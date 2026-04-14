import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { MemoryDb } from "@aceplace/runtime-core/__tests__/memory-db";
import { setDb } from "@aceplace/runtime-core/db";
import { COLLECTIONS } from "@aceplace/runtime-core/constants";
import { resolveAssignedAgentId } from "@aceplace/runtime-core/runtime/resolution";

const { mockDb } = vi.hoisted(() => {
  const { MemoryDb } = require("@aceplace/runtime-core/__tests__/memory-db");
  const db = new MemoryDb();
  (global as any).__ACEPLACE_MEMORY_DB__ = db;
  return { mockDb: db };
});

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));

// Mock Firebase Admin for workflow-engine
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: (global as any).__ACEPLACE_MEMORY_DB__,
  isBackendReady: true,
}));

describe("Job Intake API Integration Test", () => {
  const db = mockDb;

  beforeEach(() => {
    db.reset(); 
    setDb(db as any);

    
    // Reset process.env if needed
    process.env.NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME = "true";
  });



  async function seedAgent(agentId: string) {
    await db.collection(COLLECTIONS.AGENTS).doc(agentId).set({
      agent_id: agentId,
      display_name: agentId.toUpperCase(),
      identity_fingerprint: `fp_${agentId}`,
      canonical_identity_json: JSON.stringify({ agent_id: agentId }),
      verified: true,
    });
  }

  it("POST /api/jobs/intake — builds a hardened Phase-2 envelope", async () => {
    // 1. Seed ALL required agents (Fail-fast check)
    await seedAgent("agent_coo");
    await seedAgent("agent_researcher");
    await seedAgent("agent_worker");
    await seedAgent("agent_grader");

    // 2. Simulate Request
    const body = {
      user_id: "user_integration_01",
      requested_agent_id: "agent_coo",
      job_type: "research_task",
      prompt: "Analyze the dimensional manifest of ACEPLACE.",
      job_id: "job_int_01",
    };

    const req = new Request("http://localhost/api/jobs/intake", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // 3. Invoke Route
    const response: any = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);

    // 4. Verify Envelope in DB
    const envelopes = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).get();
    expect(envelopes.docs.length).toBe(1);
    
    const envelope = envelopes.docs[0].data() as any;
    expect(envelope.user_id).toBe(body.user_id);
    expect(envelope.status).toBe("created");

    // 5. Assert Hardened Field Alignment
    // Every step MUST have a role and be resolvable
    for (const step of envelope.steps) {
      expect(step.role).toBeDefined();
      const resolvedId = resolveAssignedAgentId(envelope, step);
      expect(resolvedId).toBe(step.assigned_agent_id);
      
      // Every resolved agent MUST have a verified identity context
      const ctx = envelope.identity_contexts[resolvedId];
      expect(ctx).toBeDefined();
      expect(ctx.verified).toBe(true);
      expect(ctx.identity_fingerprint).not.toBe("pending_verification");
    }

    // Role assignments must be complete
    expect(envelope.role_assignments.COO).toBe("agent_coo");
    expect(envelope.role_assignments.Researcher).toBe("agent_researcher");
    expect(envelope.role_assignments.Worker).toBe("agent_worker");
    expect(envelope.role_assignments.Grader).toBe("agent_grader");
  });

  it("POST /api/jobs/intake — fails if identities are missing (Fail-Fast)", async () => {
    // Only seed COO
    await seedAgent("agent_coo");

    const body = {
      user_id: "user_integration_02",
      requested_agent_id: "agent_coo",
      job_type: "research_task",
      prompt: "This should fail provisioning.",
    };

    const req = new Request("http://localhost/api/jobs/intake", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response: any = await POST(req);
    const result = await response.json();

    // Intake route currently catches errors and returns 500
    expect(response.status).toBe(500);
    expect(result.error).toBe("INTAKE_ERROR");
    expect(result.message).toContain("AGENT_PROVISIONING_FAILED");
  });
});
