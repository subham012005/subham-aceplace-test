"use strict";
/**
 * Runtime Engine Orchestrator — Phase 2
 *
 * Dispatch creates an execution_envelope with embedded steps[] and authority_lease=null.
 * Execution is driven by the parallel multi-agent runner (parallel-runner.ts).
 *
 * Phase 2 | Envelope-Driven Runtime
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
exports.dispatch = dispatch;
exports.getEnvelopeState = getEnvelopeState;
exports.approveEnvelope = approveEnvelope;
exports.rejectEnvelope = rejectEnvelope;
const identityKernel = __importStar(require("./kernels/identity"));
const persistence = __importStar(require("./kernels/persistence"));
const envelope_builder_1 = require("./envelope-builder");
const step_planner_1 = require("./step-planner");
const state_machine_1 = require("./state-machine");
const crypto_1 = require("crypto");
const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || "http://localhost:8001";
/**
 * Dispatch a new task — creates an envelope and starts the runtime loop.
 */
async function dispatch(params) {
    const agentId = params.agentId || "agent_coo";
    const instanceId = `inst_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 16)}`;
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
    const plannedSteps = (0, step_planner_1.planEnvelopeSteps)({
        require_human_approval: false,
        role_assignments: {
            COO: agentId,
            Researcher: "agent_researcher",
            Worker: "agent_worker",
            Grader: "agent_grader",
        },
    });
    const uniqueAgentIds = [...new Set(plannedSteps.map((s) => s.assigned_agent_id).filter(Boolean))];
    const identity_contexts = {};
    for (const aid of uniqueAgentIds) {
        try {
            const stored = await identityKernel.buildIdentityContext(aid);
            identity_contexts[aid] = stored ?? (0, envelope_builder_1.buildDefaultIdentityContext)(aid);
        }
        catch {
            identity_contexts[aid] = (0, envelope_builder_1.buildDefaultIdentityContext)(aid);
        }
    }
    // ── Step 2: Build Envelope (steps embedded inside) ────────────────────────
    const envelope = (0, envelope_builder_1.buildEnvelope)({
        orgId: params.orgId ?? "default",
        jobId: params.jobId,
        userId: params.userId,
        prompt: params.prompt,
        identityContext: identity_contexts[agentId] ?? (0, envelope_builder_1.buildDefaultIdentityContext)(agentId),
        identity_contexts, // Full multi-agent context map — derived from planner
        steps: plannedSteps, // Embed exact steps mapped by planner
    });
    // ── Step 3: Persist Envelope ──────────────────────────────────────────────
    await persistence.createEnvelope(envelope);
    await persistence.addTrace(envelope.envelope_id, "", agentId, identity_contexts[agentId].identity_fingerprint, "ENVELOPE_CREATED", { step_count: envelope.steps.length });
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
async function getEnvelopeState(envelopeId) {
    const envelope = await persistence.getEnvelope(envelopeId);
    if (!envelope)
        return null;
    const messages = await (await Promise.resolve().then(() => __importStar(require("./kernels/communications"))))
        .getEnvelopeMessages(envelopeId);
    return { envelope, messages };
}
/**
 * Approve the envelope after human review — advances to "approved" state.
 */
async function approveEnvelope(envelopeId) {
    await (0, state_machine_1.transition)(envelopeId, "approved", { approved_by: "human_review" });
    await persistence.addTrace(envelopeId, "", "human", "", "HUMAN_APPROVED");
}
/**
 * Reject the envelope at a human review gate.
 */
async function rejectEnvelope(envelopeId, reason) {
    await (0, state_machine_1.transition)(envelopeId, "rejected", { reason: reason ?? "human_rejected" });
    await persistence.addTrace(envelopeId, "", "human", "", "HUMAN_REJECTED", { reason });
}
//# sourceMappingURL=engine.js.map