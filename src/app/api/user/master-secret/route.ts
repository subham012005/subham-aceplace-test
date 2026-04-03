import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { secureJson, safeErrorResponse } from "@/lib/api-security";
import crypto from "crypto";

/**
 * Manage User Master Secret (API Key)
 * GET: Fetch masked secret
 * POST: Generate new secret
 */

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!userId) return secureJson({ error: "MISSING_USER_ID" }, { status: 400 });
        if (!adminDb) return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });

        const snap = await adminDb
            .collection("api_keys")
            .where("user_id", "==", userId)
            .where("status", "==", "active")
            .limit(1)
            .get();

        if (snap.empty) {
            return secureJson({ exists: false });
        }

        const keyData = snap.docs[0].data();
        const secret = keyData.master_secret;
        
        // Return masked version for UI
        const masked = `${secret.substring(0, 10)}...${secret.substring(secret.length - 4)}`;

        return secureJson({ 
            exists: true, 
            masked_secret: masked,
            full_secret: secret, // Returning full secret since this is requested by the actual user in the dashboard
            created_at: keyData.created_at 
        });
    } catch (error) {
        return safeErrorResponse(error, "GET_USER_SECRET");
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const userId = body.user_id;

        if (!userId) return secureJson({ error: "MISSING_USER_ID" }, { status: 400 });
        if (!adminDb) return secureJson({ error: "ADMIN_NOT_INIT" }, { status: 503 });

        // 1. Revoke existing keys
        const existingKeys = await adminDb
            .collection("api_keys")
            .where("user_id", "==", userId)
            .where("status", "==", "active")
            .get();

        const batch = adminDb.batch();
        existingKeys.forEach(doc => {
            batch.update(doc.ref, { status: "revoked", revoked_at: new Date().toISOString() });
        });

        // 2. Generate new Secure Random Secret
        // Format: nxq_sk_<48 hex chars>
        const randomStr = crypto.randomBytes(24).toString('hex');
        const masterSecret = `nxq_sk_${randomStr}`;

        const newKeyRef = adminDb.collection("api_keys").doc();
        batch.set(newKeyRef, {
            key_id: newKeyRef.id,
            user_id: userId,
            org_id: body.org_id || "default",
            master_secret: masterSecret,
            status: "active",
            created_at: new Date().toISOString(),
        });

        await batch.commit();

        return secureJson({
            success: true,
            master_secret: masterSecret,
            message: "Master secret generated. Store it safely."
        }, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, "GENERATE_USER_SECRET");
    }
}
