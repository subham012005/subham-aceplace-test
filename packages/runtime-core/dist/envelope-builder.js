"use strict";
/**
 * Envelope Builder — Phase 2
 *
 * Builds a canonical ExecutionEnvelope with steps[] EMBEDDED.
 * No separate ExecutionStep[] — everything lives inside the envelope document.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEnvelope = buildEnvelope;
exports.buildDefaultIdentityContext = buildDefaultIdentityContext;
const crypto_1 = require("crypto");
const constants_1 = require("./constants");
/**
 * Build a canonical ExecutionEnvelope with embedded steps[].
 * The first step is initialized to "ready"; all others are "pending".
 */
function buildEnvelope(params) {
    const now = new Date().toISOString();
    const envelopeId = params.envelopeId ?? `env_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
    const pipeline = params.stepPipeline ?? constants_1.DEFAULT_STEP_PIPELINE;
    const roleAssignments = params.role_assignments ?? {};
    // Build embedded steps — first step is "ready", rest are "pending"
    const steps = params.steps ?? pipeline.map((stepType, index) => {
        const config = constants_1.STEP_TYPE_CONFIG[stepType];
        const roleMap = {
            coo: "COO",
            researcher: "Researcher",
            worker: "Worker",
            grader: "Grader",
        };
        const role = config?.agent_role ? (roleMap[config.agent_role] || config.agent_role) : undefined;
        return {
            step_id: `step_${envelopeId}_${index}`,
            step_type: stepType,
            status: index === 0 ? "ready" : "pending",
            assigned_agent_id: params.identity_contexts
                ? (roleAssignments[role || ""] || config?.agent_role || stepType)
                : (params.identityContext?.agent_id || "unknown"), // Default to coordinator if single-agent
            role: role,
            retry_count: 0,
            max_retries: 2,
        };
    });
    const identity_contexts = params.identity_contexts;
    // Populate role_assignments if not provided
    if (!params.role_assignments) {
        if (!params.identity_contexts) {
            // Single agent mode: map all roles to the primary agent
            if (params.identityContext) {
                roleAssignments.COO = params.identityContext.agent_id;
                roleAssignments.Researcher = params.identityContext.agent_id;
                roleAssignments.Worker = params.identityContext.agent_id;
                roleAssignments.Grader = params.identityContext.agent_id;
            }
        }
        else {
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
        // Multi-agent identity contexts and authority leases
        authority_leases: {},
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
function buildDefaultIdentityContext(agentId) {
    return {
        agent_id: agentId,
        identity_fingerprint: "pending_verification",
        verified: false,
    };
}
//# sourceMappingURL=envelope-builder.js.map