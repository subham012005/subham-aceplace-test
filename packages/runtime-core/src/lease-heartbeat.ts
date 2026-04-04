/**
 * Per-step lease heartbeat (ACEPLACE RUNTIME spec) — renew before expiry.
 */

import { renewPerAgentLease } from "./per-agent-authority";
import { emitRuntimeMetric } from "./telemetry/emitRuntimeMetric";

export class LeaseHeartbeatManager {
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  start(
    key: string,
    params: { envelope_id: string; agent_id: string; instance_id: string },
    intervalMs = 20_000
  ) {
    this.stop(key);
    const timer = setInterval(() => {
      renewPerAgentLease(params.envelope_id, params.agent_id, params.instance_id)
        .then(() =>
          emitRuntimeMetric({
            event_type: "LEASE_RENEWED",
            envelope_id: params.envelope_id,
            agent_id: params.agent_id,
          }).catch(() => undefined)
        )
        .catch((err) => {
          console.error("[LEASE_HEARTBEAT_FAILED]", {
            key,
            error: String((err as Error)?.message || err),
          });
          emitRuntimeMetric({
            event_type: "LEASE_RENEW_FAILED",
            envelope_id: params.envelope_id,
            agent_id: params.agent_id,
          }).catch(() => undefined);
          this.stop(key);
        });
    }, intervalMs);
    this.timers.set(key, timer);
  }

  stop(key: string) {
    const t = this.timers.get(key);
    if (t) {
      clearInterval(t);
      this.timers.delete(key);
    }
  }

  stopAllForEnvelope(envelopeId: string) {
    for (const k of this.timers.keys()) {
      if (k.startsWith(`${envelopeId}:`)) this.stop(k);
    }
  }
}

export const leaseHeartbeatManager = new LeaseHeartbeatManager();
