import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Secure Firestore Fetch for Single Job by ID
 * Uses Firebase Admin SDK to bypass client-side permission issues.
 * GET /api/jobs/[jobId]
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        console.log(`[ADMIN] Fetching job details: ${jobId} (User: ${userId || 'ANY'})`);

        if (!adminDb) {
            return NextResponse.json({
                error: "Backend not configured",
                message: "Firebase Admin is not initialized. Please configure FIREBASE_PRIVATE_KEY in .env.local",
                code: "ADMIN_NOT_INITIALIZED"
            }, { status: 503 });
        }

        const jobsRef = adminDb.collection("jobs");
        const snapshot = await jobsRef.where("job_id", "==", jobId).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const doc = snapshot.docs[0];
        const docData = doc.data();

        // Security: Verify user ownership if userId is provided
        if (userId && docData.user_id !== userId) {
            return NextResponse.json({ error: "Unauthorized access to dimensional record" }, { status: 403 });
        }

        const job = {
            id: doc.id,
            ...docData,
            job_id: docData.job_id || jobId // Ensure job_id is present
        };

        return NextResponse.json(job);
    } catch (error: any) {
        console.error("Get job admin error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch job record" }, { status: 500 });
    }
}
