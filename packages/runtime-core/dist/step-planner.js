"use strict";
/**
 * Deterministic step graph (COO → Researcher → Worker → Grader [→ human] → complete)
 * per ACEPLACE Execution Envelope + Step Planner spec.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.planEnvelopeSteps = planEnvelopeSteps;
const crypto_1 = require("crypto");
function stepId(prefix) {
    return `${prefix}_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`;
}
function now() {
    return new Date().toISOString();
}
function planEnvelopeSteps(params) {
    const requireHumanApproval = params.require_human_approval ?? false;
    const roles = params.role_assignments;
    const ts = now();
    const planStepId = stepId("step_plan");
    const assignStepId = stepId("step_assign");
    const artifactStepId = stepId("step_artifact");
    const evalStepId = stepId("step_eval");
    const approvalStepId = stepId("step_approval");
    const completeStepId = stepId("step_complete");
    const steps = [
        {
            step_id: planStepId,
            step_type: "plan",
            role: "COO",
            status: "ready",
            depends_on: [],
            assigned_agent_id: roles.COO || "agent_coo",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 2,
            created_at: ts,
            updated_at: ts,
        },
        {
            step_id: assignStepId,
            step_type: "assign",
            role: "Researcher",
            status: "pending",
            depends_on: [planStepId],
            assigned_agent_id: roles.Researcher || roles.COO || "agent_researcher",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 2,
            created_at: ts,
            updated_at: ts,
        },
        {
            step_id: artifactStepId,
            step_type: "produce_artifact",
            role: "Worker",
            status: "pending",
            depends_on: [assignStepId],
            assigned_agent_id: roles.Worker || roles.COO || "agent_worker",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 2,
            created_at: ts,
            updated_at: ts,
        },
        {
            step_id: evalStepId,
            step_type: "evaluate",
            role: "Grader",
            status: "pending",
            depends_on: [artifactStepId],
            assigned_agent_id: roles.Grader || roles.COO || "agent_grader",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 2,
            created_at: ts,
            updated_at: ts,
        },
    ];
    if (requireHumanApproval) {
        steps.push({
            step_id: approvalStepId,
            step_type: "human_approval",
            role: "COO",
            status: "pending",
            depends_on: [evalStepId],
            assigned_agent_id: roles.COO || "agent_coo",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 0,
            created_at: ts,
            updated_at: ts,
        });
        steps.push({
            step_id: completeStepId,
            step_type: "complete",
            role: "COO",
            status: "pending",
            depends_on: [approvalStepId],
            assigned_agent_id: roles.COO || "agent_coo",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 0,
            created_at: ts,
            updated_at: ts,
        });
    }
    else {
        steps.push({
            step_id: completeStepId,
            step_type: "complete",
            role: "COO",
            status: "pending",
            depends_on: [evalStepId],
            assigned_agent_id: roles.COO || "agent_coo",
            input_ref: {},
            output_ref: {},
            retry_count: 0,
            max_retries: 0,
            created_at: ts,
            updated_at: ts,
        });
    }
    return steps;
}
//# sourceMappingURL=step-planner.js.map