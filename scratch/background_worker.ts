import { getDb, COLLECTIONS, runEnvelopeParallel } from "../packages/runtime-core/src";

async function main() {
  console.log("[WORKER] Background worker started. Polling for 'queued' tasks...");
  const db = getDb();
  
  while (true) {
    const snap = await db.collection(COLLECTIONS.EXECUTION_QUEUE)
      .where("status", "==", "queued")
      .limit(1)
      .get();
      
    if (!snap.empty) {
      const doc = snap.docs[0];
      const envId = doc.id;
      console.log(`[WORKER] Picked up task: ${envId}. Executing...`);
      
      try {
        await runEnvelopeParallel({ 
          envelope_id: envId, 
          instance_id: `ui_worker_${Date.now()}` 
        });
        console.log(`[WORKER] Finished task: ${envId}`);
      } catch (err) {
        console.error(`[WORKER] Task ${envId} failed:`, err);
      }
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
