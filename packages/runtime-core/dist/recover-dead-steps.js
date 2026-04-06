"use strict";
/**
 * Dead-Step Recovery Engine — Phase 2 Hardening
 *
 * Scans for steps stuck in 'executing' state where the owner instance has crashed
 * or the lease has expired. Reclaims these steps by resetting them to 'ready'
 * or marking them as 'failed' if retries are exhausted.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverGlobalDeadSteps = recoverGlobalDeadSteps;
exports.recoverEnvelopeDeadSteps = recoverEnvelopeDeadSteps;
const db_1 = require("./db");
const constants_1 = require("./constants");
const state_machine_1 = require("./state-machine");
const emitRuntimeMetric_1 = require("./telemetry/emitRuntimeMetric");
const DEFAULT_STALE_THRESHOLD_MS = 90_000; // 90 seconds
/**
 * Scan all executing envelopes and recover any dead steps.
 */
async function recoverGlobalDeadSteps(params) {
    const db = (0, db_1.getDb)();
    const threshold = params?.stale_threshold_ms ?? DEFAULT_STALE_THRESHOLD_MS;
    const limit = params?.limit ?? 50;
    const snapshot = await db
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .where("status", "==", "executing")
        .limit(limit)
        .get();
    console.log(`[RECOVERY] Scanning ${snapshot.size} envelopes for dead steps...`);
    for (const doc of snapshot.docs) {
        await recoverEnvelopeDeadSteps(doc.id, threshold).catch((err) => {
            console.error(`[RECOVERY] Failed to recover envelope ${doc.id}:`, err);
        });
    }
}
/**
 * Recover dead steps for a single envelope.
 */
async function recoverEnvelopeDeadSteps(envelopeId, staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return null;
        const envelope = snap.data();
        const steps = envelope.steps || [];
        const now = Date.now();
        let changed = false;
        let recoveredCount = 0;
        let failedCount = 0;
        const nextSteps = steps.map((step) => {
            // Only check steps that are currently being executed
            if (step.status !== "executing")
                return step;
            if (!step.claimed_at)
                return step;
            const claimedAt = new Date(step.claimed_at).getTime();
            const isStale = now - claimedAt > staleThresholdMs;
            if (!isStale)
                return step;
            // Check if the agent's lease is still valid
            const lease = envelope.authority_leases?.[step.assigned_agent_id];
            const leaseExpired = isLeaseExpired(lease, now);
            // If lease is still active, the instance might just be slow; don't reclaim yet
            if (!leaseExpired)
                return step;
            // Reclaim the step
            changed = true;
            const nextRetry = (step.retry_count || 0) + 1;
            const maxRetries = step.max_retries ?? 2;
            if (nextRetry <= maxRetries) {
                recoveredCount++;
                return {
                    ...step,
                    status: "ready",
                    retry_count: nextRetry,
                    claimed_by_instance_id: null,
                    claimed_at: null,
                    updated_at: new Date().toISOString(),
                };
            }
            else {
                failedCount++;
                return {
                    ...step,
                    status: "failed",
                    retry_count: nextRetry,
                    claimed_by_instance_id: null,
                    claimed_at: null,
                    updated_at: new Date().toISOString(),
                };
            }
        });
        if (!changed)
            return { changed: false };
        tx.update(ref, {
            steps: nextSteps,
            updated_at: new Date().toISOString(),
        });
        return {
            changed: true,
            recoveredCount,
            failedCount,
            envelope,
        };
    });
    if (result && result.changed) {
        const recoveredCount = result.recoveredCount || 0;
        const failedCount = result.failedCount || 0;
        console.log(`[RECOVERY] Envelope ${envelopeId}: Recovered ${recoveredCount}, Failed ${failedCount}`);
        if (recoveredCount > 0) {
            await (0, emitRuntimeMetric_1.emitRuntimeMetric)({
                event_type: "DEAD_STEP_RECOVERED",
                envelope_id: envelopeId,
                metadata: { count: recoveredCount },
            }).catch(() => undefined);
        }
        // If a step permanently failed, fail the envelope
        if (failedCount > 0) {
            await (0, state_machine_1.transition)(envelopeId, "failed", {
                reason: "DEAD_STEP_RECOVERY_EXHAUSTED",
                failed_steps_count: failedCount,
            }).catch(() => undefined);
        }
    }
}
function isLeaseExpired(lease, nowMs) {
    if (!lease)
        return true;
    if (lease.status === "expired" || lease.status === "revoked")
        return true;
    const expiry = new Date(lease.lease_expires_at).getTime();
    return expiry < nowMs;
}
//# sourceMappingURL=recover-dead-steps.js.map