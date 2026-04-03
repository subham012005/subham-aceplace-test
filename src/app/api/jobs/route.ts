import { adminDb } from "@/lib/firebase-admin";
import { secureJson, verifyUserApiKey, safeErrorResponse } from "@/lib/api-security";

/**
 * Secure Firestore Fetch for All Jobs by User
 * Uses Firebase Admin SDK to bypass client-side permission issues.
 * GET /api/jobs?user_id=...
 */
export async function GET(req: Request) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;

        if (!adminDb) {
            throw new Error("ADMIN_NOT_INITIALIZED");
        }

        const jobsRef = adminDb.collection("jobs");
        let snapshot;

        if (userId === "all") {
            // Internal/Admin view
            snapshot = await jobsRef.limit(200).get();
        } else {
            snapshot = await jobsRef.where("user_id", "==", userId).limit(200).get();
        }

        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as any[];

        // 🔐 3. Sort in-memory (Resolves 9 FAILED_PRECONDITION missing index error)
        jobs.sort((a, b) => {
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeB - timeA;
        });

        return secureJson(jobs);
    } catch (error: any) {
        return safeErrorResponse(error, "GET_JOBS_SECURE", 500);
    }
}
