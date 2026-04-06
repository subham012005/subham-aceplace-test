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
      
      // Completed steps
      total_steps_completed += (env.steps ?? []).filter(
        (s) => s.status === "completed"
      ).length;
    });

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
    };

    return secureJson(stats, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "GET_RUNTIME_STATS");
  }
}
