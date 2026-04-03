/**
 * POST /api/runtime/secrets — Store/Update agent-specific secrets.
 * GET /api/runtime/secrets — List secret names for an agent.
 *
 * 🔐 Security:
 *  - MASTER_RUNTIME_SECRET required for all operations.
 */

import { NextResponse } from "next/server";
import { setAgentSecrets, listSecretNames } from "@/lib/runtime/kernels/secrets";
import { verifyMasterAuth, secureJson, safeErrorResponse } from "@/lib/api-security";

export async function POST(req: Request) {
  // 🔐 Verify Master Authentication
  const authError = verifyMasterAuth(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { agent_id, secrets } = body;

    if (!agent_id || typeof secrets !== "object") {
      return NextResponse.json(
        { error: "VALIDATION", message: "agent_id and secrets object are required" },
        { status: 400 }
      );
    }

    await setAgentSecrets(agent_id as string, secrets as Record<string, string>);

    return secureJson({
      success: true,
      agent_id,
      message: "Secrets updated successfully."
    });
  } catch (error) {
    return safeErrorResponse(error, "SECRETS_POST");
  }
}

export async function GET(req: Request) {
  // 🔐 Verify Master Authentication
  const authError = verifyMasterAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json(
       { error: "VALIDATION", message: "agent_id search parameter is required" },
       { status: 400 }
    );
  }

  try {
    const names = await listSecretNames(agentId);
    return secureJson({ 
       agent_id: agentId, 
       secret_names: names 
    });
  } catch (error) {
    return safeErrorResponse(error, "SECRETS_GET");
  }
}
