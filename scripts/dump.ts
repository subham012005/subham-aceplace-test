import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};
initializeApp({ credential: cert(serviceAccount) });

async function run() {
  const db = getFirestore();
  const latestSnap = await db.collection("execution_envelopes")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
    
  if (latestSnap.empty) {
    console.log("No envelopes found.");
    return;
  }
  
  const envelopeId = latestSnap.docs[0].id;
  const doc = await db.collection("execution_envelopes").doc(envelopeId).get();
  const data = doc.data();
  require("fs").writeFileSync("dump.json", JSON.stringify(data, null, 2));
  console.log(`Wrote ${envelopeId} to dump.json`);
}

run().catch(console.error);
