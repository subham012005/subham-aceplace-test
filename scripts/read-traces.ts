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
  const envelopeId = "env_5ad80662d5e1488cb958";
  const snap = await db.collection("execution_traces")
    .where("envelope_id", "==", envelopeId)
    .orderBy("timestamp", "asc")
    .get();
  
  const traces = snap.docs.map(doc => doc.data());
  require("fs").writeFileSync("d:/NOVA/nxq-workstation/traces.json", JSON.stringify(traces, null, 2));
  console.log("Wrote to d:/NOVA/nxq-workstation/traces.json");
}

run().catch(console.error);
