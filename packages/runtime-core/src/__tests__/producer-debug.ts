import { dispatch } from "../engine";
import { MemoryDb } from "./memory-db";
import { setDb } from "../db";
import { COLLECTIONS } from "../constants";

export async function debug() {
  const db = new MemoryDb();
  setDb(db as any);

  // Seed one agent so it's found
  await db.collection(COLLECTIONS.AGENTS).doc("agent_coo").set({
    agent_id: "agent_coo",
    display_name: "COO",
    identity_fingerprint: "coo_fp",
    canonical_identity_json: "{}",
    verified: true
  });

  console.log("--- DISPATCHING ---");
  const result = await dispatch({
    prompt: "Test Task",
    userId: "user_01",
    orgId: "org_01",
    agentId: "agent_coo"
  });

  console.log("--- PRODUCED STEPS ---");
  console.log(JSON.stringify(result.envelope.steps, null, 2));
  return result.envelope;
}

if (require.main === module) {
  debug().catch(console.error);
}

