"use strict";
/**
 * ACEPLACE ACE → #us#.task.handoff → execution envelope (entry contract).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAceHandoff = createAceHandoff;
exports.validateAceHandoff = validateAceHandoff;
exports.createExecutionEnvelopeFromHandoff = createExecutionEnvelopeFromHandoff;
exports.acceptAceHandoff = acceptAceHandoff;
const crypto_1 = require("crypto");
const persistence = __importStar(require("./kernels/persistence"));
const identity_1 = require("./kernels/identity");
const step_planner_1 = require("./step-planner");
const emitRuntimeMetric_1 = require("./telemetry/emitRuntimeMetric");
function createAceHandoff(input) {
    if (!input.role_assignments?.COO) {
        throw new Error("COO_ROLE_REQUIRED");
    }
    const normalizedRoles = Object.entries(input.role_assignments)
        .filter(([_, agent_id]) => Boolean(agent_id))
        .map(([role, agent_id]) => ({ role: role, agent_id: agent_id }));
    const draft_id = `draft_${(0, crypto_1.randomUUID)().replace(/-/g, "")}`;
    return {
        protocol: "#us#",
        version: "1.0",
        message_type: "#us#.task.handoff",
        execution: {
            org_id: input.org_id,
            requested_by_user_id: input.requested_by_user_id,
            session_id: input.session_id,
            draft_id,
            ...(input.license_id ? { license_id: input.license_id } : {}),
        },
        identity: {
            agent_id: "aceplace_ace",
            identity_fingerprint: "aceplace_ace_interface",
        },
        authority: {
            approval_required: input.require_human_approval ?? false,
        },
        payload: {
            task: {
                description: input.task_description,
                context: input.context || {},
                attachments: input.attachments || [],
            },
            role_assignments: normalizedRoles,
        },
        metadata: { created_at: new Date().toISOString() },
    };
}
function assertString(value, field) {
    if (!value || typeof value !== "string") {
        throw new Error(`INVALID_FIELD:${field}`);
    }
}
function isValidRole(role) {
    return (role === "COO" ||
        role === "Researcher" ||
        role === "Worker" ||
        role === "Grader");
}
function validateAceHandoff(handoff) {
    if (!handoff || typeof handoff !== "object") {
        throw new Error("HANDOFF_INVALID_OBJECT");
    }
    const h = handoff;
    if (h.protocol !== "#us#")
        throw new Error("INVALID_PROTOCOL");
    if (h.version != null && h.version !== "1.0")
        throw new Error("INVALID_PROTOCOL_VERSION");
    if (h.message_type !== "#us#.task.handoff")
        throw new Error("INVALID_MESSAGE_TYPE");
    const exec = h.execution;
    if (!exec)
        throw new Error("MISSING_EXECUTION");
    assertString(exec.org_id, "execution.org_id");
    assertString(exec.requested_by_user_id, "execution.requested_by_user_id");
    assertString(exec.session_id, "execution.session_id");
    assertString(exec.draft_id, "execution.draft_id");
    if (exec.license_id !== undefined) {
        assertString(exec.license_id, "execution.license_id");
    }
    const payload = h.payload;
    if (!payload)
        throw new Error("MISSING_PAYLOAD");
    const task = payload.task;
    if (!task)
        throw new Error("MISSING_TASK");
    assertString(task.description, "payload.task.description");
    if (task.context !== undefined && typeof task.context !== "object") {
        throw new Error("INVALID_TASK_CONTEXT");
    }
    if (task.attachments !== undefined && !Array.isArray(task.attachments)) {
        throw new Error("INVALID_TASK_ATTACHMENTS");
    }
    const roles = payload.role_assignments;
    if (!Array.isArray(roles))
        throw new Error("ROLE_ASSIGNMENTS_REQUIRED");
    if (roles.length === 0)
        throw new Error("EMPTY_ROLE_ASSIGNMENTS");
    const seen = new Set();
    for (const entry of roles) {
        const r = entry;
        if (!r.role)
            throw new Error("ROLE_MISSING");
        if (!isValidRole(r.role))
            throw new Error(`INVALID_ROLE:${r.role}`);
        assertString(r.agent_id, `INVALID_AGENT_ID_FOR_ROLE:${r.role}`);
        if (seen.has(r.role))
            throw new Error(`DUPLICATE_ROLE:${r.role}`);
        seen.add(r.role);
    }
    if (!seen.has("COO"))
        throw new Error("COO_ROLE_REQUIRED");
    const auth = h.authority;
    if (auth?.approval_required !== undefined &&
        typeof auth.approval_required !== "boolean") {
        throw new Error("INVALID_APPROVAL_FLAG");
    }
}
async function resolveAgentFingerprint(agentId) {
    const built = await (0, identity_1.buildIdentityContext)(agentId);
    if (built)
        return built.identity_fingerprint;
    return "pending_verification";
}
function normalizeRoleAssignments(roles) {
    const out = {};
    for (const ra of roles) {
        if (!ra?.role || !ra.agent_id)
            continue;
        out[ra.role] = ra.agent_id;
    }
    return out;
}
async function createExecutionEnvelopeFromHandoff(params) {
    const now = new Date().toISOString();
    const steps = (0, step_planner_1.planEnvelopeSteps)({
        require_human_approval: params.require_human_approval,
        role_assignments: params.role_assignments,
    });
    const coordinatorCtx = params.identity_contexts[params.coordinator_agent_id] ||
        Object.values(params.identity_contexts)[0];
    const envelope = {
        envelope_id: params.envelope_id,
        org_id: params.org_id,
        status: "created",
        license_id: params.license_id ?? "dev_license",
        root_task_id: params.root_task_id,
        coordinator_agent_id: params.coordinator_agent_id,
        multi_agent: true,
        identity_contexts: params.identity_contexts,
        authority_leases: {},
        decomposition_plan: null,
        steps,
        authority_lease: null,
        identity_context: coordinatorCtx,
        artifact_refs: [],
        trace_head_hash: null,
        created_at: now,
        updated_at: now,
        prompt: params.task_description,
        user_id: params.requested_by_user_id,
    };
    await persistence.createEnvelope(envelope);
    await (0, emitRuntimeMetric_1.emitRuntimeMetric)({
        event_type: "ENVELOPE_CREATED",
        envelope_id: params.envelope_id,
        org_id: params.org_id,
        agent_id: params.coordinator_agent_id,
    }).catch(() => undefined);
    await persistence.addTrace(params.envelope_id, "", params.coordinator_agent_id, coordinatorCtx.identity_fingerprint, "HANDOFF_ENVELOPE_CREATED", { step_count: steps.length });
}
async function acceptAceHandoff(handoff) {
    validateAceHandoff(handoff);
    const { org_id, requested_by_user_id, session_id, draft_id, license_id } = handoff.execution;
    const normalized = normalizeRoleAssignments(handoff.payload.role_assignments);
    const cooAgentId = normalized.COO;
    if (!cooAgentId)
        throw new Error("COO_AGENT_REQUIRED");
    const uniqueAgentIds = Array.from(new Set(Object.values(normalized).filter((id) => Boolean(id))));
    const identity_contexts = {};
    for (const agentId of uniqueAgentIds) {
        const identity_fingerprint = await resolveAgentFingerprint(agentId);
        identity_contexts[agentId] = {
            agent_id: agentId,
            identity_fingerprint,
            verified: identity_fingerprint !== "pending_verification",
            instance_id: `inst_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 16)}`,
            gate_level: 0,
        };
    }
    const envelope_id = `env_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
    await createExecutionEnvelopeFromHandoff({
        envelope_id,
        org_id,
        root_task_id: draft_id,
        coordinator_agent_id: cooAgentId,
        identity_contexts,
        role_assignments: normalized,
        require_human_approval: handoff.authority?.approval_required ?? false,
        license_id: license_id || "dev_license",
        task_description: handoff.payload.task.description,
        requested_by_user_id,
    });
    await persistence.enqueueEnvelope(envelope_id);
    return { success: true, envelope_id };
}
//# sourceMappingURL=ace-handoff.js.map