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

import { createHash } from "crypto";
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
 * Verify agent identity against the envelope's identity_context.
 * MUST be called before any step execution.
 *
 * On mismatch: quarantines the envelope and returns verified=false.
 */
/**
 * Resolve identity_context for a step agent (multi-agent envelopes).
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

  // Recompute fingerprint from canonical_identity_json
  const recomputedFingerprint = computeFingerprint(agent.canonical_identity_json);

  // Compare with envelope's expected fingerprint
  const expectedFingerprint = envelope.identity_context.identity_fingerprint;

  if (recomputedFingerprint !== expectedFingerprint) {
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
  const fingerprint = computeFingerprint(agent.canonical_identity_json);

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
