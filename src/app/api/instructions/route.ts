/**
 * GET    /api/instructions  — List user's instruction profiles
 * POST   /api/instructions  — Create a new profile
 * PUT    /api/instructions?id=xxx — Update profile
 * DELETE /api/instructions?id=xxx — Delete profile
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyUserApiKey } from "@/lib/api-security";

export async function GET(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const snap = await db
            .collection("user_instruction_profiles")
            .doc(userId)
            .collection("profiles")
            .orderBy("created_at", "desc")
            .limit(50)
            .get();

        const profiles = snap.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                profile_id: data.profile_id || d.id
            };
        });

        return NextResponse.json({ success: true, profiles });

    } catch (err: unknown) {
        return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const name: string = (body.name || "").trim();
        const instructions: string = (body.instructions || "").trim();
        const tags: string[] = body.tags || [];

        if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
        if (!instructions) return NextResponse.json({ error: "Missing instructions" }, { status: 400 });
        if (instructions.length > 10000) return NextResponse.json({ error: "Instructions too long (max 10000 chars)" }, { status: 400 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const now = new Date().toISOString();
        const profileId = `ip_${userId.slice(0, 8)}_${Date.now()}`;

        await db
            .collection("user_instruction_profiles")
            .doc(userId)
            .collection("profiles")
            .doc(profileId)
            .set({
                profile_id: profileId,
                user_id: userId,
                name,
                instructions,
                tags,
                created_at: now,
                updated_at: now,
            });

        return NextResponse.json({ success: true, profile_id: profileId, name });

    } catch (err: unknown) {
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get("id");
        if (!profileId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const body = await req.json();
        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const ref = db
            .collection("user_instruction_profiles")
            .doc(userId)
            .collection("profiles")
            .doc(profileId);

        const doc = await ref.get();
        if (!doc.exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

        await ref.update({
            ...(body.name && { name: body.name }),
            ...(body.instructions && { instructions: body.instructions }),
            ...(body.tags && { tags: body.tags }),
            updated_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, profile_id: profileId });

    } catch (err: unknown) {
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get("id");
        if (!profileId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const ref = db
            .collection("user_instruction_profiles")
            .doc(userId)
            .collection("profiles")
            .doc(profileId);

        const doc = await ref.get();
        if (!doc.exists) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

        await ref.delete();
        return NextResponse.json({ success: true, deleted: profileId });

    } catch (err: unknown) {
        return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
    }
}
