/**
 * Persistence Kernel — Phase 2
 *
 * Manages ONLY execution_envelopes (with embedded steps[] and authority_lease).
 * No reads/writes to execution_steps or leases collections.
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import { getDb } from "../db";
import { COLLECTIONS } from "../constants";
import { generateTraceId } from "../hash";
import type {
  ExecutionEnvelope,
  EnvelopeStep,
  EnvelopeStatus,
  ExecutionTrace,
  Artifact,
} from "../types";

// ─── Envelope Operations ──────────────────────────────────────────────────────

export async function createEnvelope(envelope: ExecutionEnvelope): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .doc(envelope.envelope_id)
    .set(envelope);
}

export async function getEnvelope(envelopeId: string): Promise<ExecutionEnvelope | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .doc(envelopeId)
    .get();
  return doc.exists ? (doc.data() as ExecutionEnvelope) : null;
}

export async function updateEnvelope(
  envelopeId: string,
  updates: Partial<ExecutionEnvelope>
): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .doc(envelopeId)
    .update({ ...updates, updated_at: new Date().toISOString() });
}

export async function getUserEnvelopes(userId: string): Promise<ExecutionEnvelope[]> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as ExecutionEnvelope);
}

export async function getActiveEnvelopes(): Promise<ExecutionEnvelope[]> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .where("status", "in", ["created", "executing"])
    .get();
  return snapshot.docs.map((doc) => doc.data() as ExecutionEnvelope);
}

// ─── Embedded Step Operations ─────────────────────────────────────────────────
// Steps live inside envelope.steps[]. We update individual steps via
// Firestore arrayUnion is not suitable for updates — we use full array replace.

/**
 * Update a specific step inside envelope.steps[] by step_id.
 * Reads the envelope, patches the step, writes back atomically.
 */
export async function updateEnvelopeStep(
  envelopeId: string,
  stepId: string,
  updates: Partial<EnvelopeStep>
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`Envelope ${envelopeId} not found`);

    const envelope = snap.data() as ExecutionEnvelope;
    const updatedSteps = envelope.steps.map((step) =>
      step.step_id === stepId ? { ...step, ...updates } : step
    );

    tx.update(ref, {
      steps: updatedSteps,
      updated_at: new Date().toISOString(),
    });
  });
}

/**
 * Get a specific step from envelope.steps[] by step_id.
 */
export async function getEnvelopeStep(
  envelopeId: string,
  stepId: string
): Promise<EnvelopeStep | null> {
  const envelope = await getEnvelope(envelopeId);
  if (!envelope) return null;
  return envelope.steps.find((s) => s.step_id === stepId) ?? null;
}

/**
 * Get the next step with status === "ready".
 * Returns null if no ready step exists.
 */
export function getNextReadyStep(envelope: ExecutionEnvelope): EnvelopeStep | null {
  return envelope.steps.find((s) => s.status === "ready") ?? null;
}

// ─── Envelope Status ──────────────────────────────────────────────────────────

export async function setEnvelopeStatus(
  envelopeId: string,
  status: EnvelopeStatus
): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .doc(envelopeId)
    .update({ status, updated_at: new Date().toISOString() });
}

// ─── Trace Operations ─────────────────────────────────────────────────────────

export async function addTrace(
  envelopeId: string,
  stepId: string,
  agentId: string,
  identityFingerprint: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const traceId = generateTraceId(eventType);
  const trace: ExecutionTrace = {
    trace_id: traceId,
    envelope_id: envelopeId,
    step_id: stepId,
    agent_id: agentId,
    identity_fingerprint: identityFingerprint,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    metadata: metadata ?? {},
  };
  await getDb()
    .collection(COLLECTIONS.EXECUTION_TRACES)
    .doc(traceId)
    .set(trace);
}

// ─── Artifact Operations ──────────────────────────────────────────────────────

export async function createArtifact(artifact: Artifact): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.ARTIFACTS)
    .doc(artifact.artifact_id)
    .set(artifact);
}

export async function getArtifact(artifactId: string): Promise<Artifact | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.ARTIFACTS)
    .doc(artifactId)
    .get();
  return doc.exists ? (doc.data() as Artifact) : null;
}

// ─── Job Link (UI pointer only — NOT used for execution) ─────────────────────

export async function linkJobToEnvelope(
  jobId: string,
  envelopeId: string
): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .set({ envelope_id: envelopeId, updated_at: new Date().toISOString() }, { merge: true });
}
