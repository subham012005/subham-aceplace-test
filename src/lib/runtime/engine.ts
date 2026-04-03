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
import { runEnvelopeParallel } from "./parallel-runner";
import { transition } from "./state-machine";
import type { ExecutionEnvelope, DispatchRequest, DispatchResponse } from "./types";
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

  // ── Step 1: Build Identity Contexts (Multi-Agent Map) ─────────────────────
  const identity_contexts: Record<string, any> = {};
  const coreAgents = [agentId, "agent_researcher", "agent_grader"];
  
  for (const aid of coreAgents) {
    try {
      const stored = await identityKernel.buildIdentityContext(aid);
      if (stored) {
        identity_contexts[aid] = stored;
      } else {
        identity_contexts[aid] = buildDefaultIdentityContext(aid);
      }
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
    identityContext: identity_contexts[agentId], // Principal/Coordinator
    identity_contexts,                           // Full Multi-Agent Map
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

  // ── Step 5: Trigger Runtime Loop ──────────────────────────────────────────
  // Runs async — returns dispatch response immediately, loop runs in background
  runEnvelopeParallel({
    envelope_id: envelope.envelope_id,
    instance_id: instanceId,
  }).catch((err) => {
    console.error(`[ENGINE] Parallel runtime loop crashed for ${envelope.envelope_id}:`, err);
  });

  return {
    success: true,
    envelope_id: envelope.envelope_id,
    envelope,
    message: "Envelope created. Runtime loop started.",
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
