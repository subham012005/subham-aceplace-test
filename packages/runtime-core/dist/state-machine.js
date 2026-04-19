"use strict";
/**
 * State Machine — Phase 2
 *
 * Enforces strict envelope status transitions.
 * All transitions are atomic (Firestore transaction).
 * No state can be skipped.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transition = transition;
exports.canTransition = canTransition;
const db_1 = require("./db");
const constants_1 = require("./constants");
const hash_1 = require("./hash");
/**
 * Transition an envelope to a new status.
 * Throws if the transition is not valid from the current state.
 * Uses Firestore transaction for atomicity.
 */
async function transition(envelopeId, newStatus, metadata) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    const now = new Date().toISOString();
    let traceAgentId = metadata?.agent_id || "runtime_worker";
    let traceFingerprint = "0000000000000000000000000000000000000000000000000000000000000000";
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error(`Envelope ${envelopeId} not found`);
        const envelope = snap.data();
        const currentStatus = envelope.status;
        // Idempotency: if already in the target state, do nothing.
        if (currentStatus === newStatus)
            return;
        if (!metadata?.agent_id) {
            traceAgentId = envelope.coordinator_agent_id || envelope.identity_context?.agent_id || "runtime_worker";
        }
        if (traceAgentId !== "runtime_worker") {
            const fp = envelope.multi_agent && envelope.identity_contexts?.[traceAgentId]
                ? envelope.identity_contexts[traceAgentId]?.identity_fingerprint
                : envelope.identity_context?.identity_fingerprint;
            if (fp)
                traceFingerprint = fp;
        }
        const allowed = constants_1.ENVELOPE_STATUS_TRANSITIONS[currentStatus];
        // Hard guard: leased -> planned is strictly forbidden in Phase 2
        if (currentStatus === "leased" && newStatus === "planned") {
            throw new Error(`[StateMachine] INVALID_FLOW: leased cannot return to planned. ` +
                `Current: ${currentStatus}, Requested: ${newStatus}`);
        }
        if (!allowed.includes(newStatus)) {
            throw new Error(`[StateMachine] Illegal transition: ${currentStatus} → ${newStatus}. ` +
                `Allowed from ${currentStatus}: [${allowed.join(", ")}]`);
        }
        tx.update(ref, { status: newStatus, updated_at: now });
        // Sync legacy jobs collection if job_id is present
        if (envelope.job_id) {
            const jobRef = db.collection(constants_1.COLLECTIONS.JOBS).doc(envelope.job_id);
            const jobUpdate = { status: newStatus, updated_at: now };
            if (newStatus === "failed" && metadata?.reason) {
                jobUpdate.failure_reason = String(metadata.reason);
            }
            tx.set(jobRef, jobUpdate, { merge: true });
        }
        // Sync execution_queue status
        const queueRef = db.collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envelopeId);
        const terminalStatuses = ["completed", "failed", "quarantined", "rejected"];
        if (terminalStatuses.includes(newStatus)) {
            // For terminal states, we can either delete or mark as terminal. 
            // Mark as terminal is better for audit consistency.
            tx.set(queueRef, { status: newStatus, updated_at: now }, { merge: true });
        }
        else {
            tx.set(queueRef, { status: newStatus, updated_at: now }, { merge: true });
        }
    });
    // Log the transition
    const traceId = (0, hash_1.generateTraceId)(`TRANSITION_${newStatus.toUpperCase()}`);
    await db.collection(constants_1.COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
        trace_id: traceId,
        envelope_id: envelopeId,
        step_id: metadata?.step_id || "",
        agent_id: traceAgentId,
        identity_fingerprint: traceFingerprint,
        event_type: `STATUS_TRANSITION_${newStatus.toUpperCase()}`,
        timestamp: now,
        metadata: metadata ?? {},
    });
}
/**
 * Validate that a transition is legal WITHOUT performing it.
 * Use for preflight checks.
 */
function canTransition(currentStatus, newStatus) {
    return constants_1.ENVELOPE_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
//# sourceMappingURL=state-machine.js.map