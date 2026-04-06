import { NextResponse } from "next/server";
import { getDb } from "@aceplace/runtime-core";
import { COLLECTIONS } from "@aceplace/runtime-core";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ agent_id: string }> }
) {
  try {
    const { agent_id } = await ctx.params;
    const snap = await getDb()
      .collection(COLLECTIONS.AGENT_METRICS)
      .doc(agent_id)
      .get();
    return NextResponse.json({
      metrics: snap.exists ? snap.data() : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
