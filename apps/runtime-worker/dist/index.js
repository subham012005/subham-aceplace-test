"use strict";
/**
 * ACEPLACE Runtime Worker — Phase 2
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
// ── Firebase init (standalone — no Next.js) ───────────────────────────────────
let _app;
function initFirebase() {
    if (_app)
        return _app;
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
        : admin.credential.applicationDefault();
    _app = admin.initializeApp({ credential });
    return _app;
}
function getDb() {
    return initFirebase().firestore();
}
// ── Lazy import runtime-core so firebase-admin init runs first ──────────────
async function loadRuntime() {
    const runner = await Promise.resolve().then(() => __importStar(require("@aceplace/runtime-core")));
    return runner;
}
// ── Constants ─────────────────────────────────────────────────────────────────
const WORKER_ID = `worker_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`;
const POLL_INTERVAL_MS = 1000;
const EXECUTION_QUEUE_COLLECTION = "execution_queue";
console.log(`\n╔═══════════════════════════════════════════════════╗`);
console.log(`║   ACEPLACE Runtime Worker — Phase 2                    ║`);
console.log(`║   Worker ID : ${WORKER_ID.padEnd(34)}║`);
console.log(`║   Role      : execution-plane (not web-tier)      ║`);
console.log(`╚═══════════════════════════════════════════════════╝\n`);
// ── Claim function — atomic Firestore update ──────────────────────────────────
async function claimNextEnvelope() {
    const db = getDb();
    const snapshot = await db
        .collection(EXECUTION_QUEUE_COLLECTION)
        .where("status", "==", "queued")
        .orderBy("created_at", "asc")
        .limit(1)
        .get();
    if (snapshot.empty)
        return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    // Atomic claim — prevents two workers from racing on the same envelope
    try {
        await db.runTransaction(async (tx) => {
            const current = await tx.get(doc.ref);
            if (!current.exists)
                throw new Error("DOC_GONE");
            if (current.data()?.status !== "queued")
                throw new Error("ALREADY_CLAIMED");
            tx.update(doc.ref, {
                status: "claimed",
                claimed_by: WORKER_ID,
                claimed_at: new Date().toISOString(),
            });
        });
    }
    catch (err) {
        // Another worker claimed it first — skip silently
        if (err.message === "ALREADY_CLAIMED" || err.message === "DOC_GONE")
            return null;
        throw err;
    }
    console.log(`[WORKER:${WORKER_ID}] Claimed envelope: ${data.envelope_id}`);
    return { envelope_id: data.envelope_id };
}
// ── Mark queue entry as done (completed or failed) ────────────────────────────
async function finalizeQueueEntry(envelopeId, status, error) {
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
function sleep(ms) {
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
            }
            catch (execErr) {
                const msg = execErr?.message || String(execErr);
                console.error(`[WORKER:${WORKER_ID}] Execution failed for ${envelope_id}:`, msg);
                await finalizeQueueEntry(envelope_id, "failed", msg).catch(() => { });
            }
        }
        catch (pollErr) {
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
