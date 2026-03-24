const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function testQueries() {
    try {
        console.log("Testing Global Query (orderBy updated_at)...");
        const q1 = await db.collection("jobs").orderBy("updated_at", "desc").limit(5).get();
        console.log("Global Query Success, count:", q1.docs.length);
    } catch (e) {
        console.error("Global Query Failed:", e.message);
    }

    try {
        console.log("\nTesting Filtered Query (where user_id and orderBy updated_at)...");
        const q2 = await db.collection("jobs")
            .where("user_id", "==", "cNFEfL1QcJZIFCm8kihnEeNlk1J3")
            .orderBy("updated_at", "desc")
            .limit(5)
            .get();
        console.log("Filtered Query Success, count:", q2.docs.length);
    } catch (e) {
        console.error("Filtered Query Failed:", e.message);
    }
}

testQueries();
