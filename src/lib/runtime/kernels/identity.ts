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

/**
 * Resolve identity_context for a step agent (multi-agent envelopes), then verify.
 */
export async function verifyIdentityForAgent(
  envelopeId: string,
  envelope: ExecutionEnvelope,
  agentId: string
): Promise<IdentityVerifyResult> {
  const ctx =
    envelope.multi_agent && envelope.identity_contexts?.[agentId]
      ? envelope.identity_contexts[agentId]
      : envelope.identity_context.agent_id === agentId
        ? envelope.identity_context
        : null;
  if (!ctx) {
    return {
      verified: false,
      agent_id: agentId,
      reason: "IDENTITY_CONTEXT_MISSING",
      verified_at: new Date().toISOString(),
    };
  }
  const synthetic: ExecutionEnvelope = {
    ...envelope,
    identity_context: {
      ...ctx,
      agent_id: ctx.agent_id || agentId,
      verified: ctx.verified ?? true,
    },
  };
  return verifyIdentity(envelopeId, agentId, synthetic);
}

/** Verify a single agent against envelope.identity_context (quarantines on mismatch). */
export async function verifyIdentity(
  envelopeId: string,
  agentId: string,
  envelope: ExecutionEnvelope
): Promise<IdentityVerifyResult> {
  const now = new Date().toISOString();

  // Load agent from agents collection
  const agentDoc = await getDb()
    .collection(COLLECTIONS.AGENTS)
    .doc(agentId)
    .get();

  if (!agentDoc.exists) {
    if (envelope.identity_context.identity_fingerprint === "pending_verification") {
      return { verified: true, agent_id: agentId, verified_at: now };
    }
    await quarantineEnvelope(envelopeId, "AGENT_NOT_FOUND");
    await logIdentityTrace(envelopeId, agentId, "", "IDENTITY_AGENT_NOT_FOUND");
    return { verified: false, agent_id: agentId, reason: "AGENT_NOT_FOUND", verified_at: now };
  }

  const agent = agentDoc.data() as AgentIdentity;

  if (!agent.canonical_identity_json) {
    await quarantineEnvelope(envelopeId, "IDENTITY_DATA_MISSING");
    return { verified: false, agent_id: agentId, reason: "IDENTITY_DATA_MISSING", verified_at: now };
  }

  // Recompute fingerprint from canonical_identity_json
  const canonicalRaw = agent.canonical_identity_json;
  const canonicalStr = typeof canonicalRaw === "string" ? canonicalRaw : JSON.stringify(canonicalRaw);
  const recomputedFingerprint = computeFingerprint(canonicalStr);

  // Compare with envelope's expected fingerprint
  const expectedFingerprint = envelope.identity_context.identity_fingerprint;

  if (expectedFingerprint === "pending_verification") {
    // Pass verification; they are allowed to execute using their verified credential lease logic
  } else if (recomputedFingerprint !== expectedFingerprint) {
    await quarantineEnvelope(envelopeId, "IDENTITY_FINGERPRINT_MISMATCH");
    await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_FINGERPRINT_MISMATCH");
    return {
      verified: false,
      agent_id: agentId,
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

  return { verified: true, agent_id: agentId, verified_at: now };
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
    verified: true,
    verified_at: new Date().toISOString(),
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
    jurisdiction: "NXQ-AGENTSPACE",
    mission,
    tier: (tier as unknown) as number, // Compat with existing schema
    created_at: new Date().toISOString(),
    last_verified_at: null as any,
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
 * Quarantine an envelope — sets status to "quarantined" atomically.
 */
async function quarantineEnvelope(envelopeId: string, reason: string): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .doc(envelopeId)
    .update({
      status: "quarantined",
      updated_at: new Date().toISOString(),
    });

  const traceId = generateTraceId("QUARANTINED");
  await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
    trace_id: traceId,
    envelope_id: envelopeId,
    agent_id: "system",
    identity_fingerprint: "",
    event_type: "ENVELOPE_QUARANTINED",
    timestamp: new Date().toISOString(),
    metadata: { reason },
  });
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
