import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";
import { dispatch } from "@aceplace/runtime-core";
import { getAuth } from "firebase-admin/auth";

/**
 * POST /api/jobs/[jobId]/continue
 *
 * Governed Execution Continuation — Edit / Continue
 *
 * Appends a new governed continuation step to the EXISTING execution envelope,
 * preserving all ACEAGENT identities, continuity records, execution traces,
 * artifact lineage, and the full authority chain.
 *
 * This is NOT a new job. It is Version N+1 of the same governed work task.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;

        if (!jobId) {
            return NextResponse.json({ error: "MISSING_JOB_ID" }, { status: 400 });
        }

        // ── Authenticate ──────────────────────────────────────────────────────
        const authHeader = req.headers.get("Authorization");
        let userId: string | undefined;

        if (authHeader?.startsWith("Bearer ")) {
            try {
                const token = authHeader.slice(7);
                const decoded = await getAuth().verifyIdToken(token);
                userId = decoded.uid;
            } catch {
                return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
            }
        }

        const body = await req.json().catch(() => ({}));
        const instruction: string = (body.instruction || "").trim();

        if (!instruction) {
            return NextResponse.json(
                { error: "MISSING_INSTRUCTION", message: "Continuation instruction is required." },
                { status: 400 }
            );
        }

        // ── Run Continuation Engine ────────────────────────────────────────────
        const result = await workflowEngine.continueJob({
            job_id: jobId,
            user_id: userId,
            instruction,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: "CONTINUATION_FAILED", message: result.message },
                { status: 422 }
            );
        }

        // ── Re-dispatch via Runtime Engine (same envelope, continuation context) ──
        // The runtime engine will find the existing envelope via jobId.
        // The continuation_root_task encodes the full continuity context.
        const dispatchResult = await dispatch({
            prompt: result.continuation_root_task,
            userId: result.user_id,
            jobId: result.job_id,
            agentId: result.requested_agent_id || "agent_coo",
            orgId: result.user_id,
        });

        if (!dispatchResult.success) {
            console.error(`[CONTINUE] Dispatch failed: ${dispatchResult.message}`);
            // Non-fatal: job is already set back to queued; the runtime will pick it up
        }

        console.log(
            `[CONTINUE] Continuation dispatched — job: ${jobId}, version: ${result.continuation_count}, envelope: ${result.envelope_id}`
        );

        return NextResponse.json({
            success: true,
            job_id: result.job_id,
            continuation_count: result.continuation_count,
            envelope_id: result.envelope_id,
            status: "queued",
        });

    } catch (error: any) {
        console.error("[CONTINUE] Route error:", error);

        if (error.message?.includes("INVALID_STATE")) {
            return NextResponse.json(
                { error: "INVALID_STATE", message: error.message },
                { status: 409 }
            );
        }
        if (error.message?.includes("UNAUTHORIZED")) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
        }
        if (error.message?.includes("JOB_NOT_FOUND")) {
            return NextResponse.json({ error: "JOB_NOT_FOUND" }, { status: 404 });
        }

        return NextResponse.json(
            { error: "CONTINUATION_ERROR", message: error.message || "Failed to continue job" },
            { status: 500 }
        );
    }
}
