/**
 * ACEPLACE Runtime Worker — Phase 2
 *
 * Long-lived worker that:
 *   1. Claims runnable envelopes from `execution_queue` — via real-time listener (primary)
 *   2. Acquires per-agent leases
 *   3. Drives the parallel step runner
 *   4. Persists artifacts, messages, and traces
 *
 * RULE: This process is the ONLY place runEnvelopeParallel is called.
 *       The web app (workstation-web / engine.ts) NEVER calls it.
 *
 * ── Quota Fix ──────────────────────────────────────────────────────────────
 *   OLD: Polling every 1 000 ms  → 86 400 Firestore reads/day (quota exhausted)
 *   NEW: onSnapshot listener     → ~2 reads/day at rest (99.9% reduction)
 *        30 s fallback poll      → for stale-claim reclamation only
 *        Exponential backoff     → graceful degradation on RESOURCE_EXHAUSTED
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Phase 2 | Deterministic Runtime Architecture
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import * as http from "http";
import * as https from "https";
import { spawn } from "child_process";
import * as path from "path";

import {
  getDb,
  STALE_CLAIM_THRESHOLD_MS,
  COLLECTIONS,
  claimNextEnvelope,
  finalizeQueueEntry,
  requeueEnvelope,
  runEnvelopeParallel,
  type ExecutionEnvelope,
} from "@aceplace/runtime-core";

// ── Status Server for Render Free Tier / UptimeRobot ──────────────────────────
function startHealthCheckServer() {
  const PORT = process.env.PORT || 3001;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ACEPLACE Worker: Active\n");
  });
  server.listen(PORT, () => {
    console.log(`[STATUS] Health check server listening on port ${PORT}`);
  });
  return server;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKER_ID = `worker_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** Slow fallback poll — only for stale-claim reclamation, NOT the primary trigger */
const STALE_CLAIM_POLL_INTERVAL_MS = 120_000;  // 120 s (2 minutes)
/** Minimum pause between consecutive job executions */
const MIN_INTER_JOB_DELAY_MS = 2_000;         // 2 s
/** Exponential backoff starting delay on quota/error */
const BACKOFF_BASE_MS = 3_000;                // 3 s
/** Exponential backoff hard cap */
const BACKOFF_MAX_MS = 60_000;               // 60 s

const EXECUTION_QUEUE_COLLECTION = COLLECTIONS.EXECUTION_QUEUE;
const SELF_PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PUBLIC_URL = process.env.PUBLIC_URL || "https://subham-aceplace-test.onrender.com/";

console.log(`\n╔═══════════════════════════════════════════════════╗`);
console.log(`║   ACEPLACE Runtime Worker — Phase 2                    ║`);
console.log(`║   Worker ID : ${WORKER_ID.padEnd(34)}║`);
console.log(`║   Role      : execution-plane (not web-tier)      ║`);
console.log(`╚═══════════════════════════════════════════════════╝\n`);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startSelfPing(workerId: string) {
  if (!PUBLIC_URL) {
    console.warn(`[WORKER:${workerId}] No PUBLIC_URL. Self-ping disabled.`);
    return null;
  }
  const ping = () => {
    const protocol = PUBLIC_URL.startsWith("https") ? https : http;
    protocol.get(PUBLIC_URL, () => {}).on("error", () => {});
  };
  ping();
  return setInterval(ping, SELF_PING_INTERVAL_MS);
}

// ── Core job processor — used by both listener and fallback poll ──────────────
async function processNextJob(
  workerId: string,
  activeRef: { value: string | null }
) {
  const entry = await claimNextEnvelope(workerId);
  if (!entry) return; // Nothing to claim — silent exit

  const { envelope_id } = entry;
  activeRef.value = envelope_id;

  try {
    console.log(`[WORKER:${workerId}] ▶ runEnvelopeParallel → ${envelope_id}`);
    await runEnvelopeParallel({ envelope_id, instance_id: workerId });

    const snap = await getDb()
      .collection("execution_envelopes")
      .doc(envelope_id)
      .get();
    const finalStatus = snap.data()?.status;

    if (finalStatus === "completed" || finalStatus === "approved") {
      console.log(`[WORKER:${workerId}] ✅ Envelope completed: ${envelope_id}`);
      await finalizeQueueEntry(envelope_id, "completed");
    } else {
      console.warn(`[WORKER:${workerId}] ⚠ Envelope exited as '${finalStatus}': ${envelope_id}`);
      await finalizeQueueEntry(
        envelope_id,
        finalStatus === "failed" ? "failed" : "completed"
      );
    }
  } catch (execErr: any) {
    const msg = execErr?.message || String(execErr);
    console.error(`[WORKER:${workerId}] ❌ Execution error for ${envelope_id}:`, msg);
    await finalizeQueueEntry(envelope_id, "failed", msg).catch(() => {});
  } finally {
    activeRef.value = null;
  }
}

// ── Main worker ───────────────────────────────────────────────────────────────
export async function runWorker(workerId: string = WORKER_ID) {
  const healthServer = startHealthCheckServer();
  const pingInterval = startSelfPing(workerId);

  console.log(`[WORKER:${workerId}] 🎯 Mode: Firestore onSnapshot (real-time) + ${STALE_CLAIM_POLL_INTERVAL_MS / 1000}s stale-claim fallback`);
  console.log(`[WORKER:${workerId}] 💡 Estimated reads: ~2-5/min at rest (was 60/min — 97% reduction)`);

  let running = true;
  const activeRef = { value: null as string | null };
  let isProcessing = false;
  let backoffMs = BACKOFF_BASE_MS;

  // Cleanup handles — populated below
  let stalePollTimer: NodeJS.Timeout | null = null;
  let unsubscribeListener: (() => void) | null = null;

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[WORKER:${workerId}] ${signal} received — shutting down...`);
    running = false;

    if (unsubscribeListener) unsubscribeListener();
    if (stalePollTimer) clearInterval(stalePollTimer);
    if (pingInterval) clearInterval(pingInterval);
    healthServer.close();

    if (activeRef.value) {
      const id = activeRef.value;
      console.log(`[WORKER:${workerId}] Re-queuing active envelope ${id}...`);
      try {
        await requeueEnvelope(id);
        console.log(`[WORKER:${workerId}] Re-queued ${id} ✅`);
      } catch (err) {
        console.error(`[WORKER:${workerId}] Failed to re-queue:`, err);
      }
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // ── Safe trigger (concurrency guard + exponential backoff) ────────────────
  const triggerJob = async (source: "listener" | "poll") => {
    if (!running || isProcessing) return;
    isProcessing = true;
    try {
      await processNextJob(workerId, activeRef);
      backoffMs = BACKOFF_BASE_MS; // Reset on success
      await sleep(MIN_INTER_JOB_DELAY_MS);
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      const isQuota =
        msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota");

      if (isQuota) {
        console.warn(
          `[WORKER:${workerId}] ⏳ Quota hit [${source}] — backing off ${backoffMs / 1000}s...`
        );
      } else {
        console.error(`[WORKER:${workerId}] ❌ Error [${source}]:`, msg);
      }

      if (process.env.BYPASS_QUOTA_BACKOFF === "true") {
        console.warn(`[WORKER:${workerId}] ⚠️ Bypassing quota backoff due to flag`);
        await sleep(MIN_INTER_JOB_DELAY_MS);
      } else {
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS); // Exponential cap
      }
    } finally {
      isProcessing = false;
    }
  };

  // ── PRIMARY: Real-time Firestore listener ──────────────────────────────────
  // Fires ONLY when status="queued" docs appear — 0 reads when the queue is empty
  try {
    const db = getDb();
    unsubscribeListener = db
      .collection(EXECUTION_QUEUE_COLLECTION)
      .where("status", "==", "queued")
      .onSnapshot(
        (snapshot: admin.firestore.QuerySnapshot) => {
          if (!running || snapshot.empty) return;

          const incoming = snapshot
            .docChanges()
            .filter((c: admin.firestore.DocumentChange) => c.type === "added" || c.type === "modified");

          if (incoming.length > 0) {
            console.log(
              `[WORKER:${workerId}] 📡 Listener: ${incoming.length} queued job(s) → triggering`
            );
            triggerJob("listener");
          }
        },
        (err: Error) => {
          // Listener error — log and let fallback poll handle it
          console.error(
            `[WORKER:${workerId}] ❗ Snapshot listener error (fallback poll active):`,
            err?.message || err
          );
        }
      );

    console.log(
      `[WORKER:${workerId}] ✅ Real-time listener attached to '${EXECUTION_QUEUE_COLLECTION}'`
    );
  } catch (initErr: any) {
    console.error(
      `[WORKER:${workerId}] ⚠ Listener init failed — relying on fallback poll only:`,
      initErr?.message
    );
  }

  // ── FALLBACK: Slow safety poll — stale claim reclamation only ─────────────
  // 1 read / 30 s = 2 880 reads/day (vs 86 400/day previously)
  stalePollTimer = setInterval(async () => {
    if (!running || isProcessing) return;
    await triggerJob("poll").catch((e) => {
      console.error(
        `[WORKER:${workerId}] Fallback poll error:`,
        e?.message || e
      );
    });
  }, STALE_CLAIM_POLL_INTERVAL_MS);

  // ── Keep process alive until shutdown ─────────────────────────────────────
  console.log(
    `[WORKER:${workerId}] 🟢 Worker active — waiting for jobs via real-time listener...`
  );
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (!running) {
        clearInterval(check);
        resolve();
      }
    }, 1_000);
  });

  console.log(`[WORKER:${workerId}] Worker stopped.`);
}

// ── Python Agent Engine ───────────────────────────────────────────────────────
function startAgentEngine() {
  const isWindows = process.platform === "win32";
  const engineDir = path.join(process.cwd(), "agent-engine");
  let pythonCmd = isWindows ? "python" : "python3";

  if (isWindows) {
    const fs = require("fs");
    const myenvPython = path.join(engineDir, "myenv", "Scripts", "python.exe");
    const venvPython = path.join(engineDir, ".venv", "Scripts", "python.exe");
    if (fs.existsSync(myenvPython)) {
      pythonCmd = myenvPython;
    } else if (fs.existsSync(venvPython)) {
      pythonCmd = venvPython;
    }
  }

  console.log(`\n[SYSTEM] 🚀 Spawning Agent Engine: ${pythonCmd} main.py`);
  console.log(`[SYSTEM] CWD: ${engineDir}\n`);

  const engine = spawn(pythonCmd, ["main.py"], {
    cwd: engineDir,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, PYTHONPATH: engineDir, PYTHONUNBUFFERED: "1" },
  });

  engine.on("error", (err) => {
    console.error("[SYSTEM] ❌ Failed to start Agent Engine:", err);
  });

  engine.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[SYSTEM] ⚠️ Agent Engine exited with code ${code}`);
    } else {
      console.log("[SYSTEM] Agent Engine exited gracefully.");
    }
  });

  return engine;
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (require.main === module) {
  const engineProcess = startAgentEngine();

  runWorker().catch((err) => {
    console.error("[WORKER] Fatal startup error:", err);
    if (engineProcess) engineProcess.kill();
    process.exit(1);
  });

  process.on("exit", () => engineProcess.kill());
}
