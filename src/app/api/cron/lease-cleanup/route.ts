/**
 * GET /api/cron/lease-cleanup — Phase 2 cron job.
 * Scans execution_envelopes for expired embedded leases and marks them failed.
 *
 * 🔐 Security: CRON_SECRET is required. Returns 500 if not configured.
 */

import { NextResponse } from "next/server";
import { getDb } from "@aceplace/runtime-core";
import { COLLECTIONS } from "@aceplace/runtime-core";
import { transition } from "@aceplace/runtime-core";
import { addTrace } from "@aceplace/runtime-core";
import type { EnvelopeStep, ExecutionEnvelope } from "@aceplace/runtime-core";
import { emitRuntimeMetric } from "@aceplace/runtime-core";
import { verifyCronAuth, secureJson } from "@/lib/api-security";

const STALE_STEP_MS = 120_000;

import { recoverGlobalDeadSteps } from "@aceplace/runtime-core";

export async function GET(req: Request) {
  // 🔐 CRON_SECRET is required — hard-fail if missing or wrong
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  try {
    console.log("[CRON] Starting Phase 2 lease cleanup...");

    // 1. Recover stale multi-agent steps using the unified engine
    await recoverGlobalDeadSteps({ limit: 100 });

    const now = new Date();
    const db = getDb();

    // 2. Cleanup legacy single-agent envelopes with expired leases
    const executingEnvelopes = await db
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .where("status", "in", ["leased", "executing"])
      .get();

    let failedCount = 0;
    let cleanCount = 0;
    let multiRecovered = 0;

    for (const doc of executingEnvelopes.docs) {
      const envelope = doc.data() as ExecutionEnvelope;
      const envelopeId = doc.id;
      const lease = envelope.authority_lease;

      if (envelope.multi_agent) continue;

      if (!lease || new Date(lease.expires_at) <= now) {
        try {
          await transition(envelopeId, "failed");
          await addTrace(
            envelopeId,
            "cron",
            "cron-cleanup",
            "",
            "LEASE_EXPIRED_FAILURE",
            { reason: "Authority lease expired; stalled execution cleaned up." }
          );
          failedCount++;
        } catch (err) {
          console.error(
            `[CRON] Failed to expire envelope ${envelopeId}:`,
            err instanceof Error ? err.message : "UNKNOWN"
          );
        }
      } else {
        cleanCount++;
      }
    }

    // 3. Detect orphaned queue entries — queued but never claimed (no worker running)
    const ORPHAN_THRESHOLD_MS = 120_000; // 2 minutes
    const orphanCutoff = new Date(now.getTime() - ORPHAN_THRESHOLD_MS).toISOString();
    let orphanedCount = 0;

    const orphanedEntries = await db
      .collection(COLLECTIONS.EXECUTION_QUEUE)
      .where("status", "==", "queued")
      .where("created_at", "<", orphanCutoff)
      .limit(50)
      .get();

    for (const qDoc of orphanedEntries.docs) {
      const qData = qDoc.data();
      const envId = qData.envelope_id;
      if (!envId) continue;

      try {
        const envRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envId);
        const envSnap = await envRef.get();
        if (!envSnap.exists) continue;

        const envData = envSnap.data() as ExecutionEnvelope;
        const preExecution = ["created", "planned", "queued"];
        if (!preExecution.includes(envData.status)) continue;

        await transition(envId, "failed", {
          reason: "NO_WORKER_AVAILABLE: No runtime worker claimed this job within the timeout window.",
        });
        await addTrace(envId, "", "cron", "", "ORPHAN_QUEUE_FAILURE", {
          reason: "No runtime-worker process is running to execute this job.",
          queued_at: qData.created_at,
        });

        await qDoc.ref.update({
          status: "failed",
          error: "NO_WORKER_AVAILABLE",
          finalized_at: new Date().toISOString(),
        });

        // Sync the job doc so the dashboard shows "failed"
        const jobId = envData.job_id || (envData as any).root_task_id;
        if (jobId) {
          await db.collection(COLLECTIONS.JOBS).doc(jobId).update({
            status: "failed",
            failure_reason: "No runtime worker is running. Start the worker with 'npm run worker' and use Continuity Restore.",
            updated_at: new Date().toISOString(),
          }).catch(() => {});
        }

        orphanedCount++;
      } catch (err) {
        console.error(
          `[CRON] Failed to expire orphaned queue entry ${envId}:`,
          err instanceof Error ? err.message : "UNKNOWN"
        );
      }
    }

    console.log(
      `[CRON] Cleanup done. Expired=${failedCount}, Active=${cleanCount}, MultiRecovered=${multiRecovered}, Orphaned=${orphanedCount}`
    );

    return secureJson({
      success: true,
      expired_envelopes: failedCount,
      active_leases: cleanCount,
      multi_agent_steps_recovered: multiRecovered,
      orphaned_queue_entries: orphanedCount,
    });
  } catch (error) {
    console.error("[CRON] Lease cleanup error:", error instanceof Error ? error.message : String(error));
    return secureJson({ error: "CLEANUP_ERROR" }, { status: 500 });
  }
}
