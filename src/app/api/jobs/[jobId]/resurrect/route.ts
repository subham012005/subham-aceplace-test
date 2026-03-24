import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

/**
 * Resurrect (Resume) Job by ID
 * POST /api/jobs/[jobId]/resurrect
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const { user_id, reason } = await req.json().catch(() => ({}));

        const result = await workflowEngine.resurrectJob({
            job_id: jobId,
            user_id,
            reason,
        });

        // Trigger the Python agent engine asynchronously
        const agentEngineUrl = process.env.AGENT_ENGINE_URL || "http://localhost:8000";
        fetch(`${agentEngineUrl}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                job_id: jobId,
                prompt: result.prompt || "Resume job execution",
                user_id: user_id || "system",
            }),
        }).catch(e => console.error("Agent Engine failed to restart from API:", e));

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Resurrection error:", error);
        const status = error.message?.includes("NOT_FOUND") ? 404
            : error.message?.includes("UNAUTHORIZED") ? 403
            : 500;
        return NextResponse.json({ error: error.message || "Failed to resume job" }, { status });
    }
}
