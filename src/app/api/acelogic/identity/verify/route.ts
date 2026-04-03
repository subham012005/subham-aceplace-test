import { NextResponse } from "next/server";
import { aceLogicVerifyIdentity } from "@/lib/acelogic/service";
import { getLicenseFromRequest, runtimeIdFromRequest } from "@/lib/acelogic/http-context";

export async function POST(req: Request) {
  const lr = await getLicenseFromRequest(req);
  if (!lr.ok) return lr.response;
  const body = (await req.json()) as Record<string, unknown>;
  const result = await aceLogicVerifyIdentity({
    license: lr.license,
    route: "/acelogic/identity/verify",
    body: {
      agent_id: body.agent_id as string | undefined,
      identity_fingerprint: body.identity_fingerprint as string | undefined,
      instance_id: body.instance_id as string | undefined,
    },
    runtimeId: runtimeIdFromRequest(req),
  });
  if ("error" in result && result.error === "INVALID_INPUT") {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  if ("error" in result && result.error) {
    return NextResponse.json(
      { error: result.error, capability: (result as { capability?: string }).capability },
      { status: 403 }
    );
  }
  return NextResponse.json(result);
}
