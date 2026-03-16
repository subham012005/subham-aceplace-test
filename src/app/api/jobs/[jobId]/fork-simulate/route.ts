import { NextResponse } from "next/server";

/**
 * Proxy for n8n Fork Simulation
 * POST /api/jobs/[jobId]/fork-simulate -> /webhook/fork-simulate
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const body = await req.json();

        const baseUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;
        if (!baseUrl) {
            return NextResponse.json({ error: "NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL is not defined in environment." }, { status: 500 });
        }

        const n8nUrl = `${baseUrl}fork-simulate`;
        console.log(`[PROXY] Simulating fork for job ${jobId} at: ${n8nUrl}`);

        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                job_id: jobId,
                identity_id: body.identity_id,
                attempted_by: body.attempted_by || "system_simulation",
                reason: body.reason || "Automatic fork detection test"
            }),
        });

        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.error("[PROXY] Failed to parse n8n response as JSON:", responseText);
            data = { error: responseText || "Empty response from n8n" };
        }

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Fork simulate proxy error:", error);
        return NextResponse.json({ error: error.message || "Failed to simulate fork" }, { status: 500 });
    }
}
