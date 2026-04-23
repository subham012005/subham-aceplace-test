"use strict";
/**
 * Persistence Kernel — Phase 2
 *
 * Manages ONLY execution_envelopes (with embedded steps[] and authority_lease).
 * No reads/writes to execution_steps or leases collections.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimNextEnvelope = void 0;
exports.createEnvelope = createEnvelope;
exports.getEnvelope = getEnvelope;
exports.updateEnvelope = updateEnvelope;
exports.getUserEnvelopes = getUserEnvelopes;
exports.getActiveEnvelopes = getActiveEnvelopes;
exports.updateEnvelopeStep = updateEnvelopeStep;
exports.getEnvelopeStep = getEnvelopeStep;
exports.getNextReadyStep = getNextReadyStep;
exports.setEnvelopeStatus = setEnvelopeStatus;
exports.addTrace = addTrace;
exports.createArtifact = createArtifact;
exports.getArtifact = getArtifact;
exports.findStepCompletionEvidence = findStepCompletionEvidence;
exports.linkJobToEnvelope = linkJobToEnvelope;
exports.syncJobStatus = syncJobStatus;
exports.getJob = getJob;
exports.deleteAgent = deleteAgent;
exports.enqueueEnvelope = enqueueEnvelope;
const db_1 = require("../db");
const constants_1 = require("../constants");
const hash_1 = require("../hash");
var queue_1 = require("./queue");
Object.defineProperty(exports, "claimNextEnvelope", { enumerable: true, get: function () { return queue_1.claimNextEnvelope; } });
// ─── Envelope Operations ──────────────────────────────────────────────────────
async function createEnvelope(envelope) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .doc(envelope.envelope_id)
        .set(envelope);
}
async function getEnvelope(envelopeId) {
    const doc = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .doc(envelopeId)
        .get();
    return doc.exists ? doc.data() : null;
}
async function updateEnvelope(envelopeId, updates) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .doc(envelopeId)
        .update({ ...updates, updated_at: new Date().toISOString() });
}
async function getUserEnvelopes(userId) {
    const snapshot = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .where("user_id", "==", userId)
        .orderBy("created_at", "desc")
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
async function getActiveEnvelopes() {
    const snapshot = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .where("status", "in", ["created", "executing"])
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
// ─── Embedded Step Operations ─────────────────────────────────────────────────
// Steps live inside envelope.steps[]. We update individual steps via
// Firestore arrayUnion is not suitable for updates — we use full array replace.
/**
 * Update a specific step inside envelope.steps[] by step_id.
 * Reads the envelope, patches the step, writes back atomically.
 */
async function updateEnvelopeStep(envelopeId, stepId, updates) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error(`Envelope ${envelopeId} not found`);
        const envelope = snap.data();
        const updatedSteps = envelope.steps.map((step) => step.step_id === stepId ? { ...step, ...updates } : step);
        tx.update(ref, {
            steps: updatedSteps,
            updated_at: new Date().toISOString(),
        });
    });
}
/**
 * Get a specific step from envelope.steps[] by step_id.
 */
async function getEnvelopeStep(envelopeId, stepId) {
    const envelope = await getEnvelope(envelopeId);
    if (!envelope)
        return null;
    return envelope.steps.find((s) => s.step_id === stepId) ?? null;
}
/**
 * Get the next step with status === "ready".
 * Returns null if no ready step exists.
 */
function getNextReadyStep(envelope) {
    return envelope.steps.find((s) => s.status === "ready") ?? null;
}
// ─── Envelope Status ──────────────────────────────────────────────────────────
async function setEnvelopeStatus(envelopeId, status) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
        .doc(envelopeId)
        .update({ status, updated_at: new Date().toISOString() });
}
// ─── Trace Operations ─────────────────────────────────────────────────────────
async function addTrace(envelopeId, stepId, agentId, identityFingerprint, eventType, userId, metadata) {
    const traceId = (0, hash_1.generateTraceId)(eventType);
    const trace = {
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
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_TRACES)
        .doc(traceId)
        .set(trace);
}
// ─── Artifact Operations ──────────────────────────────────────────────────────
async function createArtifact(artifact) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.ARTIFACTS)
        .doc(artifact.artifact_id)
        .set(artifact);
}
async function getArtifact(artifactId) {
    const doc = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.ARTIFACTS)
        .doc(artifactId)
        .get();
    return doc.exists ? doc.data() : null;
}
/**
 * Searches for evidence that a step has already been completed.
 * Checks for STEP_COMPLETED traces and step-type specific artifacts.
 */
async function findStepCompletionEvidence(envelopeId, stepId, stepType) {
    const db = (0, db_1.getDb)();
    // 1. Primary Evidence: STEP_COMPLETED trace
    const traceSnap = await db.collection(constants_1.COLLECTIONS.EXECUTION_TRACES)
        .where("envelope_id", "==", envelopeId)
        .where("step_id", "==", stepId)
        .where("event_type", "==", "STEP_COMPLETED")
        .limit(1)
        .get();
    if (!traceSnap.empty)
        return true;
    // 2. Secondary Evidence: Step-type specific artifacts
    if (stepType === "produce_artifact" || stepType === "artifact_produce") {
        const artSnap = await db.collection(constants_1.COLLECTIONS.ARTIFACTS)
            .where("execution_id", "==", envelopeId)
            .where("artifact_type", "==", "production")
            .limit(1)
            .get();
        // Check if any artifact content (or a dedicated field) points to this step
        // For Phase 2, we assume if a production artifact exists for this envelope, 
        // and we are at the worker step, it's likely completed. 
        // A more precise check would involve step_id in the artifact doc.
        if (!artSnap.empty)
            return true;
    }
    return false;
}
// ─── Job Link (UI pointer only — NOT used for execution) ─────────────────────
async function linkJobToEnvelope(jobId, envelopeId) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .set({ envelope_id: envelopeId, updated_at: new Date().toISOString() }, { merge: true });
}
/**
 * Sync the legacy job status with the envelope's current state.
 */
async function syncJobStatus(jobId, status, extraData) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .set({
        status,
        updated_at: new Date().toISOString(),
        ...(extraData || {})
    }, { merge: true });
}
async function getJob(jobId) {
    const doc = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .get();
    return doc.exists ? doc.data() : null;
}
async function deleteAgent(agentId) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.AGENTS)
        .doc(agentId)
        .delete();
}
// ─── Execution Queue ──────────────────────────────────────────────────────────
/**
 * Enqueue a created envelope for the runtime-worker to claim and execute.
 * Writes to `execution_queue` Firestore collection.
 */
async function enqueueEnvelope(envelope_id) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_QUEUE)
        .doc(envelope_id)
        .set({
        envelope_id,
        status: "queued",
        created_at: new Date().toISOString(),
    });
}
//# sourceMappingURL=persistence.js.map