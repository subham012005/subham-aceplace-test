import { NextResponse } from "next/server";
import { getDb } from "@aceplace/runtime-core";
import { COLLECTIONS } from "@aceplace/runtime-core";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ envelope_id: string }> }
) {
  try {
    const { envelope_id } = await ctx.params;
    const db = getDb();
    let snap;
    try {
      snap = await db
        .collection(COLLECTIONS.EXECUTION_MESSAGES)
        .where("envelope_id", "==", envelope_id)
        .orderBy("created_at", "desc")
        .limit(200)
        .get();
    } catch {
      snap = await db
        .collection(COLLECTIONS.EXECUTION_MESSAGES)
        .where("envelope_id", "==", envelope_id)
        .limit(200)
        .get();
    }
    return NextResponse.json({ items: snap.docs.map((d) => d.data()) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
