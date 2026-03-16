import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Resurrect (Resume) Job Proxy
 * POST /api/jobs/[jobId]/resurrect
 */
export async function POST(
    req: Request,
    { params }: { params: { jobId: string } }
) {
    try {
        const jobId = params.jobId;
        const { user_id, reason } = await req.json().catch(() => ({}));

        if (!adminDb) {
            return NextResponse.json({ error: "ADMIN_NOT_INITIALIZED" }, { status: 503 });
        }

        // 1. Verify Ownership & Status
        const jobRef = adminDb.collection("jobs").doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const jobData = jobDoc.data();
        if (user_id && jobData?.user_id !== user_id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // 2. Call n8n Resurrect Webhook
        const baseUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;
        const n8nUrl = `${baseUrl}job-resurrect`;

        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.N8N_ACCESS_TOKEN}`
            },
            body: JSON.stringify({ job_id: jobId, reason: reason || "Operator Manual Override" }),
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json({ error: "n8n resurrection failed", details: error }, { status: response.status });
        }

        // 3. Update Firestore Status
        await jobRef.update({
            status: "queued", // Or in_progress, depending on if we want to wait for router
            quarantine_reason: null, // Clear quarantine
            updated_at: new Date().toISOString()
        });

        // 4. Log Trace
        await adminDb.collection("job_traces").add({
            job_id: jobId,
            user_id: jobData?.user_id,
            event_type: "OPERATOR_RESUMED",
            message: `Operator has resumed the job from quarantine.`,
            created_at: new Date().toISOString()
        });

        return NextResponse.json({ success: true, status: "resumed" });

    } catch (error: any) {
        console.error("Resurrection error:", error);
        return NextResponse.json({ error: error.message || "Failed to resume job" }, { status: 500 });
    }
}
