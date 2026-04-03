import { NextResponse } from "next/server";
import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";
import type { ExecutionEnvelope } from "@/lib/runtime/types";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ envelope_id: string }> }
) {
  try {
    const { envelope_id } = await ctx.params;
    const db = getDb();
    const envelopeSnap = await db
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .doc(envelope_id)
      .get();
    if (!envelopeSnap.exists) {
      return NextResponse.json({ error: "ENVELOPE_NOT_FOUND" }, { status: 404 });
    }
    const envelope = envelopeSnap.data() as ExecutionEnvelope;
    const refs = envelope.artifact_refs || [];
    const docs = await Promise.all(
      refs.map((id) => db.collection(COLLECTIONS.ARTIFACTS).doc(id).get())
    );
    return NextResponse.json({
      items: docs.filter((d) => d.exists).map((d) => d.data()),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
