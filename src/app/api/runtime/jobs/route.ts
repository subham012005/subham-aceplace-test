/**
 * GET /api/runtime/jobs — Securely list jobs for the authenticated user.
 */

import { adminDb } from "@/lib/firebase-admin";
import {
  safeErrorResponse,
  secureJson,
  verifyUserApiKey,
} from "@/lib/api-security";

export async function GET(req: Request) {
  try {
    // 🔐 1. Authenticate via Master Secret (API Key)
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    // 🔐 2. Fetch jobs from Firestore (Server-side)
    if (!adminDb) {
      throw new Error("ADMIN_NOT_INITIALIZED");
    }

    const snapshot = await adminDb
      .collection("jobs")
      .where("user_id", "==", userId)
      .limit(50)
      .get();

    const jobs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    // 🔐 3. Sort in-memory (Resolves 9 FAILED_PRECONDITION missing index error)
    jobs.sort((a, b) => {
      const timeA = a.updated_at?.toMillis?.() || a.updated_at?.seconds * 1000 || 0;
      const timeB = b.updated_at?.toMillis?.() || b.updated_at?.seconds * 1000 || 0;
      return timeB - timeA;
    });

    return secureJson(jobs);
  } catch (error) {
    return safeErrorResponse(error, "GET_JOBS", 500);
  }
}
