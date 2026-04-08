/**
 * runtime-validation-probe.js
 *
 * Reads Firestore state for a given envelope_id and prints evidence.
 *
 * Usage:
 *   node scripts/runtime-validation-probe.js env_...
 */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

function readDotEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  const raw = fs.readFileSync(p, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if (v.startsWith("\"") && v.endsWith("\"")) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function initAdmin() {
  if (getApps().length) return;
  const env = readDotEnvLocal();
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  }
  let privateKey = privateKeyRaw.trim();
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

async function main() {
  const envelopeId = process.argv[2];
  if (!envelopeId) {
    console.error("Usage: node scripts/runtime-validation-probe.js <envelope_id>");
    process.exit(2);
  }

  initAdmin();
  const db = getFirestore();

  const [queueSnap, envSnap] = await Promise.all([
    db.collection("execution_queue").doc(envelopeId).get(),
    db.collection("execution_envelopes").doc(envelopeId).get(),
  ]);

  console.log("== execution_queue ==");
  console.log(JSON.stringify(queueSnap.exists ? { id: queueSnap.id, ...queueSnap.data() } : null, null, 2));

  console.log("\n== execution_envelopes ==");
  console.log(JSON.stringify(envSnap.exists ? envSnap.data() : null, null, 2));

  console.log("\n== execution_messages (latest 5) ==");
  const msgSnap = await db
    .collection("execution_messages")
    .where("envelope_id", "==", envelopeId)
    .limit(5)
    .get();
  console.log(JSON.stringify(msgSnap.docs.map((d) => ({ id: d.id, ...d.data() })), null, 2));

  console.log("\n== execution_traces (latest 10) ==");
  const traceSnap = await db
    .collection("execution_traces")
    .where("envelope_id", "==", envelopeId)
    .limit(10)
    .get();
  console.log(JSON.stringify(traceSnap.docs.map((d) => ({ id: d.id, ...d.data() })), null, 2));

  console.log("\n== artifacts (by envelope.artifact_refs) ==");
  const env = envSnap.exists ? envSnap.data() : null;
  const refs = Array.isArray(env?.artifact_refs) ? env.artifact_refs : [];
  const artifacts = [];
  for (const id of refs.slice(0, 10)) {
    const a = await db.collection("artifacts").doc(id).get();
    artifacts.push(a.exists ? { id: a.id, ...a.data() } : { id, missing: true });
  }
  console.log(JSON.stringify(artifacts, null, 2));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});

