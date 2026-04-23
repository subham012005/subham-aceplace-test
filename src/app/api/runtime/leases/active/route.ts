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

    const activeLeases: any[] = [];

    snap.docs.forEach((doc) => {
      const envelope = doc.data() as ExecutionEnvelope;
      
      // 1. Check legacy singular lease for backward compat
      if (envelope.authority_lease) {
        const lease = envelope.authority_lease;
        if (new Date(lease.expires_at) > now) {
          activeLeases.push({
            envelope_id: doc.id,
            agent_id: "coordinator", // Singular lease assumed to be coordinator
            authority_lease: lease,
            is_legacy: true
          });
        }
      }

      // 2. Check Phase 2 multi-agent leases
      if (envelope.authority_leases) {
        Object.entries(envelope.authority_leases).forEach(([agentId, lease]) => {
          if (lease && lease.status !== "expired" && lease.status !== "revoked") {
            const expiry = lease.lease_expires_at || (lease as any).expires_at;
            if (expiry && new Date(expiry) > now) {
              activeLeases.push({
                envelope_id: doc.id,
                agent_id: agentId,
                authority_lease: {
                  holder_instance_id: lease.current_instance_id,
                  leased_at: lease.acquired_at,
                  expires_at: expiry
                }
              });
            }
          }
        });
      }
    });

    return secureJson({ activeLeases }, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "GET_ACTIVE_LEASES");
  }
}
