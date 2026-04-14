/**
 * POST /api/runtime/dispatch — Accept task, build envelope, start execution.
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

    // 🔐 2. Validate that userId is valid (not empty or null)
    if (!userId || userId.trim().length === 0) {
      return safeErrorResponse(
        new Error("INVALID_AUTH: No valid user ID from authentication"),
        "DISPATCH",
        400
      );
    }

    const body = (await req.json()) as Record<string, unknown>;

    if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim() === "") {
      return safeErrorResponse(
        new Error("INVALID_INPUT: 'prompt' must be a non-empty string."),
        "DISPATCH",
        400
      );
    }
    const prompt = sanitisePrompt(body.prompt);

    const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    if (agentId === "") {
      return safeErrorResponse(
        new Error("INVALID_INPUT: 'agent_id' must be provided."),
        "DISPATCH",
        400
      );
    }

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

    return secureJson(result, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "DISPATCH", 500);
  }
}
