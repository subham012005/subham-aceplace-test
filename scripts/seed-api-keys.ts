/**
 * seed-api-keys.ts — Pre-populate api_keys in Firestore for E2E testing.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function seed() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    console.error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY.");
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  const db = getFirestore();
  const masterSecret = process.env.MASTER_RUNTIME_SECRET || "test_master_secret_2026";

  const keyRecord = {
    key_id: "key_test_admin",
    user_id: "test_user_hardening_123",
    org_id: "ACEPLACE-CORE",
    master_secret: masterSecret,
    status: "active",
    created_at: new Date().toISOString(),
    name: "E2E Test Key",
  };

  await db.collection("api_keys").doc(keyRecord.key_id).set(keyRecord);
  console.log(`✅ Seeded API Key: ${keyRecord.key_id} | master_secret: ${masterSecret}`);
}

seed().catch(console.error);
