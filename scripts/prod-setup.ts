
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const admin = require("firebase-admin");
const { createHash } = require("crypto");

async function setup() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();

  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  const db = admin.firestore();
  console.log(`[SETUP] Initializing production environment for project: ${projectId}`);

  // Detect recent Org ID from envelopes to avoid mismatch
  let orgId = "org_subham_prod"; 
  const recentEnv = await db.collection("execution_envelopes").orderBy("created_at", "desc").limit(1).get();
  if (!recentEnv.empty) {
    orgId = recentEnv.docs[0].data().org_id;
    console.log(`[SETUP] Detected active Org ID from recent task: ${orgId}`);
  } else {
    console.log(`[SETUP] No recent tasks found. Using default Org ID: ${orgId}`);
  }

  // 1. Create a Production-Grade "dev_license" so checks pass even with FALLBACK=false
  const licenseId = "dev_license";
  const now = new Date().toISOString();
  
  const licenseData = {
    license_id: licenseId,
    org_id: orgId,
    tier: "growth",
    deployment_mode: "hosted_control_plane",
    status: "active",
    issued_at: now,
    expires_at: null,
    gates: {
      min_gate: 1,
      max_gate: 10
    },
    modules: {
      "identity_core": true,
      "fork_detection": true,
      "resurrection_verification": true,
      "runtime": true,
      "governance": true
    },
    limits: {
      max_agents: 100,
      max_environments: 10,
      telemetry_required: false
    }
  };

  await db.collection("licenses").doc(licenseId).set(licenseData);
  console.log(`[SETUP] Created production license: ${licenseId}`);

  // 2. Register/Update Agents with real SHA-256 fingerprints
  const agents = [
    { id: "agent_coo", role: "COO", mission: "Orchestrate" },
    { id: "agent_researcher", role: "Researcher", mission: "Research" },
    { id: "agent_worker", role: "Worker", mission: "Produce" },
    { id: "agent_grader", role: "Grader", mission: "Evaluate" },
  ];

  for (const a of agents) {
    const canonicalBody = {
      agent_id: a.id,
      display_name: a.role,
      role: a.role,
      mission: a.mission,
      org_id: orgId,
      created_at: now,
    };
    const canonicalJson = JSON.stringify(canonicalBody);
    const fingerprint = createHash("sha256").update(canonicalJson, "utf8").digest("hex");

    await db.collection("agents").doc(a.id).set({
      agent_id: a.id,
      display_name: a.role,
      canonical_identity_json: canonicalJson,
      identity_fingerprint: fingerprint,
      fingerprint: fingerprint,
      agent_class: a.role,
      jurisdiction: "ACEPLACE-AGENTSPACE",
      mission: a.mission,
      tier: 1,
      owner_org_id: orgId,
      created_at: now,
      last_verified_at: now,
    });
    console.log(`[SETUP] Registered agent: ${a.id} (fp: ${fingerprint.slice(0, 16)}...)`);
  }

  console.log("[SETUP] Success! Your local production environment is ready.");
  process.exit(0);
}

setup().catch(err => {
  console.error("[SETUP] Fatal Error:", err);
  process.exit(1);
});

module.exports = {};
