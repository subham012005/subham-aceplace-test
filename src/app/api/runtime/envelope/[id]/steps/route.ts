/**
 * GET /api/runtime/envelope/[id]/steps — Phase 2: Returns embedded steps from envelope.
 * Steps are NOT in a separate collection — they are inside execution_envelopes.steps[]
 */

import { NextResponse } from "next/server";
import { getEnvelopeStep } from "@/lib/runtime/kernels/persistence";
import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params;

    // Phase 2: read steps from embedded envelope.steps[]
    const doc = await getDb()
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .doc(envelopeId)
      .get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Envelope not found" },
        { status: 404 }
      );
    }

    const steps = doc.data()?.steps ?? [];

    return NextResponse.json({ steps, count: steps.length }, { status: 200 });
  } catch (error: any) {
    console.error("[STEPS] Error:", error);
    return NextResponse.json(
      { error: "STEPS_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
