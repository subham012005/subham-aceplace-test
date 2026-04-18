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
import { emitRuntimeMetric } from "./telemetry/emitRuntimeMetric";
import { transition } from "./state-machine";

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
  const traceId = randomUUID();
  await db.collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
    trace_id: traceId,
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    message_id,
    agent_id: msg.identity.agent_id,
    identity_fingerprint: msg.identity.identity_fingerprint,
    event_type: msg.message_type,
    timestamp: new Date().toISOString(),
  });
  await emitRuntimeMetric({
    event_type: "MESSAGE_STORED",
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    agent_id: msg.identity.agent_id,
  }).catch(() => undefined);
  return message_id;
}

export function mapStepTypeToUSMessage(stepType: string): ProtocolVerb {
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

import { executeFallbackStep } from "./llm-fallback";
import { addTrace } from "./kernels/persistence";

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || "http://localhost:8001";

function isNetworkError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err).toLowerCase();
  return msg.includes("econnrefused") || msg.includes("fetch failed") || msg.includes("network");
}

async function logComputeProvider(
  envelopeId: string, stepId: string, agentId: string, fingerprint: string,
  provider: "python" | "ts-fallback", fallbackReason?: string,
): Promise<void> {
  await addTrace(envelopeId, stepId, agentId, fingerprint, "COMPUTE_PROVIDER_SELECTED", {
    compute_provider: provider,
    ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
  });
}

export async function handleUSMessage(msg: USMessage): Promise<USMessage | null> {
  const db = getDb();
  const envelopeRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(msg.execution.envelope_id);
  const snap = await envelopeRef.get();
  if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const envelope = snap.data() as ExecutionEnvelope;

  switch (msg.message_type) {
    case "#us#.task.plan":
      return handleTaskPlan(msg, envelope);
    case "#us#.task.assign":
      return handleTaskAssign(msg, envelope);
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

async function runFallbackForStep(
  msg: USMessage,
  envelope: ExecutionEnvelope,
  stepType: string,
  inputRef: string | null,
  fallbackReason: string,
): Promise<void> {
  await logComputeProvider(
    msg.execution.envelope_id, msg.execution.step_id,
    msg.identity.agent_id, msg.identity.identity_fingerprint,
    "ts-fallback", fallbackReason,
  );
  const result = await executeFallbackStep({
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    step_type: stepType,
    agent_id: msg.identity.agent_id,
    identity_fingerprint: msg.identity.identity_fingerprint,
    prompt: envelope.prompt || "",
    input_ref: inputRef,
  });
  await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, result.artifact_id);
  await attachArtifactToEnvelope(msg.execution.envelope_id, result.artifact_id);
}

async function handleTaskPlan(msg: USMessage, envelope: ExecutionEnvelope): Promise<USMessage | null> {
  console.log(`[#us#] Dispatching COO execution to Agent Engine: ${msg.execution.step_id}`);

  try {
    const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN || ""
      },
      body: JSON.stringify({
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        step_type: "plan",
        agent_id: msg.identity.agent_id,
        prompt: envelope.prompt || "",
        input_ref: null,
        message_id: null
      }),
    });

    if (!res.ok) throw new Error(`Agent Engine error: ${await res.text()}`);
    const result = await res.json() as { success: boolean; error?: string; artifact_id: string };
    if (!result.success) throw new Error(result.error || "Agent Engine failed");

    await logComputeProvider(
      msg.execution.envelope_id, msg.execution.step_id,
      msg.identity.agent_id, msg.identity.identity_fingerprint, "python",
    );
    await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, result.artifact_id);
    await attachArtifactToEnvelope(msg.execution.envelope_id, result.artifact_id);
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`[#us#] Agent engine unreachable, falling back to TypeScript LLM for COO`);
      await runFallbackForStep(msg, envelope, "plan", null, String((err as Error).message));
      return null;
    }
    console.error(`[#us#] EXCEPTION in handleTaskPlan:`, err);
    throw err;
  }
  return null;
}

async function handleTaskAssign(msg: USMessage, envelope: ExecutionEnvelope): Promise<USMessage | null> {
  const planArtifactRef = envelope.artifact_refs?.find(id => id.startsWith('art_plan')) || null;

  let richArtifactId: string | null = null;

  console.log(`[#us#] Dispatching RESEARCHER execution to Agent Engine: ${msg.execution.step_id}`);
  try {
    const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN || ""
      },
      body: JSON.stringify({
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        step_type: "assign",
        agent_id: msg.identity.agent_id,
        prompt: envelope.prompt || "",
        input_ref: planArtifactRef,
        message_id: null
      }),
    });

    if (res.ok) {
      const result = await res.json() as { success: boolean; artifact_id: string };
      if (result.success) {
        richArtifactId = result.artifact_id;
        await logComputeProvider(
          msg.execution.envelope_id, msg.execution.step_id,
          msg.identity.agent_id, msg.identity.identity_fingerprint, "python",
        );
        await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, richArtifactId);
        await attachArtifactToEnvelope(msg.execution.envelope_id, richArtifactId);
      }
    }
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`[#us#] Agent engine unreachable, falling back to TypeScript LLM for Researcher`);
      const result = await executeFallbackStep({
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        step_type: "assign",
        agent_id: msg.identity.agent_id,
        identity_fingerprint: msg.identity.identity_fingerprint,
        prompt: envelope.prompt || "",
        input_ref: planArtifactRef,
      });
      richArtifactId = result.artifact_id;
      await logComputeProvider(
        msg.execution.envelope_id, msg.execution.step_id,
        msg.identity.agent_id, msg.identity.identity_fingerprint,
        "ts-fallback", String((err as Error).message),
      );
      await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, richArtifactId);
      await attachArtifactToEnvelope(msg.execution.envelope_id, richArtifactId);
    } else {
      console.warn(`[#us#] Could not get rich research, falling back to basic decomposition`, err);
    }
  }

  const workerAgentIds = envelope.steps
    .filter((s) => s.role === "Worker" && s.step_type === "produce_artifact")
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
    research_artifact_id: richArtifactId || undefined
  });

  // If we didn't get a rich artifact from the agent, create the boilerplate one
  if (!richArtifactId) {
    const artifactId = `art_assign_${Date.now()}`;
    const missionObjective = envelope.prompt || decompositionPlan.work_units[0]?.objective || "mission";
    const structuredContent = {
      research_summary: `Mission objective "${missionObjective}" has been successfully decomposed into ${decompositionPlan.work_units.length} tactical work units.`,
      findings: decompositionPlan.work_units.map(wu => ({
        title: wu.title,
        detail: wu.instructions,
        id: wu.work_unit_id
      })),
      raw_plan: decompositionPlan,
      timestamp: new Date().toISOString()
    };

    const artifact = {
      artifact_id: artifactId,
      execution_id: msg.execution.envelope_id,
      produced_by_agent: msg.identity.agent_id,
      identity_fingerprint: msg.identity.identity_fingerprint,
      artifact_type: "assignment",
      artifact_content: JSON.stringify(structuredContent),
      created_at: new Date().toISOString(),
    };
    await getDb().collection(COLLECTIONS.ARTIFACTS).doc(artifactId).set(artifact);
    await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, artifactId);
    await attachArtifactToEnvelope(msg.execution.envelope_id, artifactId);
  }

  return null;
}

async function handleArtifactProduce(msg: USMessage, envelope: ExecutionEnvelope): Promise<USMessage | null> {
  const step = envelope.steps.find(s => s.step_id === msg.execution.step_id);
  const inputRef = step?.input_ref
    ? (typeof step.input_ref === "string" ? step.input_ref : (step.input_ref as any).artifact_id)
    : null;

  console.log(`[#us#] Dispatching WORKER execution to Agent Engine: ${msg.execution.step_id}`);
  try {
    const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN || ""
      },
      body: JSON.stringify({
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        step_type: "artifact_produce",
        agent_id: msg.identity.agent_id,
        prompt: envelope.prompt || "",
        input_ref: inputRef,
        message_id: null
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[#us#] Agent Engine error (${res.status}): ${errText}`);
      throw new Error(`Agent Engine error: ${errText}`);
    }
    const result = await res.json() as { success: boolean; error?: string; artifact_id: string };
    if (!result.success) throw new Error(result.error || "Agent Engine execution failed");

    await logComputeProvider(
      msg.execution.envelope_id, msg.execution.step_id,
      msg.identity.agent_id, msg.identity.identity_fingerprint, "python",
    );
    await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, result.artifact_id);
    await attachArtifactToEnvelope(msg.execution.envelope_id, result.artifact_id);

    const traceId = randomUUID();
    await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
      trace_id: traceId,
      envelope_id: msg.execution.envelope_id,
      step_id: msg.execution.step_id,
      agent_id: msg.identity.agent_id,
      identity_fingerprint: msg.identity.identity_fingerprint,
      event_type: "#us#.artifact.produce",
      artifact_id: result.artifact_id,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`[#us#] Agent engine unreachable, falling back to TypeScript LLM for Worker`);
      await runFallbackForStep(msg, envelope, "artifact_produce", inputRef, String((err as Error).message));
    } else {
      console.error(`[#us#] EXCEPTION in handleArtifactProduce:`, err);
      throw err;
    }
  }

  await emitRuntimeMetric({
    event_type: "ARTIFACT_CREATED",
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    agent_id: msg.identity.agent_id,
  }).catch(() => undefined);

  return null;
}

async function handleEvaluation(msg: USMessage, envelope: ExecutionEnvelope): Promise<USMessage | null> {
  // 1. Gather all Worker artifacts for the Grader to evaluate
  const out = (s: EnvelopeStep) => {
    const r = s.output_ref;
    if (typeof r === "object" && r?.artifact_id) return r.artifact_id as string;
    if (typeof r === "string") return r;
    return null;
  };

  const workerSteps = (envelope.steps || []).filter(
    (s) =>
      s.role === "Worker" &&
      (s.step_type === "produce_artifact" || s.step_type === "artifact_produce") &&
      s.status === "completed" &&
      out(s)
  );
  const artifactIds = workerSteps.map((s) => out(s)!).filter(Boolean);
  const aggregatedContent = artifactIds.length > 0 ? await aggregateArtifacts(artifactIds) : "";

  let graderArtifactId: string;

  console.log(`[#us#] Dispatching GRADER execution to Agent Engine: ${msg.execution.step_id}`);
  try {
    const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN || ""
      },
      body: JSON.stringify({
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        step_type: "evaluation",
        agent_id: msg.identity.agent_id,
        prompt: envelope.prompt || "",
        input_ref: artifactIds.join(","),
        message_id: null
      }),
    });

    if (!res.ok) throw new Error(`Agent Engine error: ${await res.text()}`);
    const result = await res.json() as { success: boolean; error?: string; artifact_id: string };
    if (!result.success) throw new Error(result.error || "Agent Engine execution failed");
    graderArtifactId = result.artifact_id;
    await logComputeProvider(
      msg.execution.envelope_id, msg.execution.step_id,
      msg.identity.agent_id, msg.identity.identity_fingerprint, "python",
    );
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`[#us#] Agent engine unreachable, falling back to TypeScript LLM for Grader`);
      await logComputeProvider(
        msg.execution.envelope_id, msg.execution.step_id,
        msg.identity.agent_id, msg.identity.identity_fingerprint,
        "ts-fallback", String((err as Error).message),
      );
      const result = await executeFallbackStep({
        envelope_id: msg.execution.envelope_id,
        step_id: msg.execution.step_id,
        step_type: "evaluation",
        agent_id: msg.identity.agent_id,
        identity_fingerprint: msg.identity.identity_fingerprint,
        prompt: envelope.prompt || "",
        input_ref: artifactIds[0] || null,
      });
      graderArtifactId = result.artifact_id;
      await attachArtifactToStep(msg.execution.envelope_id, msg.execution.step_id, graderArtifactId);
      await attachArtifactToEnvelope(msg.execution.envelope_id, graderArtifactId);
    } else {
      throw err;
    }
  }

  return createUSMessage({
    message_type: "#us#.execution.complete",
    execution: msg.execution,
    identity: msg.identity,
    authority: msg.authority,
    payload: {
      status: "success",
      role: "Grader",
      artifact_id: graderArtifactId,
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

  const traceId = randomUUID();
  await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
    trace_id: traceId,
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    agent_id: msg.identity.agent_id,
    identity_fingerprint: msg.identity.identity_fingerprint,
    event_type: "#us#.execution.complete",
    artifact_id: final_artifact_id,
    timestamp: new Date().toISOString(),
  });

  await emitRuntimeMetric({
    event_type: "ARTIFACT_CREATED",
    envelope_id: msg.execution.envelope_id,
    step_id: msg.execution.step_id,
    agent_id: msg.identity.agent_id,
  }).catch(() => undefined);

  // 🛡️ Removed early transition: parallel-runner manages terminal states.

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
