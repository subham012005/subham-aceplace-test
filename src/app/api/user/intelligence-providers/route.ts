import { adminDb, admin } from "@/lib/firebase-admin";
import { secureJson, verifyUserApiKey, safeErrorResponse } from "@/lib/api-security";

/**
 * Secure Intelligence Provider Configuration API
 * Uses Firebase Admin SDK to bypass client-side security rules.
 */

export async function GET(req: Request) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;

        if (!adminDb) {
            throw new Error("ADMIN_NOT_INITIALIZED");
        }

        // Try canonical location first
        let doc = await adminDb.collection("org_intelligence_providers").doc(userId).get();
        
        if (!doc.exists) {
            // Fallback: check the 'jobs' collection for legacy/hack storage
            doc = await adminDb.collection("jobs").doc(`provider_config_${userId}`).get();
        }

        if (!doc.exists) {
            return new Response(JSON.stringify({ error: "NOT_FOUND", message: "No configuration found" }), { status: 404 });
        }

        return secureJson(doc.data());
    } catch (error: any) {
        return safeErrorResponse(error, "GET_INTEL_CONFIG", 500);
    }
}

export async function POST(req: Request) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;

        if (!adminDb) {
            throw new Error("ADMIN_NOT_INITIALIZED");
        }

        const body = await req.json();

        // 1. Save to canonical collection (Admin SDK bypasses rules)
        await adminDb.collection("org_intelligence_providers").doc(userId).set({
            ...body,
            org_id: userId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Cleanup legacy 'jobs' entry if it exists
        try {
            await adminDb.collection("jobs").doc(`provider_config_${userId}`).delete();
        } catch (e) { /* ignore cleanup errors */ }

        console.log(`[API] Successfully updated intelligence providers for user: ${userId}`);

        return secureJson({ success: true });
    } catch (error: any) {
        return safeErrorResponse(error, "SAVE_INTEL_CONFIG", 500);
    }
}
