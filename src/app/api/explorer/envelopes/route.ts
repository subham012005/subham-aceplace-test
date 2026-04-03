import { NextResponse } from "next/server";
import { listEnvelopes } from "@/lib/explorer/service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const org_id = searchParams.get("org_id") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : 50;
    const items = await listEnvelopes({ org_id, status, limit });
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "EXPLORER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
