import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/runtime/constants";
import { secureJson, safeErrorResponse, verifyUserApiKey } from "@/lib/api-security";

/**
 * GET /api/runtime/envelopes — List execution envelopes for a user.
 */
export async function GET(req: Request) {
  try {
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });
    }

    const snap = await adminDb
      .collection(COLLECTIONS.EXECUTION_ENVELOPES)
      .where("user_id", "==", userId)
      .limit(100)
      .get();

    const items = snap.docs.map((doc) => ({
      ...doc.data(),
      envelope_id: doc.id,
    })) as any[];

    // 🔐 3. Sort in-memory (Resolves 9 FAILED_PRECONDITION missing index error)
    items.sort((a, b) => {
      const timeA = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
      const timeB = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
      return timeB - timeA; // Descending
    });

    return secureJson({ items }, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "LIST_ENVELOPES");
  }
}
