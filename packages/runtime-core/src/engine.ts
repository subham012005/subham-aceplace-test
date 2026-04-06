/**
 * Runtime Engine Orchestrator — Phase 2
 *
 * Dispatch creates an execution_envelope with embedded steps[] and authority_lease=null.
 * Execution is driven by the parallel multi-agent runner (parallel-runner.ts).
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import * as identityKernel from "./kernels/identity";
import * as persistence from "./kernels/persistence";
import { buildEnvelope, buildDefaultIdentityContext } from "./envelope-builder";
import { planEnvelopeSteps } from "./step-planner";
import { transition } from "./state-machine";
import { getDb } from "./db";
import { COLLECTIONS } from "./constants";
import type { ExecutionEnvelope, DispatchRequest, DispatchResponse, IdentityContext } from "./types";
import { randomUUID } from "crypto";

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || "http://localhost:8001";

/**
 * Dispatch a new task — creates an envelope and starts the runtime loop.
 */
export async function dispatch(params: {
  prompt: string;
  userId: string;
  jobId?: string;
  orgId?: string;
  agentId?: string;
}): Promise<DispatchResponse> {
  const agentId = params.agentId || "agent_coo";
  const instanceId = `inst_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  // ── Step 0: Idempotency Check ─────────────────────────────────────────────
  if (params.jobId) {
    const existingJob = await persistence.getJob(params.jobId);
    if (existingJob && existingJob.envelope_id) {
      const existingEnvelope = await persistence.getEnvelope(existingJob.envelope_id);
      if (existingEnvelope) {
        return {
          success: true,
          envelope_id: existingEnvelope.envelope_id,
          envelope: existingEnvelope,
          message: "Existing job found. Returning current state.",
        };
      }
    }
  }

  // ── Step 1: Plan steps first — derive agent set from step assignments ────────
  // AUDIT FIX P0#2: identity_contexts MUST be derived from actual planned steps,
  // not from a hardcoded array. The planner is the authoritative source of agent IDs.
  const plannedSteps = planEnvelopeSteps({
    require_human_approval: false,
    role_assignments: {
      COO: agentId,
      Researcher: "agent_researcher",
      Worker: "agent_worker",
      Grader: "agent_grader",
    },
  });

  const uniqueAgentIds = [...new Set(plannedSteps.map((s) => s.assigned_agent_id).filter(Boolean))];

  const identity_contexts: Record<string, IdentityContext> = {};
  for (const aid of uniqueAgentIds) {
    try {
      const stored = await identityKernel.buildIdentityContext(aid);
      identity_contexts[aid] = stored ?? buildDefaultIdentityContext(aid);
    } catch {
      identity_contexts[aid] = buildDefaultIdentityContext(aid);
    }
  }

  // ── Step 2: Build Envelope (steps embedded inside) ────────────────────────
  const envelope = buildEnvelope({
    orgId: params.orgId ?? "default",
    jobId: params.jobId,
    userId: params.userId,
    prompt: params.prompt,
    identityContext: identity_contexts[agentId] ?? buildDefaultIdentityContext(agentId),
    identity_contexts,  // Full multi-agent context map — derived from planner
    steps: plannedSteps, // Embed exact steps mapped by planner
  });

  // ── Step 3: Persist Envelope ──────────────────────────────────────────────
  await persistence.createEnvelope(envelope);

  await persistence.addTrace(
    envelope.envelope_id, "", agentId, identity_contexts[agentId].identity_fingerprint,
    "ENVELOPE_CREATED", { step_count: envelope.steps.length }
  );

  // ── Step 4: Link Job → Envelope (UI pointer only) ─────────────────────────
  if (params.jobId) {
    // Write envelope_id into job document immediately so UI can find it
    await persistence.syncJobStatus(params.jobId, "executing", {
      envelope_id: envelope.envelope_id,
      active_stage: "DISPATCHED",
      assigned_agent_id: agentId,
    });
    await persistence.linkJobToEnvelope(params.jobId, envelope.envelope_id);
  }

  // ── Step 5: Enqueue for runtime-worker ───────────────────────────────────────
  // AUDIT FIX P0#1: Web tier NEVER executes the runtime loop.
  // Enqueue the envelope so the dedicated runtime-worker process picks it up.
  await persistence.enqueueEnvelope(envelope.envelope_id);

  return {
    success: true,
    envelope_id: envelope.envelope_id,
    envelope,
    message: "Envelope created and queued for worker execution.",
  };
}



/**
 * Get the current state of an envelope by ID.
 */
export async function getEnvelopeState(envelopeId: string): Promise<{
  envelope: ExecutionEnvelope;
  messages: unknown[];
} | null> {
  const envelope = await persistence.getEnvelope(envelopeId);
  if (!envelope) return null;

  const messages = await (await import("./kernels/communications"))
    .getEnvelopeMessages(envelopeId);

  return { envelope, messages };
}

/**
 * Approve the envelope after human review — advances to "approved" state.
 */
export async function approveEnvelope(envelopeId: string): Promise<void> {
  await transition(envelopeId, "approved", { approved_by: "human_review" });
  await persistence.addTrace(envelopeId, "", "human", "", "HUMAN_APPROVED");
}

/**
 * Reject the envelope at a human review gate.
 */
export async function rejectEnvelope(envelopeId: string, reason?: string): Promise<void> {
  await transition(envelopeId, "rejected", { reason: reason ?? "human_rejected" });
  await persistence.addTrace(envelopeId, "", "human", "", "HUMAN_REJECTED", { reason });
}
