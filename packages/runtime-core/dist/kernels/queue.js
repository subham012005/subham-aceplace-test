"use strict";
/**
 * Queue Kernel — Phase 2
 *
 * Manages the execution_queue collection.
 * Ported from runtime-worker to allow library-level access and testing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimNextEnvelope = claimNextEnvelope;
exports.requeueEnvelope = requeueEnvelope;
exports.finalizeQueueEntry = finalizeQueueEntry;
const db_1 = require("../db");
const constants_1 = require("../constants");
const EXECUTION_QUEUE_COLLECTION = constants_1.COLLECTIONS.EXECUTION_QUEUE;
/**
 * Claim the next available envelope from the queue.
 * Implements strict 4-part AND condition for reclamation.
 */
async function claimNextEnvelope(workerId) {
    const db = (0, db_1.getDb)();
    const now = Date.now();
    const staleTime = now - constants_1.STALE_CLAIM_THRESHOLD_MS;
    const nowIso = new Date().toISOString();
    // 1. Initial Polling — look for strictly queued OR stale claimed
    let snapshot = await db
        .collection(EXECUTION_QUEUE_COLLECTION)
        .where("status", "==", "queued")
        .limit(1)
        .get();
    if (snapshot.empty) {
        // AUDIT FIX: To avoid FAILED_PRECONDITION on new collection names without composite indexes,
        // we fetch recently claimed entries and filter for staleness in memory.
        const claimedSnap = await db
            .collection(EXECUTION_QUEUE_COLLECTION)
            .where("status", "==", "claimed")
            .limit(10) // Small batch
            .get();
        const staleDoc = claimedSnap.docs.find(d => {
            const data = d.data();
            return new Date(data.updated_at).getTime() < staleTime;
        });
        if (staleDoc) {
            snapshot = { empty: false, docs: [staleDoc] };
        }
    }
    if (snapshot.empty)
        return null;
    const doc = snapshot.docs[0];
    const qData = doc.data();
    const envId = qData.envelope_id;
    // 2. Atomic claim — verifies strict reclaim eligibility
    try {
        const claimed = await db.runTransaction(async (tx) => {
            const qSnap = await tx.get(doc.ref);
            if (!qSnap.exists)
                return null;
            const qLive = qSnap.data();
            const isQueued = qLive?.status === "queued";
            const isStale = qLive?.status === "claimed" &&
                new Date(qLive?.updated_at).getTime() < staleTime;
            if (!isQueued && !isStale)
                return null;
            // Check Envelope for terminality and lease state
            const envRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId);
            const envSnap = await tx.get(envRef);
            if (!envSnap.exists)
                return null;
            const envData = envSnap.data();
            // Rule: Non-terminal
            const terminal = ["approved", "completed", "rejected", "failed", "quarantined", "awaiting_human"];
            if (terminal.includes(envData.status))
                return null;
            // Rule: Lease stale (if it's a reclaim)
            if (isStale) {
                const leases = envData.authority_leases || {};
                const anyActiveLease = Object.values(leases).some(lease => {
                    if (!lease)
                        return false;
                    if (lease.status !== "active")
                        return false;
                    return new Date(lease.lease_expires_at).getTime() > now;
                });
                if (anyActiveLease)
                    return null;
            }
            tx.update(doc.ref, {
                status: "claimed",
                claimed_by: workerId,
                claimed_at: nowIso,
                updated_at: nowIso,
            });
            return { envelope_id: envId };
        });
        return claimed;
    }
    catch (err) {
        return null;
    }
}
/**
 * Reset queue entry to queued and clear ALL ownership fields.
 */
async function requeueEnvelope(envelopeId) {
    await (0, db_1.getDb)()
        .collection(EXECUTION_QUEUE_COLLECTION)
        .doc(envelopeId)
        .update({
        status: "queued",
        claimed_by: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
    });
}
/**
 * Mark queue entry as finalized (completed or failed).
 */
async function finalizeQueueEntry(envelopeId, status, error) {
    const db = (0, db_1.getDb)();
    await db
        .collection(EXECUTION_QUEUE_COLLECTION)
        .doc(envelopeId)
        .update({
        status,
        finalized_at: new Date().toISOString(),
        ...(error ? { error } : {}),
    });
}
//# sourceMappingURL=queue.js.map