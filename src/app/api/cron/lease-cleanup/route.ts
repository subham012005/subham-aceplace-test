/**
 * GET /api/cron/lease-cleanup — Phase 2 cron job.
 * Scans execution_envelopes for expired embedded leases and marks them failed.
 *
 * 🔐 Security: CRON_SECRET is required. Returns 500 if not configured.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";
import { transition } from "@/lib/runtime/state-machine";
import { addTrace } from "@/lib/runtime/kernels/persistence";
import type { EnvelopeStep, ExecutionEnvelope } from "@/lib/runtime/types";
import { emitRuntimeMetric } from "@/lib/runtime/telemetry/emitRuntimeMetric";
import { verifyCronAuth, secureJson } from "@/lib/api-security";

const STALE_STEP_MS = 120_000;

import { recoverGlobalDeadSteps } from "@/lib/runtime/recover-dead-steps";

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

    console.log(
      `[CRON] Cleanup done. Expired=${failedCount}, Active=${cleanCount}, MultiRecovered=${multiRecovered}`
    );

    return secureJson({
      success: true,
      expired_envelopes: failedCount,
      active_leases: cleanCount,
      multi_agent_steps_recovered: multiRecovered,
    });
  } catch (error) {
    console.error("[CRON] Lease cleanup error:", error instanceof Error ? error.message : String(error));
    return secureJson({ error: "CLEANUP_ERROR" }, { status: 500 });
  }
}
