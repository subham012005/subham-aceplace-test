/**
 * GET /api/runtime/jobs/[id]/artifacts — Securely get artifacts for a job.
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

    // 🔐 1. Identity Resolution & Ownership check
    const jobDoc = await adminDb.collection("jobs").doc(jobId).get();
    let searchExecutionId = jobId;

    if (jobDoc.exists) {
        const job = jobDoc.data();
        if (job?.user_id !== userId) {
            return secureJson({ error: "Unauthorized" }, { status: 403 });
        }
        if (job?.envelope_id) {
            searchExecutionId = job.envelope_id;
        }
    } else {
        // Fallback: Check if this is an envelope ID directly
        const envDoc = await adminDb.collection("execution_envelopes").doc(jobId).get();
        if (envDoc.exists) {
            const env = envDoc.data();
            if (env?.user_id !== userId) {
                return secureJson({ error: "Unauthorized" }, { status: 403 });
            }
            // ID is already the execution ID
        } else {
            return secureJson({ error: "Context not found" }, { status: 404 });
        }
    }

    // 🔐 2. Fetch artifacts from modern collection (Server-side)
    const snapshot = await adminDb
      .collection("artifacts")
      .where("execution_id", "==", searchExecutionId)
      .get();

    const artifacts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    // 🔐 3. Sort in-memory (Resolves 9 FAILED_PRECONDITION missing index error)
    artifacts.sort((a, b) => {
      const timeA = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
      const timeB = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
      return timeB - timeA; // Descending
    });

    return secureJson(artifacts);
  } catch (error) {
    return safeErrorResponse(error, "GET_JOB_ARTIFACTS", 500);
  }
}
