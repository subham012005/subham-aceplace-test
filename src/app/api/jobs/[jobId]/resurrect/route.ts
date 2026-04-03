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

        const agentEngineUrl = (
            process.env.AGENT_ENGINE_URL || "http://localhost:8001"
        ).replace(/\/+$/, "");

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const useDeterministic =
            process.env.NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME === "true";

        (async () => {
            if (result.execution_id && result.assigned_instance_id) {
                const res = await fetch(`${agentEngineUrl}/execute`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        envelope_id: result.execution_id,
                        instance_id: result.assigned_instance_id,
                    }),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    console.warn(
                        `[RESURRECT] Agent engine /execute returned ${res.status}:`,
                        text || res.statusText
                    );
                }
                return;
            }

            if (useDeterministic && result.prompt && result.user_id) {
                await fetch(`${baseUrl}/api/runtime/dispatch`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: result.prompt,
                        user_id: result.user_id,
                        job_id: jobId,
                        agent_id: result.requested_agent_id || "agent_coo",
                    }),
                });
                return;
            }

            console.warn(
                "[RESURRECT] No execution_id on job — skipped agent-engine /execute. " +
                    "Start the engine on AGENT_ENGINE_URL for Phase 2 jobs with an envelope, " +
                    "or set NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME=true to dispatch anew."
            );
        })().catch((e) => {
            const cause = e instanceof Error ? e.message : String(e);
            console.warn(
                `[RESURRECT] Follow-up trigger failed (${agentEngineUrl}). ` +
                    "Is the agent engine running (e.g. uvicorn on 8001)? " +
                    cause
            );
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Resurrection error:", error);
        const status = error.message?.includes("NOT_FOUND") ? 404
            : error.message?.includes("UNAUTHORIZED") ? 403
            : 500;
        return NextResponse.json({ error: error.message || "Failed to resume job" }, { status });
    }
}
