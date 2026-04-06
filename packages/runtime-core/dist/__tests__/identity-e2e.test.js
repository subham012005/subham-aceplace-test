"use strict";
/**
 * Identity & Runtime — End-to-End Integration Test
 *
 * Proves the critical identity invariant through a complete execution path:
 *
 *   1.  Register agent identity  (agents collection)
 *   2.  Build envelope with correct fingerprint
 *   3.  Persist envelope to execution_envelopes
 *   4.  Add entry to execution_queue
 *   5.  Worker claims the queue entry (status: queued → claimed)
 *   6.  verifyIdentity()           — fingerprint verified against stored agent record
 *   7.  acquirePerAgentLease()     — per-agent lease written to envelope
 *   8.  claimEnvelopeStep()        — step status: ready → executing
 *   9.  finalizeEnvelopeStep()     — step status: executing → completed
 *   10. Assert execution_traces contains an IDENTITY_VERIFIED event
 *
 * Also verifies the mismatch path:
 *   - tampered fingerprint in identity_context → verifyIdentity returns verified:false
 *   - envelope status transitions to "quarantined"
 *
 * Uses an in-memory Firestore mock — no live connection required.
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
const identity_1 = require("../kernels/identity");
const envelope_builder_1 = require("../envelope-builder");
const step_planner_1 = require("../step-planner");
const constants_1 = require("../constants");
class MockFirestore {
    store = new Map();
    traces = [];
    key(col, id) {
        return `${col}/${id}`;
    }
    read(col, id) {
        const d = this.store.get(this.key(col, id));
        return { exists: d !== undefined, data: () => (d ? { ...d } : undefined) };
    }
    write(col, id, data, merge = false) {
        const k = this.key(col, id);
        const base = merge ? (this.store.get(k) ?? {}) : {};
        this.store.set(k, { ...base, ...data });
        if (col === constants_1.COLLECTIONS.EXECUTION_TRACES) {
            this.traces.push({ ...data });
        }
    }
    patch(col, id, updates) {
        const k = this.key(col, id);
        const existing = { ...(this.store.get(k) ?? {}) };
        for (const [field, val] of Object.entries(updates)) {
            if (field.includes(".")) {
                // Handle dot-notation keys e.g. "authority_leases.agent_coo"
                const parts = field.split(".");
                let cursor = existing;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== "object") {
                        cursor[parts[i]] = {};
                    }
                    cursor = cursor[parts[i]];
                }
                cursor[parts[parts.length - 1]] = val;
            }
            else {
                existing[field] = val;
            }
        }
        this.store.set(k, existing);
        if (col === constants_1.COLLECTIONS.EXECUTION_TRACES) {
            this.traces.push({ ...existing });
        }
    }
    reset() {
        this.store.clear();
        this.traces = [];
    }
}
const mockFs = new MockFirestore();
function buildMockDb(fs) {
    function docRef(col, id) {
        return {
            get: async () => fs.read(col, id),
            set: async (data, opts) => fs.write(col, id, data, opts?.merge),
            update: async (patch) => fs.patch(col, id, patch),
        };
    }
    return {
        collection: (col) => ({
            doc: (id) => docRef(col, id),
            where: () => ({
                orderBy: () => ({
                    limit: () => ({
                        get: async () => ({ empty: true, docs: [] }),
                    }),
                }),
            }),
        }),
        /**
         * Minimal transaction: buffers tx.update / tx.set ops, flushes after fn resolves.
         * tx.get reads directly from the store so the callback sees current state.
         */
        runTransaction: async (fn) => {
            const deferred = [];
            const tx = {
                get: async (ref) => ref.get(),
                update: (ref, patch) => {
                    deferred.push(() => ref.update(patch));
                },
                set: (ref, data, opts) => {
                    deferred.push(() => ref.set(data, opts));
                },
            };
            const result = await fn(tx);
            for (const op of deferred)
                await op();
            return result;
        },
    };
}
vitest_1.vi.mock("../db", () => ({
    getDb: () => buildMockDb(mockFs),
}));
// ── Import modules under test AFTER mock is in place ─────────────────────────
// Dynamic imports ensure the vi.mock hoisting has taken effect.
const { verifyIdentity } = await Promise.resolve().then(() => __importStar(require("../kernels/identity")));
const { acquirePerAgentLease } = await Promise.resolve().then(() => __importStar(require("../per-agent-authority")));
const { claimEnvelopeStep, finalizeEnvelopeStep } = await Promise.resolve().then(() => __importStar(require("../parallel-runner")));
// ── Helpers ───────────────────────────────────────────────────────────────────
const AGENT_ID = "agent_coo_e2e";
const INSTANCE_ID = "worker_instance_e2e_001";
function makeAgentRecord() {
    const canonical = JSON.stringify({
        agent_id: AGENT_ID,
        display_name: "COO E2E",
        role: "coordinator",
        mission: "Orchestrate tasks deterministically",
        org_id: "org_test",
        created_at: "2026-01-01T00:00:00.000Z",
    });
    const fingerprint = (0, identity_1.computeFingerprint)(canonical);
    return {
        agent_id: AGENT_ID,
        display_name: "COO E2E",
        canonical_identity_json: canonical,
        identity_fingerprint: fingerprint,
        fingerprint,
        agent_class: "coordinator",
        jurisdiction: "ACEPLACE-AGENTSPACE",
        mission: "Orchestrate tasks deterministically",
        tier: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        last_verified_at: null,
    };
}
function makeIdentityContext(agent) {
    return {
        agent_id: agent.agent_id,
        identity_fingerprint: agent.identity_fingerprint,
        fingerprint: agent.identity_fingerprint,
        verified: true,
        verified_at: new Date().toISOString(),
    };
}
// ── Tests ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("Identity + Runtime — End-to-End: happy path", () => {
    let envelope;
    let agent;
    (0, vitest_1.beforeEach)(() => {
        mockFs.reset();
        // Step 1: Register agent in agents collection
        agent = makeAgentRecord();
        mockFs.write(constants_1.COLLECTIONS.AGENTS, AGENT_ID, agent);
        // Step 2: Build envelope with correct fingerprint
        const idCtx = makeIdentityContext(agent);
        const steps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments: {
                COO: AGENT_ID,
                Researcher: AGENT_ID,
                Worker: AGENT_ID,
                Grader: AGENT_ID,
            },
        });
        // Single-agent envelope so all steps share the same agent
        envelope = (0, envelope_builder_1.buildEnvelope)({
            orgId: "org_test",
            prompt: "E2E identity test task",
            identityContext: idCtx,
            identity_contexts: { [AGENT_ID]: idCtx },
            steps,
        });
        // Step 3: Persist envelope
        mockFs.write(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id, envelope);
        // Step 4: Add to execution_queue
        mockFs.write(constants_1.COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id, {
            envelope_id: envelope.envelope_id,
            status: "queued",
            created_at: new Date().toISOString(),
        });
    });
    (0, vitest_1.it)("step 5 — worker claims the queue entry", () => {
        // Simulate worker claim: queued → claimed
        mockFs.patch(constants_1.COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id, {
            status: "claimed",
            claimed_by: INSTANCE_ID,
            claimed_at: new Date().toISOString(),
        });
        const entry = mockFs.read(constants_1.COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id);
        (0, vitest_1.expect)(entry.exists).toBe(true);
        (0, vitest_1.expect)(entry.data().status).toBe("claimed");
        (0, vitest_1.expect)(entry.data().claimed_by).toBe(INSTANCE_ID);
    });
    (0, vitest_1.it)("step 6 — verifyIdentity succeeds with correct fingerprint", async () => {
        const result = await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
        (0, vitest_1.expect)(result.verified).toBe(true);
        (0, vitest_1.expect)(result.agent_id).toBe(AGENT_ID);
        (0, vitest_1.expect)(result.verified_at).toBeTruthy();
        // last_verified_at must be written back to the agent record
        const updatedAgent = mockFs.read(constants_1.COLLECTIONS.AGENTS, AGENT_ID);
        (0, vitest_1.expect)(updatedAgent.data().last_verified_at).toBeTruthy();
    });
    (0, vitest_1.it)("step 6 — verifyIdentity writes IDENTITY_VERIFIED trace", async () => {
        await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
        const verifiedTrace = mockFs.traces.find((t) => t["event_type"] === "IDENTITY_VERIFIED");
        (0, vitest_1.expect)(verifiedTrace).toBeDefined();
        (0, vitest_1.expect)(verifiedTrace["envelope_id"]).toBe(envelope.envelope_id);
        (0, vitest_1.expect)(verifiedTrace["agent_id"]).toBe(AGENT_ID);
        (0, vitest_1.expect)(verifiedTrace["identity_fingerprint"].length).toBe(64);
    });
    (0, vitest_1.it)("step 7 — acquirePerAgentLease writes lease to envelope", async () => {
        const lease = await acquirePerAgentLease(envelope.envelope_id, AGENT_ID, INSTANCE_ID);
        (0, vitest_1.expect)(lease.agent_id).toBe(AGENT_ID);
        (0, vitest_1.expect)(lease.current_instance_id).toBe(INSTANCE_ID);
        (0, vitest_1.expect)(lease.status).toBe("active");
        const envDoc = mockFs.read(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
        const stored = envDoc.data();
        (0, vitest_1.expect)(stored.authority_leases?.[AGENT_ID]).toBeDefined();
        (0, vitest_1.expect)(stored.authority_leases[AGENT_ID].current_instance_id).toBe(INSTANCE_ID);
    });
    (0, vitest_1.it)("steps 8+9 — claimEnvelopeStep then finalizeEnvelopeStep updates step status", async () => {
        const firstStep = envelope.steps[0];
        (0, vitest_1.expect)(firstStep.status).toBe("ready");
        // Step 8: claim
        await claimEnvelopeStep({
            envelope_id: envelope.envelope_id,
            step_id: firstStep.step_id,
            instance_id: INSTANCE_ID,
        });
        let envDoc = mockFs.read(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
        let steps = envDoc.data().steps;
        let claimed = steps.find((s) => s.step_id === firstStep.step_id);
        (0, vitest_1.expect)(claimed.status).toBe("executing");
        (0, vitest_1.expect)(claimed.claimed_by_instance_id).toBe(INSTANCE_ID);
        // Step 9: finalize
        await finalizeEnvelopeStep({
            envelope_id: envelope.envelope_id,
            step_id: firstStep.step_id,
            status: "completed",
            output_ref: { artifact_id: "artifact_e2e_001" },
        });
        envDoc = mockFs.read(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
        steps = envDoc.data().steps;
        const finalized = steps.find((s) => s.step_id === firstStep.step_id);
        (0, vitest_1.expect)(finalized.status).toBe("completed");
        (0, vitest_1.expect)(finalized.output_ref.artifact_id).toBe("artifact_e2e_001");
    });
    (0, vitest_1.it)("full flow — identity verify + lease acquire + step claim/finalize in sequence", async () => {
        // Claim queue entry
        mockFs.patch(constants_1.COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id, {
            status: "claimed",
            claimed_by: INSTANCE_ID,
        });
        // Identity verify
        const idResult = await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
        (0, vitest_1.expect)(idResult.verified).toBe(true);
        // Acquire lease
        const lease = await acquirePerAgentLease(envelope.envelope_id, AGENT_ID, INSTANCE_ID);
        (0, vitest_1.expect)(lease.status).toBe("active");
        // Claim step
        const step = envelope.steps[0];
        await claimEnvelopeStep({
            envelope_id: envelope.envelope_id,
            step_id: step.step_id,
            instance_id: INSTANCE_ID,
        });
        // Finalize step
        await finalizeEnvelopeStep({
            envelope_id: envelope.envelope_id,
            step_id: step.step_id,
            status: "completed",
        });
        // Assert trace was written
        const identityTrace = mockFs.traces.find((t) => t["event_type"] === "IDENTITY_VERIFIED");
        (0, vitest_1.expect)(identityTrace).toBeDefined();
        (0, vitest_1.expect)(identityTrace["envelope_id"]).toBe(envelope.envelope_id);
        // Assert final step state
        const envDoc = mockFs.read(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
        const finalStep = envDoc.data().steps.find((s) => s.step_id === step.step_id);
        (0, vitest_1.expect)(finalStep.status).toBe("completed");
    });
});
(0, vitest_1.describe)("Identity + Runtime — End-to-End: mismatch path", () => {
    let envelope;
    (0, vitest_1.beforeEach)(() => {
        mockFs.reset();
        const agent = makeAgentRecord();
        mockFs.write(constants_1.COLLECTIONS.AGENTS, AGENT_ID, agent);
        // Build envelope with a TAMPERED fingerprint
        const tamperedCtx = {
            agent_id: AGENT_ID,
            identity_fingerprint: (0, identity_1.computeFingerprint)(JSON.stringify({ agent_id: "agent_evil", role: "attacker" })),
            verified: false,
            verified_at: new Date().toISOString(),
        };
        const steps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments: {
                COO: AGENT_ID,
                Researcher: AGENT_ID,
                Worker: AGENT_ID,
                Grader: AGENT_ID,
            },
        });
        envelope = (0, envelope_builder_1.buildEnvelope)({
            orgId: "org_test",
            prompt: "Tampered identity test",
            identityContext: tamperedCtx,
            identity_contexts: { [AGENT_ID]: tamperedCtx },
            steps,
        });
        mockFs.write(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id, { ...envelope, status: "leased" });
    });
    (0, vitest_1.it)("verifyIdentity returns verified:false on fingerprint mismatch", async () => {
        const result = await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
        (0, vitest_1.expect)(result.verified).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe("IDENTITY_FINGERPRINT_MISMATCH");
    });
    (0, vitest_1.it)("fingerprint mismatch transitions envelope to quarantined", async () => {
        await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
        const envDoc = mockFs.read(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
        (0, vitest_1.expect)(envDoc.data().status).toBe("quarantined");
    });
    (0, vitest_1.it)("fingerprint mismatch writes IDENTITY_FINGERPRINT_MISMATCH trace", async () => {
        await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
        const mismatchTrace = mockFs.traces.find((t) => t["event_type"] === "IDENTITY_FINGERPRINT_MISMATCH");
        (0, vitest_1.expect)(mismatchTrace).toBeDefined();
        (0, vitest_1.expect)(mismatchTrace["envelope_id"]).toBe(envelope.envelope_id);
    });
});
(0, vitest_1.describe)("Identity + Runtime — End-to-End: FORK_DETECTED", () => {
    let envelope;
    (0, vitest_1.beforeEach)(() => {
        mockFs.reset();
        const agent = makeAgentRecord();
        mockFs.write(constants_1.COLLECTIONS.AGENTS, AGENT_ID, agent);
        const idCtx = makeIdentityContext(agent);
        const steps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments: {
                COO: AGENT_ID,
                Researcher: AGENT_ID,
                Worker: AGENT_ID,
                Grader: AGENT_ID,
            },
        });
        envelope = (0, envelope_builder_1.buildEnvelope)({
            orgId: "org_test",
            prompt: "Fork detection test",
            identityContext: idCtx,
            identity_contexts: { [AGENT_ID]: idCtx },
            steps,
        });
        // Persist envelope with an active lease already held by a DIFFERENT instance
        const existingLease = {
            lease_id: "lease_existing_001",
            agent_id: AGENT_ID,
            current_instance_id: "worker_other_instance",
            lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
            acquired_at: new Date().toISOString(),
            last_renewed_at: new Date().toISOString(),
            status: "active",
        };
        mockFs.write(constants_1.COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id, {
            ...envelope,
            authority_leases: { [AGENT_ID]: existingLease },
        });
    });
    (0, vitest_1.it)("acquirePerAgentLease throws FORK_DETECTED when another instance holds the lease", async () => {
        await (0, vitest_1.expect)(acquirePerAgentLease(envelope.envelope_id, AGENT_ID, INSTANCE_ID)).rejects.toThrow("FORK_DETECTED");
    });
});
//# sourceMappingURL=identity-e2e.test.js.map