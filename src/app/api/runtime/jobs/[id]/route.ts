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
    const doc = await adminDb.collection("jobs").doc(id).get();

    if (!doc.exists) {
      return secureJson({ error: "Job not found" }, { status: 404 });
    }

    const job = { id: doc.id, ...doc.data() } as any;

    // 🔐 3. Ownership check
    if (job.user_id !== userId) {
      return secureJson({ error: "Unauthorized" }, { status: 403 });
    }

    return secureJson(job);
  } catch (error) {
    return safeErrorResponse(error, "GET_JOB_DETAIL", 500);
  }
}
