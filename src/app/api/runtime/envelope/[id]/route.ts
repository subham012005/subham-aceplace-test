/**
 * GET /api/runtime/envelope/[id] — Phase 2: Fetch full envelope state.
 */

import { NextResponse } from "next/server";
import { getEnvelopeState } from "@/lib/runtime/engine";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params;

    const state = await getEnvelopeState(envelopeId);

    if (!state) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Envelope not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(state, { status: 200 });
  } catch (error: any) {
    console.error("[ENVELOPE] Error:", error);
    return NextResponse.json(
      { error: "ENVELOPE_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
