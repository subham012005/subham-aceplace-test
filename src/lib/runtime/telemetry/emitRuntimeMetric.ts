/**
 * Telemetry events + envelope/agent counter rollups (ACEPLACE spec).
 */

import { randomUUID } from "crypto";
import { getDb } from "../db";
import { COLLECTIONS } from "../constants";

export type TelemetryEventType =
  | "ENVELOPE_CREATED"
  | "ENVELOPE_COMPLETED"
  | "ENVELOPE_FAILED"
  | "STEP_CLAIMED"
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "STEP_FAILED"
  | "STEP_RETRY_SCHEDULED"
  | "LEASE_ACQUIRED"
  | "LEASE_RENEWED"
  | "LEASE_RENEW_FAILED"
  | "LEASE_RELEASED"
  | "DEAD_STEP_RECOVERED"
  | "ARTIFACT_CREATED"
  | "MESSAGE_STORED";

function num(r: Record<string, unknown>, k: string): number {
  const v = r[k];
  return typeof v === "number" ? v : 0;
}

export async function emitRuntimeMetric(params: {
  event_type: TelemetryEventType;
  envelope_id?: string | null;
  step_id?: string | null;
  agent_id?: string | null;
  org_id?: string | null;
  value?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  const event_id = `te_${randomUUID().replace(/-/g, "")}`;
  const timestamp = new Date().toISOString();

  await db
    .collection(COLLECTIONS.TELEMETRY_EVENTS)
    .doc(event_id)
    .set({
      event_id,
      event_type: params.event_type,
      envelope_id: params.envelope_id ?? null,
      step_id: params.step_id ?? null,
      agent_id: params.agent_id ?? null,
      org_id: params.org_id ?? null,
      value: params.value ?? null,
      metadata: params.metadata ?? {},
      timestamp,
    });

  if (params.envelope_id) {
    const ref = db.collection(COLLECTIONS.ENVELOPE_METRICS).doc(params.envelope_id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const base: Record<string, unknown> = snap.exists
        ? { ...(snap.data() as Record<string, unknown>) }
        : {
            envelope_id: params.envelope_id,
            org_id: params.org_id ?? null,
            steps_started: 0,
            steps_completed: 0,
            steps_failed: 0,
            steps_retried: 0,
            artifacts_created: 0,
            messages_stored: 0,
            dead_steps_recovered: 0,
          };
      const next: Record<string, unknown> = { ...base, updated_at: timestamp };
      switch (params.event_type) {
        case "STEP_STARTED":
          next.steps_started = num(next, "steps_started") + 1;
          break;
        case "STEP_COMPLETED":
          next.steps_completed = num(next, "steps_completed") + 1;
          break;
        case "STEP_FAILED":
          next.steps_failed = num(next, "steps_failed") + 1;
          break;
        case "STEP_RETRY_SCHEDULED":
          next.steps_retried = num(next, "steps_retried") + 1;
          break;
        case "ARTIFACT_CREATED":
          next.artifacts_created = num(next, "artifacts_created") + 1;
          break;
        case "MESSAGE_STORED":
          next.messages_stored = num(next, "messages_stored") + 1;
          break;
        case "DEAD_STEP_RECOVERED":
          next.dead_steps_recovered = num(next, "dead_steps_recovered") + 1;
          break;
        case "ENVELOPE_COMPLETED":
          next.status = "completed";
          break;
        case "ENVELOPE_FAILED":
          next.status = "failed";
          break;
        default:
          break;
      }
      tx.set(ref, next);
    });
  }

  if (params.agent_id) {
    const aref = db.collection(COLLECTIONS.AGENT_METRICS).doc(params.agent_id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(aref);
      const base: Record<string, unknown> = snap.exists
        ? { ...(snap.data() as Record<string, unknown>) }
        : {
            agent_id: params.agent_id,
            total_steps_started: 0,
            total_steps_completed: 0,
            total_steps_failed: 0,
            total_leases_acquired: 0,
            total_leases_renewed: 0,
            total_lease_renew_failed: 0,
            total_artifacts_created: 0,
            total_dead_steps_recovered: 0,
          };
      const next: Record<string, unknown> = {
        ...base,
        last_seen_at: timestamp,
        updated_at: timestamp,
      };
      switch (params.event_type) {
        case "STEP_STARTED":
          next.total_steps_started = num(next, "total_steps_started") + 1;
          break;
        case "STEP_COMPLETED":
          next.total_steps_completed = num(next, "total_steps_completed") + 1;
          break;
        case "STEP_FAILED":
          next.total_steps_failed = num(next, "total_steps_failed") + 1;
          break;
        case "LEASE_ACQUIRED":
          next.total_leases_acquired = num(next, "total_leases_acquired") + 1;
          break;
        case "LEASE_RENEWED":
          next.total_leases_renewed = num(next, "total_leases_renewed") + 1;
          break;
        case "LEASE_RENEW_FAILED":
          next.total_lease_renew_failed = num(next, "total_lease_renew_failed") + 1;
          break;
        case "ARTIFACT_CREATED":
          next.total_artifacts_created = num(next, "total_artifacts_created") + 1;
          break;
        case "DEAD_STEP_RECOVERED":
          next.total_dead_steps_recovered = num(next, "total_dead_steps_recovered") + 1;
          break;
        default:
          break;
      }
      tx.set(aref, next);
    });
  }
}
