"use strict";
/**
 * Per-step lease heartbeat (ACEPLACE RUNTIME spec) — renew before expiry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaseHeartbeatManager = exports.LeaseHeartbeatManager = void 0;
const per_agent_authority_1 = require("./per-agent-authority");
const emitRuntimeMetric_1 = require("./telemetry/emitRuntimeMetric");
class LeaseHeartbeatManager {
    timers = new Map();
    start(key, params, intervalMs = 20_000) {
        this.stop(key);
        const timer = setInterval(() => {
            this.renewWithRetry(params.envelope_id, params.agent_id, params.instance_id, key);
        }, intervalMs);
        this.timers.set(key, timer);
    }
    async renewWithRetry(envelope_id, agent_id, instance_id, key) {
        let attempt = 0;
        const maxAttempts = 3;
        while (attempt < maxAttempts) {
            try {
                await (0, per_agent_authority_1.renewPerAgentLease)(envelope_id, agent_id, instance_id);
                await (0, emitRuntimeMetric_1.emitRuntimeMetric)({
                    event_type: "LEASE_RENEWED",
                    envelope_id,
                    agent_id,
                }).catch(() => undefined);
                return;
            }
            catch (err) {
                const msg = String(err?.message || err);
                if (msg.includes("ABORTED") && attempt < maxAttempts - 1) {
                    attempt++;
                    const jitter = Math.random() * 200;
                    const delay = (500 * attempt) + jitter;
                    console.warn(`[LEASE_RETRY] Heartbeat contention (ABORTED), retrying ${attempt}/${maxAttempts - 1} in ${Math.round(delay)}ms for ${key}`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                console.error("[LEASE_HEARTBEAT_FAILED]", {
                    key,
                    error: msg,
                    exhausted: attempt >= maxAttempts - 1
                });
                (0, emitRuntimeMetric_1.emitRuntimeMetric)({
                    event_type: "LEASE_RENEW_FAILED",
                    envelope_id,
                    agent_id,
                }).catch(() => undefined);
                this.stop(key);
                return;
            }
        }
    }
    stop(key) {
        const t = this.timers.get(key);
        if (t) {
            clearInterval(t);
            this.timers.delete(key);
        }
    }
    stopAllForEnvelope(envelopeId) {
        for (const k of this.timers.keys()) {
            if (k.startsWith(`${envelopeId}:`))
                this.stop(k);
        }
    }
}
exports.LeaseHeartbeatManager = LeaseHeartbeatManager;
exports.leaseHeartbeatManager = new LeaseHeartbeatManager();
//# sourceMappingURL=lease-heartbeat.js.map