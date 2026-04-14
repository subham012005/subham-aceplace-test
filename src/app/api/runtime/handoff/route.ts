/**
 * POST /api/runtime/handoff — DEPRECATED (Phase-2)
 *
 * #us#.task.handoff is removed from the runtime.
 * External callers MUST use /api/runtime/dispatch instead.
 *
 * This route returns 410 Gone to make the removal explicit and auditable.
 */

import { secureJson } from "@/lib/api-security";

export async function POST() {
  return secureJson(
    {
      error: "ENDPOINT_REMOVED",
      message: "#us#.task.handoff has been removed in Phase-2. Use POST /api/runtime/dispatch instead.",
      migration: "POST /api/runtime/dispatch",
    },
    { status: 410 }
  );
}
