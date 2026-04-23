/**
 * Identity Kernel — Phase 2
 *
 * Verifies agent identity by:
 * 1. Loading agent from agents/{agent_id}
 * 2. Recomputing SHA-256 fingerprint from canonical_identity_json
 * 3. Comparing with envelope.identity_context.identity_fingerprint
 *
 * On mismatch → set envelope.status = "quarantined", stop execution.
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import { createHash, randomBytes } from "crypto";
import { getDb } from "../db";
import { COLLECTIONS } from "../constants";
import { generateTraceId } from "../hash";
import type {
  ExecutionEnvelope,
  AgentIdentity,
  IdentityContext,
  IdentityVerifyResult,
} from "../types";
// Lazy import to avoid circular dep — state-machine imports db, not identity
let _transition: typeof import("../state-machine")["transition"] | null = null;
async function getTransition() {
  if (!_transition) {
    const sm = await import("../state-machine");
    _transition = sm.transition;
  }
  return _transition;
}

/**
 * Resolve identity_context for a step agent (multi-agent envelopes), then verify.
 */
export async function verifyIdentityForAgent(
  envelopeId: string,
  envelope: ExecutionEnvelope,
  agentId: string
): Promise<IdentityVerifyResult> {
  const ctx = envelope.identity_contexts?.[agentId] || null;
  if (!ctx) {
    await quarantineEnvelope(envelopeId, "IDENTITY_CONTEXT_MISSING");
    await logIdentityTrace(envelopeId, agentId, "", "IDENTITY_CONTEXT_MISSING");
    return {
      verified: false,
      agent_id: agentId,
      identity_fingerprint: "",
      reason: "IDENTITY_CONTEXT_MISSING",
      verified_at: new Date().toISOString(),
    };
  }

  return verifyIdentity(envelopeId, agentId, ctx.identity_fingerprint);
}

/** Verify a single agent against a specific fingerprint (quarantines on mismatch). */
export async function verifyIdentity(
  envelopeId: string,
  agentId: string,
  expectedFingerprint: string
): Promise<IdentityVerifyResult> {
  const now = new Date().toISOString();

  // Load agent from agents collection
  const agentDoc = await getDb()
    .collection(COLLECTIONS.AGENTS)
    .doc(agentId)
    .get();

  if (!agentDoc.exists) {
    // AUDIT FIX P0#3: No silent bypass — AGENT_NOT_FOUND always quarantines in prod.
    await quarantineEnvelope(envelopeId, "AGENT_NOT_FOUND");
    await logIdentityTrace(envelopeId, agentId, "", "IDENTITY_AGENT_NOT_FOUND");
    return { verified: false, agent_id: agentId, identity_fingerprint: "", reason: "AGENT_NOT_FOUND", verified_at: now };
  }

  const agent = agentDoc.data() as AgentIdentity;

  if (!agent.canonical_identity_json) {
    await quarantineEnvelope(envelopeId, "IDENTITY_DATA_MISSING");
    return { verified: false, agent_id: agentId, identity_fingerprint: "", reason: "IDENTITY_DATA_MISSING", verified_at: now };
  }

  // Recompute fingerprint from canonical_identity_json
  const canonicalRaw = agent.canonical_identity_json;
  const canonicalStr = typeof canonicalRaw === "string" ? canonicalRaw : JSON.stringify(canonicalRaw);
  const recomputedFingerprint = computeFingerprint(canonicalStr);

  // RULE: Missing identity_fingerprint on envelope is a hard failure.
  if (!expectedFingerprint) {
    await quarantineEnvelope(envelopeId, "GUARD_IDENTITY_FINGERPRINT_MISSING");
    await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_FINGERPRINT_MISSING");
    return { verified: false, agent_id: agentId, identity_fingerprint: recomputedFingerprint, reason: "IDENTITY_FINGERPRINT_MISSING", verified_at: now };
  }

  // AUDIT FIX P0#3: pending_verification is NOT a valid production fingerprint.
  // Gate behind env flag — fail CLOSED in prod (ALLOW_PENDING_IDENTITY not set).
  if (expectedFingerprint === "pending_verification") {
    if (process.env.ALLOW_PENDING_IDENTITY === "true") {
      console.warn(
        `[IDENTITY] WARNING: pending_verification allowed for ${agentId} — dev mode only. ` +
        `Set ALLOW_PENDING_IDENTITY=false for production.`
      );
      // continue to success path below
    } else {
      await quarantineEnvelope(envelopeId, "IDENTITY_NOT_VERIFIED");
      await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_PENDING_REJECTED");
      return {
        verified: false,
        agent_id: agentId,
        identity_fingerprint: recomputedFingerprint,
        reason: "IDENTITY_NOT_VERIFIED",
        verified_at: now,
      };
    }
  } else if (recomputedFingerprint !== expectedFingerprint) {
    await quarantineEnvelope(envelopeId, "IDENTITY_FINGERPRINT_MISMATCH");
    await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_FINGERPRINT_MISMATCH");
    return {
      verified: false,
      agent_id: agentId,
      identity_fingerprint: recomputedFingerprint,
      reason: "IDENTITY_FINGERPRINT_MISMATCH",
      verified_at: now,
    };
  }

  // Update last_verified_at on agent record
  await getDb()
    .collection(COLLECTIONS.AGENTS)
    .doc(agentId)
    .update({ last_verified_at: now });

  await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_VERIFIED");

  return { verified: true, agent_id: agentId, identity_fingerprint: recomputedFingerprint, verified_at: now };
}

/**
 * Build an IdentityContext from a stored agent record.
 * Used when creating a new envelope.
 */
export async function buildIdentityContext(agentId: string): Promise<IdentityContext | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.AGENTS)
    .doc(agentId)
    .get();

  if (!doc.exists) return null;

  const agent = doc.data() as AgentIdentity;
  if (!agent.canonical_identity_json) return null;
  
  const canonicalRaw = agent.canonical_identity_json;
  const canonicalStr = typeof canonicalRaw === "string" ? canonicalRaw : JSON.stringify(canonicalRaw);
  const fingerprint = computeFingerprint(canonicalStr);

  return {
    agent_id: agent.agent_id,
    identity_fingerprint: fingerprint,
    verified: agent.last_verified_at != null || (agent as any).verified === true,
    verified_at: agent.last_verified_at ?? undefined,
  };
}

/**
 * Compute SHA-256 fingerprint of canonical_identity_json.
 */
export function computeFingerprint(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Register a new agent identity.
 * Handles canonical JSON generation, fingerprinting, and persistence.
 */
export async function registerAgentIdentity(params: {
  display_name: string;
  role: string;
  mission: string;
  org_id: string;
  agent_id?: string;
  tier?: string;
}): Promise<{ agent_id: string; identity_fingerprint: string }> {
  const { display_name, role, mission, org_id, tier = "builder" } = params;

  // 1. Generate or validate agent_id
  const slug = display_name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
  const suffix = randomBytes(3).toString("hex");
  const agent_id = params.agent_id || `agent_${slug}_${suffix}`;

  // 2. Build canonical JSON (the source of truth for the hash)
  const canonical_identity = {
    agent_id,
    display_name,
    role,
    mission,
    org_id,
    created_at: new Date().toISOString(),
  };
  const canonical_identity_json = JSON.stringify(canonical_identity);

  // 3. Compute Fingerprint
  const identity_fingerprint = computeFingerprint(canonical_identity_json);

  // 4. Persist to Firestore
  const agentData: AgentIdentity = {
    agent_id,
    display_name,
    canonical_identity_json,
    identity_fingerprint,
    fingerprint: identity_fingerprint, // UI compat alias
    agent_class: role,
    jurisdiction: "ACEPLACE-AGENTSPACE",
    mission,
    tier: (tier as unknown) as number, // Compat with existing schema
    created_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
  };

  await getDb()
    .collection(COLLECTIONS.AGENTS)
    .doc(agent_id)
    .set(agentData);

  return { agent_id, identity_fingerprint };
}

/**
 * Remove an agent identity record and its associated data.
 */
export async function deleteAgentIdentity(agentId: string): Promise<void> {
  const { deleteAgent } = await import("../kernels/persistence");
  await deleteAgent(agentId);
}

/**
 * Quarantine an envelope — routes THROUGH the state machine so that:
 *   1. The transition is validated (legal from current state)
 *   2. A STATUS_TRANSITION_QUARANTINED trace is always written
 *
 * AUDIT FIX P0#4: Never write quarantined status directly — always via state machine.
 */
async function quarantineEnvelope(envelopeId: string, reason: string): Promise<void> {
  try {
    const transitionFn = await getTransition();
    await transitionFn(envelopeId, "quarantined", { reason });
  } catch (smErr: any) {
    // If state machine rejects the transition (e.g. already terminal),
    // fall back to direct write to guarantee the record is marked quarantined.
    // This is the ONLY acceptable direct-write path.
    console.warn(
      `[IDENTITY] State machine rejected quarantine transition for ${envelopeId} (${smErr?.message}). ` +
      `Applying direct fallback.`
    );
    await getDb()
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .doc(envelopeId)
      .update({
        status: "quarantined",
        updated_at: new Date().toISOString(),
        quarantine_reason: reason,
      });
    // Still write an explicit trace for the fallback path
    const traceId = generateTraceId("QUARANTINED_FALLBACK");
    await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
      trace_id: traceId,
      envelope_id: envelopeId,
      agent_id: "system",
      identity_fingerprint: "",
      event_type: "ENVELOPE_QUARANTINED",
      timestamp: new Date().toISOString(),
      metadata: { reason, fallback: true },
    });
  }
}

/**
 * Log an identity event to execution_traces.
 */
async function logIdentityTrace(
  envelopeId: string,
  agentId: string,
  fingerprint: string,
  eventType: string
): Promise<void> {
  const traceId = generateTraceId(eventType);
  await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
    trace_id: traceId,
    envelope_id: envelopeId,
    agent_id: agentId,
    identity_fingerprint: fingerprint,
    event_type: eventType,
    timestamp: new Date().toISOString(),
  });
}
