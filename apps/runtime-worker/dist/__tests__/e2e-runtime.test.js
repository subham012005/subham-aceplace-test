"use strict";
/**
 * ACEPLACE Phase 2 — Deterministic E2E Runtime Test
 *
 * Covers:
 *   1. Full multi-agent task: handoff → worker claim → execution → completion
 *   2. Quarantine on identity fingerprint mismatch
 *   3. FORK_DETECTED: active lease held by a different instance → quarantine
 *   4. Duplicate step claim blocked (STEP_NOT_CLAIMABLE)
 *   5. No execution without a valid lease (validatePerAgentLease throws)
 *   6. Runtime guards reject terminal envelopes and missing identity contexts
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
const vitest_1 = require("vitest");
// ── Database Setup (MUST RUN BEFORE ANY OTHER IMPORTS) ────────────────────────
const memory_db_1 = require("../../../../packages/runtime-core/src/__tests__/memory-db");
global.__ACEPLACE_MEMORY_DB__ = memory_db_1.memoryDb;
vitest_1.vi.setConfig({ testTimeout: 60000 });
// Mock global fetch for Agent Engine simulation
vitest_1.vi.stubGlobal('fetch', vitest_1.vi.fn().mockImplementation(async (url) => {
    if (url.includes("/execute-step")) {
        return {
            ok: true,
            text: async () => JSON.stringify({
                success: true,
                artifact_id: `artifact_${Math.random().toString(36).slice(2, 10)}`,
            }),
            json: async () => ({
                success: true,
                artifact_id: `artifact_${Math.random().toString(36).slice(2, 10)}`,
            }),
        };
    }
    return { ok: true, json: async () => ({ success: true }) };
}));
const TEST_WORKER_ID = "test_worker_e2e_001";
const ORG_ID = "org_e2e_test";
const USER_ID = "user_e2e_tester";
(0, vitest_1.describe)("ACEPLACE Deterministic Runtime — End-to-End", () => {
    (0, vitest_1.it)("should process a multi-agent task via dispatch to completion", async () => {
        // Dynamically load to ensure the global DB singleton is picked up after it was set
        const { dispatch, registerAgentIdentity, COLLECTIONS, runEnvelopeParallel, claimNextEnvelope } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        // 1. Register all required agents for multi-agent envelope
        for (const [agentId, role] of [
            ["agent_coo_e2e", "COO"],
            ["agent_researcher", "Researcher"],
            ["agent_worker", "Worker"],
            ["agent_grader", "Grader"],
        ]) {
            await registerAgentIdentity({
                display_name: `Test ${role}`,
                role,
                mission: `Test ${role} mission`,
                org_id: ORG_ID,
                agent_id: agentId,
            });
        }
        // 2. Dispatch (Phase-2 canonical entry point — no handoff)
        const dispatchResult = await dispatch({
            prompt: "E2E Test: Aggregate world news and summarize.",
            userId: USER_ID,
            jobId: `job_e2e_${Date.now()}`,
            orgId: ORG_ID,
            agentId: "agent_coo_e2e",
        });
        (0, vitest_1.expect)(dispatchResult.success).toBe(true);
        const envelopeId = dispatchResult.envelope_id;
        // 3. Worker Claims the Envelope (Execution Plane Action)
        const claimResult = await claimNextEnvelope(TEST_WORKER_ID);
        (0, vitest_1.expect)(claimResult).not.toBeNull();
        // 4. Drive Execution (Direct Core Engine Execution)
        await runEnvelopeParallel({
            envelope_id: envelopeId,
            instance_id: TEST_WORKER_ID
        });
        // 5. Verify Final State Transitions
        const envelopeDoc = await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
        const envelope = envelopeDoc.data();
        (0, vitest_1.expect)(envelope?.status).toBe("awaiting_human");
        // Verify all steps are completed
        const steps = envelope?.steps || [];
        (0, vitest_1.expect)(steps.length).toBeGreaterThan(0);
        for (const step of steps) {
            (0, vitest_1.expect)(step.status).toBe("completed");
        }
        // 6. Verify Traces
        const tracesSnap = await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_TRACES).get();
        const eventTypes = tracesSnap.docs.map((d) => d.data().event_type);
        (0, vitest_1.expect)(eventTypes).toContain("ENVELOPE_CREATED");
        (0, vitest_1.expect)(eventTypes).toContain("LEASE_ACQUIRED");
        (0, vitest_1.expect)(eventTypes).toContain("STEP_COMPLETED");
        (0, vitest_1.expect)(eventTypes).toContain("STATUS_TRANSITION_AWAITING_HUMAN");
        // 7. Verify envelope_id on every trace
        const allTraces = tracesSnap.docs.map((d) => d.data());
        for (const trace of allTraces) {
            (0, vitest_1.expect)(trace.envelope_id, "trace must carry envelope_id").toBeTruthy();
        }
        console.log(`[E2E] Success: Envelope ${envelopeId} fully finalized to awaiting_human.`);
        // 8. Simulate Human Approval
        const { transition } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        await transition(envelopeId, "approved");
        const finalDoc = await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
        (0, vitest_1.expect)(finalDoc.data()?.status).toBe("approved");
        console.log(`[E2E] Success: Envelope ${envelopeId} fully finalized to approved.`);
    }, 120000);
    (0, vitest_1.it)("should fail gracefully if identity verification fails (Quarantine Path)", async () => {
        const { COLLECTIONS, runEnvelopeParallel } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        const tamperedAgentId = "agent_tampered_e2e";
        await memory_db_1.memoryDb.collection(COLLECTIONS.AGENTS).doc(tamperedAgentId).set({
            agent_id: tamperedAgentId,
            display_name: "Tampered Agent",
            canonical_identity_json: JSON.stringify({ agent_id: tamperedAgentId, role: "COO" }),
            identity_fingerprint: "invalid_fingerprint_for_tampering_test"
        });
        const envelopeId = `env_tamper_${Date.now()}`;
        await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
            envelope_id: envelopeId,
            status: "created",
            multi_agent: false,
            identity_contexts: {
                [tamperedAgentId]: {
                    agent_id: tamperedAgentId,
                    identity_fingerprint: "different_fingerprint_to_trigger_mismatch",
                    verified: true
                }
            },
            steps: [{ step_id: "step_1", status: "ready", assigned_agent_id: tamperedAgentId }],
            created_at: new Date().toISOString()
        });
        await runEnvelopeParallel({
            envelope_id: envelopeId,
            instance_id: TEST_WORKER_ID
        });
        const envelopeDoc = await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
        (0, vitest_1.expect)(envelopeDoc.data()?.status).toBe("quarantined");
    }, 30000);
    (0, vitest_1.it)("should quarantine envelope on FORK_DETECTED (active lease held by different instance)", async () => {
        const { COLLECTIONS, acquirePerAgentLease, } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        const envelopeId = `env_fork_${Date.now()}`;
        const agentId = "agent_fork_test";
        const instanceA = "worker_instance_A";
        const instanceB = "worker_instance_B";
        // Create envelope with an active lease for instanceA
        const futureExpiry = new Date(Date.now() + 60_000).toISOString();
        await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
            envelope_id: envelopeId,
            status: "executing",
            multi_agent: true,
            identity_context: {
                agent_id: agentId,
                identity_fingerprint: "fp_fork_test",
                verified: true,
            },
            identity_contexts: {
                [agentId]: { agent_id: agentId, identity_fingerprint: "fp_fork_test", verified: true },
            },
            authority_leases: {
                [agentId]: {
                    lease_id: "lease_existing",
                    agent_id: agentId,
                    current_instance_id: instanceA, // A holds the lease
                    lease_expires_at: futureExpiry,
                    acquired_at: new Date().toISOString(),
                    last_renewed_at: new Date().toISOString(),
                    status: "active",
                },
            },
            steps: [{ step_id: "step_1", status: "ready", assigned_agent_id: agentId }],
            created_at: new Date().toISOString(),
        });
        // instanceB attempts to acquire — must throw FORK_DETECTED
        await (0, vitest_1.expect)(acquirePerAgentLease(envelopeId, agentId, instanceB)).rejects.toThrow("FORK_DETECTED");
    }, 15000);
    (0, vitest_1.it)("should block duplicate step execution (STEP_NOT_CLAIMABLE)", async () => {
        const { COLLECTIONS, claimEnvelopeStep, } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        const envelopeId = `env_dup_${Date.now()}`;
        const stepId = "step_dup_1";
        await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
            envelope_id: envelopeId,
            status: "executing",
            identity_context: { agent_id: "agent_dup", identity_fingerprint: "fp_dup", verified: true },
            steps: [{
                    step_id: stepId,
                    status: "ready",
                    assigned_agent_id: "agent_dup",
                }],
            created_at: new Date().toISOString(),
        });
        // First claim succeeds
        await claimEnvelopeStep({ envelope_id: envelopeId, step_id: stepId, instance_id: "worker_dup_1" });
        // Second claim on the same step (now "executing") must fail
        await (0, vitest_1.expect)(claimEnvelopeStep({ envelope_id: envelopeId, step_id: stepId, instance_id: "worker_dup_2" })).rejects.toThrow("STEP_NOT_CLAIMABLE");
    }, 15000);
    (0, vitest_1.it)("should throw on validatePerAgentLease when no lease exists (no execution without lease)", async () => {
        const { validatePerAgentLease, COLLECTIONS } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        const envelopeId = `env_nolease_${Date.now()}`;
        const agentId = "agent_nolease";
        // Envelope with no authority_leases
        const envDoc = {
            envelope_id: envelopeId,
            status: "executing",
            identity_context: { agent_id: agentId, identity_fingerprint: "fp_nolease", verified: true },
            steps: [{ step_id: "step_1", status: "executing", assigned_agent_id: agentId }],
            authority_leases: {},
            created_at: new Date().toISOString(),
        };
        // validatePerAgentLease operates on the envelope object directly
        (0, vitest_1.expect)(() => validatePerAgentLease(envDoc, agentId, "worker_nolease")).toThrow("LEASE_MISSING");
    }, 5000);
    (0, vitest_1.it)("should fail hard on assertClaimOwnership mismatch", async () => {
        const { assertClaimOwnership } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        (0, vitest_1.expect)(() => assertClaimOwnership("env_1", "worker_A", "worker_B")).toThrow("GUARD_CLAIM_OWNERSHIP_MISMATCH");
    }, 5000);
    (0, vitest_1.it)("should reject pending_verification in production (ALLOW_PENDING_IDENTITY=false)", async () => {
        const { verifyIdentity, COLLECTIONS } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        const agentId = "agent_pending_test";
        await memory_db_1.memoryDb.collection(COLLECTIONS.AGENTS).doc(agentId).set({
            agent_id: agentId,
            canonical_identity_json: JSON.stringify({ agent_id: agentId }),
            identity_fingerprint: "actual_fp"
        });
        const env = {
            envelope_id: "env_pending",
            identity_context: { agent_id: agentId, identity_fingerprint: "pending_verification" }
        };
        // Mock process.env
        const original = process.env.ALLOW_PENDING_IDENTITY;
        process.env.ALLOW_PENDING_IDENTITY = "false";
        try {
            const result = await verifyIdentity("env_pending", agentId, env.identity_context.identity_fingerprint);
            (0, vitest_1.expect)(result.verified).toBe(false);
            (0, vitest_1.expect)(result.reason).toBe("IDENTITY_NOT_VERIFIED");
            // Verify quarantined state in DB
            const envDoc = await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc("env_pending").get();
            (0, vitest_1.expect)(envDoc.data()?.status).toBe("quarantined");
        }
        finally {
            process.env.ALLOW_PENDING_IDENTITY = original;
        }
    }, 10000);
    (0, vitest_1.it)("should reject execution when step depends on uncompleted steps (GUARD_DEPENDENCY_NOT_SATISFIED)", async () => {
        const { assertDependenciesSatisfied } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        const step = { step_id: "s2", depends_on: ["s1"], status: "ready" };
        const allSteps = [
            { step_id: "s1", status: "executing" },
            { step_id: "s2", depends_on: ["s1"], status: "ready" }
        ];
        (0, vitest_1.expect)(() => assertDependenciesSatisfied(step, allSteps)).toThrow("GUARD_DEPENDENCY_NOT_SATISFIED");
    }, 5000);
    (0, vitest_1.it)("should reject execution of a terminal envelope (GUARD_ENVELOPE_TERMINAL)", async () => {
        const { assertEnvelopeNotTerminal } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        const terminals = ["approved", "completed", "rejected", "failed", "quarantined"];
        for (const status of terminals) {
            (0, vitest_1.expect)(() => assertEnvelopeNotTerminal({ status })).toThrow(`GUARD_ENVELOPE_TERMINAL:${status}`);
        }
    }, 5000);
    (0, vitest_1.it)("should emit a trace for every state transition", async () => {
        const { COLLECTIONS } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        const { transition } = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
        memory_db_1.memoryDb.reset();
        const envelopeId = `env_trace_${Date.now()}`;
        await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
            envelope_id: envelopeId,
            status: "created",
            identity_context: { agent_id: "agent_trace", identity_fingerprint: "fp_trace", verified: true },
            steps: [{ step_id: "s1", status: "pending", assigned_agent_id: "agent_trace" }],
            created_at: new Date().toISOString(),
        });
        await transition(envelopeId, "planned");
        await transition(envelopeId, "leased");
        await transition(envelopeId, "executing");
        await transition(envelopeId, "completed");
        const tracesSnap = await memory_db_1.memoryDb.collection(COLLECTIONS.EXECUTION_TRACES).get();
        const eventTypes = tracesSnap.docs.map((d) => d.data().event_type);
        (0, vitest_1.expect)(eventTypes).toContain("STATUS_TRANSITION_LEASED");
        (0, vitest_1.expect)(eventTypes).toContain("STATUS_TRANSITION_PLANNED");
        (0, vitest_1.expect)(eventTypes).toContain("STATUS_TRANSITION_EXECUTING");
        (0, vitest_1.expect)(eventTypes).toContain("STATUS_TRANSITION_COMPLETED");
        // Every trace must carry envelope_id
        for (const d of tracesSnap.docs) {
            (0, vitest_1.expect)(d.data().envelope_id).toBe(envelopeId);
        }
    }, 15000);
});
