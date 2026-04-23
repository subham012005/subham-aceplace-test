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
export { claimNextEnvelope } from "./queue";


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
  userId?: string,
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
    user_id: userId,
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

/**
 * Searches for evidence that a step has already been completed.
 * Checks for STEP_COMPLETED traces and step-type specific artifacts.
 */
export async function findStepCompletionEvidence(
  envelopeId: string, 
  stepId: string,
  stepType: string
): Promise<boolean> {
  const db = getDb();
  
  // 1. Primary Evidence: STEP_COMPLETED trace
  const traceSnap = await db.collection(COLLECTIONS.EXECUTION_TRACES)
    .where("envelope_id", "==", envelopeId)
    .where("step_id", "==", stepId)
    .where("event_type", "==", "STEP_COMPLETED")
    .limit(1)
    .get();
    
  if (!traceSnap.empty) return true;

  // 2. Secondary Evidence: Step-type specific artifacts
  if (stepType === "produce_artifact" || stepType === "artifact_produce") {
    const artSnap = await db.collection(COLLECTIONS.ARTIFACTS)
      .where("execution_id", "==", envelopeId)
      .where("artifact_type", "==", "production")
      .limit(1)
      .get();
    
    // Check if any artifact content (or a dedicated field) points to this step
    // For Phase 2, we assume if a production artifact exists for this envelope, 
    // and we are at the worker step, it's likely completed. 
    // A more precise check would involve step_id in the artifact doc.
    if (!artSnap.empty) return true;
  }

  return false;
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

/**
 * Sync the legacy job status with the envelope's current state.
 */
export async function syncJobStatus(
  jobId: string,
  status: string,
  extraData?: Record<string, any>
): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .set({ 
      status, 
      updated_at: new Date().toISOString(),
      ...(extraData || {})
    }, { merge: true });
}

export async function getJob(jobId: string): Promise<{ envelope_id: string } | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .get();
  return doc.exists ? (doc.data() as { envelope_id: string }) : null;
}

export async function deleteAgent(agentId: string): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.AGENTS)
    .doc(agentId)
    .delete();
}

// ─── Execution Queue ──────────────────────────────────────────────────────────

/**
 * Enqueue a created envelope for the runtime-worker to claim and execute.
 * Writes to `execution_queue` Firestore collection.
 */
export async function enqueueEnvelope(envelope_id: string): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.EXECUTION_QUEUE)
    .doc(envelope_id)
    .set({
      envelope_id,
      status: "queued",
      created_at: new Date().toISOString(),
    });
}
