import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

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

        const USE_DETERMINISTIC = body.use_deterministic ?? (process.env.NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME === "true");

        if (USE_DETERMINISTIC) {
            // Phase 2: dispatch through the deterministic runtime engine
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            fetch(`${baseUrl}/api/runtime/dispatch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: body.prompt,
                    user_id: body.user_id,
                    job_id: result.job_id,
                    agent_id: body.requested_agent_id || "agent_coo",
                    job_type: body.job_type,
                }),
            }).catch((err) => {
                console.warn("[INTAKE] Runtime dispatch trigger failed:", err.message);
            });
        } else {
            // Phase 1: fire the agent pipeline asynchronously (non-blocking)
            const agentEngineUrl = process.env.AGENT_ENGINE_URL || "http://localhost:8001";
            fetch(`${agentEngineUrl}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job_id: result.job_id,
                    prompt: body.prompt,
                    user_id: body.user_id,
                }),
            }).catch((err) => {
                console.warn("[INTAKE] Agent engine trigger failed (pipeline may not be running):", err.message);
            });
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

