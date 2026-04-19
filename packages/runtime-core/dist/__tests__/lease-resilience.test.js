"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const memory_db_1 = require("./memory-db");
const db_1 = require("../db");
const constants_1 = require("../constants");
const per_agent_authority_1 = require("../per-agent-authority");
const lease_heartbeat_1 = require("../lease-heartbeat");
(0, vitest_1.describe)("Lease Resilience & Contention Handling", () => {
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = new memory_db_1.MemoryDb();
        (0, db_1.setDb)(db);
        vitest_1.vi.useFakeTimers();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllTimers();
        vitest_1.vi.restoreAllMocks();
    });
    const setupEnvelope = async (id, ttlMs, instanceId = "worker_1") => {
        const now = Date.now();
        const expiresAt = new Date(now + ttlMs).toISOString();
        await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(id).set({
            envelope_id: id,
            status: "executing",
            authority_leases: {
                agent_master: {
                    lease_id: "lease_master",
                    agent_id: "agent_master",
                    current_instance_id: instanceId,
                    lease_expires_at: expiresAt,
                    acquired_at: new Date(now - 10000).toISOString(),
                    last_renewed_at: new Date(now - 10000).toISOString(),
                    status: "active",
                }
            },
            updated_at: new Date(now - 10000).toISOString(),
        });
    };
    (0, vitest_1.it)("1. High TTL skips write on acquirePerAgentLease", async () => {
        const envId = "env_high_ttl";
        // TTL is 40s, safely above 20s minimum
        await setupEnvelope(envId, 40_000);
        const initialDoc = await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
        const initialUpdatedAt = initialDoc.data()?.updated_at;
        const lease = await (0, per_agent_authority_1.acquirePerAgentLease)(envId, "agent_master", "worker_1");
        // Validate we skipped the write (the doc's updated_at should remain identical)
        const afterDoc = await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
        (0, vitest_1.expect)(afterDoc.data()?.updated_at).toBe(initialUpdatedAt);
        // Sanity check remaining TTL
        const diff = new Date(lease.lease_expires_at).getTime() - Date.now();
        (0, vitest_1.expect)(diff).toBeLessThanOrEqual(40_000);
        (0, vitest_1.expect)(diff).toBeGreaterThan(constants_1.STEP_EXECUTION_MIN_WINDOW_MS);
    });
    (0, vitest_1.it)("2. Low TTL forces renewal on acquirePerAgentLease", async () => {
        const envId = "env_low_ttl";
        // TTL is 10s, below the 20s minimum
        await setupEnvelope(envId, 10_000);
        const lease = await (0, per_agent_authority_1.acquirePerAgentLease)(envId, "agent_master", "worker_1");
        // Remaining time must now be full defaults (60s)
        const diff = new Date(lease.lease_expires_at).getTime() - Date.now();
        (0, vitest_1.expect)(diff).toBeGreaterThan(50_000); // Definitely renewed
    });
    (0, vitest_1.it)("3. Final step (forceRenew) always rewrites even if TTL is high", async () => {
        const envId = "env_force_renew";
        // Setup with 50s TTL (super safe)
        await setupEnvelope(envId, 50_000);
        // Provide forceRenew: true (simulating the 'complete' step behavior)
        const lease = await (0, per_agent_authority_1.acquirePerAgentLease)(envId, "agent_master", "worker_1", { forceRenew: true });
        // The lease_expires_at will be refreshed mathematically to Date.now() + 60s
        // Since we wait 1ms in tests sometimes, let's just assert it's roughly 60s from now
        // and definitely pushed past the 50s mark.
        const diff = new Date(lease.lease_expires_at).getTime() - Date.now();
        (0, vitest_1.expect)(diff).toBeGreaterThanOrEqual(59_000);
    });
    (0, vitest_1.it)("4. Heartbeat contention resolves with exponential backoff", async () => {
        const envId = "env_hb_contention";
        await setupEnvelope(envId, 60_000);
        // We will spy on the database runTransaction to throw ABORTED twice, then succeed.
        let calls = 0;
        const realRunTransaction = db.runTransaction.bind(db);
        vitest_1.vi.spyOn(db, "runTransaction").mockImplementation(async (fn) => {
            calls++;
            console.log(`runTransaction called: call=${calls}, time=${Date.now()}`);
            if (calls <= 2) {
                throw new Error("10 ABORTED: Transaction aborted due to concurrency");
            }
            return realRunTransaction(fn);
        });
        const key = `${envId}:step_hb:agent_master`;
        // Start heartbeat (interval 20s)
        lease_heartbeat_1.leaseHeartbeatManager.start(key, {
            envelope_id: envId,
            agent_id: "agent_master",
            instance_id: "worker_1"
        }, 20_000);
        // Fast-forward to trigger the interval
        await vitest_1.vi.advanceTimersByTimeAsync(20_001);
        // Initial attempt throws ABORTED, triggering backoff (500 + jitter).
        // Fast-forward past the first backoff (~500ms-700ms)
        await vitest_1.vi.advanceTimersByTimeAsync(800);
        // Second attempt throws ABORTED, triggering backoff (1000 + jitter).
        // Fast-forward past the second backoff (~1000ms-1200ms)
        await vitest_1.vi.advanceTimersByTimeAsync(1300);
        // Third attempt succeeds, which then triggers 2 more runTransactions inside emitRuntimeMetrics.
        // Total calls = 1 (fail) + 1 (fail) + 1 (success) + 2 (telemetry) = 5
        (0, vitest_1.expect)(calls).toBe(5);
        // Verify lease was actually updated in the DB
        const doc = await db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
        const currentLease = doc.data()?.authority_leases?.["agent_master"];
        const diff = new Date(currentLease.lease_expires_at).getTime() - Date.now();
        // It should have successfully refreshed to ~60s
        (0, vitest_1.expect)(diff).toBeGreaterThan(58_000);
        lease_heartbeat_1.leaseHeartbeatManager.stop(key);
    });
});
//# sourceMappingURL=lease-resilience.test.js.map