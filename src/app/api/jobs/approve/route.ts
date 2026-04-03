import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

/**
 * Global Job Approve
 * Approves a job directly via Firestore.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        const result = await workflowEngine.approveJob({
            job_id: body.job_id,
            user_id: body.user_id,
        });

        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error("Global Approve Error:", error);
        return NextResponse.json({
            error: "APPROVE_ERROR",
            message: error.message || "Failed to approve job"
        }, { status: 500 });
    }
}
