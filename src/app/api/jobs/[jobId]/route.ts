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


        if (!adminDb) {
            return NextResponse.json({
                error: "Backend not configured",
                message: "Firebase Admin is not initialized. Please configure FIREBASE_PRIVATE_KEY in .env.local",
                code: "ADMIN_NOT_INITIALIZED"
            }, { status: 503 });
        }

        const jobsRef = adminDb.collection("jobs");
        let doc = await jobsRef.doc(jobId).get();
        let docData = doc.exists ? doc.data() : null;

        if (!doc.exists) {
            // Fallback: search by job_id field
            const snapshot = await jobsRef.where("job_id", "==", jobId).limit(1).get();
            if (!snapshot.empty) {
                doc = snapshot.docs[0];
                docData = doc.data();
            }
        }

        if (!docData) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }


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

/**
 * DELETE /api/jobs/[jobId]
 * Deletes a job record from Firestore.
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!adminDb) {
            return NextResponse.json({
                error: "Backend not configured",
                code: "ADMIN_NOT_INITIALIZED"
            }, { status: 503 });
        }

        const jobsRef = adminDb.collection("jobs");
        let docRef = jobsRef.doc(jobId);
        let doc = await docRef.get();

        if (!doc.exists) {
            // Fallback: search by job_id field
            const snapshot = await jobsRef.where("job_id", "==", jobId).limit(1).get();
            if (!snapshot.empty) {
                docRef = snapshot.docs[0].ref;
                doc = snapshot.docs[0];
            } else {
                return NextResponse.json({ error: "Job not found" }, { status: 404 });
            }
        }

        const docData = doc.data();
        if (userId && docData?.user_id !== userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const envelopeId = docData?.envelope_id;
        const searchIds = [jobId];
        if (envelopeId) searchIds.push(envelopeId);

        // --- CASCADED CLEANUP ---
        
        // 1. Delete Execution Traces
        const tracesSnapshot = await adminDb.collection("execution_traces")
            .where("envelope_id", "in", searchIds)
            .get();
        const traceDeletes = tracesSnapshot.docs.map(d => d.ref.delete());

        // 2. Delete Artifacts
        const artifactsSnapshot = await adminDb.collection("artifacts")
            .where("execution_id", "in", searchIds)
            .get();
        const artifactDeletes = artifactsSnapshot.docs.map(d => d.ref.delete());

        // 3. Delete Execution Envelope
        if (envelopeId) {
            await adminDb.collection("execution_envelopes").doc(envelopeId).delete();
        }

        // 4. Delete the Job record itself
        await docRef.delete();

        // Wait for all sub-records to be purged
        await Promise.all([...traceDeletes, ...artifactDeletes]);

        return NextResponse.json({ 
            success: true, 
            message: "Job record and all associated dimensional data purged from database",
            purged: {
                traces: tracesSnapshot.size,
                artifacts: artifactsSnapshot.size,
                envelopes: envelopeId ? 1 : 0
            }
        });
    } catch (error: any) {
        console.error("Delete job admin error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete job record" }, { status: 500 });
    }
}
