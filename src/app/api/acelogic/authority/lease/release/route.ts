import { NextResponse } from "next/server";
import { aceLogicLeaseRelease } from "@aceplace/runtime-core";
import { getLicenseFromRequest, runtimeIdFromRequest } from "@aceplace/runtime-core";

export async function POST(req: Request) {
  const lr = await getLicenseFromRequest(req);
  if (!lr.ok) return lr.response;
  const result = await aceLogicLeaseRelease({
    license: lr.license,
    route: "/acelogic/authority/lease/release",
    runtimeId: runtimeIdFromRequest(req),
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}
