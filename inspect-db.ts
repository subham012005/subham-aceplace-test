import { adminDb } from "./src/lib/firebase-admin";

async function inspectJobs() {
    if (!adminDb) {
        console.error("ADMIN_NOT_INITIALIZED: Firebase Admin SDK is not configured.");
        return;
    }
    console.log("--- Inspecting Jobs ---");
    const snapshot = await adminDb.collection("jobs").orderBy("created_at", "desc").limit(5).get();
    
    if (snapshot.empty) {
        console.log("No jobs found.");
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Job ID: ${data.job_id}`);
        console.log(`  User ID: ${data.user_id}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Created: ${data.created_at}`);
        console.log(`  Updated: ${data.updated_at}`);
        console.log("  ---");
    });
}

async function inspectForkEvents() {
    if (!adminDb) return;
    console.log("\n--- Inspecting Fork Events ---");
    const snapshot = await adminDb.collection("fork_events").limit(5).get();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Job ID: ${data.job_id}`);
        console.log(`  User ID: ${data.user_id || "MISSING"}`);
        console.log("  ---");
    });
}

Promise.all([inspectJobs(), inspectForkEvents()])
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
