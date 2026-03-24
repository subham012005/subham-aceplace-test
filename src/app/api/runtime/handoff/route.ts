/**
 * POST /api/runtime/handoff — NOVA ACE #us#.task.handoff → envelope + parallel runner
 */

import { NextResponse } from "next/server";
import {
  acceptNovaHandoff,
  validateNovaHandoff,
  type NovaHandoffMessage,
} from "@/lib/runtime/nova-handoff";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    validateNovaHandoff(body);
    const result = await acceptNovaHandoff(body as NovaHandoffMessage);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "HANDOFF_ERROR";
    const status =
      message.startsWith("INVALID_") ||
      message.startsWith("MISSING_") ||
      message.startsWith("COO_") ||
      message.startsWith("ROLE_") ||
      message.startsWith("HANDOFF_")
        ? 400
        : 500;
    return NextResponse.json(
      { error: "HANDOFF_FAILED", message },
      { status }
    );
  }
}
