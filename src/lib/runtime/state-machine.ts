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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`Envelope ${envelopeId} not found`);

    const envelope = snap.data() as ExecutionEnvelope;
    const currentStatus = envelope.status;

    const allowed = ENVELOPE_STATUS_TRANSITIONS[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `[StateMachine] Illegal transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed from ${currentStatus}: [${allowed.join(", ")}]`
      );
    }

    tx.update(ref, { status: newStatus, updated_at: now });
  });

  // Log the transition
  const traceId = generateTraceId(`TRANSITION_${newStatus.toUpperCase()}`);
  await db.collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
    trace_id: traceId,
    envelope_id: envelopeId,
    step_id: "",
    agent_id: "state_machine",
    identity_fingerprint: "",
    event_type: `STATUS_TRANSITION_${newStatus.toUpperCase()}`,
    timestamp: now,
    metadata: metadata ?? {},
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
