/**
 * GET /api/runtime/jobs/[id]/traces — Securely get traces for a job.
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
    const { id: jobId } = await params;

    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      throw new Error("ADMIN_NOT_INITIALIZED");
    }

    // 🔐 2. Resolve internal execution identity (job_id → envelope_id)
    let jobDoc = await adminDb.collection("jobs").doc(jobId).get();
    let jobData = jobDoc.exists ? jobDoc.data() : null;

    if (!jobDoc.exists) {
        // Fallback: search by job_id field
        const snapshot = await adminDb.collection("jobs").where("job_id", "==", jobId).limit(1).get();
        if (!snapshot.empty) {
            jobDoc = snapshot.docs[0];
            jobData = jobDoc.data();
        }
    }

    let searchId = jobId;
    if (jobData?.envelope_id) {
        searchId = jobData.envelope_id;
    }

    // 🔐 3. Fetch traces from modern Phase 2 collection (Server-side)
    const snapshot = await adminDb
      .collection("execution_traces")
      .where("envelope_id", "==", searchId)
      .get();

    const traces = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    // 🔐 3. Sort in-memory (Resolves 9 FAILED_PRECONDITION missing index error)
    traces.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
      const timeB = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
      return timeA - timeB;
    });

    return secureJson(traces);
  } catch (error) {
    return safeErrorResponse(error, "GET_JOB_TRACES", 500);
  }
}
