import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

/**
 * Reject Job by ID
 * POST /api/jobs/[jobId]/reject
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const { user_id, reason } = await req.json().catch(() => ({}));

        const result = await workflowEngine.rejectJob({
            job_id: jobId,
            user_id,
            reason,
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Rejection error:", error);
        const status = error.message?.includes("NOT_FOUND") ? 404
            : error.message?.includes("UNAUTHORIZED") ? 403
            : error.message?.includes("INVALID_STATE") ? 409
            : 500;
        return NextResponse.json({ error: error.message || "Failed to reject job" }, { status });
    }
}
