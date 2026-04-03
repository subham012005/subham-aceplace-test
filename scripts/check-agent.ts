import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { computeFingerprint } from "../src/lib/runtime/kernels/identity";

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

initializeApp({ 
  credential: cert(serviceAccount),
  projectId: serviceAccount.projectId 
});
const db = getFirestore();

async function check() {
  const doc = await db.collection("agents").doc("agent_grader").get();
  const data = doc.data();
  console.log("agent_grader DATA:", JSON.stringify(data, null, 2));
  
  if (data?.canonical_identity_json) {
    const raw = data.canonical_identity_json;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    console.log("COMPUTED HASH:", computeFingerprint(str));
  }
}
check();
