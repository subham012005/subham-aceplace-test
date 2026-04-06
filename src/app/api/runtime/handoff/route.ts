/**
 * POST /api/runtime/handoff — ACEPLACE #us#.task.handoff → envelope + parallel runner
 *
 * 🔐 Security:
 *  - validateAceHandoff enforces #us# protocol structure
 *  - task.description is length-capped to 8 000 chars
 *  - Security headers on all responses
 *  - Stack traces never returned to client
 */

import {
  acceptAceHandoff,
  validateAceHandoff,
  type AceHandoffMessage,
} from "@aceplace/runtime-core";
import { safeErrorResponse, secureJson, verifyUserApiKey } from "@/lib/api-security";

const MAX_TASK_DESCRIPTION_LENGTH = 8_000;

function sanitiseHandoffPayload(body: AceHandoffMessage): void {
  const desc = body?.payload?.task?.description;
  if (typeof desc === "string" && desc.length > MAX_TASK_DESCRIPTION_LENGTH) {
    throw Object.assign(
      new Error(`FIELD_TOO_LONG:payload.task.description`),
      { statusHint: 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    const body = (await req.json()) as any;

    // 🔐 2. Strict #us# protocol structure validation
    validateAceHandoff(body);

    // 🔐 3. Additional payload sanitisation
    sanitiseHandoffPayload(body as AceHandoffMessage);

    // 🔐 4. Override user context with authenticated identity
    if (body.execution) {
      body.execution.requested_by_user_id = userId;
    }

    const result = await acceptAceHandoff(body as AceHandoffMessage);
    return secureJson(result, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "HANDOFF", 500);
  }
}
