/**
 * Read-only explorer queries (ACEPLACE explorer API spec).
 */

import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";
import type { ExecutionEnvelope } from "@/lib/runtime/types";

function mapSummary(
  envelope: ExecutionEnvelope,
  docId: string,
  traceCount: number
) {
  const steps = envelope.steps || [];
  const countByStatus = (st: string) => steps.filter((s) => s.status === st).length;
  return {
    envelope_id: envelope.envelope_id || docId,
    org_id: envelope.org_id,
    root_task_id: envelope.root_task_id ?? "",
    status: envelope.status,
    coordinator_agent_id:
      envelope.coordinator_agent_id ?? envelope.identity_context?.agent_id,
    step_counts: {
      total: steps.length,
      ready: countByStatus("ready"),
      running: countByStatus("executing"),
      completed: countByStatus("completed"),
      failed: countByStatus("failed"),
      awaiting_human: countByStatus("awaiting_human"),
    },
    artifact_count: (envelope.artifact_refs || []).length,
    trace_event_count: traceCount,
    created_at: envelope.created_at,
    updated_at: envelope.updated_at,
  };
}

export async function listEnvelopes(params?: {
  org_id?: string;
  status?: string;
  limit?: number;
}) {
  const db = getDb();
  const lim = params?.limit ?? 50;
  const col = db.collection(COLLECTIONS.EXECUTION_ENVELOPES);

  let snap;
  if (params?.org_id && params?.status) {
    snap = await col
      .where("org_id", "==", params.org_id)
      .where("status", "==", params.status)
      .orderBy("updated_at", "desc")
      .limit(lim)
      .get();
  } else if (params?.org_id) {
    snap = await col
      .where("org_id", "==", params.org_id)
      .orderBy("updated_at", "desc")
      .limit(lim)
      .get();
  } else if (params?.status) {
    snap = await col
      .where("status", "==", params.status)
      .orderBy("updated_at", "desc")
      .limit(lim)
      .get();
  } else {
    snap = await col.orderBy("updated_at", "desc").limit(lim).get();
  }

  return snap.docs.map((doc) => {
    const envelope = { ...doc.data(), envelope_id: doc.id } as ExecutionEnvelope;
    return mapSummary(envelope, doc.id, 0);
  });
}

export async function getEnvelopeSummary(envelope_id: string) {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const envelope = snap.data() as ExecutionEnvelope;
  const traces = await db
    .collection(COLLECTIONS.EXECUTION_TRACES)
    .where("envelope_id", "==", envelope_id)
    .get();
  return mapSummary(envelope, envelope_id, traces.size);
}

export async function getEnvelopeDetail(envelope_id: string) {
  const db = getDb();
  const envelopeRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id);
  const envelopeSnap = await envelopeRef.get();
  if (!envelopeSnap.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const envelope = envelopeSnap.data() as ExecutionEnvelope;

  const artifactRefs = envelope.artifact_refs || [];
  const artifactDocs = await Promise.all(
    artifactRefs.map((id) => db.collection(COLLECTIONS.ARTIFACTS).doc(id).get())
  );

  const traceSnap = await db
    .collection(COLLECTIONS.EXECUTION_TRACES)
    .where("envelope_id", "==", envelope_id)
    .orderBy("timestamp", "desc")
    .limit(100)
    .get();

  let messageSnap;
  try {
    messageSnap = await db
      .collection(COLLECTIONS.EXECUTION_MESSAGES)
      .where("envelope_id", "==", envelope_id)
      .orderBy("created_at", "desc")
      .limit(100)
      .get();
  } catch {
    messageSnap = await db
      .collection(COLLECTIONS.EXECUTION_MESSAGES)
      .where("envelope_id", "==", envelope_id)
      .limit(100)
      .get();
  }

  const envelopeMetricsSnap = await db
    .collection(COLLECTIONS.ENVELOPE_METRICS)
    .doc(envelope_id)
    .get();

  let rollupsSnap;
  try {
    rollupsSnap = await db
      .collection(COLLECTIONS.TELEMETRY_ROLLUPS)
      .orderBy("window_end", "desc")
      .limit(10)
      .get();
  } catch {
    rollupsSnap = await db.collection(COLLECTIONS.TELEMETRY_ROLLUPS).limit(10).get();
  }

  return {
    envelope,
    steps: envelope.steps || [],
    identity_contexts: envelope.identity_contexts || {},
    authority_leases: envelope.authority_leases || {},
    artifacts: artifactDocs.filter((d) => d.exists).map((d) => d.data()),
    recent_messages: messageSnap.docs.map((d) => d.data()),
    recent_traces: traceSnap.docs.map((d) => d.data()),
    telemetry: {
      envelope_metrics: envelopeMetricsSnap.exists ? envelopeMetricsSnap.data() : null,
      recent_rollups: rollupsSnap.docs.map((d) => d.data()),
    },
  };
}
