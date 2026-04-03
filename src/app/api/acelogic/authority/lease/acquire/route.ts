import { NextResponse } from "next/server";
import { aceLogicLeaseAcquire } from "@/lib/acelogic/service";
import { getLicenseFromRequest, runtimeIdFromRequest } from "@/lib/acelogic/http-context";

export async function POST(req: Request) {
  const lr = await getLicenseFromRequest(req);
  if (!lr.ok) return lr.response;
  const body = (await req.json()) as Record<string, unknown>;
  const result = await aceLogicLeaseAcquire({
    license: lr.license,
    route: "/acelogic/authority/lease/acquire",
    body: {
      agent_id: body.agent_id as string | undefined,
      instance_id: body.instance_id as string | undefined,
    },
    runtimeId: runtimeIdFromRequest(req),
  });
  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: result.error, capability: (result as { capability?: string }).capability },
      { status: 403 }
    );
  }
  return NextResponse.json(result);
}
