import { dispatch, getDb, COLLECTIONS } from "../packages/runtime-core/src";

async function main() {
  const RUN_ID = `ui_sim_${Date.now()}`;
  const USER_ID = "user_certification_dashboard_final_proof";

  console.log(`[UI_SIM] 🚀 Starting Proof 14: Simulated TaskComposer Dispatch...`);
  console.log(`[UI_SIM] Prompt: 'Real UI Chain Validation Proof 14 - Full Stack Audit'`);

  // 1. Dispatch Task (Simulating the API call from TaskComposer)
  const result = await dispatch({
    prompt: "Real UI Chain Validation Proof 14 - Full Stack Audit",
    userId: USER_ID,
    jobId: RUN_ID,
    agentId: "agent_coo",
    orgId: "cert_org"
  });

  if (!result.success) {
    console.error(`[UI_SIM] ❌ Dispatch failed: ${result.message}`);
    process.exit(1);
  }

  const envId = result.envelope_id;
  console.log(`[UI_SIM] ✅ Dispatch Successful! Envelope ID: ${envId}`);
  console.log(`[UI_SIM] 🕒 Waiting for background worker to process...`);

  // 2. Poll for Completion
  const db = getDb();
  let completed = false;
  let attempts = 0;

  while (!completed && attempts < 30) {
    const snap = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get();
    const status = snap.data()?.status;
    console.log(`[UI_SIM] Status: ${status}`);

    if (status === "completed" || status === "failed" || status === "quarantined") {
      completed = true;
      break;
    }

    await new Promise(r => setTimeout(r, 5000));
    attempts++;
  }

  if (!completed) {
    console.error(`[UI_SIM] ❌ Task timed out after 150s.`);
    process.exit(1);
  }

  // 3. Evidence Collection
  console.log(`\n--- [UI_SIM] 📊 FINAL EVIDENCE COLLECTION ---`);
  
  const envData = (await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId).get()).data();
  console.log(`Final Envelope Status: ${envData?.status}`);
  console.log(`Total Artifacts: ${envData?.artifact_refs?.length || 0}`);

  const traces = await db.collection(COLLECTIONS.EXECUTION_TRACES)
    .where("envelope_id", "==", envId)
    .get();

  console.log(`Trace Audit Trail:`);
  traces.docs.forEach(doc => {
    const t = doc.data();
    console.log(`  - ${t.timestamp} | ${t.event_type.padEnd(30)} | Agent: ${t.agent_id}`);
  });

  console.log(`\n[UI_SIM] ✅ Proof 14 (UI Validation Chain) Complete.`);
  process.exit(0);
}

main().catch(console.error);
