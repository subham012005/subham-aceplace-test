/**
 * GET  /api/knowledge/collections  — List user's KB collections
 * DELETE /api/knowledge/collections?id=xxx — Delete a collection
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
            .collection("user_knowledge_collections")
            .doc(userId)
            .collection("collections")
            .orderBy("created_at", "desc")
            .limit(50)
            .get();

        const collections = snap.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                collection_id: data.collection_id || d.id // Ensure ID exists for React keys
            };
        });
        return NextResponse.json({ success: true, collections });

    } catch (err: unknown) {
        console.error("[KB_COLLECTIONS] GET error:", err);
        return NextResponse.json({ error: "Failed to load collections" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const collectionId = searchParams.get("id");
        if (!collectionId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        // Verify ownership
        const collDoc = await db
            .collection("user_knowledge_collections")
            .doc(userId)
            .collection("collections")
            .doc(collectionId)
            .get();

        if (!collDoc.exists) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

        // Delete collection metadata
        await collDoc.ref.delete();

        // Delete chunks (batch delete)
        const chunksSnap = await db
            .collection("user_knowledge_chunks")
            .doc(collectionId)
            .collection("chunks")
            .limit(500)
            .get();

        const batch = db.batch();
        chunksSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        return NextResponse.json({ success: true, deleted: collectionId });

    } catch (err: unknown) {
        console.error("[KB_COLLECTIONS] DELETE error:", err);
        return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
    }
}
