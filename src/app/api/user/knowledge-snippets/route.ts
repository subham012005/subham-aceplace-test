
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyUserApiKey } from "@/lib/api-security";

/**
 * GET    /api/user/knowledge-snippets — List user's saved knowledge snippets
 * POST   /api/user/knowledge-snippets — Save a new knowledge snippet
 * DELETE /api/user/knowledge-snippets?id=xxx — Delete a snippet
 */

export async function GET(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const snap = await db
            .collection("user_knowledge_snippets")
            .doc(userId)
            .collection("snippets")
            .orderBy("created_at", "desc")
            .get();

        const snippets = snap.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                snippet_id: data.snippet_id || d.id
            };
        });

        return NextResponse.json({ success: true, snippets });

    } catch (err: unknown) {
        console.error("GET snippets error:", err);
        return NextResponse.json({ error: "Failed to load snippets" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const content: string = (body.content || "").trim();
        const title: string = (body.title || content.slice(0, 30) + "...").trim();

        if (!content) return NextResponse.json({ error: "Missing content" }, { status: 400 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const now = new Date().toISOString();
        const snippetId = `snip_${userId.slice(0, 8)}_${Date.now()}`;

        await db
            .collection("user_knowledge_snippets")
            .doc(userId)
            .collection("snippets")
            .doc(snippetId)
            .set({
                snippet_id: snippetId,
                user_id: userId,
                title,
                content,
                created_at: now,
                updated_at: now,
            });

        return NextResponse.json({ success: true, snippet_id: snippetId });

    } catch (err: unknown) {
        console.error("POST snippet error:", err);
        return NextResponse.json({ error: "Failed to save snippet" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const snippetId = searchParams.get("id");
        if (!snippetId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        await db
            .collection("user_knowledge_snippets")
            .doc(userId)
            .collection("snippets")
            .doc(snippetId)
            .delete();

        return NextResponse.json({ success: true });

    } catch (err: unknown) {
        console.error("DELETE snippet error:", err);
        return NextResponse.json({ error: "Failed to delete snippet" }, { status: 500 });
    }
}
