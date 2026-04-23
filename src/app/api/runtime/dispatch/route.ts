/**
 * POST /api/runtime/dispatch — Accept task, build execution envelope, start runtime.
 *
 * Phase 2 Contract (Envelope-First):
 *   - Dispatch creates an Execution Envelope, not targeting an agent directly.
 *   - entry_agent resolved from execution_policy (defaults to COO).
 *   - agent_id is DEPRECATED — accepted for backward compat only, maps to execution_policy.entry_agent.
 *
 * 🔐 Security:
 *  - prompt is validated and length-capped (8 000 chars)
 *  - user_id is format-validated (Firebase UID pattern)
 *  - Security headers on all responses
 *  - Stack traces never returned to client
 */

import { dispatch } from "@aceplace/runtime-core";
import {
  sanitisePrompt,
  sanitiseUserId,
  safeErrorResponse,
  secureJson,
  verifyUserApiKey,
} from "@/lib/api-security";

export async function POST(req: Request) {
  try {
    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    // 🔐 2. Validate userId
    if (!userId || userId.trim().length === 0) {
      return safeErrorResponse(
        new Error("INVALID_AUTH: No valid user ID from authentication"),
        "DISPATCH",
        400
      );
    }

    const body = (await req.json()) as Record<string, unknown>;

    // ── Accept both Phase 2 (root_task) and legacy (prompt) field names ──
    const rawTask =
      (typeof body.root_task === "string" ? body.root_task : null) ??
      (typeof body.prompt    === "string" ? body.prompt    : null);

    if (!rawTask || rawTask.trim() === "") {
      return safeErrorResponse(
        new Error("INVALID_INPUT: 'root_task' (or 'prompt') must be a non-empty string."),
        "DISPATCH",
        400
      );
    }
    const prompt = sanitisePrompt(rawTask);

    // ── Resolve entry agent from execution_policy (Phase 2) or legacy agent_id ──
    const executionPolicy =
      typeof body.execution_policy === "object" && body.execution_policy !== null
        ? (body.execution_policy as Record<string, unknown>)
        : {};

    const agentId =
      (typeof executionPolicy.entry_agent === "string" ? executionPolicy.entry_agent.trim() : null) ??
      (typeof body.agent_id === "string" ? body.agent_id.trim() : null) ??
      "agent_coo"; // Default: COO is always the Phase 2 entry point

    const jobId =
      typeof body.job_id === "string" && body.job_id.trim()
        ? body.job_id.trim().slice(0, 128)
        : `job_${Date.now()}`;

    const result = await dispatch({ prompt, userId, jobId, agentId });

    if (!result.success) {
      return secureJson({
        error: "IDENTITY_VERIFICATION_FAILED",
        ...result
      }, { status: 403 });
    }

    return secureJson({
      ...result,
      // Phase 2 response fields
      envelope_id: (result as any).envelope_id ?? (result as any).execution_id ?? null,
      entry_agent: agentId,
    }, { status: 200 });

  } catch (error) {
    return safeErrorResponse(error, "DISPATCH", 500);
  }
}
