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
  const snap = await db.collection("execution_messages")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
    
  if (snap.empty) {
    console.log("No messages found.");
    return;
  }
  
  console.log("LATEST MESSAGE:", JSON.stringify(snap.docs[0].data(), null, 2));
}

run().catch(console.error);
