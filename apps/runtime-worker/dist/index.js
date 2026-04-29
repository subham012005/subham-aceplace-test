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
exports.sleep = sleep;
exports.runWorker = runWorker;
const env_1 = require("@next/env");
(0, env_1.loadEnvConfig)(process.cwd());
const crypto_1 = require("crypto");
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const runtime_core_1 = require("@aceplace/runtime-core");
// ── Status Server for Render Free Tier / UptimeRobot ──────────────────────────
function startHealthCheckServer() {
    const PORT = process.env.PORT || 3001;
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
let _app;
// ── Constants ─────────────────────────────────────────────────────────────────
const WORKER_ID = `worker_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`;
const POLL_INTERVAL_MS = 1000;
const EXECUTION_QUEUE_COLLECTION = runtime_core_1.COLLECTIONS.EXECUTION_QUEUE;
const SELF_PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (Render sleep is 15m)
const PUBLIC_URL = process.env.PUBLIC_URL || "https://subham-aceplace-test.onrender.com/";
console.log(`\n╔═══════════════════════════════════════════════════╗`);
console.log(`║   ACEPLACE Runtime Worker — Phase 2                    ║`);
console.log(`║   Worker ID : ${WORKER_ID.padEnd(34)}║`);
console.log(`║   Role      : execution-plane (not web-tier)      ║`);
console.log(`╚═══════════════════════════════════════════════════╝\n`);
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function startSelfPing(workerId) {
    if (!PUBLIC_URL) {
        console.warn(`[WORKER:${workerId}] No PUBLIC_URL provided. Self-ping disabled.`);
        return null;
    }
    const ping = () => {
        const protocol = PUBLIC_URL.startsWith("https") ? https : http;
        protocol.get(PUBLIC_URL, (res) => {
        }).on("error", (err) => {
        });
    };
    // Ping immediately then set interval
    ping();
    return setInterval(ping, SELF_PING_INTERVAL_MS);
}
// ── Main polling loop ─────────────────────────────────────────────────────────
async function runWorker(workerId = WORKER_ID) {
    // Start health check server
    const healthServer = startHealthCheckServer();
    // Start self-ping for Render Free Tier
    const pingInterval = startSelfPing(workerId);
    console.log(`[WORKER:${workerId}] Polling ${EXECUTION_QUEUE_COLLECTION} every ${POLL_INTERVAL_MS}ms...`);
    // Graceful shutdown
    let running = true;
    let activeEnvelopeId = null;
    const shutdown = async (signal) => {
        console.log(`\n[WORKER:${workerId}] Received ${signal} — shutting down gracefully...`);
        running = false;
        // Close health check server
        healthServer.close();
        // Stop self-ping
        if (pingInterval)
            clearInterval(pingInterval);
        if (activeEnvelopeId) {
            console.log(`[WORKER:${workerId}] Active envelope ${activeEnvelopeId} detected. Attempting to re-queue...`);
            try {
                await (0, runtime_core_1.requeueEnvelope)(activeEnvelopeId);
                console.log(`[WORKER:${workerId}] Successfully re-queued ${activeEnvelopeId}.`);
            }
            catch (err) {
                console.error(`[WORKER:${workerId}] Failed to re-queue:`, err);
            }
        }
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    while (running) {
        try {
            const entry = await (0, runtime_core_1.claimNextEnvelope)(workerId);
            if (!entry) {
                await sleep(POLL_INTERVAL_MS);
                continue;
            }
            const { envelope_id } = entry;
            activeEnvelopeId = envelope_id;
            try {
                console.log(`[WORKER:${workerId}] Starting runEnvelopeParallel for ${envelope_id}`);
                await (0, runtime_core_1.runEnvelopeParallel)({
                    envelope_id,
                    instance_id: workerId,
                });
                // Final status check — ensure we don't log "Completed" for failed/quarantined envelopes
                const finalEnv = await (0, runtime_core_1.getDb)().collection("execution_envelopes").doc(envelope_id).get();
                const finalStatus = finalEnv.data()?.status;
                if (finalStatus === "completed" || finalStatus === "approved") {
                    console.log(`[WORKER:${workerId}] Successfully completed envelope: ${envelope_id}`);
                    await (0, runtime_core_1.finalizeQueueEntry)(envelope_id, "completed");
                }
                else {
                    console.warn(`[WORKER:${workerId}] Runner exited with status: ${finalStatus} for ${envelope_id}`);
                    await (0, runtime_core_1.finalizeQueueEntry)(envelope_id, finalStatus === "failed" ? "failed" : "completed");
                }
            }
            catch (execErr) {
                const msg = execErr?.message || String(execErr);
                console.error(`[WORKER:${workerId}] Execution failed for ${envelope_id}:`, msg);
                await (0, runtime_core_1.finalizeQueueEntry)(envelope_id, "failed", msg).catch(() => { });
            }
            finally {
                activeEnvelopeId = null;
            }
        }
        catch (pollErr) {
            // Poll error — log and keep running
            console.error(`[WORKER:${workerId}] Poll error:`, pollErr?.message || pollErr);
            await sleep(POLL_INTERVAL_MS * 2);
        }
    }
    console.log(`[WORKER:${workerId}] Worker stopped.`);
}
/**
 * Starts the Python Agent Engine as a background process.
 * This allows running both the TS Worker and Python Engine on a single Render instance.
 */
function startAgentEngine() {
    const isWindows = process.platform === "win32";
    // On Render/Linux, we usually want 'python3'. Locally on Windows 'python'.
    const pythonCmd = isWindows ? "python" : "python3";
    const engineDir = path.join(process.cwd(), "agent-engine");
    console.log(`\n[SYSTEM] 🚀 Spawning Agent Engine: ${pythonCmd} main.py`);
    console.log(`[SYSTEM] CWD: ${engineDir}\n`);
    const engine = (0, child_process_1.spawn)(pythonCmd, ["main.py"], {
        cwd: engineDir,
        stdio: "inherit", // Pipe Python logs directly to our stdout/stderr
        shell: true,
        env: { ...process.env, PYTHONPATH: engineDir }
    });
    engine.on("error", (err) => {
        console.error("[SYSTEM] ❌ Failed to start Agent Engine:", err);
    });
    engine.on("exit", (code) => {
        if (code !== 0 && code !== null) {
            console.error(`[SYSTEM] ⚠️ Agent Engine process exited with code ${code}`);
        }
        else {
            console.log(`[SYSTEM] Agent Engine process exited gracefully.`);
        }
    });
    return engine;
}
// Only run if this is the main module
if (require.main === module) {
    // 1. Start the Python Agent Engine in the background
    const engineProcess = startAgentEngine();
    // 2. Start the Node.js Worker polling loop
    runWorker().catch((err) => {
        console.error("[WORKER] Fatal startup error:", err);
        if (engineProcess)
            engineProcess.kill();
        process.exit(1);
    });
    // Ensure Python dies if Node dies
    process.on("exit", () => engineProcess.kill());
}
