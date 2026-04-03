import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/runtime/constants";
import { secureJson, safeErrorResponse, verifyUserApiKey } from "@/lib/api-security";
import type { AgentIdentity } from "@/lib/runtime/types";

/**
 * GET /api/runtime/identity/[agentId] — Fetch agent identity from identity store.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    // 🔐 1. Authenticate
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });
    }

    const doc = await adminDb.collection(COLLECTIONS.AGENTS).doc(agentId).get();

    if (!doc.exists) {
      return secureJson(
        { error: "NOT_FOUND", message: "Agent identity not found" },
        { status: 404 }
      );
    }

    const data = doc.data() as AgentIdentity;

    // 🔐 2. Ownership check
    if (data.user_id && data.user_id !== userId) {
      return secureJson({ error: "FORBIDDEN", message: "Identity owned by another user." }, { status: 403 });
    }

    return secureJson({ ...data, agent_id: doc.id }, { status: 200 });
  } catch (error) {
    return safeErrorResponse(error, "GET_AGENT_IDENTITY");
  }
}

/**
 * DELETE /api/runtime/identity/[agentId] — Remove agent identity from store.
 * Requires mandatory API key verification.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    // Verify User API Key
    const auth = await verifyUserApiKey(req);
    if (auth.error) return auth.error;

    if (!adminDb) {
      return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });
    }

    // Verify ownership before delete (optional but recommended)
    const docRef = adminDb.collection(COLLECTIONS.AGENTS).doc(agentId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data() as AgentIdentity;
      if (data.user_id && data.user_id !== auth.userId) {
        return secureJson({ error: "FORBIDDEN", message: "Identity owned by another user." }, { status: 403 });
      }
      await docRef.delete();
    }

    return secureJson({
      success: true,
      agent_id: agentId,
      message: "Agent identity deleted successfully."
    });
  } catch (error) {
    return safeErrorResponse(error, "DELETE_AGENT_IDENTITY");
  }
}
