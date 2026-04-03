/**
 * GET /api/runtime/envelope/[id] — Phase 2: Fetch full envelope state.
 */

import { NextResponse } from "next/server";
import { getEnvelopeState } from "@/lib/runtime/engine";
import { verifyUserApiKey, safeErrorResponse, secureJson } from "@/lib/api-security";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params;

    // 🔐 1. Validate Input (FIRST - returns 400 for bad format)
    if (!envelopeId || envelopeId.trim().length === 0) {
      return secureJson(
        { error: "INVALID_REQUEST", message: "Envelope ID is required." },
        { status: 400 }
      );
    }

    // 🔐 2. Authenticate via Master Secret (API Key)
    const { userId, error: authError } = await verifyUserApiKey(req);
    if (authError) return authError;

    // 🔐 3. Resolve Identity (job_id → envelope_id)
    const { adminDb } = await import("@/lib/firebase-admin");
    if (!adminDb) throw new Error("ADMIN_NOT_INITIALIZED");

    let resolvedId = envelopeId;
    if (envelopeId.startsWith("job_")) {
        const jobDoc = await adminDb.collection("jobs").doc(envelopeId).get();
        if (jobDoc.exists && jobDoc.data()?.envelope_id) {
            resolvedId = jobDoc.data()?.envelope_id;
        }
    }

    // 🔐 4. Check resource existence
    const state = await getEnvelopeState(resolvedId);

    if (!state) {
      return secureJson(
        { error: "NOT_FOUND", message: `Envelope not found for ID: ${resolvedId}` },
        { status: 404 }
      );
    }

    // 🔐 5. Verify Envelope Ownership (Authorization)
    if ((state as any).envelope?.user_id !== userId) {
      return secureJson({ error: "FORBIDDEN", message: "Access denied to this envelope." }, { status: 403 });
    }

    return secureJson(state, { status: 200 });
  } catch (error: any) {
    return safeErrorResponse(error, "GET_ENVELOPE", 500);
  }
}
