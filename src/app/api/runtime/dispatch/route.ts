/**
 * POST /api/runtime/dispatch — Accept task, build envelope, start execution.
 * T-012 | Sprint 3
 */

import { NextResponse } from "next/server";
import { dispatch } from "@/lib/runtime/engine";
import type { DispatchRequest } from "@/lib/runtime/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any; // Using any to allow optional job_id

    if (!body.prompt || !body.user_id) {
      return NextResponse.json(
        { error: "DISPATCH_VALIDATION", message: "prompt and user_id are required" },
        { status: 400 }
      );
    }

    const jobId = body.job_id || `job_${Date.now()}`;

    const result = await dispatch({
      prompt: body.prompt,
      userId: body.user_id,
      jobId,
      agentId: body.agent_id,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[DISPATCH] Error:", error);
    return NextResponse.json(
      { error: "DISPATCH_ERROR", message: error.message || "Failed to dispatch task" },
      { status: 500 }
    );
  }
}
