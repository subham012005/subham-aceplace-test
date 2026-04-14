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
      this.renewWithRetry(params.envelope_id, params.agent_id, params.instance_id, key);
    }, intervalMs);
    this.timers.set(key, timer);
  }

  private async renewWithRetry(envelope_id: string, agent_id: string, instance_id: string, key: string) {
    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      try {
        await renewPerAgentLease(envelope_id, agent_id, instance_id);
        await emitRuntimeMetric({
          event_type: "LEASE_RENEWED",
          envelope_id,
          agent_id,
        }).catch(() => undefined);
        return;
      } catch (err: any) {
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
        emitRuntimeMetric({
          event_type: "LEASE_RENEW_FAILED",
          envelope_id,
          agent_id,
        }).catch(() => undefined);
        this.stop(key);
        return;
      }
    }
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
