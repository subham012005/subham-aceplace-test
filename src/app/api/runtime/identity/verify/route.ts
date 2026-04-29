/**
 * POST /api/runtime/identity/verify — Phase 2: Verify agent identity fingerprint.
 */

import { NextResponse } from "next/server";
import { verifyIdentity } from "@aceplace/runtime-core";
import { verifyUserApiKey, safeErrorResponse } from "@/lib/api-security";

interface IdentityVerifyRequest {
  agent_id: string;
  envelope_id?: string;
  fingerprint?: string;       // alias for identity_fingerprint
  identity_fingerprint?: string;
}

export async function POST(req: Request) {
  try {
    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

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

    const db = (await import("@aceplace/runtime-core")).getDb();
    const { COLLECTIONS } = await import("@aceplace/runtime-core");
    const { computeFingerprint } = await import("@aceplace/runtime-core");
    
    // Phase 2: If envelopeId is missing, perform a GLOBAL registration check.
    if (!envelopeId) {
      const agentDoc = await db.collection(COLLECTIONS.AGENTS).doc(agentId).get();
      if (!agentDoc.exists) {
         return NextResponse.json(
          { error: "NOT_FOUND", message: "Agent not registered. Cannot verify identity." },
          { status: 404 }
        );
      }
      const agentData = agentDoc.data() as any;
      const recomputed = computeFingerprint(agentData.canonical_identity_json);
      // Normalize both sides: strip "hex:" and "0x" prefixes, lowercase.
      // Handles legacy agents stored as raw SHA-256 hex AND new agents with "hex:0x" prefix.
      const normFp = (v: string) => v.trim().replace(/^hex:/i, "").replace(/^0x/i, "").toLowerCase();
      const verified = normFp(recomputed) === normFp(fingerprint);
      
      
      return NextResponse.json({ 
        verified, 
        agent_id: agentId, 
        reason: verified ? undefined : "IDENTITY_FINGERPRINT_MISMATCH",
        verified_at: new Date().toISOString() 
      }, { status: verified ? 200 : 403 });
    }

    // Phase 2: verifyIdentity requires the full ExecutionEnvelope context
    const envelopeDoc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
    if (!envelopeDoc.exists) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Envelope not found. Cannot verify identity." },
        { status: 404 }
      );
    }

    const envelope = envelopeDoc.data() as any;
    const result = await verifyIdentity(envelopeId, agentId, envelope);

    return NextResponse.json(result, { status: result.verified ? 200 : 403 });
  } catch (error: any) {
    console.error("[IDENTITY_VERIFY] Error:", error);
    return NextResponse.json(
      { error: "IDENTITY_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
