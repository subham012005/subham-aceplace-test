/**
 * POST /api/runtime/lease/release — Release envelope lease.
 * Phase 2: lease is embedded inside execution_envelopes.authority_lease.
 */

import { NextResponse } from "next/server";
import { releaseLease } from "@/lib/runtime/kernels/authority";
import type { LeaseReleaseRequest } from "@/lib/runtime/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeaseReleaseRequest;

    // Accept envelope_id + instance_id OR legacy lease_id (envelope_id)
    const envelopeId = body.envelope_id || body.lease_id;
    const instanceId = (body as any).instance_id || "unknown";

    if (!envelopeId) {
      return NextResponse.json(
        { error: "VALIDATION", message: "envelope_id is required" },
        { status: 400 }
      );
    }

    const released = await releaseLease(envelopeId, instanceId);

    if (!released) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Lease not found or already released" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Lease released" }, { status: 200 });
  } catch (error: any) {
    console.error("[LEASE_RELEASE] Error:", error);
    return NextResponse.json(
      { error: "LEASE_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
