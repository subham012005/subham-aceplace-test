import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Secure Firestore Fetch for All Jobs by User
 * Uses Firebase Admin SDK to bypass client-side permission issues.
 * GET /api/jobs?user_id=...
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!userId) {
            return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
        }

        console.log(`[ADMIN] Fetching jobs for user: ${userId}`);

        if (!adminDb) {
            return NextResponse.json({
                error: "Backend not configured",
                message: "Firebase Admin is not initialized. Please configure FIREBASE_PRIVATE_KEY in .env.local",
                code: "ADMIN_NOT_INITIALIZED"
            }, { status: 503 });
        }

        const jobsRef = adminDb.collection("jobs");
        const snapshot = await jobsRef.where("user_id", "==", userId).get();

        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by updated_at desc in memory
        jobs.sort((a: any, b: any) =>
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        );

        return NextResponse.json(jobs);
    } catch (error: any) {
        console.error("Get jobs admin error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch jobs from secure layer." }, { status: 500 });
    }
}
