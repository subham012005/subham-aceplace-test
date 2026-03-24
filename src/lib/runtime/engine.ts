/**
 * Runtime Engine Orchestrator — Phase 2
 *
 * Dispatch creates an execution_envelope with embedded steps[] and authority_lease=null.
 * Execution is driven by the deterministic runtime loop (runtime-loop.ts).
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import * as identityKernel from "./kernels/identity";
import * as persistence from "./kernels/persistence";
import { buildEnvelope, buildDefaultIdentityContext } from "./envelope-builder";
import { runEnvelope } from "./runtime-loop";
import { transition } from "./state-machine";
import type { ExecutionEnvelope, DispatchRequest, DispatchResponse } from "./types";
import { randomUUID } from "crypto";

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || "http://localhost:8001";

/**
 * Dispatch a new task — creates an envelope and starts the runtime loop.
 *
 * Full flow:
 *   1. Build identity context from agents/{agent_id}
 *   2. Build ExecutionEnvelope with steps[] embedded
 *   3. Persist envelope to execution_envelopes/{envelope_id}
 *   4. Link job → envelope (for UI display only)
 *   5. Trigger runtime loop (acquires lease + executes steps)
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

  // ── Step 1: Build Identity Context ────────────────────────────────────────
  let identityContext = buildDefaultIdentityContext(agentId);
  try {
    const stored = await identityKernel.buildIdentityContext(agentId);
    if (stored) identityContext = stored;
  } catch {
    // agents collection may not exist yet in dev — use default
  }

  // ── Step 2: Build Envelope (steps embedded inside) ────────────────────────
  const envelope = buildEnvelope({
    orgId: params.orgId ?? "default",
    jobId: params.jobId,
    userId: params.userId,
    prompt: params.prompt,
    identityContext,
  });

  // ── Step 3: Persist Envelope ──────────────────────────────────────────────
  await persistence.createEnvelope(envelope);

  await persistence.addTrace(
    envelope.envelope_id, "", agentId, identityContext.identity_fingerprint,
    "ENVELOPE_CREATED", { step_count: envelope.steps.length }
  );

  // ── Step 4: Link Job → Envelope (UI pointer only) ─────────────────────────
  if (params.jobId) {
    await persistence.linkJobToEnvelope(params.jobId, envelope.envelope_id);
  }

  // ── Step 5: Trigger Runtime Loop ──────────────────────────────────────────
  // Runs async — returns dispatch response immediately, loop runs in background
  runEnvelope(envelope.envelope_id, instanceId).catch((err) => {
    console.error(`[ENGINE] Runtime loop crashed for ${envelope.envelope_id}:`, err);
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
