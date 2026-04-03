/**
 * POST /api/runtime/lease/acquire — Acquire envelope execution lease.
 * Phase 2: lease is embedded inside execution_envelopes.authority_lease.
 */

import { NextResponse } from "next/server";
import { acquireLease } from "@/lib/runtime/kernels/authority";
import { verifyUserApiKey, safeErrorResponse } from "@/lib/api-security";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/runtime/constants";
import type { LeaseAcquireRequest } from "@/lib/runtime/types";

export async function POST(req: Request) {
  try {
    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error: authError } = await verifyUserApiKey(req);
    if (authError) return authError;

    const body = (await req.json()) as LeaseAcquireRequest;

    if (!body.envelope_id || !body.instance_id) {
      return NextResponse.json(
        { error: "VALIDATION", message: "envelope_id and instance_id are required" },
        { status: 400 }
      );
    }

    // 🔐 2. Verify Envelope Ownership
    const envelopeDoc = await adminDb!.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(body.envelope_id).get();
    if (!envelopeDoc.exists) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Envelope not found" }, { status: 404 });
    }

    const envelopeData = envelopeDoc.data();
    if (envelopeData?.user_id !== userId) {
      return NextResponse.json({ error: "FORBIDDEN", message: "You do not have authority over this envelope." }, { status: 403 });
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
