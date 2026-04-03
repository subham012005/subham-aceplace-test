import { NextResponse } from "next/server";
import { getEnvelopeDetail } from "@/lib/explorer/service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ envelope_id: string }> }
) {
  try {
    const { envelope_id } = await ctx.params;
    const data = await getEnvelopeDetail(envelope_id);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    const status = msg === "ENVELOPE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
