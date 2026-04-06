/**
 * Roll up raw telemetry_events into telemetry_rollups (ACEPLACE spec).
 */

import { randomUUID } from "crypto";
import { getDb } from "../db";
import { COLLECTIONS } from "../constants";
import type { TelemetryEventType } from "./emitRuntimeMetric";

export async function aggregateTelemetryWindow(params: {
  window_start: string;
  window_end: string;
}): Promise<{ rollup_id: string }> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.TELEMETRY_EVENTS)
    .where("timestamp", ">=", params.window_start)
    .get();
  const endMs = new Date(params.window_end).getTime();

  const totals = {
    envelopes_completed: 0,
    envelopes_failed: 0,
    steps_started: 0,
    steps_completed: 0,
    steps_failed: 0,
    steps_retried: 0,
    leases_acquired: 0,
    leases_renewed: 0,
    lease_renew_failed: 0,
    dead_steps_recovered: 0,
    artifacts_created: 0,
    messages_stored: 0,
    total_step_duration: 0,
    avg_step_duration: 0,
  };

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const ts = data.timestamp as string;
    if (new Date(ts).getTime() >= endMs) return;
    const event_type = data.event_type as TelemetryEventType;
    const value = data.value as number | undefined;

    switch (event_type) {
      case "ENVELOPE_COMPLETED":
        totals.envelopes_completed += 1;
        break;
      case "ENVELOPE_FAILED":
        totals.envelopes_failed += 1;
        break;
      case "STEP_STARTED":
        totals.steps_started += 1;
        break;
      case "STEP_COMPLETED":
        totals.steps_completed += 1;
        if (typeof value === "number") totals.total_step_duration += value;
        break;
      case "STEP_FAILED":
        totals.steps_failed += 1;
        break;
      case "STEP_RETRY_SCHEDULED":
        totals.steps_retried += 1;
        break;
      case "LEASE_ACQUIRED":
        totals.leases_acquired += 1;
        break;
      case "LEASE_RENEWED":
        totals.leases_renewed += 1;
        break;
      case "LEASE_RENEW_FAILED":
        totals.lease_renew_failed += 1;
        break;
      case "DEAD_STEP_RECOVERED":
        totals.dead_steps_recovered += 1;
        break;
      case "ARTIFACT_CREATED":
        totals.artifacts_created += 1;
        break;
      case "MESSAGE_STORED":
        totals.messages_stored += 1;
        break;
      default:
        break;
    }
  });

  if (totals.steps_completed > 0) {
    totals.avg_step_duration = totals.total_step_duration / totals.steps_completed;
  }

  const rollup_id = `rollup_${randomUUID().replace(/-/g, "")}`;
  await db
    .collection(COLLECTIONS.TELEMETRY_ROLLUPS)
    .doc(rollup_id)
    .set({
      rollup_id,
      window_start: params.window_start,
      window_end: params.window_end,
      totals,
      created_at: new Date().toISOString(),
    });

  return { rollup_id };
}
