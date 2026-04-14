import { describe, it, expect, beforeEach } from "vitest";
import { dispatch } from "../engine";
import { MemoryDb } from "./memory-db";
import { setDb } from "../db";

describe("Phase-2 Identity Enforcement — Dispatch Guards", () => {
  let db: MemoryDb;

  beforeEach(() => {
    db = new MemoryDb();
    setDb(db as any);
  });

  it("Test: Missing agent → hard fail (AGENT_PROVISIONING_FAILED) — Phase 2 always enforces", async () => {
    // DB is empty — no agents seeded
    await expect(dispatch({
      prompt: "Production fail test",
      userId: "user_test",
      agentId: "agent_unknown_dispatch"
    })).rejects.toThrow("AGENT_PROVISIONING_FAILED");
  });

  it("Test: Unverified agent → quarantined envelope (verified=false path)", async () => {
    const { COLLECTIONS } = await import("../constants");

    // Seed an UNVERIFIED agent (verified = false)
    await db.collection(COLLECTIONS.AGENTS).doc("agent_coo").set({
      agent_id: "agent_coo",
      identity_fingerprint: "fp_coo",
      canonical_identity_json: JSON.stringify({ agent_id: "agent_coo" }),
      verified: false,
    });
    // Seed all other pipeline agents as verified
    for (const agentId of ["agent_researcher", "agent_worker", "agent_grader"]) {
      await db.collection(COLLECTIONS.AGENTS).doc(agentId).set({
        agent_id: agentId,
        identity_fingerprint: `fp_${agentId}`,
        canonical_identity_json: JSON.stringify({ agent_id: agentId }),
        verified: true,
      });
    }

    const result = await dispatch({
      prompt: "Unverified agent test",
      userId: "user_test",
      agentId: "agent_coo",
    });

    // Should return an envelope in quarantined state
    expect(result.success).toBe(false);
    expect(result.envelope_id).toBeDefined();
    // Verify the envelope is marked quarantined in DB
    const envDoc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(result.envelope_id).get();
    expect(envDoc.data()?.status).toBe("quarantined");
  });
});
