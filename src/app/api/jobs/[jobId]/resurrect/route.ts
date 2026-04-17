import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";
import { dispatch } from "@aceplace/runtime-core";

/**
 * Resurrect (Resume) Job by ID
 * POST /api/jobs/[jobId]/resurrect
 *
 * Two cases:
 *   RESUME  — envelope exists, workflowEngine.resurrectJob resets it and
 *             re-queues the execution_queue entry. The runtime-worker picks
 *             it up on its next poll cycle.
 *   RESTART — rejected job, envelope wiped. We call dispatch() to create a
 *             fresh envelope + queue entry so the worker can claim it.
 *
 * The worker decides the compute path at runtime (Python agent-engine or
 * TypeScript LLM fallback) based on agent-engine availability.
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

        // RESTART path: rejected job had its envelope wiped — create a fresh
        // envelope + queue entry so the runtime-worker can pick it up.
        if (!result.execution_id && result.prompt && result.user_id) {
            await dispatch({
                prompt: result.prompt,
                userId: result.user_id,
                jobId,
                agentId: result.requested_agent_id || "agent_coo",
            });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Resurrection error:", error);
        const status = error.message?.includes("NOT_FOUND") ? 404
            : error.message?.includes("UNAUTHORIZED") ? 403
            : 500;
        return NextResponse.json({ error: error.message || "Failed to resume job" }, { status });
    }
}
