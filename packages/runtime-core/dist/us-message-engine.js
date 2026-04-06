"use strict";
/**
 * #us# Message Engine — deterministic execution grammar (ACEPLACE spec).
 * All step execution persists messages to execution_messages + execution_traces.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUSMessage = createUSMessage;
exports.storeUSMessage = storeUSMessage;
exports.mapStepTypeToUSMessage = mapStepTypeToUSMessage;
exports.handleUSMessage = handleUSMessage;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const constants_1 = require("./constants");
const decomposition_1 = require("./decomposition");
const emitRuntimeMetric_1 = require("./telemetry/emitRuntimeMetric");
const state_machine_1 = require("./state-machine");
function createUSMessage(input) {
    return {
        protocol: "#us#",
        version: "1.0",
        ...input,
        metadata: { timestamp: new Date().toISOString() },
    };
}
async function storeUSMessage(msg) {
    const message_id = (0, crypto_1.randomUUID)();
    const db = (0, db_1.getDb)();
    await db.collection(constants_1.COLLECTIONS.EXECUTION_MESSAGES).doc(message_id).set({
        message_id,
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        message_type: msg.message_type,
        agent_id: msg.identity.agent_id,
        identity_fingerprint: msg.identity.identity_fingerprint,
        payload: msg.payload,
        created_at: new Date().toISOString(),
    });
    await db.collection(constants_1.COLLECTIONS.EXECUTION_TRACES).add({
        envelope_id: msg.execution.envelope_id,
        message_id,
        agent_id: msg.identity.agent_id,
        identity_fingerprint: msg.identity.identity_fingerprint,
        event_type: msg.message_type,
        timestamp: new Date().toISOString(),
    });
    await (0, emitRuntimeMetric_1.emitRuntimeMetric)({
        event_type: "MESSAGE_STORED",
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        agent_id: msg.identity.agent_id,
    }).catch(() => undefined);
    return message_id;
}
function mapStepTypeToUSMessage(stepType) {
    switch (stepType) {
        case "plan":
            return "#us#.task.plan";
        case "assign":
            return "#us#.task.assign";
        case "produce_artifact":
        case "artifact_produce":
            return "#us#.artifact.produce";
        case "evaluate":
        case "evaluation":
            return "#us#.evaluation.score";
        case "complete":
            return "#us#.execution.complete";
        case "human_approval":
            return "#us#.task.plan";
        default:
            throw new Error(`UNSUPPORTED_STEP_TYPE:${stepType}`);
    }
}
const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || "http://localhost:8001";
async function handleUSMessage(msg) {
    const db = (0, db_1.getDb)();
    const envelopeRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(msg.execution.envelope_id);
    const snap = await envelopeRef.get();
    if (!snap.exists)
        throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data();
    switch (msg.message_type) {
        case "#us#.task.plan":
            return handleTaskPlan(msg);
        case "#us#.task.assign":
            return handleTaskAssign(msg);
        case "#us#.artifact.produce":
            return handleArtifactProduce(msg, envelope);
        case "#us#.evaluation.score":
            return handleEvaluation(msg, envelope);
        case "#us#.execution.complete":
            return handleExecutionComplete(msg);
        default:
            throw new Error("UNKNOWN_MESSAGE_TYPE");
    }
}
async function handleTaskPlan(_msg) {
    // Dispatch creates the initial plan; extra planning steps can be added here if needed.
    return null;
}
async function handleTaskAssign(msg) {
    const ref = (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(msg.execution.envelope_id);
    const envelopeSnap = await ref.get();
    if (!envelopeSnap.exists)
        throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = envelopeSnap.data();
    const workerAgentIds = envelope.steps
        .filter((s) => s.role === "Worker" && s.step_type === "produce_artifact")
        .map((s) => s.assigned_agent_id)
        .filter(Boolean);
    const decompositionPlan = (0, decomposition_1.createDecompositionPlan)({
        objective: envelope.root_task_id || envelope.prompt || envelope.envelope_id,
        worker_agent_ids: workerAgentIds.length ? workerAgentIds : [msg.identity.agent_id],
        parent_step_id: msg.execution.step_id,
    });
    await (0, decomposition_1.expandWorkerSteps)({
        envelope_id: msg.execution.envelope_id,
        decomposition_plan: decompositionPlan,
    });
    return null;
}
/**
 * 🤖 ALIGNMENT: Call the Python Agent Engine for Worker execution.
 */
async function handleArtifactProduce(msg, envelope) {
    console.log(`[#us#] Dispatching WORKER execution to Agent Engine: ${msg.execution.step_id}`);
    const step = envelope.steps.find(s => s.step_id === msg.execution.step_id);
    try {
        console.log(`[#us#] Fetching ${AGENT_ENGINE_URL}/execute-step...`);
        const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                envelope_id: msg.execution.envelope_id,
                step_id: msg.execution.step_id,
                step_type: "artifact_produce", // Python uses artifact_produce for Workers
                agent_id: msg.identity.agent_id,
                prompt: envelope.prompt || "",
                input_ref: step?.input_ref ?
                    (typeof step.input_ref === 'string' ? step.input_ref : step.input_ref.artifact_id)
                    : null,
                message_id: null
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error(`[#us#] Agent Engine error (${res.status}): ${errText}`);
            throw new Error(`Agent Engine error: ${errText}`);
        }
        const result = await res.json();
        console.log(`[#us#] Agent Engine success for ${msg.execution.step_id}:`, result);
        if (!result.success)
            throw new Error(result.error || "Agent Engine execution failed");
        const artifactId = result.artifact_id;
        await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, artifactId);
        await attachArtifactToEnvelope(msg.execution.envelope_id, artifactId);
    }
    catch (err) {
        console.error(`[#us#] EXCEPTION in handleArtifactProduce:`, err);
        throw err;
    }
    await (0, emitRuntimeMetric_1.emitRuntimeMetric)({
        event_type: "ARTIFACT_CREATED",
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        agent_id: msg.identity.agent_id,
    }).catch(() => undefined);
    return null;
}
/**
 * 🤖 ALIGNMENT: Call the Python Agent Engine for Grader evaluation.
 */
async function handleEvaluation(msg, envelope) {
    console.log(`[#us#] Dispatching GRADER execution to Agent Engine: ${msg.execution.step_id}`);
    // 1. Gather all Worker artifacts for the Grader to evaluate
    const out = (s) => {
        const r = s.output_ref;
        if (typeof r === "object" && r?.artifact_id)
            return r.artifact_id;
        if (typeof r === "string")
            return r;
        return null;
    };
    const workerSteps = (envelope.steps || []).filter((s) => s.role === "Worker" &&
        (s.step_type === "produce_artifact" || s.step_type === "artifact_produce") &&
        s.status === "completed" &&
        out(s));
    const artifactIds = workerSteps.map((s) => out(s)).filter(Boolean);
    const aggregatedContent = artifactIds.length > 0 ? await (0, decomposition_1.aggregateArtifacts)(artifactIds) : "";
    // 2. Call the Agent Engine (Grader)
    const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            envelope_id: msg.execution.envelope_id,
            step_id: msg.execution.step_id,
            step_type: "evaluation", // Python uses evaluation for Graders
            agent_id: msg.identity.agent_id,
            prompt: envelope.prompt || "",
            input_ref: artifactIds.join(","), // Grader gets all worker results
            message_id: null
        }),
    });
    if (!res.ok)
        throw new Error(`Agent Engine error: ${await res.text()}`);
    const result = await res.json();
    if (!result.success)
        throw new Error(result.error || "Agent Engine execution failed");
    // 3. Return the completion message with the aggregated result
    return createUSMessage({
        message_type: "#us#.execution.complete",
        execution: msg.execution,
        identity: msg.identity,
        authority: msg.authority,
        payload: {
            status: "success",
            role: "Grader",
            artifact_id: result.artifact_id,
            aggregated_content: aggregatedContent, // Keep for legacy / trace
        },
    });
}
async function handleExecutionComplete(msg) {
    const final_artifact_id = (0, crypto_1.randomUUID)();
    const content = String(msg.payload.aggregated_content || "");
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.ARTIFACTS)
        .doc(final_artifact_id)
        .set({
        artifact_id: final_artifact_id,
        execution_id: msg.execution.envelope_id,
        produced_by_agent: msg.identity.agent_id,
        identity_fingerprint: msg.identity.identity_fingerprint,
        artifact_type: "final_result",
        artifact_content: content,
        created_at: new Date().toISOString(),
    });
    await attachArtifactToEnvelope(msg.execution.envelope_id, final_artifact_id);
    await (0, emitRuntimeMetric_1.emitRuntimeMetric)({
        event_type: "ARTIFACT_CREATED",
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        agent_id: msg.identity.agent_id,
    }).catch(() => undefined);
    // 🛡️ Belt-and-suspenders: explicitly transition envelope to completed
    await (0, state_machine_1.transition)(msg.execution.envelope_id, "completed").catch(() => undefined);
    return null;
}
function buildWorkerArtifactContent(msg) {
    const workUnit = msg.payload.work_unit;
    if (workUnit) {
        const title = String(workUnit.title || "Untitled Work Unit");
        const objective = String(workUnit.objective || "");
        const instructions = String(workUnit.instructions || "");
        return [
            `# ${title}`,
            "",
            `Objective: ${objective}`,
            "",
            `Instructions: ${instructions}`,
            "",
            `Generated by agent ${msg.identity.agent_id}`,
        ].join("\n");
    }
    return `Generated artifact by ${msg.identity.agent_id}`;
}
async function attachArtifactToStep(envelopeId, stepId, artifactId) {
    const db = (0, db_1.getDb)();
    const docRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const steps = (envelope.steps || []).map((step) => {
            if (step.step_id !== stepId)
                return step;
            const prev = typeof step.output_ref === "object" && step.output_ref
                ? step.output_ref
                : {};
            return {
                ...step,
                output_ref: { ...prev, artifact_id: artifactId },
                updated_at: new Date().toISOString(),
            };
        });
        tx.update(docRef, { steps, updated_at: new Date().toISOString() });
    });
}
async function attachArtifactToEnvelope(envelopeId, artifactId) {
    const db = (0, db_1.getDb)();
    const docRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const artifact_refs = [...(envelope.artifact_refs || []), artifactId];
        tx.update(docRef, {
            artifact_refs,
            updated_at: new Date().toISOString(),
        });
    });
}
//# sourceMappingURL=us-message-engine.js.map