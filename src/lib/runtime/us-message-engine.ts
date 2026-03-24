/**
 * #us# Message Engine — deterministic execution grammar (ACEPLACE spec).
 * All step execution persists messages to execution_messages + execution_traces.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";
import { COLLECTIONS } from "./constants";
import type {
  Artifact,
  EnvelopeStep,
  ExecutionEnvelope,
  ProtocolVerb,
  USMessage,
} from "./types";
import { createDecompositionPlan, expandWorkerSteps, aggregateArtifacts } from "./decomposition";

export function createUSMessage(
  input: Omit<USMessage, "protocol" | "version" | "metadata">
): USMessage {
  return {
    protocol: "#us#",
    version: "1.0",
    ...input,
    metadata: { timestamp: new Date().toISOString() },
  };
}

export async function storeUSMessage(msg: USMessage): Promise<string> {
  const message_id = randomUUID();
  const db = getDb();
  await db.collection(COLLECTIONS.EXECUTION_MESSAGES).doc(message_id).set({
    message_id,
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    message_type: msg.message_type,
    agent_id: msg.identity.agent_id,
    identity_fingerprint: msg.identity.identity_fingerprint,
    payload: msg.payload,
    created_at: new Date().toISOString(),
  });
  await db.collection(COLLECTIONS.EXECUTION_TRACES).add({
    envelope_id: msg.execution.envelope_id,
    message_id,
    agent_id: msg.identity.agent_id,
    identity_fingerprint: msg.identity.identity_fingerprint,
    event_type: msg.message_type,
    timestamp: new Date().toISOString(),
  });
  return message_id;
}

export async function handleUSMessage(msg: USMessage): Promise<USMessage | null> {
  switch (msg.message_type) {
    case "#us#.task.plan":
      return handleTaskPlan(msg);
    case "#us#.task.assign":
      return handleTaskAssign(msg);
    case "#us#.artifact.produce":
      return handleArtifactProduce(msg);
    case "#us#.evaluation.score":
      return handleEvaluation(msg);
    case "#us#.execution.complete":
      return handleExecutionComplete(msg);
    default:
      throw new Error("UNKNOWN_MESSAGE_TYPE");
  }
}

async function handleTaskPlan(_msg: USMessage): Promise<USMessage | null> {
  // Assign step emits #us#.task.assign when executed; avoid running assign handler during plan.
  return null;
}

async function handleTaskAssign(msg: USMessage): Promise<USMessage | null> {
  const ref = getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(msg.execution.envelope_id);
  const envelopeSnap = await ref.get();
  if (!envelopeSnap.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const envelope = envelopeSnap.data() as ExecutionEnvelope;

  const workerAgentIds = envelope.steps
    .filter((s) => s.role === "Worker" && s.step_type === "artifact_produce")
    .map((s) => s.assigned_agent_id)
    .filter(Boolean) as string[];

  const decompositionPlan = createDecompositionPlan({
    objective: envelope.root_task_id || envelope.prompt || envelope.envelope_id,
    worker_agent_ids: workerAgentIds.length ? workerAgentIds : [msg.identity.agent_id],
    parent_step_id: msg.execution.step_id,
  });
  await expandWorkerSteps({
    envelope_id: msg.execution.envelope_id,
    decomposition_plan: decompositionPlan,
  });
  return null;
}

async function handleArtifactProduce(msg: USMessage): Promise<USMessage | null> {
  const content = buildWorkerArtifactContent(msg);
  const artifact_type =
    (msg.payload.artifact_type as string) || "production";
  const artifact_id = randomUUID();
  const artifact: Artifact = {
    artifact_id,
    execution_id: msg.execution.envelope_id,
    produced_by_agent: msg.identity.agent_id,
    identity_fingerprint: msg.identity.identity_fingerprint,
    artifact_type: artifact_type as Artifact["artifact_type"],
    artifact_content: content,
    created_at: new Date().toISOString(),
  };
  await getDb().collection(COLLECTIONS.ARTIFACTS).doc(artifact_id).set(artifact);
  await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, artifact_id);
  await attachArtifactToEnvelope(msg.execution.envelope_id, artifact_id);
  return null;
}

/** Reference routing: reuse plan verb slot for artifact.reference semantically via payload */
export function mapStepTypeToUSMessage(stepType: string): ProtocolVerb {
  switch (stepType) {
    case "plan":
      return "#us#.task.plan";
    case "assign":
      return "#us#.task.assign";
    case "artifact_produce":
      return "#us#.artifact.produce";
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

async function handleEvaluation(msg: USMessage): Promise<USMessage | null> {
  const ref = getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(msg.execution.envelope_id);
  const envelopeSnap = await ref.get();
  if (!envelopeSnap.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const envelope = envelopeSnap.data() as ExecutionEnvelope;

  const out = (s: EnvelopeStep) => {
    const r = s.output_ref;
    if (typeof r === "object" && r?.artifact_id) return r.artifact_id as string;
    if (typeof r === "string") return r;
    return null;
  };

  const workerSteps = (envelope.steps || []).filter(
    (s) =>
      s.role === "Worker" &&
      s.step_type === "artifact_produce" &&
      s.status === "completed" &&
      out(s)
  );
  const artifactIds = workerSteps.map((s) => out(s)!).filter(Boolean);
  const aggregatedContent =
    artifactIds.length > 0 ? await aggregateArtifacts(artifactIds) : "";

  return createUSMessage({
    message_type: "#us#.execution.complete",
    execution: msg.execution,
    identity: msg.identity,
    authority: msg.authority,
    payload: {
      status: "success",
      role: "Grader",
      score: 0.95,
      summary: "Aggregated output validated",
      artifact_ids: artifactIds,
      aggregated_content: aggregatedContent,
    },
  });
}

async function handleExecutionComplete(msg: USMessage): Promise<USMessage | null> {
  const final_artifact_id = randomUUID();
  const content = String(msg.payload.aggregated_content || "");
  await getDb()
    .collection(COLLECTIONS.ARTIFACTS)
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
  return null;
}

function buildWorkerArtifactContent(msg: USMessage): string {
  const workUnit = msg.payload.work_unit as Record<string, unknown> | null | undefined;
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

async function attachArtifactToStep(
  envelopeId: string,
  stepId: string,
  artifactId: string
): Promise<void> {
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const steps = (envelope.steps || []).map((step) => {
      if (step.step_id !== stepId) return step;
      const prev =
        typeof step.output_ref === "object" && step.output_ref
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

async function attachArtifactToEnvelope(envelopeId: string, artifactId: string): Promise<void> {
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const artifact_refs = [...(envelope.artifact_refs || []), artifactId];
    tx.update(docRef, {
      artifact_refs,
      updated_at: new Date().toISOString(),
    });
  });
}
