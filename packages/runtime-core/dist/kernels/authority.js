"use strict";
/**
 * Authority Kernel — Phase 2
 *
 * Lease is EMBEDDED inside execution_envelopes.authority_lease.
 * No separate leases collection.
 *
 * Rules:
 * - If no lease → acquire
 * - If lease expired → acquire (replace)
 * - If lease active AND different instance → STOP (quarantine = fork detected)
 * - Lease MUST be checked before EVERY step
 *
 * Phase 2 | Envelope-Driven Runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireLease = acquireLease;
exports.releaseLease = releaseLease;
exports.hasValidLease = hasValidLease;
exports.expireStaleLeases = expireStaleLeases;
const db_1 = require("../db");
const constants_1 = require("../constants");
const hash_1 = require("../hash");
/**
 * Acquire a time-bound execution lease embedded in the envelope.
 * Uses Firestore transaction to prevent race conditions.
 *
 * @param envelopeId  - ID of the envelope to lease
 * @param instanceId  - Unique ID for this runtime instance
 * @param durationSeconds - Lease duration (clamped to MAX_LEASE_DURATION_SECONDS)
 */
async function acquireLease(envelopeId, instanceId, durationSeconds = constants_1.DEFAULT_LEASE_DURATION_SECONDS) {
    const db = (0, db_1.getDb)();
    const envelopeRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    const duration = Math.min(durationSeconds, constants_1.MAX_LEASE_DURATION_SECONDS);
    const now = new Date();
    return db.runTransaction(async (tx) => {
        console.log(`[AUTHORITY] Starting transaction for envelope: ${envelopeId}`);
        const snap = await tx.get(envelopeRef);
        if (!snap.exists) {
            console.error(`[AUTHORITY] Envelope ${envelopeId} not found in Firestore.`);
            throw new Error(`Envelope ${envelopeId} not found`);
        }
        const envelope = snap.data();
        const existing = envelope.authority_lease;
        console.log(`[AUTHORITY] Envelope status: ${envelope.status}, Existing lease:`, existing);
        // Check for fork: active lease held by DIFFERENT instance
        if (existing && new Date(existing.expires_at) > now) {
            if (existing.holder_instance_id !== instanceId) {
                console.warn(`[AUTHORITY] FORK DETECTED for ${envelopeId}. Current holder: ${existing.holder_instance_id}, New instance: ${instanceId}`);
                // FORK DETECTED — quarantine immediately
                tx.update(envelopeRef, {
                    status: "quarantined",
                    updated_at: now.toISOString(),
                });
                await logAuthorityTrace(envelopeId, instanceId, "LEASE_FORK_DETECTED", {
                    conflicting_instance: existing.holder_instance_id,
                });
                return {
                    acquired: false,
                    authority_lease: null,
                    reason: "fork_detected",
                };
            }
            console.log(`[AUTHORITY] Lease already held by instance: ${instanceId}`);
            // Same instance — lease already held, return existing
            return {
                acquired: true,
                authority_lease: existing,
                reason: "already_held",
            };
        }
        // No lease or lease expired — acquire new lease
        const expiresAt = new Date(now.getTime() + duration * 1000).toISOString();
        const newLease = {
            holder_instance_id: instanceId,
            leased_at: now.toISOString(),
            expires_at: expiresAt,
        };
        console.log(`[AUTHORITY] Acquiring new lease for ${envelopeId}, instance: ${instanceId}, expires at: ${expiresAt}`);
        tx.update(envelopeRef, {
            authority_lease: newLease,
            status: "leased",
            updated_at: now.toISOString(),
        });
        await logAuthorityTrace(envelopeId, instanceId, "LEASE_ACQUIRED", {
            expires_at: expiresAt,
            duration_seconds: duration,
        });
        console.log(`[AUTHORITY] Lease acquired successfully for ${envelopeId}`);
        return {
            acquired: true,
            authority_lease: newLease,
            reason: "ok",
        };
    });
}
/**
 * Release the lease embedded in the envelope.
 * Clears authority_lease field.
 */
async function releaseLease(envelopeId, instanceId) {
    const db = (0, db_1.getDb)();
    const envelopeRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    const snap = await envelopeRef.get();
    if (!snap.exists)
        return false;
    const envelope = snap.data();
    if (!envelope.authority_lease)
        return false;
    // Only the holder can release
    if (envelope.authority_lease.holder_instance_id !== instanceId) {
        return false;
    }
    await envelopeRef.update({
        authority_lease: null,
        updated_at: new Date().toISOString(),
    });
    await logAuthorityTrace(envelopeId, instanceId, "LEASE_RELEASED", {});
    return true;
}
/**
 * Check if the envelope has a valid (non-expired) lease for a given instance.
 * Must be called BEFORE every step execution.
 */
function hasValidLease(envelope, instanceId) {
    const lease = envelope.authority_lease;
    if (!lease)
        return false;
    if (lease.holder_instance_id !== instanceId)
        return false;
    return new Date(lease.expires_at) > new Date();
}
/**
 * Log an authority event to execution_traces.
 */
async function logAuthorityTrace(envelopeId, instanceId, eventType, metadata) {
    const traceId = (0, hash_1.generateTraceId)(eventType);
    await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
        trace_id: traceId,
        envelope_id: envelopeId,
        agent_id: instanceId,
        identity_fingerprint: "",
        event_type: eventType,
        timestamp: new Date().toISOString(),
        metadata,
    });
}
/**
 * Phase 2 stub — stale lease cleanup is performed directly by the cron route
 * by scanning execution_envelopes with expired embedded leases.
 * Kept here for backward-compat; returns 0 (no-op).
 */
async function expireStaleLeases() {
    // No-op: Phase 2 cleanup in /api/cron/lease-cleanup/route.ts
    return 0;
}
//# sourceMappingURL=authority.js.map