/**
 * Parallel envelope runner — per-agent leases, step claims, #us# message engine
 * (ACEPLACE RUNTIME + State Machine spec).
 */

import { verifyIdentityForAgent } from "./kernels/identity";
import { transition } from "./state-machine";
import { COLLECTIONS } from "./constants";
import { getDb } from "./db";
import {
  acquirePerAgentLease,
  releasePerAgentLease,
  validatePerAgentLease,
} from "./per-agent-authority";
import {
  createUSMessage,
  handleUSMessage,
  mapStepTypeToUSMessage,
  storeUSMessage,
} from "./us-message-engine";
import { acelogicExecutionGuard } from "./acelogic-guard";
import type { EnvelopeStep, ExecutionEnvelope, StepStatus } from "./types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function dependencySatisfied(step: EnvelopeStep, steps: EnvelopeStep[]): boolean {
  const deps = step.depends_on || [];
  if (!deps.length) return true;
  const map = new Map(steps.map((s) => [s.step_id, s]));
  return deps.every((id) => map.get(id)?.status === "completed");
}

export function getRunnableSteps(envelope: ExecutionEnvelope): EnvelopeStep[] {
  return (envelope.steps || []).filter((step) => {
    if (step.status !== "ready" && step.status !== "pending") return false;
    return dependencySatisfied(step, envelope.steps || []);
  });
}

export function selectParallelStepBatch(params: {
  runnableSteps: EnvelopeStep[];
  maxParallelSteps?: number;
}): EnvelopeStep[] {
  const max = params.maxParallelSteps ?? 20;
  const selected: EnvelopeStep[] = [];
  const usedAgents = new Set<string>();
  for (const step of params.runnableSteps) {
    const aid = step.assigned_agent_id;
    if (!aid) {
      selected.push(step);
      if (selected.length >= max) break;
      continue;
    }
    if (usedAgents.has(aid)) continue;
    usedAgents.add(aid);
    selected.push(step);
    if (selected.length >= max) break;
  }
  return selected;
}

export async function claimEnvelopeStep(params: {
  envelope_id: string;
  step_id: string;
  instance_id: string;
}): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(params.envelope_id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const steps = envelope.steps || [];
    let claimed = false;
    const nextSteps = steps.map((step: EnvelopeStep) => {
      if (step.step_id !== params.step_id) return step;
      if (step.status !== "ready" && step.status !== "pending") {
        throw new Error(`STEP_NOT_CLAIMABLE:${step.step_id}`);
      }
      claimed = true;
      return {
        ...step,
        status: "executing" as StepStatus,
        claimed_by_instance_id: params.instance_id,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    if (!claimed) throw new Error("STEP_NOT_FOUND");
    tx.update(ref, { steps: nextSteps, updated_at: new Date().toISOString() });
  });
}

export async function finalizeEnvelopeStep(params: {
  envelope_id: string;
  step_id: string;
  status: Extract<StepStatus, "completed" | "failed" | "ready">;
  output_ref?: EnvelopeStep["output_ref"];
  retry_count?: number;
}): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(params.envelope_id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const steps = envelope.steps || [];
    const nextSteps = steps.map((step: EnvelopeStep) => {
      if (step.step_id !== params.step_id) return step;
      const baseOut =
        typeof step.output_ref === "object" && step.output_ref
          ? { ...(step.output_ref as object) }
          : {};
      let mergedOut: EnvelopeStep["output_ref"] = step.output_ref;
      if (params.output_ref !== undefined) {
        mergedOut =
          typeof params.output_ref === "object"
            ? { ...baseOut, ...(params.output_ref as object) }
            : params.output_ref;
      }
      return {
        ...step,
        status: params.status,
        retry_count: params.retry_count ?? step.retry_count ?? 0,
        output_ref: mergedOut,
        claimed_by_instance_id: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      };
    });
    tx.update(ref, { steps: nextSteps, updated_at: new Date().toISOString() });
  });
}

async function pauseForHumanApproval(
  envelopeId: string,
  stepId: string,
  coordinatorId: string
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const nextSteps = (envelope.steps || []).map((step) =>
      step.step_id === stepId
        ? { ...step, status: "awaiting_human" as StepStatus, updated_at: new Date().toISOString() }
        : step
    );
    tx.update(ref, { steps: nextSteps, updated_at: new Date().toISOString() });
  });
  await transition(envelopeId, "awaiting_human", { step_id: stepId, agent_id: coordinatorId });
}

function resolveInstanceId(envelope: ExecutionEnvelope, agentId: string, fallback: string) {
  const ctx = envelope.multi_agent
    ? envelope.identity_contexts?.[agentId]
    : envelope.identity_context;
  return ctx?.instance_id || fallback;
}

async function executeClaimedStep(params: {
  envelope_id: string;
  runtime_instance_id: string;
  step: EnvelopeStep;
}): Promise<void> {
  const { envelope_id, runtime_instance_id, step } = params;
  const ref = getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const envelope = snap.data() as ExecutionEnvelope;

  if (step.step_type === "human_approval") {
    throw new Error("HUMAN_APPROVAL_USE_PAUSE");
  }

  const agentId = step.assigned_agent_id;
  if (!agentId) throw new Error(`STEP_AGENT_MISSING:${step.step_id}`);

  const ident = await verifyIdentityForAgent(envelope_id, envelope, agentId);
  if (!ident.verified) {
    throw new Error(`IDENTITY_FAILED:${ident.reason}`);
  }

  const instanceId = resolveInstanceId(envelope, agentId, runtime_instance_id);
  const licenseId = envelope.license_id || "dev_license";
  const guard = await acelogicExecutionGuard({
    agent_id: agentId,
    identity_fingerprint:
      envelope.multi_agent && envelope.identity_contexts?.[agentId]
        ? envelope.identity_contexts[agentId].identity_fingerprint
        : envelope.identity_context.identity_fingerprint,
    instance_id: instanceId,
    org_id: envelope.org_id,
    license_id: licenseId,
  });
  if (!guard.allowed) {
    throw new Error(`EXECUTION_BLOCKED:${agentId}`);
  }

  await acquirePerAgentLease(envelope_id, agentId, instanceId);
  const refreshed = (await ref.get()).data() as ExecutionEnvelope;
  validatePerAgentLease(refreshed, agentId, instanceId);

  const fingerprint =
    refreshed.multi_agent && refreshed.identity_contexts?.[agentId]
      ? refreshed.identity_contexts[agentId].identity_fingerprint
      : refreshed.identity_context.identity_fingerprint;
  const leaseRow = refreshed.authority_leases?.[agentId];

  const message = createUSMessage({
    message_type: mapStepTypeToUSMessage(step.step_type),
    execution: { envelope_id, step_id: step.step_id },
    identity: { agent_id: agentId, identity_fingerprint: fingerprint },
    authority: { lease_id: leaseRow?.lease_id },
    payload: {
      role: step.role,
      work_unit:
        typeof step.input_ref === "object" && step.input_ref && "work_unit" in step.input_ref
          ? (step.input_ref.work_unit as Record<string, unknown>)
          : null,
    },
  });

  const messageId = await storeUSMessage(message);
  let follow: Awaited<ReturnType<typeof handleUSMessage>> = await handleUSMessage(message);
  let depth = 0;
  while (follow && depth < 5) {
    await storeUSMessage(follow);
    follow = await handleUSMessage(follow);
    depth++;
  }

  await finalizeEnvelopeStep({
    envelope_id,
    step_id: step.step_id,
    status: "completed",
    output_ref: { message_id: messageId },
  });

  await releasePerAgentLease(envelope_id, agentId).catch(() => undefined);
}

/**
 * Entry: multi-agent deterministic runtime loop with bounded parallelism.
 */
export async function runEnvelopeParallel(params: {
  envelope_id: string;
  instance_id: string;
  max_parallel_steps?: number;
}): Promise<void> {
  const { envelope_id, instance_id, max_parallel_steps = 20 } = params;
  const ref = getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id);

  const boot = await ref.get();
  if (!boot.exists) throw new Error("ENVELOPE_NOT_FOUND");
  const first = boot.data() as ExecutionEnvelope;

  if (first.status === "created") {
    try {
      await transition(envelope_id, "leased");
    } catch {
      /* ignore */
    }
  }
  const s1 = (await ref.get()).data() as ExecutionEnvelope;
  if (s1.status === "leased") {
    try {
      await transition(envelope_id, "planned");
    } catch {
      /* ignore */
    }
  }
  const s2 = (await ref.get()).data() as ExecutionEnvelope;
  if (s2.status === "planned") {
    try {
      await transition(envelope_id, "executing");
    } catch {
      /* ignore */
    }
  }

  while (true) {
    const snap = await ref.get();
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;

    const terminal = ["approved", "rejected", "failed", "quarantined", "awaiting_human"];
    if (terminal.includes(envelope.status)) return;

    const humanApprovalStep = (envelope.steps || []).find(
      (s) =>
        s.step_type === "human_approval" &&
        (s.status === "pending" || s.status === "ready") &&
        dependencySatisfied(s, envelope.steps || [])
    );
    if (humanApprovalStep) {
      await pauseForHumanApproval(
        envelope_id,
        humanApprovalStep.step_id,
        envelope.coordinator_agent_id || envelope.identity_context.agent_id
      );
      return;
    }

    const runnableSteps = getRunnableSteps(envelope).filter(
      (s) => s.step_type !== "human_approval"
    );

    if (!runnableSteps.length) {
      const hasRunning = (envelope.steps || []).some((s) => s.status === "executing");
      const hasPending = (envelope.steps || []).some(
        (s) => s.status === "pending" || s.status === "ready"
      );
      if (!hasRunning && !hasPending) {
        const anyFailed = (envelope.steps || []).some((s) => s.status === "failed");
        try {
          await transition(envelope_id, anyFailed ? "failed" : "approved");
        } catch {
          /* */
        }
        return;
      }
      await sleep(400);
      continue;
    }

    const batch = selectParallelStepBatch({ runnableSteps, maxParallelSteps: max_parallel_steps });
    const claimed: EnvelopeStep[] = [];
    for (const step of batch) {
      try {
        await claimEnvelopeStep({
          envelope_id,
          step_id: step.step_id,
          instance_id: params.instance_id,
        });
        claimed.push(step);
      } catch {
        /* race */
      }
    }

    if (!claimed.length) {
      await sleep(250);
      continue;
    }

    const results = await Promise.allSettled(
      claimed.map((step) =>
        executeClaimedStep({
          envelope_id,
          runtime_instance_id: instance_id,
          step,
        })
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const step = claimed[i];
      if (result.status === "fulfilled") continue;
      const err = result.reason;
      const maxR = step.max_retries ?? 2;
      const curR = step.retry_count ?? 0;
      const nextRetry = curR + 1;
      const canRetry = nextRetry < maxR;
      if (canRetry) {
        await finalizeEnvelopeStep({
          envelope_id,
          step_id: step.step_id,
          status: "ready",
          retry_count: nextRetry,
        });
      } else {
        await finalizeEnvelopeStep({
          envelope_id,
          step_id: step.step_id,
          status: "failed",
          retry_count: nextRetry,
        });
        try {
          await transition(envelope_id, "failed", {
            step_id: step.step_id,
            error: String((err as Error)?.message || err),
          });
        } catch {
          /* */
        }
        throw err;
      }
    }
  }
}
