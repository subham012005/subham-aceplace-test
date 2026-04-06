import { NextResponse } from "next/server";
import { getDb } from "@aceplace/runtime-core";
import { COLLECTIONS } from "@aceplace/runtime-core";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ envelope_id: string }> }
) {
  try {
    const { envelope_id } = await ctx.params;
    const snap = await getDb()
      .collection(COLLECTIONS.EXECUTION_TRACES)
      .where("envelope_id", "==", envelope_id)
      .orderBy("timestamp", "desc")
      .limit(200)
      .get();
    return NextResponse.json({ items: snap.docs.map((d) => d.data()) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
