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
    const envelopeMetricsSnap = await db
      .collection(COLLECTIONS.ENVELOPE_METRICS)
      .doc(envelope_id)
      .get();
    let rollupsSnap;
    try {
      rollupsSnap = await db
        .collection(COLLECTIONS.TELEMETRY_ROLLUPS)
        .orderBy("window_end", "desc")
        .limit(20)
        .get();
    } catch {
      rollupsSnap = await db.collection(COLLECTIONS.TELEMETRY_ROLLUPS).limit(20).get();
    }
    return NextResponse.json({
      envelope_metrics: envelopeMetricsSnap.exists ? envelopeMetricsSnap.data() : null,
      rollups: rollupsSnap.docs.map((d) => d.data()),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
