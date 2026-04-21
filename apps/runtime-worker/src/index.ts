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

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import * as http from "http";
import * as https from "https";

import {
  getDb,
  STALE_CLAIM_THRESHOLD_MS,
  COLLECTIONS,
  claimNextEnvelope,
  finalizeQueueEntry,
  requeueEnvelope,
  runEnvelopeParallel,
  type ExecutionEnvelope
} from "@aceplace/runtime-core";

// ── Status Server for Render Free Tier / UptimeRobot ──────────────────────────
function startHealthCheckServer() {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ACEPLACE Worker: Active\n");
  });

  server.listen(PORT, () => {
    console.log(`[STATUS] Health check server listening on port ${PORT}`);
  });

  return server;
}

// ── Firebase init (standalone — no Next.js) ───────────────────────────────────
let _app: admin.app.App;

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKER_ID = `worker_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const POLL_INTERVAL_MS = 1000;
const EXECUTION_QUEUE_COLLECTION = "execution_queue";
const SELF_PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (Render sleep is 15m)
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
    console.warn(`[WORKER:${workerId}] No PUBLIC_URL provided. Self-ping disabled.`);
    return null;
  }

  console.log(`[WORKER:${workerId}] Self-ping enabled for ${PUBLIC_URL}`);
  
  const ping = () => {
    console.log(`[WORKER:${workerId}] Sending self-ping to ${PUBLIC_URL}...`);
    const protocol = PUBLIC_URL.startsWith("https") ? https : http;
    protocol.get(PUBLIC_URL, (res) => {
      console.log(`[WORKER:${workerId}] Self-ping response: ${res.statusCode}`);
    }).on("error", (err) => {
      console.error(`[WORKER:${workerId}] Self-ping failed:`, err.message);
    });
  };

  // Ping immediately then set interval
  ping();
  return setInterval(ping, SELF_PING_INTERVAL_MS);
}

// ── Main polling loop ─────────────────────────────────────────────────────────
export async function runWorker(workerId: string = WORKER_ID) {
  // Start health check server
  const healthServer = startHealthCheckServer();
  // Start self-ping for Render Free Tier
  const pingInterval = startSelfPing(workerId);

  console.log(`[WORKER:${workerId}] Polling ${EXECUTION_QUEUE_COLLECTION} every ${POLL_INTERVAL_MS}ms...`);

  // Graceful shutdown
  let running = true;
  let activeEnvelopeId: string | null = null;

  const shutdown = async (signal: string) => {
    console.log(`\n[WORKER:${workerId}] Received ${signal} — shutting down gracefully...`);
    running = false;

    // Close health check server
    healthServer.close();

    // Stop self-ping
    if (pingInterval) clearInterval(pingInterval);

    if (activeEnvelopeId) {
       console.log(`[WORKER:${workerId}] Active envelope ${activeEnvelopeId} detected. Attempting to re-queue...`);
       try {
         await requeueEnvelope(activeEnvelopeId);
         console.log(`[WORKER:${workerId}] Successfully re-queued ${activeEnvelopeId}.`);
       } catch (err) {
         console.error(`[WORKER:${workerId}] Failed to re-queue:`, err);
       }
    }
  };


  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (running) {
    try {
      const entry = await claimNextEnvelope(workerId);

      if (!entry) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const { envelope_id } = entry;
      activeEnvelopeId = envelope_id;

        try {
          console.log(`[WORKER:${workerId}] Starting runEnvelopeParallel for ${envelope_id}`);
          await runEnvelopeParallel({
            envelope_id,
            instance_id: workerId,
          });
          
          // Final status check — ensure we don't log "Completed" for failed/quarantined envelopes
          const finalEnv = await getDb().collection("execution_envelopes").doc(envelope_id).get();
          const finalStatus = finalEnv.data()?.status;
          
          if (finalStatus === "completed" || finalStatus === "approved") {
            console.log(`[WORKER:${workerId}] Successfully completed envelope: ${envelope_id}`);
            await finalizeQueueEntry(envelope_id, "completed");
          } else {
            console.warn(`[WORKER:${workerId}] Runner exited with status: ${finalStatus} for ${envelope_id}`);
            await finalizeQueueEntry(envelope_id, finalStatus === "failed" ? "failed" : "completed"); 
          }
        } catch (execErr: any) {
          const msg = execErr?.message || String(execErr);
          console.error(`[WORKER:${workerId}] Execution failed for ${envelope_id}:`, msg);
          await finalizeQueueEntry(envelope_id, "failed", msg).catch(() => {});
        } finally {
          activeEnvelopeId = null;
        }
    } catch (pollErr: any) {
      // Poll error — log and keep running
      console.error(`[WORKER:${workerId}] Poll error:`, pollErr?.message || pollErr);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }

  console.log(`[WORKER:${workerId}] Worker stopped.`);
}

// Only run if this is the main module
if (require.main === module) {
  runWorker().catch((err) => {
    console.error("[WORKER] Fatal startup error:", err);
    process.exit(1);
  });
}

