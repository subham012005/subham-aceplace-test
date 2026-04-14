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
import { CANONICAL_AGENTS } from "./constants/agents";


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

  // ── Step 1: Identity & Role Resolution ─────────────────────────────────────
  // Define canonical roles for Phase 2 multi-agent orchestration
  const role_assignments: Record<string, string> = {
    COO: agentId,
    Researcher: "agent_researcher",
    Worker: "agent_worker",
    Grader: "agent_grader",
  };

  const plannedSteps = planEnvelopeSteps({
    require_human_approval: false,
    role_assignments,
  });

  const uniqueAgentIds = [...new Set(plannedSteps.map((s) => s.assigned_agent_id).filter(Boolean))];

  const identity_contexts: Record<string, IdentityContext> = {};

  for (const aid of uniqueAgentIds) {
    let stored = await identityKernel.buildIdentityContext(aid);
    
    if (!stored && process.env.ACELOGIC_DEV_LICENSE_FALLBACK === "true") {
      // Lazy Provisioning Fallback (Dev Only)
      const def = CANONICAL_AGENTS.find(a => a.agent_id === aid);

      if (def) {
        console.warn(`[DEV] Agent '${aid}' missing after database wipe. Lazily provisioning from registry...`);
        await identityKernel.registerAgentIdentity({
          agent_id: def.agent_id,
          display_name: def.display_name,
          role: def.agent_class,
          mission: def.mission,
          org_id: def.owner_org_id,
          tier: def.tier.toString(),
        });
        stored = await identityKernel.buildIdentityContext(aid);
      }
    }

    if (!stored) {
      // Hard fail — do not produce unverified envelopes in Phase 2
      throw new Error(`AGENT_PROVISIONING_FAILED:Agent '${aid}' not found in identity store.`);
    }
    identity_contexts[aid] = stored;
  }


  // ── Step 2: Build Envelope (steps embedded inside) ────────────────────────
  const envelope = buildEnvelope({
    orgId: params.orgId ?? "default",
    jobId: params.jobId,
    userId: params.userId,
    prompt: params.prompt,
    identityContext: identity_contexts[agentId],
    identity_contexts, 
    role_assignments,    // Pass explicitly to ensure alignment
    steps: plannedSteps,
  });

  console.log(`[PRODUCER] Created envelope ${envelope.envelope_id} for user ${params.userId}.`);
  console.log(`[PRODUCER] Initial Step (0): type=${envelope.steps[0]?.step_type}, role=${envelope.steps[0]?.role}, assigned=${envelope.steps[0]?.assigned_agent_id}`);
  console.log(`[PRODUCER] Roles: ${JSON.stringify(envelope.role_assignments)}`);
  console.log(`[PRODUCER] Identity Contexts (found): ${Object.keys(envelope.identity_contexts || {}).join(", ")}`);


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
