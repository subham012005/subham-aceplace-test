"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const memory_db_1 = require("./memory-db");
const db_1 = require("../db");
const constants_1 = require("../constants");
const parallel_runner_1 = require("../parallel-runner");
const queue_1 = require("../kernels/queue");
// Mock Firebase Admin for worker
vitest_1.vi.mock("firebase-admin", () => ({}));
(0, vitest_1.describe)("Resume Eligibility & Recovery Integration Test", () => {
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = new memory_db_1.MemoryDb();
        (0, db_1.setDb)(db);
    });
    async function seedAgent(agentId) {
        await db.collection(constants_1.COLLECTIONS.AGENTS).doc(agentId).set({
            agent_id: agentId,
            display_name: agentId.toUpperCase(),
            identity_fingerprint: `fp_${agentId}`,
            canonical_identity_json: JSON.stringify({ agent_id: agentId }),
            verified: true,
        });
    }
    (0, vitest_1.it)("Scenario 1: Stale Claim Reclamation — steals a dead worker's claim", async () => {
        const envId = "env_stale_reclaim";
        const workerDead = "worker_dead";
        const workerAlive = "worker_alive";
        // 1. Setup a stalled queue entry
        const staleTime = new Date(Date.now() - constants_1.STALE_CLAIM_THRESHOLD_MS - 10000).toISOString();
        await db.collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envId).set({
            envelope_id: envId,
            status: "claimed",
            claimed_by: workerDead,
            updated_at: staleTime,
        });
        // 2. Setup corresponding envelope
        await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).set({
            envelope_id: envId,
            status: "executing",
            steps: [
                { step_id: "s1", status: "completed" },
                { step_id: "s2", status: "ready" }
            ],
            authority_leases: {} // No active leases
        });
        // 3. Attempt to claim as workerAlive
        const claim = await (0, queue_1.claimNextEnvelope)(workerAlive);
        (0, vitest_1.expect)(claim).not.toBeNull();
        (0, vitest_1.expect)(claim?.envelope_id).toBe(envId);
        // 4. Verify queue ownership changed
        const qDoc = await db.collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envId).get();
        (0, vitest_1.expect)(qDoc.data()?.claimed_by).toBe(workerAlive);
        (0, vitest_1.expect)(qDoc.data()?.status).toBe("claimed");
    });
    (0, vitest_1.it)("Scenario 2: Evidence-Based Healing — step heals to completed if trace exists", async () => {
        const envId = "env_heal";
        const workerId = "worker_recovery";
        // 1. Setup envelope with an 'executing' step left by dead worker
        await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).set({
            envelope_id: envId,
            status: "executing",
            steps: [
                { step_id: "s1", status: "completed" },
                {
                    step_id: "s2",
                    step_type: "produce_artifact",
                    status: "executing",
                    claimed_by_instance_id: "worker_dead"
                }
            ],
            authority_leases: {}
        });
        // 2. Seed a completion trace for s2
        await db.collection(constants_1.COLLECTIONS.EXECUTION_TRACES).doc("trace_s2").set({
            trace_id: "trace_s2",
            envelope_id: envId,
            step_id: "s2",
            event_type: "STEP_COMPLETED",
            timestamp: new Date().toISOString()
        });
        // 3. Run parallel runner (which calls recoverInterruptedSteps)
        // We mock some internal guards to let it run in isolation
        await (0, parallel_runner_1.runEnvelopeParallel)({
            envelope_id: envId,
            instance_id: workerId
        }).catch(() => { }); // It might fail later due to missing agents, but recovery happens at boot
        // 4. Verify step healed
        const envDoc = await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
        const s2 = envDoc.data()?.steps.find((s) => s.step_id === "s2");
        (0, vitest_1.expect)(s2.status).toBe("completed");
        (0, vitest_1.expect)(s2.claimed_by_instance_id).toBeNull();
    });
    (0, vitest_1.it)("Scenario 3: Evidence-Based Resume — step resets to ready if no evidence", async () => {
        const envId = "env_resume";
        const workerId = "worker_recovery";
        // 1. Setup envelope with an 'executing' step with NO trace
        await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).set({
            envelope_id: envId,
            status: "executing",
            identity_context: {
                agent_id: "agent_recovery",
                identity_fingerprint: "fp_recovery",
                verified: true
            },
            steps: [
                { step_id: "s1", status: "completed" },
                {
                    step_id: "s2",
                    step_type: "produce_artifact",
                    status: "executing",
                    assigned_agent_id: "agent_recovery",
                    claimed_by_instance_id: "worker_dead"
                }
            ],
            authority_leases: {}
        });
        // 2. Run parallel runner
        await (0, parallel_runner_1.runEnvelopeParallel)({
            envelope_id: envId,
            instance_id: workerId
        }).catch(() => { });
        // 3. Verify step reset to ready
        const envDoc = await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
        const s2 = envDoc.data()?.steps.find((s) => s.step_id === "s2");
        (0, vitest_1.expect)(s2.status).toBe("ready");
        (0, vitest_1.expect)(s2.claimed_by_instance_id).toBeNull();
    });
    (0, vitest_1.it)("Scenario 4: Graceful Shutdown — requeueEnvelope clears all ownership", async () => {
        const envId = "env_requeue";
        await db.collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envId).set({
            envelope_id: envId,
            status: "claimed",
            claimed_by: "worker_01",
            claimed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        await (0, queue_1.requeueEnvelope)(envId);
        const qDoc = await db.collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envId).get();
        (0, vitest_1.expect)(qDoc.data()?.status).toBe("queued");
        (0, vitest_1.expect)(qDoc.data()?.claimed_by).toBeNull();
        (0, vitest_1.expect)(qDoc.data()?.claimed_at).toBeNull();
    });
});
//# sourceMappingURL=resume.integration.test.js.map