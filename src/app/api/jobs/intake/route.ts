import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";
import { dispatch } from "@aceplace/runtime-core";

/**
 * Job Intake — Local Workflow Engine + Agent Pipeline Trigger
 * Creates a new job in Firestore, then fires the LangGraph pipeline.
 *
 * When NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME=true, the job is also
 * dispatched through the deterministic runtime engine (Phase 2).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        const result = await workflowEngine.createJob({
            user_id: body.user_id,
            requested_agent_id: body.requested_agent_id,
            job_type: body.job_type,
            prompt: body.prompt,
            job_id: body.job_id,
            force_crash: body.force_crash,
        });

        // Always dispatch through the deterministic runtime engine (Phase 2) DIRECTLY.
        // This avoids internal fetch overhead and potential auth mismatches.
        try {
            const dispatchResult = await dispatch({
                prompt: body.prompt,
                userId: body.user_id,
                jobId: result.job_id,
                agentId: body.requested_agent_id || "agent_coo",
                orgId: "default"
            });
            console.log(`[INTAKE] Successfully dispatched envelope: ${dispatchResult.envelope_id}`);
        } catch (err: any) {
            console.error("[INTAKE] Runtime dispatch trigger failed:", err.message);
        }

        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error("Job intake error:", error);
        return NextResponse.json({
            error: "INTAKE_ERROR",
            message: error.message || "Failed to create job"
        }, { status: 500 });
    }
}

