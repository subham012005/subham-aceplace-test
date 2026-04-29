
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyUserApiKey } from "@/lib/api-security";

/**
 * GET    /api/user/direct-knowledge — Load user's persisted direct knowledge
 * POST   /api/user/direct-knowledge — Save user's direct knowledge
 */

export async function GET(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const doc = await db.collection("user_configs").doc(userId).get();
        if (!doc.exists) {
            return NextResponse.json({ success: true, direct_text: "" });
        }

        const data = doc.data();
        return NextResponse.json({ success: true, direct_text: data?.direct_text || "" });

    } catch (err: unknown) {
        console.error("GET direct-knowledge error:", err);
        return NextResponse.json({ error: "Failed to load direct knowledge" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const text: string = (body.text || "").trim();

        if (text.length > 50000) {
            return NextResponse.json({ error: "Content too long (max 50,000 chars)" }, { status: 400 });
        }

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        await db.collection("user_configs").doc(userId).set({
            direct_text: text,
            updated_at: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({ success: true });

    } catch (err: unknown) {
        console.error("POST direct-knowledge error:", err);
        return NextResponse.json({ error: "Failed to save direct knowledge" }, { status: 500 });
    }
}
