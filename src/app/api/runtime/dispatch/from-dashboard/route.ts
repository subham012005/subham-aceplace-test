import { dispatch } from "@aceplace/runtime-core";
import { sanitisePrompt, safeErrorResponse, secureJson, verifyUserApiKey } from "@/lib/api-security";

/**
 * POST /api/runtime/dispatch/from-dashboard
 *
 * Dashboard-only dispatch helper that:
 *  - Authenticates via Firebase ID token (verifyUserApiKey)
 *  - Accepts a raw prompt and optional job_id/agent_id
 *  - Calls the deterministic runtime engine dispatcher
 *
 * This keeps the public /api/runtime/dispatch contract intact for
 * server-to-server/API-key callers while giving the GUI an explicit
 * entry point that matches the docs' TaskComposer → dispatch flow.
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId, error } = await verifyUserApiKey(req);
    if (error) return error;

    const body = (await req.json()) as Record<string, unknown>;

    const prompt = sanitisePrompt(body.prompt);

    const agentId =
      typeof body.agent_id === "string" && body.agent_id.trim()
        ? body.agent_id.trim().slice(0, 128)
        : undefined;

    const jobId =
      typeof body.job_id === "string" && body.job_id.trim()
        ? body.job_id.trim().slice(0, 128)
        : undefined;

    const result = await dispatch({
      prompt,
      userId,
      jobId,
      orgId,
      agentId,
    });

    if (!result.success) {
      return secureJson({
        error: "IDENTITY_VERIFICATION_FAILED",
        ...result
      }, { status: 403 });
    }

    return secureJson(result, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "DASHBOARD_DISPATCH", 500);
  }
}

