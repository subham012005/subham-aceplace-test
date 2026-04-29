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
import { sha256 } from "./hash";


/**
 * Dispatch a new task — creates an envelope and enqueues it for the runtime-worker.
 */
export async function dispatch(params: {
  prompt: string;
  userId: string;
  jobId?: string;
  orgId?: string;
  agentId?: string;
  knowledge_context?: { collections?: string[]; direct_text?: string; enabled: boolean };
  instruction_context?: { profiles?: string[]; enabled: boolean };
  web_search_context?: { enabled: boolean; queries?: string[]; sources_used?: string[] };
}): Promise<DispatchResponse> {
  const db = getDb();
  const agentId = params.agentId || "agent_coo";

  // Deterministic envelope ID for job-based dispatches
  const suggestedEnvId = params.jobId 
    ? `env_${sha256(params.jobId).slice(0, 20)}`
    : undefined;

  return await db.runTransaction(async (tx) => {
    // ── Step 0: Idempotency Check (Inside Transaction) ────────────────────────
    if (params.jobId) {
      const jobRef = db.collection(COLLECTIONS.JOBS).doc(params.jobId);
      const jobSnap = await tx.get(jobRef);
      
      if (jobSnap.exists && jobSnap.data()?.envelope_id) {
        const envId = jobSnap.data()?.envelope_id;
        const envRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId);
        const envSnap = await tx.get(envRef);
        
        if (envSnap.exists) {
          return {
            success: true,
            envelope_id: envId,
            envelope: envSnap.data() as ExecutionEnvelope,
            message: "Existing job found. Returning current state.",
          };
        }
      }
    }

    // ── Step 1: Identity & Role Resolution ─────────────────────────────────────
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
    let identityFailure = false;
    let identityFailureReason = "";

    for (const aid of uniqueAgentIds) {
      let stored = await identityKernel.buildIdentityContext(aid);

      // 🛡️ AUTO-PROVISION: If agent not found (e.g. fresh/cleared database), seed it from
      // the canonical registry and then build the identity context. This prevents
      // AGENT_PROVISIONING_FAILED on a clean environment without requiring a manual seed step.
      if (!stored) {
        const canonical = CANONICAL_AGENTS.find(a => a.agent_id === aid);
        if (canonical) {
          console.log(`[engine][auto-provision] Seeding missing canonical agent: ${aid}`);
          const canonicalBody = {
            agent_id: canonical.agent_id,
            display_name: canonical.display_name,
            role: canonical.agent_class,
            mission: canonical.mission,
            org_id: canonical.owner_org_id,
            created_at: new Date().toISOString(),
          };
          const canonicalJson = JSON.stringify(canonicalBody);
          const { createHash } = await import("crypto");
          const realFingerprint = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
          await db.collection(COLLECTIONS.AGENTS).doc(aid).set({
            agent_id: canonical.agent_id,
            display_name: canonical.display_name,
            canonical_identity_json: canonicalJson,
            identity_fingerprint: realFingerprint,
            fingerprint: realFingerprint,
            agent_class: canonical.agent_class,
            jurisdiction: canonical.jurisdiction,
            mission: canonical.mission,
            tier: canonical.tier,
            acelogic_id: canonical.acelogic_id,
            owner_org_id: canonical.owner_org_id,
            created_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
          });
          stored = await identityKernel.buildIdentityContext(aid);
        }
      }

      if (!stored) {
        throw new Error(`AGENT_PROVISIONING_FAILED:Agent '${aid}' not found and is not a canonical agent.`);
      }
      if (!stored.verified) {
        identityFailure = true;
        identityFailureReason = `Agent '${aid}' is not verified (verified=false).`;
      }
      identity_contexts[aid] = stored;
    }

    // ── Step 2: Build Envelope ────────────────────────────────────────────────
    const envelope = buildEnvelope({
      envelopeId: suggestedEnvId,
      orgId: params.orgId || params.userId,
      jobId: params.jobId,
      userId: params.userId,
      prompt: params.prompt,
      identity_contexts, 
      role_assignments,    
      steps: plannedSteps,
      knowledge_context: params.knowledge_context,
      instruction_context: params.instruction_context,
      web_search_context: params.web_search_context,
    });

    if (identityFailure) {
      envelope.status = "quarantined";
      envelope.updated_at = new Date().toISOString();
    }

    // 🤖 ALIGNMENT: Create initial 'plan' artifact for Mission Strategy visibility
    const planArtifactId = `art_plan_${Date.now()}`;

    // Map role assignments to UI-friendly task objects
    const assignments = Object.entries(role_assignments).map(([role, agentId]) => ({
      name: `${role} Unit`,
      task: `Perform primary ${role} operations for mission execution.`,
      assigned_to: agentId,
      priority: "high"
    }));

    const planArtifact = {
      artifact_id: planArtifactId,
      execution_id: envelope.envelope_id,
      produced_by_agent: agentId,
      identity_fingerprint: identity_contexts[agentId].identity_fingerprint,
      artifact_type: "plan",
      artifact_content: JSON.stringify({
        strategic_objective: params.prompt,
        mission: "ACEPLACE Strategic Execution",
        assignments: assignments,
        timestamp: new Date().toISOString()
      }),
      created_at: new Date().toISOString(),
    };
    envelope.artifact_refs = [planArtifactId];

    // ── Step 3: Persist (Atomically in Transaction) ──────────────────────────
    const envRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope.envelope_id);
    tx.set(envRef, envelope);

    const artRef = db.collection(COLLECTIONS.ARTIFACTS).doc(planArtifactId);
    tx.set(artRef, planArtifact);

    if (params.jobId) {
      const jobRef = db.collection(COLLECTIONS.JOBS).doc(params.jobId);
      tx.set(jobRef, {
        envelope_id: envelope.envelope_id,
        execution_id: envelope.envelope_id,
        user_id: params.userId,
        prompt: params.prompt,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        status: identityFailure ? "quarantined" : "created"
      }, { merge: true });
    }

    // Queue entry
    const queueRef = db.collection(COLLECTIONS.EXECUTION_QUEUE).doc(envelope.envelope_id);
    tx.set(queueRef, {
      envelope_id: envelope.envelope_id,
      status: identityFailure ? "quarantined" : "queued",
      created_at: new Date().toISOString(),
    });

    // Trace
    const traceId = `trace_envelope_created_${Date.now()}`;
    const traceRef = db.collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId);
    tx.set(traceRef, {
      trace_id: traceId,
      envelope_id: envelope.envelope_id,
      step_id: "",
      agent_id: agentId,
      identity_fingerprint: identity_contexts[agentId].identity_fingerprint,
      event_type: "ENVELOPE_CREATED",
      timestamp: new Date().toISOString(),
      metadata: { step_count: envelope.steps.length }
    });

    if (identityFailure) {
      // Re-fetch status if we want to return the quarantined state
      return {
        success: false,
        envelope_id: envelope.envelope_id,
        envelope,
        message: `Quarantined: ${identityFailureReason}`,
      };
    }

    return {
      success: true,
      envelope_id: envelope.envelope_id,
      envelope,
      message: "Task dispatched successfully. Runtime loop active.",
    };
  });
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
  await persistence.addTrace(envelopeId, "", "human", "", "HUMAN_REJECTED", undefined, { reason });
}
