import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@aceplace/runtime-core";
import { secureJson, safeErrorResponse } from "@/lib/api-security";
import type { ExecutionEnvelope } from "@aceplace/runtime-core";

/**
 * GET /api/runtime/leases/active — Fetch envelopes with active leases.
 * Used by the dashboard to show real-time agent activity.
 */
export async function GET() {
  try {
    if (!adminDb) {
      return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });
    }

    const now = new Date();
    
    // Phase 2: active leases are envelopes with status 'leased' or 'executing'
    const snap = await adminDb
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .where("status", "in", ["leased", "executing"])
      .get();

    const activeLeases = snap.docs
      .map((doc) => {
        const envelope = doc.data() as ExecutionEnvelope;
        const lease = envelope.authority_lease;
        
        // Final sanity check on expiration
        if (lease && new Date(lease.expires_at) > now) {
          return {
            envelope_id: doc.id,
            authority_lease: lease,
          };
        }
        return null;
      })
      .filter(Boolean);

    return secureJson({ activeLeases }, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "GET_ACTIVE_LEASES");
  }
}
