/**
 * ACEPLACE Phase 2 — Deterministic E2E Runtime Test (Fallback Mode)
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ── Database Setup (MUST RUN BEFORE ANY OTHER IMPORTS) ────────────────────────
import { memoryDb } from "../../../../packages/runtime-core/src/__tests__/memory-db";
(global as any).__ACEPLACE_MEMORY_DB__ = memoryDb;

vi.setConfig({ testTimeout: 60000 });

// Mock global fetch for Agent Engine simulation
global.fetch = vi.fn().mockImplementation(async (url: string) => {
  if (url.includes("/execute-step")) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        artifact_id: `artifact_${Math.random().toString(36).slice(2, 10)}`,
      }),
    };
  }
  return { ok: true, json: async () => ({ success: true }) };
});

const TEST_WORKER_ID = "test_worker_e2e_001";
const ORG_ID = "org_e2e_test";
const USER_ID = "user_e2e_tester";

describe("ACEPLACE Deterministic Runtime — End-to-End", () => {
  
  it("should process a multi-agent task from handoff to completion", async () => {
    // Dynamically load to ensure the global DB singleton is picked up after it was set
    const { 
      acceptAceHandoff, 
      registerAgentIdentity, 
      COLLECTIONS,
      runEnvelopeParallel
    } = await import("@aceplace/runtime-core");
    const { claimNextEnvelope } = await import("../index");

    memoryDb.reset();

    // 1. Register Agents
    await registerAgentIdentity({
      display_name: "Test COO",
      role: "COO",
      mission: "Test orchestration",
      org_id: ORG_ID,
      agent_id: "agent_coo_e2e"
    });

    // 2. Trigger Handoff (Web Control Plane Action)
    const handoffResult = await acceptAceHandoff({
      protocol: "#us#",
      message_type: "#us#.task.handoff",
      execution: {
        org_id: ORG_ID,
        requested_by_user_id: USER_ID,
        session_id: "sess_e2e_001",
        draft_id: "draft_e2e_001",
      },
      payload: {
        task: {
          description: "E2E Test: Aggregate world news and summarize.",
        },
        role_assignments: [
          { role: "COO", agent_id: "agent_coo_e2e" }
        ],
      }
    });

    expect(handoffResult.success).toBe(true);
    const envelopeId = handoffResult.envelope_id;

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
    
    expect(envelope?.status).toBe("completed");
    
    // Verify all steps are completed
    const steps = envelope?.steps || [];
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.status).toBe("completed");
    }

    // 6. Verify Traces
    const tracesSnap = await memoryDb.collection(COLLECTIONS.EXECUTION_TRACES).get();
    const eventTypes = tracesSnap.docs.map((d: any) => d.data().event_type);
    
    expect(eventTypes).toContain("HANDOFF_ENVELOPE_CREATED");
    expect(eventTypes).toContain("LEASE_ACQUIRED");
    expect(eventTypes).toContain("STEP_COMPLETED");
    expect(eventTypes).toContain("STATUS_TRANSITION_COMPLETED");

    console.log(`[E2E] Success: Envelope ${envelopeId} fully finalized.`);
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
      identity_context: {
        agent_id: tamperedAgentId,
        identity_fingerprint: "different_fingerprint_to_trigger_mismatch"
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
});
