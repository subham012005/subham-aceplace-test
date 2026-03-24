/**
 * POST /api/runtime/lease/acquire — Acquire envelope execution lease.
 * Phase 2: lease is embedded inside execution_envelopes.authority_lease.
 */

import { NextResponse } from "next/server";
import { acquireLease } from "@/lib/runtime/kernels/authority";
import type { LeaseAcquireRequest } from "@/lib/runtime/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeaseAcquireRequest;

    if (!body.envelope_id || !body.instance_id) {
      return NextResponse.json(
        { error: "VALIDATION", message: "envelope_id and instance_id are required" },
        { status: 400 }
      );
    }

    const result = await acquireLease(
      body.envelope_id,
      body.instance_id,
      body.duration_seconds
    );

    if (!result.acquired) {
      return NextResponse.json(
        { error: "LEASE_CONFLICT", message: `Lease not acquired: ${result.reason}` },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      authority_lease: result.authority_lease,
      reason: result.reason,
    }, { status: 200 });
  } catch (error: any) {
    console.error("[LEASE_ACQUIRE] Error:", error);
    return NextResponse.json(
      { error: "LEASE_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
