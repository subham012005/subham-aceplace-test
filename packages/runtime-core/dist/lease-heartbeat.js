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
            (0, per_agent_authority_1.renewPerAgentLease)(params.envelope_id, params.agent_id, params.instance_id)
                .then(() => (0, emitRuntimeMetric_1.emitRuntimeMetric)({
                event_type: "LEASE_RENEWED",
                envelope_id: params.envelope_id,
                agent_id: params.agent_id,
            }).catch(() => undefined))
                .catch((err) => {
                console.error("[LEASE_HEARTBEAT_FAILED]", {
                    key,
                    error: String(err?.message || err),
                });
                (0, emitRuntimeMetric_1.emitRuntimeMetric)({
                    event_type: "LEASE_RENEW_FAILED",
                    envelope_id: params.envelope_id,
                    agent_id: params.agent_id,
                }).catch(() => undefined);
                this.stop(key);
            });
        }, intervalMs);
        this.timers.set(key, timer);
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