import { NextResponse } from "next/server";
import { aceLogicResurrectionVerify } from "@aceplace/runtime-core";
import { getLicenseFromRequest, runtimeIdFromRequest } from "@aceplace/runtime-core";

export async function POST(req: Request) {
  const lr = await getLicenseFromRequest(req);
  if (!lr.ok) return lr.response;
  const result = await aceLogicResurrectionVerify({
    license: lr.license,
    route: "/acelogic/continuity/resurrection/verify",
    runtimeId: runtimeIdFromRequest(req),
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}
