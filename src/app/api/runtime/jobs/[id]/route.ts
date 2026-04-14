/**
 * GET /api/runtime/jobs/[id] — Securely get a single job detail.
 */

import { adminDb } from "@/lib/firebase-admin";
import {
  safeErrorResponse,
  secureJson,
  verifyUserApiKey,
} from "@/lib/api-security";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      throw new Error("ADMIN_NOT_INITIALIZED");
    }

    // 🔐 2. Fetch the job from Firestore (Server-side)
    let doc = await adminDb.collection("jobs").doc(id).get();
    let jobData = doc.exists ? doc.data() : null;

    if (!doc.exists) {
      // Fallback: search by job_id field
      const snapshot = await adminDb.collection("jobs").where("job_id", "==", id).limit(1).get();
      if (!snapshot.empty) {
        doc = snapshot.docs[0];
        jobData = doc.data();
      }
    }

    if (!jobData) {
      return secureJson({ error: "Job not found" }, { status: 404 });
    }

    const job = { id: doc.id, ...jobData } as any;

    // 🔐 3. Ownership check
    if (job.user_id !== userId) {
      return secureJson({ error: "Unauthorized" }, { status: 403 });
    }

    return secureJson(job);
  } catch (error) {
    return safeErrorResponse(error, "GET_JOB_DETAIL", 500);
  }
}
