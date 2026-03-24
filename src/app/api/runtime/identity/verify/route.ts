/**
 * POST /api/runtime/identity/verify — Phase 2: Verify agent identity fingerprint.
 */

import { NextResponse } from "next/server";
import { verifyIdentity } from "@/lib/runtime/kernels/identity";

interface IdentityVerifyRequest {
  agent_id: string;
  envelope_id?: string;
  fingerprint?: string;       // alias for identity_fingerprint
  identity_fingerprint?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IdentityVerifyRequest;

    const agentId = body.agent_id;
    const envelopeId = body.envelope_id || "";
    const fingerprint = body.identity_fingerprint || body.fingerprint || "";

    if (!agentId || (!envelopeId && !fingerprint)) {
      return NextResponse.json(
        { error: "VALIDATION", message: "agent_id and (envelope_id or fingerprint) are required" },
        { status: 400 }
      );
    }

    const db = (await import("@/lib/runtime/db")).getDb();
    const { COLLECTIONS } = await import("@/lib/runtime/constants");
    
    // Phase 2: verifyIdentity requires the full ExecutionEnvelope context
    const envelopeDoc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId || agentId).get();
    if (!envelopeDoc.exists) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Envelope not found. Cannot verify identity." },
        { status: 404 }
      );
    }

    const envelope = envelopeDoc.data() as any;
    const result = await verifyIdentity(envelopeId || agentId, agentId, envelope);

    return NextResponse.json(result, { status: result.verified ? 200 : 403 });
  } catch (error: any) {
    console.error("[IDENTITY_VERIFY] Error:", error);
    return NextResponse.json(
      { error: "IDENTITY_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
