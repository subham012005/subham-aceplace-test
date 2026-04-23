"use strict";
/**
 * Per-agent authority leases on execution_envelopes.authority_leases[agent_id]
 * (ACEPLACE RUNTIME spec).
 *
 * AUDIT FIX P0#4:
 *   This module NEVER writes terminal envelope states (quarantined, failed, etc.).
 *   On fork detection it throws the domain error FORK_DETECTED.
 *   The caller (parallel-runner.ts) is responsible for routing that error
 *   through the state machine via transition().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquirePerAgentLease = acquirePerAgentLease;
exports.validatePerAgentLease = validatePerAgentLease;
exports.renewPerAgentLease = renewPerAgentLease;
exports.releasePerAgentLease = releasePerAgentLease;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const constants_1 = require("./constants");
const persistence_1 = require("./kernels/persistence");
async function acquirePerAgentLease(envelopeId, agentId, instanceId, options) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    const leaseDurationMs = (options?.durationSeconds ?? constants_1.DEFAULT_LEASE_DURATION_SECONDS) * 1000;
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const existing = envelope.authority_leases?.[agentId];
        const now = Date.now();
        const nowIso = new Date().toISOString();
        if (existing && existing.status !== "expired" && existing.status !== "revoked") {
            const exp = new Date(existing.lease_expires_at).getTime();
            if (exp > now && existing.current_instance_id === instanceId) {
                if (!options?.forceRenew && (exp - now) >= constants_1.STEP_EXECUTION_MIN_WINDOW_MS) {
                    return existing;
                }
                const expiresAt = new Date(now + leaseDurationMs).toISOString();
                const lease = {
                    ...existing,
                    lease_expires_at: expiresAt,
                    last_renewed_at: nowIso,
                    status: "active",
                };
                tx.update(ref, {
                    [`authority_leases.${agentId}`]: lease,
                    updated_at: nowIso,
                });
                return lease;
            }
            if (exp > now && existing.current_instance_id !== instanceId) {
                throw new Error("FORK_DETECTED");
            }
        }
        const leaseId = `lease_${(0, crypto_1.randomUUID)().replace(/-/g, "")}`;
        const expiresAt = new Date(now + leaseDurationMs).toISOString();
        const lease = {
            lease_id: leaseId,
            agent_id: agentId,
            current_instance_id: instanceId,
            lease_expires_at: expiresAt,
            acquired_at: nowIso,
            last_renewed_at: nowIso,
            status: "active",
        };
        const authority_leases = { ...(envelope.authority_leases || {}), [agentId]: lease };
        tx.update(ref, { authority_leases, updated_at: nowIso });
        await (0, persistence_1.addTrace)(envelopeId, "", agentId, envelope.identity_contexts?.[agentId]?.identity_fingerprint || "unknown", "LEASE_ACQUIRED", undefined, { lease_id: leaseId, instance_id: instanceId });
        return lease;
    });
}
function validatePerAgentLease(envelope, agentId, instanceId) {
    const lease = envelope.authority_leases?.[agentId];
    if (!lease)
        throw new Error(`LEASE_MISSING:${agentId}`);
    if (lease.agent_id !== agentId)
        throw new Error(`LEASE_AGENT_MISMATCH:${agentId}`);
    if (lease.current_instance_id !== instanceId)
        throw new Error(`LEASE_INSTANCE_MISMATCH:${agentId}`);
    if (lease.status === "expired" || lease.status === "revoked") {
        throw new Error(`LEASE_NOT_ACTIVE:${agentId}`);
    }
    if (new Date(lease.lease_expires_at).getTime() < Date.now()) {
        throw new Error(`LEASE_EXPIRED:${agentId}`);
    }
}
/** Heartbeat / explicit renew — extends lease_expires_at for active same-instance holder. */
async function renewPerAgentLease(envelopeId, agentId, instanceId, durationSeconds = constants_1.DEFAULT_LEASE_DURATION_SECONDS) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    const leaseDurationMs = durationSeconds * 1000;
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const current = envelope.authority_leases?.[agentId];
        if (!current)
            throw new Error(`LEASE_MISSING:${agentId}`);
        if (current.current_instance_id !== instanceId) {
            throw new Error(`FORK_DETECTED:${agentId}`);
        }
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + leaseDurationMs).toISOString();
        const lease = {
            ...current,
            lease_expires_at: expiresAt,
            last_renewed_at: nowIso,
            status: "active",
        };
        tx.update(ref, {
            authority_leases: { ...(envelope.authority_leases || {}), [agentId]: lease },
            updated_at: nowIso,
        });
        return lease;
    });
}
async function releasePerAgentLease(envelopeId, agentId) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return;
        const envelope = snap.data();
        const current = envelope.authority_leases?.[agentId];
        if (!current)
            return;
        const released = {
            ...current,
            status: "expired",
            lease_expires_at: new Date().toISOString(),
            last_renewed_at: new Date().toISOString(),
        };
        tx.update(ref, {
            authority_leases: { ...(envelope.authority_leases || {}), [agentId]: released },
            updated_at: new Date().toISOString(),
        });
    });
}
//# sourceMappingURL=per-agent-authority.js.map