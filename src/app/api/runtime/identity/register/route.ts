/**
 * POST /api/runtime/identity/register — Automated Agent Onboarding.
 *
 * 🔐 Security:
 *  - MASTER_RUNTIME_SECRET (or CRON_SECRET fallback) Bearer token required.
 *  - Inputs sanitised (length-capped, trimmed).
 *  - Security headers on all responses.
 */

import { registerAgentIdentity } from "@aceplace/runtime-core";
import {
  verifyUserApiKey,
  sanitiseString,
  safeErrorResponse,
  secureJson,
} from "@/lib/api-security";

export async function POST(req: Request) {
  // 🔐 1. Authenticate via Master Secret (API Key)
  const { userId, orgId: resolvedOrgId, error } = await verifyUserApiKey(req);
  if (error) return error;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    // 🔐 2. Sanitise every user-supplied field
    const displayName = sanitiseString(body.display_name, "display_name", 64);
    const role = sanitiseString(body.role, "role", 32);
    const mission = sanitiseString(body.mission, "mission", 512);
    const orgId = resolvedOrgId; // Use the orgId resolved from the API key

    // Optional override — use with caution
    const agentId = typeof body.agent_id === "string" ? body.agent_id : undefined;

    // 📋 3. Execute Registration
    const result = await registerAgentIdentity({
      display_name: displayName,
      role,
      mission,
      org_id: orgId,
      agent_id: agentId,
    });

    // 🚢 4. Return secure response
    return secureJson(
      {
        success: true,
        agent_id: result.agent_id,
        identity_fingerprint: result.identity_fingerprint,
        message: "Agent identity registered and fingerprinted successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    return safeErrorResponse(error, "AGENT_ONBOARDING", 500);
  }
}
