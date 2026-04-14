import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MemoryDb } from "./memory-db";
import { setDb } from "../db";
import { COLLECTIONS, STEP_EXECUTION_MIN_WINDOW_MS } from "../constants";
import { acquirePerAgentLease, renewPerAgentLease, validatePerAgentLease } from "../per-agent-authority";
import { leaseHeartbeatManager } from "../lease-heartbeat";

describe("Lease Resilience & Contention Handling", () => {
  let db: MemoryDb;

  beforeEach(() => {
    db = new MemoryDb();
    setDb(db as any);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  const setupEnvelope = async (id: string, ttlMs: number, instanceId = "worker_1") => {
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs).toISOString();

    await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(id).set({
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

  it("1. High TTL skips write on acquirePerAgentLease", async () => {
    const envId = "env_high_ttl";
    // TTL is 40s, safely above 20s minimum
    await setupEnvelope(envId, 40_000);

    const initialDoc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
    const initialUpdatedAt = initialDoc.data()?.updated_at;

    const lease = await acquirePerAgentLease(envId, "agent_master", "worker_1");
    
    // Validate we skipped the write (the doc's updated_at should remain identical)
    const afterDoc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
    expect(afterDoc.data()?.updated_at).toBe(initialUpdatedAt);
    
    // Sanity check remaining TTL
    const diff = new Date(lease.lease_expires_at).getTime() - Date.now();
    expect(diff).toBeLessThanOrEqual(40_000);
    expect(diff).toBeGreaterThan(STEP_EXECUTION_MIN_WINDOW_MS);
  });

  it("2. Low TTL forces renewal on acquirePerAgentLease", async () => {
    const envId = "env_low_ttl";
    // TTL is 10s, below the 20s minimum
    await setupEnvelope(envId, 10_000);

    const lease = await acquirePerAgentLease(envId, "agent_master", "worker_1");
    
    // Remaining time must now be full defaults (60s)
    const diff = new Date(lease.lease_expires_at).getTime() - Date.now();
    expect(diff).toBeGreaterThan(50_000); // Definitely renewed
  });

  it("3. Final step (forceRenew) always rewrites even if TTL is high", async () => {
    const envId = "env_force_renew";
    // Setup with 50s TTL (super safe)
    await setupEnvelope(envId, 50_000);

    // Provide forceRenew: true (simulating the 'complete' step behavior)
    const lease = await acquirePerAgentLease(envId, "agent_master", "worker_1", { forceRenew: true });
    
    // The lease_expires_at will be refreshed mathematically to Date.now() + 60s
    // Since we wait 1ms in tests sometimes, let's just assert it's roughly 60s from now
    // and definitely pushed past the 50s mark.
    const diff = new Date(lease.lease_expires_at).getTime() - Date.now();
    expect(diff).toBeGreaterThanOrEqual(59_000);
  });

  it("4. Heartbeat contention resolves with exponential backoff", async () => {
    const envId = "env_hb_contention";
    await setupEnvelope(envId, 60_000);

    // We will spy on the database runTransaction to throw ABORTED twice, then succeed.
    let calls = 0;
    const realRunTransaction = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation(async (fn: any) => {
      calls++;
      console.log(`runTransaction called: call=${calls}, time=${Date.now()}`);
      if (calls <= 2) {
        throw new Error("10 ABORTED: Transaction aborted due to concurrency");
      }
      return realRunTransaction(fn);
    });

    const key = `${envId}:step_hb:agent_master`;
    
    // Start heartbeat (interval 20s)
    leaseHeartbeatManager.start(key, {
      envelope_id: envId,
      agent_id: "agent_master",
      instance_id: "worker_1"
    }, 20_000);

    // Fast-forward to trigger the interval
    await vi.advanceTimersByTimeAsync(20_001);

    // Initial attempt throws ABORTED, triggering backoff (500 + jitter).
    // Fast-forward past the first backoff (~500ms-700ms)
    await vi.advanceTimersByTimeAsync(800);

    // Second attempt throws ABORTED, triggering backoff (1000 + jitter).
    // Fast-forward past the second backoff (~1000ms-1200ms)
    await vi.advanceTimersByTimeAsync(1300);

    // Third attempt succeeds, which then triggers 2 more runTransactions inside emitRuntimeMetrics.
    // Total calls = 1 (fail) + 1 (fail) + 1 (success) + 2 (telemetry) = 5
    expect(calls).toBe(5);

    // Verify lease was actually updated in the DB
    const doc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
    const currentLease = doc.data()?.authority_leases?.["agent_master"];
    
    const diff = new Date(currentLease.lease_expires_at).getTime() - Date.now();
    // It should have successfully refreshed to ~60s
    expect(diff).toBeGreaterThan(58_000);

    leaseHeartbeatManager.stop(key);
  });
});
