import { dispatch } from "@aceplace/runtime-core";
import { sanitisePrompt, safeErrorResponse, secureJson, verifyUserApiKey } from "@/lib/api-security";

/**
 * POST /api/runtime/dispatch/from-dashboard
 *
 * Phase 3: accepts knowledge_context, instruction_context, web_search_context
 * and passes them into the execution envelope as grounding context.
 */
export async function POST(req: Request) {
  try {
    const { userId, orgId, error } = await verifyUserApiKey(req);
    if (error) return error;

    const body = (await req.json()) as Record<string, unknown>;

    const prompt = sanitisePrompt((body.root_task || body.prompt) as string);

    let agentId: string | undefined = undefined;
    if (body.execution_policy && typeof body.execution_policy === "object") {
        const entry_agent = (body.execution_policy as Record<string, unknown>).entry_agent;
        if (typeof entry_agent === "string") {
            agentId = entry_agent.trim().slice(0, 128);
        }
    }
    if (!agentId && typeof body.agent_id === "string") {
        agentId = body.agent_id.trim().slice(0, 128);
    }

    const jobId =
      typeof body.job_id === "string" && body.job_id.trim()
        ? body.job_id.trim().slice(0, 128)
        : undefined;

    // ── Phase 3: Extract grounding context from request ────────────────────
    const knowledge_context = (body.knowledge_context && typeof body.knowledge_context === "object")
        ? body.knowledge_context as { collections?: string[]; direct_text?: string; enabled: boolean }
        : undefined;

    const instruction_context = (body.instruction_context && typeof body.instruction_context === "object")
        ? body.instruction_context as { profiles?: string[]; enabled: boolean }
        : undefined;

    // Web search always enabled
    const web_search_context = {
        enabled: true,
        queries: [] as string[],
        sources_used: [] as string[],
    };

    const result = await dispatch({
      prompt,
      userId,
      jobId,
      orgId,
      agentId,
      // Phase 3 envelope grounding fields
      knowledge_context,
      instruction_context,
      web_search_context,
    } as any);

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
