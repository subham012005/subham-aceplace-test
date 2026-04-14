/**
 * Envelope Builder — Phase 2
 *
 * Builds a canonical ExecutionEnvelope with steps[] EMBEDDED.
 * No separate ExecutionStep[] — everything lives inside the envelope document.
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import { randomUUID } from "crypto";
import { DEFAULT_STEP_PIPELINE, STEP_TYPE_CONFIG } from "./constants";
import type {
  ExecutionEnvelope,
  EnvelopeStep,
  IdentityContext,
  StepType,
} from "./types";

/**
 * Build a canonical ExecutionEnvelope with embedded steps[].
 * The first step is initialized to "ready"; all others are "pending".
 */
export function buildEnvelope(params: {
  orgId?: string;
  jobId?: string;
  userId?: string;
  prompt?: string;
  identityContext: IdentityContext;
  identity_contexts?: Record<string, IdentityContext>;
  role_assignments?: Record<string, string>;
  stepPipeline?: string[];        // canonical step types from Python engine
  steps?: EnvelopeStep[];         // explicitly mapped steps from the planner
}): ExecutionEnvelope {
  const now = new Date().toISOString();
  const envelopeId = `env_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const pipeline = params.stepPipeline ?? DEFAULT_STEP_PIPELINE;

  const roleAssignments = params.role_assignments ?? {};

  // Build embedded steps — first step is "ready", rest are "pending"
  const steps: EnvelopeStep[] = params.steps ?? pipeline.map((stepType, index) => {
    const config = STEP_TYPE_CONFIG[stepType as keyof typeof STEP_TYPE_CONFIG];
    const roleMap: Record<string, any> = {
      coo: "COO",
      researcher: "Researcher",
      worker: "Worker",
      grader: "Grader",
    };
    const role = config?.agent_role ? (roleMap[config.agent_role] || config.agent_role) : undefined;

    return {
      step_id: `step_${envelopeId}_${index}`,
      step_type: stepType as StepType,
      status: index === 0 ? "ready" : "pending",
      assigned_agent_id: params.identity_contexts
          ? (config?.agent_role ?? stepType)
          : (params.identityContext.agent_id), // Default to coordinator if single-agent
      role: role,
      retry_count: 0,
      max_retries: 2,
    } as EnvelopeStep;
  });

  const identity_contexts = params.identity_contexts ?? {
    [params.identityContext.agent_id]: params.identityContext,
  };

  // Populate role_assignments if not provided
  if (!params.role_assignments) {
    if (!params.identity_contexts) {
       // Single agent mode: map all roles to the primary agent
       roleAssignments.COO = params.identityContext.agent_id;
       roleAssignments.Researcher = params.identityContext.agent_id;
       roleAssignments.Worker = params.identityContext.agent_id;
       roleAssignments.Grader = params.identityContext.agent_id;
    } else {
       // Multi-agent mode: try to infer from step config
       for (const step of steps) {
         if (step.role && !roleAssignments[step.role]) {
           roleAssignments[step.role] = step.assigned_agent_id;
         }
       }
    }
  }

  const assignedAgents = new Set(steps.map(s => s.assigned_agent_id));
  if (assignedAgents.size > 1 && !params.identity_contexts) {
    throw new Error(`INCOMPLETE_IDENTITY_CONTEXTS: Multi-agent envelope requires explicit identity_contexts map covering exactly the planned agents.`);
  }

  // Hard Invariant: All assigned agents MUST have a corresponding identity context
  for (const agentId of assignedAgents) {
    if (!identity_contexts[agentId]) {
      throw new Error(`MISSING_AGENT_CONTEXT: Agent '${agentId}' has no identity entry in identity_contexts.`);
    }
    if (!identity_contexts[agentId].identity_fingerprint || identity_contexts[agentId].identity_fingerprint === "pending_verification") {
      throw new Error(`INVALID_AGENT_FINGERPRINT: Agent '${agentId}' has invalid or pending identity context.`);
    }
  }


  return {
    envelope_id: envelopeId,
    org_id: params.orgId ?? "default",
    status: "created",

    // Steps EMBEDDED (not external collection)
    steps,

    // Lease starts as null — acquired before first step
    authority_lease: null,

    // Identity context from agent store
    identity_context: params.identityContext,

  // Multi-agent identity contexts
    multi_agent: assignedAgents.size > 1,
    identity_contexts,
    role_assignments: roleAssignments,

    // Metadata for completion
    artifact_refs: [],
    trace_head_hash: null,

    created_at: now,
    updated_at: now,

    // Legacy link fields
    job_id: params.jobId,
    user_id: params.userId,
    prompt: params.prompt,
  };
}

/**
 * Build a minimal identity context (no agent store lookup).
 * Used for development/testing when agents collection doesn't exist.
 */
export function buildDefaultIdentityContext(agentId: string): IdentityContext {
  return {
    agent_id: agentId,
    identity_fingerprint: "pending_verification",
    verified: false,
  };
}
