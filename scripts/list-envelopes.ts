import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};
initializeApp({ 
  credential: cert(serviceAccount),
  projectId: serviceAccount.projectId 
});

async function run() {
  const db = getFirestore();
  const snap = await db.collection("execution_envelopes")
    .orderBy("created_at", "desc")
    .limit(5)
    .get();
    
  console.log("LATEST ENVELOPES:");
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ${doc.id} | status: ${data.status} | updated: ${data.updated_at}`);
  });
}

run().catch(console.error);
