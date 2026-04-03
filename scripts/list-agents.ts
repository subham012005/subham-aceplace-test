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
  const snap = await db.collection("agents").get();
  console.log("AGENT IDs in 'agents' collection:");
  snap.docs.forEach(doc => {
    console.log(`- ${doc.id} (canonical_identity_json: ${!!doc.data().canonical_identity_json})`);
  });
  
  const snap2 = await db.collection("agent_identities").get();
  console.log("\nAGENT IDs in 'agent_identities' collection:");
  snap2.docs.forEach(doc => {
      console.log(`- ${doc.id}`);
  });
}

run().catch(console.error);
