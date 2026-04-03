/**
 * Seed a dev ACELOGIC license document in Firestore (licenses collection).
 * Usage: node scripts/seed-license.js
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or Firebase env vars used by admin SDK.
 *
 * Set ACELOGIC_DEV_LICENSE_FALLBACK=1 to use tier defaults when the doc is missing;
 * this script creates `dev_license` so local runs match production contract.
 */

const { initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function init() {
  try {
    initializeApp({ credential: applicationDefault() });
  } catch {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) {
      console.error("Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY");
      process.exit(1);
    }
    initializeApp({ credential: cert(JSON.parse(key)) });
  }
}

async function main() {
  init();
  const db = getFirestore();
  const orgId = process.env.SEED_ORG_ID || "default";
  const licenseId = process.env.SEED_LICENSE_ID || "dev_license";
  const tier = process.env.SEED_LICENSE_TIER || "growth";

  const gates =
    tier === "free"
      ? { min_gate: 1, max_gate: 3 }
      : tier === "builder"
        ? { min_gate: 1, max_gate: 3 }
        : { min_gate: 1, max_gate: 6 };

  const modules =
    tier === "growth"
      ? {
          identity_core: true,
          mission_binding: true,
          metadata_signing: true,
          failover: true,
          fork_detection: true,
          resurrection_verification: true,
          continuity_api: true,
        }
      : {
          identity_core: true,
          mission_binding: true,
          metadata_signing: true,
          failover: tier === "builder",
          fork_detection: false,
          resurrection_verification: false,
          continuity_api: false,
        };

  await db
    .collection("licenses")
    .doc(licenseId)
    .set({
      license_id: licenseId,
      org_id: orgId,
      tier,
      deployment_mode: "hosted_control_plane",
      gates,
      modules,
      limits: {
        max_agents: tier === "growth" ? null : 20,
        max_environments: tier === "growth" ? 5 : 1,
        telemetry_required: true,
      },
      status: "active",
      issued_at: new Date().toISOString(),
      expires_at: null,
    });

  console.log(`Seeded licenses/${licenseId} for org_id=${orgId} tier=${tier}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
