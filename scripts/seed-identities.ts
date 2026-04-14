/**
 * seed-identities.ts — Pre-populate agent_identities in Firestore.
 * T-036 | Sprint 6
 *
 * Usage: npx ts-node -e "require('./scripts/seed-identities').seed()"
 *        or: npx tsx scripts/seed-identities.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return `hex:0x${createHash("sha256").update(input, "utf-8").digest("hex")}`;
}

function computeFingerprint(agentId: string, acelogicId: string): string {
  const salt = process.env.ACELOGIC_IDENTITY_SALT ?? "";
  return sha256Hex(`${agentId}:${acelogicId}:${salt}`);
}

function now(): string {
  return new Date().toISOString();
}

import { CANONICAL_AGENTS as AGENTS } from "./packages/runtime-core/src/constants/agents";


// ── Main ──────────────────────────────────────────────────────────────────────

export async function seed() {
  // Init Firebase Admin if not already done
  if (!getApps().length) {
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccount) {
        initializeApp({ credential: cert(serviceAccount) });
    } else {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!clientEmail || !privateKey) {
            console.error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in environment.");
            process.exit(1);
        }

        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: formattedPrivateKey,
            }),
        });
    }
  }

  const db = getFirestore();
  const timestamp = now();

  for (const agent of AGENTS) {
    const canonical_identity_json = JSON.stringify({
      agent_id: agent.agent_id,
      acelogic_id: agent.acelogic_id,
      owner_org_id: agent.owner_org_id,
    });
    
    // Use the same hashing as in the runtime kernel
    const identity_fingerprint = createHash("sha256").update(canonical_identity_json, "utf-8").digest("hex");

    const record = {
      ...agent,
      canonical_identity_json,
      identity_fingerprint,
      anchors: {
        covenant_hash: sha256Hex(`${agent.agent_id}:covenant`),
        cvr_polygon: null,
        cvr_xrpl: null,
      },
      continuity: {
        status: "ACTIVE",
        current_instance_id: null,
        lease_expires_at: null,
        last_seen_at: null,
        resurrection_count: 0,
        fork_flag: false,
      },
      created_at: timestamp,
      last_verified_at: null,
    };

    const collectionName = "agents"; // Phase 2 canonical collection
    await db.collection(collectionName).doc(agent.agent_id).set(record, { merge: true });
    console.log(`✅ Seeded: ${agent.agent_id} in '${collectionName}' | fingerprint: ${identity_fingerprint.slice(0, 30)}...`);
  }

  console.log("\n🚀 Identity seed complete. 4 agents registered in Firestore 'agents' collection.");
}

// Auto-run if called directly
seed().catch(console.error);
