/**
 * GET /api/runtime/envelope/[id]/steps — Phase 2: Returns embedded steps from envelope.
 * Steps are NOT in a separate collection — they are inside execution_envelopes.steps[]
 */

import { getDb } from "@aceplace/runtime-core";
import { COLLECTIONS } from "@aceplace/runtime-core";
import { verifyUserApiKey, safeErrorResponse, secureJson } from "@/lib/api-security";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params;

    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!getDb()) {
        throw new Error("DB_NOT_INITIALIZED");
    }

    // Phase 2: read steps from embedded envelope.steps[]
    const doc = await getDb()
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .doc(envelopeId)
      .get();

    if (!doc.exists) {
      return secureJson(
        { error: "NOT_FOUND", message: "Envelope not found" },
        { status: 404 }
      );
    }

    const data = doc.data();

    // 🔐 2. Ownership check
    if (data?.user_id !== userId) {
        return secureJson({ error: "FORBIDDEN", message: "Access denied to these steps." }, { status: 403 });
    }

    const steps = data?.steps ?? [];

    return secureJson({ steps, count: steps.length }, { status: 200 });
  } catch (error: any) {
    return safeErrorResponse(error, "GET_ENVELOPE_STEPS", 500);
  }
}
