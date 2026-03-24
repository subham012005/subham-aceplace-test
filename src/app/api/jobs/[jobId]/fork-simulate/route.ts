import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

/**
 * Fork Simulation — Local Workflow Engine
 * POST /api/jobs/[jobId]/fork-simulate
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const body = await req.json();

        const result = await workflowEngine.simulateFork({
            job_id: jobId,
            identity_id: body.identity_id,
            attempted_by: body.attempted_by || "system_simulation",
            reason: body.reason || "Automatic fork detection test",
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Fork simulate error:", error);
        return NextResponse.json({ error: error.message || "Failed to simulate fork" }, { status: 500 });
    }
}
