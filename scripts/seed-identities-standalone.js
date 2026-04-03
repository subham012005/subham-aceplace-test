const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * seed-identities-standalone.js — Pre-populate agent_identities in Firestore.
 * This is a CommonJS script to avoid transpilation issues.
 */

// ── Environment Loading ──────────────────────────────────────────────────────

const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
    console.log('--- Loading .env.local ---');
    const content = fs.readFileSync(envFile, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#=]+)\s*=\s*["']?(.*?)["']?\s*$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            process.env[key] = value;
        }
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256Hex(input) {
  return `hex:0x${crypto.createHash("sha256").update(input, "utf-8").digest("hex")}`;
}

function computeFingerprint(agentId, acelogicId) {
  const salt = 'nxq_salt_2024'; // Matches useRuntime salt if hardcoded, or read from env
  return sha256Hex(`${agentId}:${acelogicId}:${salt}`);
}

function now() {
  return new Date().toISOString();
}

// ── Agent Definitions ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    agent_id: "agent_coo",
    acelogic_id: "ACELOGIC-NXQ-COO-001",
    display_name: "Chief Orchestration Officer",
    agent_class: "Orchestrator",
    mission: "Plan, decompose, and orchestrate multi-step research and production tasks.",
    jurisdiction: "NXQ-AGENTSPACE",
    governance_profile: "STRATEGIC",
    owner_org_id: "NXQ-CORE",
    tier: 2,
  },
  {
    agent_id: "agent_researcher",
    acelogic_id: "ACELOGIC-NXQ-RES-001",
    display_name: "Intelligence Researcher",
    agent_class: "Analyst",
    mission: "Gather, structure, and synthesize information.",
    jurisdiction: "NXQ-AGENTSPACE",
    governance_profile: "ANALYTICAL",
    owner_org_id: "NXQ-CORE",
    tier: 1,
  },
  {
    agent_id: "agent_worker",
    acelogic_id: "ACELOGIC-NXQ-WRK-001",
    display_name: "Production Worker",
    agent_class: "Producer",
    mission: "Execute and produce deliverables to the highest specification.",
    jurisdiction: "NXQ-AGENTSPACE",
    governance_profile: "PRODUCTION",
    owner_org_id: "NXQ-CORE",
    tier: 1,
  },
  {
    agent_id: "agent_grader",
    acelogic_id: "ACELOGIC-NXQ-GRD-001",
    display_name: "Quality Grader",
    agent_class: "Evaluator",
    mission: "Assess output quality, compliance, and correctness.",
    jurisdiction: "NXQ-AGENTSPACE",
    governance_profile: "EVALUATIVE",
    owner_org_id: "NXQ-CORE",
    tier: 1,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        console.error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in environment.");
        process.exit(1);
    }

    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: formattedPrivateKey,
        }),
    });

    const db = admin.firestore();
    const timestamp = now();

    console.log(`Starting seeding for ${AGENTS.length} agents...`);

    for (const agent of AGENTS) {
        // ── 🤖 ALIGNMENT: Match Identity Kernel's canonical JSON & fingerprinting ────────────────
        const canonical_identity = {
            agent_id: agent.agent_id,
            display_name: agent.display_name,
            role: agent.agent_class,
            mission: agent.mission,
            org_id: agent.owner_org_id,
            created_at: timestamp,
        };
        const canonical_identity_json = JSON.stringify(canonical_identity);
        const identity_fingerprint = crypto.createHash("sha256").update(canonical_identity_json, "utf-8").digest("hex");

        const record = {
            ...agent,
            canonical_identity_json,
            identity_fingerprint,
            fingerprint: identity_fingerprint, // UI compat
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
            last_verified_at: timestamp,
            jurisdiction: agent.jurisdiction || "NXQ-AGENTSPACE",
        };

        // Write to 'agents' collection (as defined in COLLECTIONS.AGENTS)
        await db.collection("agents").doc(agent.agent_id).set(record, { merge: true });
        console.log(`✅ Seeded: ${agent.agent_id} | fingerprint: ${identity_fingerprint.slice(0, 30)}...`);
    }

    console.log("\n🚀 Identity seed complete. 4 agents registered in Firestore.");
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
