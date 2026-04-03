import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

/**
 * Global Job Reject
 * Rejects a job directly via Firestore.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        const result = await workflowEngine.rejectJob({
            job_id: body.job_id,
            user_id: body.user_id,
            reason: body.reason,
        });

        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error("Global Reject Error:", error);
        return NextResponse.json({
            error: "REJECT_ERROR",
            message: error.message || "Failed to reject job"
        }, { status: 500 });
    }
}
