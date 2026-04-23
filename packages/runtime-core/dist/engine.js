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
const db_1 = require("./db");
const constants_1 = require("./constants");
const agents_1 = require("./constants/agents");
const hash_1 = require("./hash");
/**
 * Dispatch a new task — creates an envelope and enqueues it for the runtime-worker.
 */
async function dispatch(params) {
    const db = (0, db_1.getDb)();
    const agentId = params.agentId || "agent_coo";
    // Deterministic envelope ID for job-based dispatches
    const suggestedEnvId = params.jobId
        ? `env_${(0, hash_1.sha256)(params.jobId).slice(0, 20)}`
        : undefined;
    return await db.runTransaction(async (tx) => {
        // ── Step 0: Idempotency Check (Inside Transaction) ────────────────────────
        if (params.jobId) {
            const jobRef = db.collection(constants_1.COLLECTIONS.JOBS).doc(params.jobId);
            const jobSnap = await tx.get(jobRef);
            if (jobSnap.exists && jobSnap.data()?.envelope_id) {
                const envId = jobSnap.data()?.envelope_id;
                const envRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId);
                const envSnap = await tx.get(envRef);
                if (envSnap.exists) {
                    return {
                        success: true,
                        envelope_id: envId,
                        envelope: envSnap.data(),
                        message: "Existing job found. Returning current state.",
                    };
                }
            }
        }
        // ── Step 1: Identity & Role Resolution ─────────────────────────────────────
        const role_assignments = {
            COO: agentId,
            Researcher: "agent_researcher",
            Worker: "agent_worker",
            Grader: "agent_grader",
        };
        const plannedSteps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments,
        });
        const uniqueAgentIds = [...new Set(plannedSteps.map((s) => s.assigned_agent_id).filter(Boolean))];
        const identity_contexts = {};
        let identityFailure = false;
        let identityFailureReason = "";
        for (const aid of uniqueAgentIds) {
            let stored = await identityKernel.buildIdentityContext(aid);
            // 🛡️ AUTO-PROVISION: If agent not found (e.g. fresh/cleared database), seed it from
            // the canonical registry and then build the identity context. This prevents
            // AGENT_PROVISIONING_FAILED on a clean environment without requiring a manual seed step.
            if (!stored) {
                const canonical = agents_1.CANONICAL_AGENTS.find(a => a.agent_id === aid);
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
                    const { createHash } = await Promise.resolve().then(() => __importStar(require("crypto")));
                    const realFingerprint = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
                    await db.collection(constants_1.COLLECTIONS.AGENTS).doc(aid).set({
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
        const envelope = (0, envelope_builder_1.buildEnvelope)({
            envelopeId: suggestedEnvId,
            orgId: params.orgId ?? "default",
            jobId: params.jobId,
            userId: params.userId,
            prompt: params.prompt,
            identity_contexts,
            role_assignments,
            steps: plannedSteps,
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
        const envRef = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope.envelope_id);
        tx.set(envRef, envelope);
        const artRef = db.collection(constants_1.COLLECTIONS.ARTIFACTS).doc(planArtifactId);
        tx.set(artRef, planArtifact);
        if (params.jobId) {
            const jobRef = db.collection(constants_1.COLLECTIONS.JOBS).doc(params.jobId);
            tx.set(jobRef, {
                envelope_id: envelope.envelope_id,
                user_id: params.userId,
                prompt: params.prompt,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                status: identityFailure ? "quarantined" : "created"
            }, { merge: true });
        }
        // Queue entry
        const queueRef = db.collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envelope.envelope_id);
        tx.set(queueRef, {
            envelope_id: envelope.envelope_id,
            status: identityFailure ? "quarantined" : "queued",
            created_at: new Date().toISOString(),
        });
        // Trace
        const traceId = `trace_envelope_created_${Date.now()}`;
        const traceRef = db.collection(constants_1.COLLECTIONS.EXECUTION_TRACES).doc(traceId);
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
    await persistence.addTrace(envelopeId, "", "human", "", "HUMAN_REJECTED", undefined, { reason });
}
//# sourceMappingURL=engine.js.map