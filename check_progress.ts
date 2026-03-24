import { adminDb } from "./src/lib/firebase-admin";

async function run() {
    if (!adminDb) {
        process.exit(1);
    }
    const snapshot = await adminDb.collection("job_traces")
        .orderBy("created_at", "desc")
        .limit(10)
        .get();
    
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`[${data.created_at}] ${data.event_type}: ${data.message}`);
    });
    process.exit(0);
}

run().catch(console.error);
