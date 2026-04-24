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

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ── Database Setup (MUST RUN BEFORE ANY OTHER IMPORTS) ────────────────────────
import { memoryDb } from "../../../../packages/runtime-core/src/__tests__/memory-db";
(global as any).__ACEPLACE_MEMORY_DB__ = memoryDb;

vi.setConfig({ testTimeout: 60000 });

// Mock global fetch for Agent Engine simulation
vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
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

describe("ACEPLACE Deterministic Runtime — End-to-End", () => {
  
  it("should process a multi-agent task via dispatch to completion", async () => {
    // Dynamically load to ensure the global DB singleton is picked up after it was set
    const { 
      dispatch,
      registerAgentIdentity, 
      COLLECTIONS,
      runEnvelopeParallel,
      claimNextEnvelope
    } = await import("@aceplace/runtime-core");

    memoryDb.reset();

    // 1. Register all required agents for multi-agent envelope
    for (const [agentId, role] of [
      ["agent_coo_e2e", "COO"],
      ["agent_researcher", "Researcher"],
      ["agent_worker", "Worker"],
      ["agent_grader", "Grader"],
    ] as const) {
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

    expect(dispatchResult.success).toBe(true);
    const envelopeId = dispatchResult.envelope_id;

    // 3. Worker Claims the Envelope (Execution Plane Action)
    const claimResult = await claimNextEnvelope(TEST_WORKER_ID);
    expect(claimResult).not.toBeNull();

    // 4. Drive Execution (Direct Core Engine Execution)
    await runEnvelopeParallel({
      envelope_id: envelopeId,
      instance_id: TEST_WORKER_ID
    });

    // 5. Verify Final State Transitions
    const envelopeDoc = await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
    const envelope = envelopeDoc.data();
    
    expect(envelope?.status).toBe("awaiting_human");
    
    // Verify all steps are completed
    const steps = envelope?.steps || [];
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.status).toBe("completed");
    }

    // 6. Verify Traces
    const tracesSnap = await memoryDb.collection(COLLECTIONS.EXECUTION_TRACES).get();
    const eventTypes = tracesSnap.docs.map((d: any) => d.data().event_type);
    
    expect(eventTypes).toContain("ENVELOPE_CREATED");
    expect(eventTypes).toContain("LEASE_ACQUIRED");
    expect(eventTypes).toContain("STEP_COMPLETED");
    expect(eventTypes).toContain("STATUS_TRANSITION_AWAITING_HUMAN");

    // 7. Verify envelope_id on every trace
    const allTraces = tracesSnap.docs.map((d: any) => d.data());
    for (const trace of allTraces) {
      expect(trace.envelope_id, "trace must carry envelope_id").toBeTruthy();
    }

    console.log(`[E2E] Success: Envelope ${envelopeId} fully finalized to awaiting_human.`);

    // 8. Simulate Human Approval
    const { transition } = await import("@aceplace/runtime-core");
    await transition(envelopeId, "approved");
    const finalDoc = await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
    expect(finalDoc.data()?.status).toBe("approved");

    console.log(`[E2E] Success: Envelope ${envelopeId} fully finalized to approved.`);
  }, 120000);

  it("should fail gracefully if identity verification fails (Quarantine Path)", async () => {
    const { 
      COLLECTIONS,
      runEnvelopeParallel
    } = await import("@aceplace/runtime-core");

    memoryDb.reset();

    const tamperedAgentId = "agent_tampered_e2e";
    await memoryDb.collection(COLLECTIONS.AGENTS).doc(tamperedAgentId).set({
      agent_id: tamperedAgentId,
      display_name: "Tampered Agent",
      canonical_identity_json: JSON.stringify({ agent_id: tamperedAgentId, role: "COO" }),
      identity_fingerprint: "invalid_fingerprint_for_tampering_test"
    });

    const envelopeId = `env_tamper_${Date.now()}`;
    await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
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

    const envelopeDoc = await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
    expect(envelopeDoc.data()?.status).toBe("quarantined");
  }, 30000);

  it("should quarantine envelope on FORK_DETECTED (active lease held by different instance)", async () => {
    const {
      COLLECTIONS,
      acquirePerAgentLease,
    } = await import("@aceplace/runtime-core");

    memoryDb.reset();

    const envelopeId = `env_fork_${Date.now()}`;
    const agentId = "agent_fork_test";
    const instanceA = "worker_instance_A";
    const instanceB = "worker_instance_B";

    // Create envelope with an active lease for instanceA
    const futureExpiry = new Date(Date.now() + 60_000).toISOString();
    await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
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
          current_instance_id: instanceA,  // A holds the lease
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
    await expect(
      acquirePerAgentLease(envelopeId, agentId, instanceB)
    ).rejects.toThrow("FORK_DETECTED");
  }, 15000);

  it("should block duplicate step execution (STEP_NOT_CLAIMABLE)", async () => {
    const {
      COLLECTIONS,
      claimEnvelopeStep,
    } = await import("@aceplace/runtime-core");

    memoryDb.reset();

    const envelopeId = `env_dup_${Date.now()}`;
    const stepId = "step_dup_1";

    await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
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
    await expect(
      claimEnvelopeStep({ envelope_id: envelopeId, step_id: stepId, instance_id: "worker_dup_2" })
    ).rejects.toThrow("STEP_NOT_CLAIMABLE");
  }, 15000);

  it("should throw on validatePerAgentLease when no lease exists (no execution without lease)", async () => {
    const { validatePerAgentLease, COLLECTIONS } = await import("@aceplace/runtime-core");

    memoryDb.reset();

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
    expect(() =>
      validatePerAgentLease(envDoc as any, agentId, "worker_nolease")
    ).toThrow("LEASE_MISSING");
  }, 5000);

  it("should fail hard on assertClaimOwnership mismatch", async () => {
    const { assertClaimOwnership } = await import("@aceplace/runtime-core");
    
    expect(() => 
      assertClaimOwnership("env_1", "worker_A", "worker_B")
    ).toThrow("GUARD_CLAIM_OWNERSHIP_MISMATCH");
  }, 5000);

  it("should reject pending_verification in production (ALLOW_PENDING_IDENTITY=false)", async () => {
    const { verifyIdentity, COLLECTIONS } = await import("@aceplace/runtime-core");
    
    memoryDb.reset();
    const agentId = "agent_pending_test";
    await memoryDb.collection(COLLECTIONS.AGENTS).doc(agentId).set({
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
      expect(result.verified).toBe(false);
      expect(result.reason).toBe("IDENTITY_NOT_VERIFIED");
      
      // Verify quarantined state in DB
      const envDoc = await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc("env_pending").get();
      expect(envDoc.data()?.status).toBe("quarantined");
    } finally {
      process.env.ALLOW_PENDING_IDENTITY = original;
    }
  }, 10000);

  it("should reject execution when step depends on uncompleted steps (GUARD_DEPENDENCY_NOT_SATISFIED)", async () => {
    const { assertDependenciesSatisfied } = await import("@aceplace/runtime-core");

    const step = { step_id: "s2", depends_on: ["s1"], status: "ready" };
    const allSteps = [
      { step_id: "s1", status: "executing" },
      { step_id: "s2", depends_on: ["s1"], status: "ready" }
    ];

    expect(() => 
      assertDependenciesSatisfied(step as any, allSteps as any)
    ).toThrow("GUARD_DEPENDENCY_NOT_SATISFIED");
  }, 5000);

  it("should reject execution of a terminal envelope (GUARD_ENVELOPE_TERMINAL)", async () => {
    const { assertEnvelopeNotTerminal } = await import("@aceplace/runtime-core");

    const terminals = ["approved", "completed", "rejected", "failed", "quarantined"];
    for (const status of terminals) {
      expect(() =>
        assertEnvelopeNotTerminal({ status } as any)
      ).toThrow(`GUARD_ENVELOPE_TERMINAL:${status}`);
    }
  }, 5000);



  it("should emit a trace for every state transition", async () => {
    const { COLLECTIONS } = await import("@aceplace/runtime-core");
    const { transition } = await import("@aceplace/runtime-core");

    memoryDb.reset();

    const envelopeId = `env_trace_${Date.now()}`;
    await memoryDb.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).set({
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

    const tracesSnap = await memoryDb.collection(COLLECTIONS.EXECUTION_TRACES).get();
    const eventTypes = tracesSnap.docs.map((d: any) => d.data().event_type);

    expect(eventTypes).toContain("STATUS_TRANSITION_LEASED");
    expect(eventTypes).toContain("STATUS_TRANSITION_PLANNED");
    expect(eventTypes).toContain("STATUS_TRANSITION_EXECUTING");
    expect(eventTypes).toContain("STATUS_TRANSITION_COMPLETED");

    // Every trace must carry envelope_id
    for (const d of tracesSnap.docs) {
      expect(d.data().envelope_id).toBe(envelopeId);
    }
  }, 15000);
});
