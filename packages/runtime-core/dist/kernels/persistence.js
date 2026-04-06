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
exports.linkJobToEnvelope = linkJobToEnvelope;
exports.syncJobStatus = syncJobStatus;
exports.getJob = getJob;
exports.deleteAgent = deleteAgent;
exports.enqueueEnvelope = enqueueEnvelope;
const db_1 = require("../db");
const constants_1 = require("../constants");
const hash_1 = require("../hash");
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
async function addTrace(envelopeId, stepId, agentId, identityFingerprint, eventType, metadata) {
    const traceId = (0, hash_1.generateTraceId)(eventType);
    const trace = {
        trace_id: traceId,
        envelope_id: envelopeId,
        step_id: stepId,
        agent_id: agentId,
        identity_fingerprint: identityFingerprint,
        event_type: eventType,
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