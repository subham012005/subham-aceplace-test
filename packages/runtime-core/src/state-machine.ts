/**
 * State Machine — Phase 2
 *
 * Enforces strict envelope status transitions.
 * All transitions are atomic (Firestore transaction).
 * No state can be skipped.
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import { getDb } from "./db";
import { COLLECTIONS, ENVELOPE_STATUS_TRANSITIONS } from "./constants";
import { generateTraceId } from "./hash";
import type { EnvelopeStatus, ExecutionEnvelope } from "./types";

/**
 * Transition an envelope to a new status.
 * Throws if the transition is not valid from the current state.
 * Uses Firestore transaction for atomicity.
 */
export async function transition(
  envelopeId: string,
  newStatus: EnvelopeStatus,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  const now = new Date().toISOString();

  let traceAgentId = (metadata?.agent_id as string) || "runtime_worker";
  let traceFingerprint = "0000000000000000000000000000000000000000000000000000000000000000";

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`Envelope ${envelopeId} not found`);

    const envelope = snap.data() as ExecutionEnvelope;
    const currentStatus = envelope.status;

    // Idempotency: if already in the target state, do nothing.
    if (currentStatus === newStatus) return;

    if (!metadata?.agent_id) {
       traceAgentId = envelope.coordinator_agent_id || Object.keys(envelope.identity_contexts || {})[0] || "runtime_worker";
    }
    if (traceAgentId !== "runtime_worker") {
        const fp = envelope.identity_contexts?.[traceAgentId]?.identity_fingerprint;
        if (fp) traceFingerprint = fp;
    }

    const allowed = ENVELOPE_STATUS_TRANSITIONS[currentStatus];
    
    // Hard guard: leased -> planned is strictly forbidden in Phase 2
    if (currentStatus === "leased" && newStatus === "planned") {
      throw new Error(
        `[StateMachine] INVALID_FLOW: leased cannot return to planned. ` +
        `Current: ${currentStatus}, Requested: ${newStatus}`
      );
    }

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `[StateMachine] Illegal transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed from ${currentStatus}: [${allowed.join(", ")}]`
      );
    }

    const updates: Partial<ExecutionEnvelope> = { status: newStatus, updated_at: now };
    const failureReason = (metadata?.error || metadata?.reason) as string;
    
    if (newStatus === "failed" && failureReason) {
      updates.failure_reason = failureReason;
    }

    tx.update(ref, updates);

    // Sync legacy jobs collection if job_id is present
    if (envelope.job_id) {
      const jobRef = db.collection(COLLECTIONS.JOBS).doc(envelope.job_id);
      const jobUpdate: Record<string, unknown> = { status: newStatus, updated_at: now };
      if (newStatus === "failed" && failureReason) {
        jobUpdate.failure_reason = failureReason;
      }
      tx.set(jobRef, jobUpdate, { merge: true });
    }

    // Sync execution_queue status
    const queueRef = db.collection(COLLECTIONS.EXECUTION_QUEUE).doc(envelopeId);
    
    tx.set(queueRef, { status: newStatus, updated_at: now }, { merge: true });

    // Log the transition
    const traceId = generateTraceId(`TRANSITION_${newStatus.toUpperCase()}`);
    tx.set(db.collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId), {
      trace_id: traceId,
      envelope_id: envelopeId,
      step_id: (metadata?.step_id as string) || "",
      agent_id: traceAgentId,
      identity_fingerprint: traceFingerprint,
      event_type: `STATUS_TRANSITION_${newStatus.toUpperCase()}`,
      user_id: envelope.user_id || "",
      timestamp: now,
      metadata: metadata ?? {},
    });
  });
}

/**
 * Validate that a transition is legal WITHOUT performing it.
 * Use for preflight checks.
 */
export function canTransition(
  currentStatus: EnvelopeStatus,
  newStatus: EnvelopeStatus
): boolean {
  return ENVELOPE_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
