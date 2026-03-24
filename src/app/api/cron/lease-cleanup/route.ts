/**
 * GET /api/cron/lease-cleanup — Phase 2 cron job.
 * Scans execution_envelopes for expired embedded leases and marks them failed.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";
import { transition } from "@/lib/runtime/state-machine";
import { addTrace } from "@/lib/runtime/kernels/persistence";
import type { EnvelopeStep, ExecutionEnvelope } from "@/lib/runtime/types";

const STALE_STEP_MS = 120_000;

async function recoverStaleMultiAgentSteps(): Promise<number> {
  const db = getDb();
  const now = Date.now();
  const snap = await db
    .collection(COLLECTIONS.EXECUTION_ENVELOPES)
    .where("status", "==", "executing")
    .get();

  let recovered = 0;
  for (const doc of snap.docs) {
    const envelope = doc.data() as ExecutionEnvelope;
    if (!envelope.multi_agent) continue;

    let changed = false;
    const nextSteps = (envelope.steps || []).map((step: EnvelopeStep) => {
      if (step.status !== "executing" || !step.claimed_at) return step;
      const stale = now - new Date(step.claimed_at).getTime() > STALE_STEP_MS;
      if (!stale) return step;
      const aid = step.assigned_agent_id;
      const lease = aid ? envelope.authority_leases?.[aid] : null;
      const leaseExpired =
        !lease ||
        lease.status === "expired" ||
        lease.status === "revoked" ||
        new Date(lease.lease_expires_at).getTime() < now;

      if (!leaseExpired) return step;

      changed = true;
      const maxR = step.max_retries ?? 2;
      const nextRetry = (step.retry_count ?? 0) + 1;
      if (nextRetry < maxR) {
        recovered++;
        return {
          ...step,
          status: "ready" as const,
          retry_count: nextRetry,
          claimed_by_instance_id: null,
          claimed_at: null,
          updated_at: new Date().toISOString(),
        };
      }
      return {
        ...step,
        status: "failed" as const,
        retry_count: nextRetry,
        claimed_by_instance_id: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      };
    });

    if (changed) {
      await doc.ref.update({
        steps: nextSteps,
        updated_at: new Date().toISOString(),
      });
      await addTrace(
        doc.id,
        "",
        envelope.coordinator_agent_id || "system",
        "",
        "DEAD_STEP_RECOVERED",
        {}
      );
    }
  }
  return recovered;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    console.log("[CRON] Starting Phase 2 lease cleanup...");

    const now = new Date();
    const db = getDb();

    // Phase 2: leases are embedded in execution_envelopes.authority_lease
    // Find executing envelopes with expired leases
    const executingEnvelopes = await db
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .where("status", "in", ["leased", "executing"])
      .get();

    let failedCount = 0;
    let cleanCount = 0;

    let multiRecovered = 0;
    try {
      multiRecovered = await recoverStaleMultiAgentSteps();
    } catch (e) {
      console.error("[CRON] Multi-agent recovery error:", e);
    }

    for (const doc of executingEnvelopes.docs) {
      const envelope = doc.data() as ExecutionEnvelope;
      const envelopeId = doc.id;
      const lease = envelope.authority_lease;

      if (envelope.multi_agent) {
        continue;
      }

      if (!lease || new Date(lease.expires_at) <= now) {
        // Lease expired — mark envelope as failed
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
        } catch (err: any) {
          console.error(`[CRON] Failed to expire envelope ${envelopeId}:`, err.message);
        }
      } else {
        cleanCount++;
      }
    }

    console.log(`[CRON] Cleanup done. Expired ${failedCount} stalled envelopes. ${cleanCount} active leases still valid.`);

    return NextResponse.json({
      success: true,
      expired_envelopes: failedCount,
      active_leases: cleanCount,
      multi_agent_steps_recovered: multiRecovered,
    });
  } catch (error: any) {
    console.error("[CRON] Lease cleanup error:", error);
    return NextResponse.json(
      { error: "CLEANUP_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
