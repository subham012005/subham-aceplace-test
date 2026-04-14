import { describe, it, expect, beforeEach, vi } from "vitest";
import { dispatch } from "../engine";
import { MemoryDb } from "./memory-db";
import { setDb } from "../db";
import { COLLECTIONS } from "../constants";

describe("Lazy Provisioning Fallback — Dev Mode", () => {
  let db: MemoryDb;

  beforeEach(() => {
    db = new MemoryDb();
    setDb(db as any);
    
    // Enable Dev Mode
    process.env.ACELOGIC_DEV_LICENSE_FALLBACK = "true";
  });

  it("Test: Missing agent → auto-provisioned in Dev Mode", async () => {
    // 1. Database is empty (wiped)
    const agentId = "agent_coo";
    const doc = await db.collection(COLLECTIONS.AGENTS).doc(agentId).get();
    expect(doc.exists).toBe(false);

    // 2. Dispatch a task
    const result = await dispatch({
      prompt: "Auto-provision test",
      userId: "user_test",
      orgId: "org_test",
      agentId: agentId
    });

    expect(result.success).toBe(true);
    expect(result.envelope_id).toBeDefined();

    // 3. Verify agent now exists in DB
    const finalDoc = await db.collection(COLLECTIONS.AGENTS).doc(agentId).get();
    expect(finalDoc.exists).toBe(true);
    const agentData = finalDoc.data() as any;
    expect(agentData.agent_id).toBe(agentId);
    expect(agentData.identity_fingerprint).toBeDefined();
    expect(agentData.display_name).toContain("Chief Orchestration Officer");
  });

  it("Test: Missing agent → hard fail in Production Mode", async () => {
    // Disable Dev Mode
    process.env.ACELOGIC_DEV_LICENSE_FALLBACK = "false";

    const agentId = "agent_coo";

    // Dispatch should throw
    await expect(dispatch({
      prompt: "Production fail test",
      userId: "user_test",
      agentId: agentId
    })).rejects.toThrow(`AGENT_PROVISIONING_FAILED:Agent '${agentId}' not found in identity store.`);
  });
});
