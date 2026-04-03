import { adminDb } from "../lib/firebase-admin";

async function syncLegacyEnvelopes() {
    console.log("[SYNC] Starting legacy envelope sync...");
    const jobsSnap = await adminDb.collection("jobs").get();
    let updatedCount = 0;

    for (const doc of jobsSnap.docs) {
        const job = doc.data();
        const envelopeId = job.execution_id || job.envelope_id;
        
        if (envelopeId && job.status) {
            const rawStatus = String(job.status).toLowerCase();
            
            // Only care about terminal states that might be out of sync
            if (['approved', 'rejected', 'quarantined'].includes(rawStatus)) {
                
                const envelopeRef = adminDb.collection("execution_envelopes").doc(envelopeId);
                const envelopeDoc = await envelopeRef.get();
                
                if (envelopeDoc.exists) {
                    const envStatus = String(envelopeDoc.data()?.status || "").toLowerCase();
                    
                    if (envStatus !== rawStatus) {
                        console.log(`[SYNC] Job ${job.job_id} is '${rawStatus}' but Envelope ${envelopeId} is '${envStatus}'. Fixing...`);
                        await envelopeRef.update({
                            status: rawStatus,
                            updated_at: new Date().toISOString()
                        });
                        updatedCount++;
                    }
                }
            }
        }
    }
    
    console.log(`[SYNC] Finished. Fixed ${updatedCount} legacy envelopes.`);
}

syncLegacyEnvelopes().catch(console.error);
