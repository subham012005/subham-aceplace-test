import { NextResponse } from "next/server";
import { aceLogicIntrospect } from "@/lib/acelogic/service";
import { getLicenseFromRequest, runtimeIdFromRequest } from "@/lib/acelogic/http-context";

export async function GET(req: Request) {
  const lr = await getLicenseFromRequest(req);
  if (!lr.ok) return lr.response;
  void runtimeIdFromRequest(req);
  const data = await aceLogicIntrospect(lr.license);
  return NextResponse.json(data);
}
