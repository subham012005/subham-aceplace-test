import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    if (!adminDb) {
        return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
    }
    try {
        const body = await req.json();
        const userId = body.user_id;

        if (!userId || typeof userId !== "string") {
            return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
        }

        // 1. Generate new raw API key
        const rawApiKey = `NOVA-${randomBytes(32).toString('hex')}`;

        // 2. Hash the key for storage — raw key is NEVER stored
        const hashedSecret = createHash('sha256').update(rawApiKey).digest('hex');

        // 3. Masked version for UI display
        const maskedSecret = `NOVA-...${rawApiKey.slice(-4)}`;

        // 4. Revoke previous keys for this user
        const existingKeys = await adminDb.collection("api_keys")
            .where("user_id", "==", userId)
            .where("status", "==", "active")
            .get();

        const batch = adminDb.batch();
        existingKeys.docs.forEach(doc => {
            batch.update(doc.ref, {
                status: "revoked",
                revoked_at: new Date().toISOString()
            });
        });

        // 5. Save new key — only hashed_secret is persisted
        const newKeyRef = adminDb.collection("api_keys").doc();
        batch.set(newKeyRef, {
            api_key_id: newKeyRef.id,
            user_id: userId,
            hashed_secret: hashedSecret,
            masked_secret: maskedSecret,
            status: "active",
            created_at: new Date().toISOString()
        });

        await batch.commit();

        // 6. Return raw key ONCE — never retrievable again
        return NextResponse.json({
            success: true,
            api_key: rawApiKey,
            masked_secret: maskedSecret
        });
    } catch (err: any) {
        console.error("[master-secret] Failed to generate master secret:", err);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    if (!adminDb) {
        return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
    }
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!userId) {
            return NextResponse.json({ error: "MISSING_USER_ID" }, { status: 400 });
        }

        const keys = await adminDb.collection("api_keys")
            .where("user_id", "==", userId)
            .where("status", "==", "active")
            .limit(1)
            .get();

        if (keys.empty) {
            return NextResponse.json({ exists: false }, { status: 200 });
        }

        const data = keys.docs[0].data();
        return NextResponse.json({
            exists: true,
            masked_secret: data.masked_secret,
            created_at: data.created_at
        }, { status: 200 });
    } catch (err: any) {
        console.error("[master-secret] Failed to fetch master secret status:", err);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
