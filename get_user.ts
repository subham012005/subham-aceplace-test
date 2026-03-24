import { adminDb } from "./src/lib/firebase-admin";

async function run() {
    if (!adminDb) {
        console.error("Firebase Admin DB not initialized");
        process.exit(1);
    }
    const snapshot = await adminDb.collection("jobs").limit(1).get();
    if (snapshot.empty) {
        console.log("No jobs found, using default user_id");
        console.log("USER_ID: debug_user_123");
    } else {
        const data = snapshot.docs[0].data();
        console.log(`USER_ID: ${data.user_id}`);
    }
    process.exit(0);
}

run().catch(console.error);
