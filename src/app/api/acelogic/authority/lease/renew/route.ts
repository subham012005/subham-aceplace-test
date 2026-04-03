import { NextResponse } from "next/server";
import { aceLogicLeaseRenew } from "@/lib/acelogic/service";
import { getLicenseFromRequest, runtimeIdFromRequest } from "@/lib/acelogic/http-context";

export async function POST(req: Request) {
  const lr = await getLicenseFromRequest(req);
  if (!lr.ok) return lr.response;
  const result = await aceLogicLeaseRenew({
    license: lr.license,
    route: "/acelogic/authority/lease/renew",
    runtimeId: runtimeIdFromRequest(req),
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}
