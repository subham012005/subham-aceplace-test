/**
 * Phase 2 Migration Script
 *
 * Migrates existing Firestore data to the Phase 2 schema:
 * 1. Copies envelopes → execution_envelopes (with steps[] embedded)
 * 2. Embeds execution_steps data into parent envelope steps[]
 * 3. Embeds leases data into parent envelope authority_lease
 * 4. Updates jobs.envelope_id pointer (from execution_id)
 *
 * OLD collections remain intact (deprecated, not deleted).
 * Run once, then verify manually in Firebase console.
 *
 * Usage: node scripts/migrate-to-phase2.js
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// ─── Init Firebase ─────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

// ─── Migration Logic ───────────────────────────────────────────────────────────

async function migrateToPhase2() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   NXQ Phase 2 Migration                      ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  let stats = {
    envelopes_migrated: 0,
    steps_embedded: 0,
    leases_embedded: 0,
    jobs_updated: 0,
    errors: 0,
  };

  // ── Step 1: Load all existing envelopes ───────────────────────────────────
  console.log("1. Loading existing envelopes...");
  const envelopeSnap = await db.collection("envelopes").get();
  console.log(`   Found ${envelopeSnap.size} envelopes in legacy collection.`);

  for (const envDoc of envelopeSnap.docs) {
    const old = envDoc.data();
    const envelopeId = old.execution_id || envDoc.id;

    try {
      // ── Step 2: Load external steps for this envelope ─────────────────────
      const stepsSnap = await db.collection("execution_steps")
        .where("execution_id", "==", envDoc.id)
        .orderBy("step_index", "asc")
        .get();

      const embeddedSteps = stepsSnap.docs.map((doc) => {
        const step = doc.data();
        stats.steps_embedded++;
        return {
          step_id: step.step_id,
          step_type: mapLegacyStepType(step.step_type),
          status: mapLegacyStepStatus(step.status),
          assigned_agent_id: step.agent_id || "unknown",
          input_ref: null,
          output_ref: step.output ? `legacy_${step.step_id}` : null,
        };
      });

      // If no external steps, build default steps[] from step_count
      if (embeddedSteps.length === 0) {
        const defaultTypes = ["plan", "assign", "artifact_produce", "evaluation"];
        const count = old.step_count || 4;
        for (let i = 0; i < Math.min(count, defaultTypes.length); i++) {
          embeddedSteps.push({
            step_id: `step_${envelopeId}_${i}`,
            step_type: defaultTypes[i],
            status: i < (old.completed_steps || 0) ? "completed" : "pending",
            assigned_agent_id: getDefaultAgent(defaultTypes[i]),
            input_ref: null,
            output_ref: null,
          });
        }
      }

      // ── Step 3: Load embedded lease ───────────────────────────────────────
      const leasesSnap = await db.collection("leases")
        .where("execution_id", "==", envDoc.id)
        .where("revoked", "==", false)
        .get();

      let authority_lease = null;
      if (!leasesSnap.empty) {
        const leaseData = leasesSnap.docs[0].data();
        const now = new Date();
        const expires = new Date(leaseData.expires_at);
        if (expires > now) {
          authority_lease = {
            holder_instance_id: leaseData.agent_id || "migrated",
            leased_at: leaseData.granted_at,
            expires_at: leaseData.expires_at,
          };
          stats.leases_embedded++;
        }
      }

      // Also check authority_context from old envelope
      if (!authority_lease && old.authority_context && !old.authority_context.revoked) {
        const expires = new Date(old.authority_context.expires_at || 0);
        if (expires > new Date()) {
          authority_lease = {
            holder_instance_id: old.agent_id || "migrated",
            leased_at: old.authority_context.granted_at || old.created_at,
            expires_at: old.authority_context.expires_at,
          };
        }
      }

      // ── Step 4: Build Phase 2 ExecutionEnvelope ───────────────────────────
      const phase2Envelope = {
        envelope_id: envelopeId,
        org_id: old.org_id || "default",
        status: mapLegacyStatus(old.execution_context?.status || old.status || "created"),

        // Embedded steps
        steps: embeddedSteps,

        // Embedded lease (or null)
        authority_lease,

        // Identity context
        identity_context: {
          agent_id: old.agent_id || old.identity_context?.agent_id || "unknown",
          identity_fingerprint: old.identity_context?.fingerprint || "migrated_no_fingerprint",
          verified: old.identity_context?.verified ?? false,
          verified_at: old.identity_context?.verified_at || old.created_at,
        },

        // Artifact refs
        artifact_refs: [],

        // Trace head
        trace_head_hash: null,

        // Timestamps
        created_at: old.created_at,
        updated_at: new Date().toISOString(),

        // Legacy link fields
        job_id: old.job_id || null,
        user_id: old.user_id || null,
        prompt: old.prompt || null,

        // Migration metadata
        _migrated_from: "envelopes",
        _migrated_at: new Date().toISOString(),
        _legacy_execution_id: envDoc.id,
      };

      // ── Step 5: Write to execution_envelopes ──────────────────────────────
      await db.collection("execution_envelopes").doc(envelopeId).set(phase2Envelope);
      stats.envelopes_migrated++;
      console.log(`   ✓ Migrated envelope ${envelopeId} (${embeddedSteps.length} steps)`);

      // ── Step 6: Update jobs collection pointer ────────────────────────────
      if (old.job_id) {
        await db.collection("jobs").doc(old.job_id).set({
          envelope_id: envelopeId,
          _phase2_migrated: true,
          updated_at: new Date().toISOString(),
        }, { merge: true });
        stats.jobs_updated++;
      }
    } catch (err) {
      console.error(`   ✗ Error migrating envelope ${envDoc.id}:`, err.message);
      stats.errors++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   Migration Complete                          ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Envelopes migrated : ${stats.envelopes_migrated}`);
  console.log(`  Steps embedded     : ${stats.steps_embedded}`);
  console.log(`  Leases embedded    : ${stats.leases_embedded}`);
  console.log(`  Jobs updated       : ${stats.jobs_updated}`);
  console.log(`  Errors             : ${stats.errors}`);
  console.log("\n  ⚠ Old collections (envelopes, execution_steps, leases)");
  console.log("    are PRESERVED and marked deprecated.");
  console.log("  ✓ New collection: execution_envelopes\n");
}

// ─── Mapping Helpers ──────────────────────────────────────────────────────────

function mapLegacyStepType(type) {
  const map = {
    plan: "plan", research: "assign", produce: "artifact_produce",
    grade: "evaluation", human_review: "evaluation", finalize: "evaluation",
  };
  return map[type] || "plan";
}

function mapLegacyStepStatus(status) {
  const map = {
    pending: "pending", running: "executing",
    completed: "completed", failed: "failed",
    skipped: "completed", awaiting_human: "executing",
  };
  return map[status] || "pending";
}

function mapLegacyStatus(status) {
  const map = {
    created: "created", identity_verified: "leased", lease_acquired: "leased",
    running: "executing", awaiting_human: "awaiting_human",
    completed: "approved", failed: "failed", quarantined: "quarantined",
  };
  return map[status] || "created";
}

function getDefaultAgent(stepType) {
  const map = { plan: "coo", assign: "researcher", artifact_produce: "worker", evaluation: "grader" };
  return map[stepType] || "system";
}

// ─── Run ──────────────────────────────────────────────────────────────────────
migrateToPhase2().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
