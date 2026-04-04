/**
 * NXQ Runtime Worker — Phase 2
 *
 * Long-lived polling loop that:
 *   1. Claims runnable envelopes from `execution_queue`
 *   2. Acquires per-agent leases
 *   3. Drives the parallel step runner
 *   4. Persists artifacts, messages, and traces
 *
 * RULE: This process is the ONLY place runEnvelopeParallel is called.
 *       The web app (workstation-web / engine.ts) NEVER calls it.
 *
 * Phase 2 | Deterministic Runtime Architecture
 */

import { randomUUID } from "crypto";
import * as admin from "firebase-admin";

// ── Firebase init (standalone — no Next.js) ───────────────────────────────────
let _app: admin.app.App;

function initFirebase(): admin.app.App {
  if (_app) return _app;
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : admin.credential.applicationDefault();

  _app = admin.initializeApp({ credential });
  return _app;
}

function getDb(): FirebaseFirestore.Firestore {
  return initFirebase().firestore();
}

// ── Lazy import runtime-core so firebase-admin init runs first ──────────────
async function loadRuntime() {
  // Direct import from upstream source (src/lib/runtime).
  // Adjust this to "@nxq/runtime-core" once the monorepo workspace links are installed.
  const runner = await import("../../../src/lib/runtime/parallel-runner");
  return runner;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKER_ID = `worker_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const POLL_INTERVAL_MS = 1000;
const EXECUTION_QUEUE_COLLECTION = "execution_queue";

console.log(`\n╔═══════════════════════════════════════════════════╗`);
console.log(`║   NXQ Runtime Worker — Phase 2                    ║`);
console.log(`║   Worker ID : ${WORKER_ID.padEnd(34)}║`);
console.log(`║   Role      : execution-plane (not web-tier)      ║`);
console.log(`╚═══════════════════════════════════════════════════╝\n`);

// ── Claim function — atomic Firestore update ──────────────────────────────────
async function claimNextEnvelope(): Promise<{ envelope_id: string } | null> {
  const db = getDb();
  const snapshot = await db
    .collection(EXECUTION_QUEUE_COLLECTION)
    .where("status", "==", "queued")
    .orderBy("created_at", "asc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data() as { envelope_id: string; status: string };

  // Atomic claim — prevents two workers from racing on the same envelope
  try {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(doc.ref);
      if (!current.exists) throw new Error("DOC_GONE");
      if (current.data()?.status !== "queued") throw new Error("ALREADY_CLAIMED");
      tx.update(doc.ref, {
        status: "claimed",
        claimed_by: WORKER_ID,
        claimed_at: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    // Another worker claimed it first — skip silently
    if (err.message === "ALREADY_CLAIMED" || err.message === "DOC_GONE") return null;
    throw err;
  }

  console.log(`[WORKER:${WORKER_ID}] Claimed envelope: ${data.envelope_id}`);
  return { envelope_id: data.envelope_id };
}

// ── Mark queue entry as done (completed or failed) ────────────────────────────
async function finalizeQueueEntry(
  envelopeId: string,
  status: "completed" | "failed",
  error?: string
): Promise<void> {
  const db = getDb();
  await db
    .collection(EXECUTION_QUEUE_COLLECTION)
    .doc(envelopeId)
    .update({
      status,
      finalized_at: new Date().toISOString(),
      ...(error ? { error } : {}),
    });
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main polling loop ─────────────────────────────────────────────────────────
async function main() {
  initFirebase();
  const { runEnvelopeParallel } = await loadRuntime();

  console.log(`[WORKER:${WORKER_ID}] Polling ${EXECUTION_QUEUE_COLLECTION} every ${POLL_INTERVAL_MS}ms...`);

  // Graceful shutdown
  let running = true;
  process.on("SIGINT", () => {
    console.log(`\n[WORKER:${WORKER_ID}] Received SIGINT — shutting down gracefully...`);
    running = false;
  });
  process.on("SIGTERM", () => {
    console.log(`\n[WORKER:${WORKER_ID}] Received SIGTERM — shutting down gracefully...`);
    running = false;
  });

  while (running) {
    try {
      const entry = await claimNextEnvelope();

      if (!entry) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const { envelope_id } = entry;

      try {
        console.log(`[WORKER:${WORKER_ID}] Starting runEnvelopeParallel for ${envelope_id}`);
        await runEnvelopeParallel({
          envelope_id,
          instance_id: WORKER_ID,
        });
        console.log(`[WORKER:${WORKER_ID}] Completed envelope: ${envelope_id}`);
        await finalizeQueueEntry(envelope_id, "completed");
      } catch (execErr: any) {
        const msg = execErr?.message || String(execErr);
        console.error(`[WORKER:${WORKER_ID}] Execution failed for ${envelope_id}:`, msg);
        await finalizeQueueEntry(envelope_id, "failed", msg).catch(() => {});
      }
    } catch (pollErr: any) {
      // Poll error — log and keep running
      console.error(`[WORKER:${WORKER_ID}] Poll error:`, pollErr?.message || pollErr);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }

  console.log(`[WORKER:${WORKER_ID}] Worker stopped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[WORKER] Fatal startup error:", err);
  process.exit(1);
});
