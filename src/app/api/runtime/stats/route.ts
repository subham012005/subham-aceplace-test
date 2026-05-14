import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@aceplace/runtime-core";
import { secureJson, safeErrorResponse, verifyUserApiKey } from "@/lib/api-security";
import type { ExecutionEnvelope } from "@aceplace/runtime-core";

/**
 * GET /api/runtime/stats — Aggregate runtime stats for the authenticated user.
 */
export async function GET(req: Request) {
  try {
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });
    }

    const now = new Date();
    const snap = await adminDb
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .where("user_id", "==", userId)
      .get();

    let active_leases = 0;
    let total_steps_completed = 0;
    const stepDurationsMs: number[] = [];
    const docs = snap.docs.map((d) => d.data() as ExecutionEnvelope);

    docs.forEach((env) => {
      // Lease check
      if (env.authority_lease && new Date(env.authority_lease.expires_at) > now) {
        active_leases++;
      } else if (env.multi_agent && env.authority_leases) {
          for (const l of Object.values(env.authority_leases)) {
              if (l && l.status !== "expired" && new Date(l.lease_expires_at) > now) {
                  active_leases++;
              }
          }
      }

      // Count completed steps
      const completedSteps = (env.steps ?? []).filter(
        (s) => s.status === "completed"
      );
      total_steps_completed += completedSteps.length;

      // Calculate latency ONLY for jobs that are graded, accepted, or rejected by the user/human
      const isJobCompletedOrResolved = 
        env.status === "completed" || 
        env.status === "approved" || 
        env.status === "rejected";

      if (isJobCompletedOrResolved) {
        // Collect durations from steps that have timing data
        for (const step of (env.steps ?? [])) {
          const s = step as any;
          
          // Phase 2 canonical timing uses created_at and updated_at for steps
          // Legacy check included for backward compatibility
          const startStr = s.started_at || s.created_at;
          const endStr = s.completed_at || s.updated_at;

          if (startStr && endStr) {
            const start = new Date(startStr).getTime();
            const end = new Date(endStr).getTime();
            const dur = end - start;
            if (!isNaN(dur) && dur >= 0) {
              stepDurationsMs.push(dur);
            }
          } else if (s.duration_ms != null && s.duration_ms >= 0) {
            stepDurationsMs.push(s.duration_ms);
          }
        }

        // Envelope-level fallback: if no step timing, use envelope created_at → updated_at
        if ((env.steps ?? []).length === 0) {
          const e = env as any;
          const created = e.created_at ? new Date(e.created_at).getTime() : null;
          const updated = e.updated_at ? new Date(e.updated_at).getTime() : null;
          if (created && updated) {
            const dur = updated - created;
            if (!isNaN(dur) && dur >= 0 && dur < 24 * 60 * 60 * 1000) {
              stepDurationsMs.push(dur);
            }
          }
        }
      }
    });

    const average_step_duration_ms =
      stepDurationsMs.length > 0
        ? Math.round(
            stepDurationsMs.reduce((a, b) => a + b, 0) / stepDurationsMs.length
          )
        : 0;

    const stats = {
      active_leases,
      total_envelopes: docs.length,
      executing_envelopes: docs.filter((d) => d.status === "executing").length,
      completed_envelopes: docs.filter(
        (d) => d.status === "approved" || d.status === "completed"
      ).length,
      failed_envelopes: docs.filter((d) => d.status === "failed").length,
      quarantined_envelopes: docs.filter((d) => d.status === "quarantined").length,
      total_steps_completed,
      average_step_duration_ms,
    };

    return secureJson(stats, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "GET_RUNTIME_STATS");
  }
}
