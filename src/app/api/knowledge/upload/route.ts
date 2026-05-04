/**
 * POST /api/knowledge/upload
 * Upload a knowledge file, extract text, chunk it, and store in Firestore
 * under user_knowledge_collections/{userId}/collections/{collectionId}
 * and user_knowledge_chunks/{collectionId}/chunks/{chunkId}
 * Supported: PDF, TXT
 * User isolation: strict — only stores under authenticated user's ID
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyUserApiKey } from "@/lib/api-security";

const MAX_FILE_SIZE_MB = 10;
const CHUNK_SIZE = 900000;      // Max characters for Long Context (Firestore ~1MB limit)
const CHUNK_OVERLAP = 0;        // No overlap needed for Long Context

interface Chunk {
    text: string;
    start: number;
}

function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const content = text.slice(start, end).trim();
        
        if (content.length > 0) {
            chunks.push({ text: content, start });
        }
        
        // If we reached the end of the text, stop chunking
        if (end >= text.length) break;
        
        // Move to next start point, ensuring we always make progress
        const nextStart = end - overlap;
        start = nextStart > start ? nextStart : end;
    }
    return chunks;
}

function extractTags(text: string, filename: string): string[] {
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const freq: Record<string, number> = {};
    for (const w of words) {
        freq[w] = (freq[w] || 0) + 1;
    }
    const stopWords = new Set(["that","this","with","have","from","they","will","been","their","were","said","each","which","about","there"]);
    return Object.entries(freq)
        .filter(([w, c]) => !stopWords.has(w) && c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([w]) => w)
        .concat([filename.split(".")[0].toLowerCase()]);
}

export async function POST(req: NextRequest) {
    try {
        const { userId, error } = await verifyUserApiKey(req);
        if (error) return error;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const collectionName = (formData.get("collection_name") as string) || file?.name || "Untitled";
        const fileType = (formData.get("file_type") as string) || "";

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `File too large (max ${MAX_FILE_SIZE_MB}MB)` }, { status: 400 });
        }

        const allowedTypes = ["pdf", "txt"];
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (!allowedTypes.includes(ext)) {
            return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
        }

        // Extract text content
        let extractedText = "";
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (ext === "txt") {
            extractedText = buffer.toString("utf-8");
        } else if (ext === "pdf") {
            try {
                // Use standard pdf-parse (pure JS) - bypass index.js which has node-specific issues in Next.js
                const { createRequire } = await import("module");
                const require = createRequire(import.meta.url);
                const pdf = require("pdf-parse/lib/pdf-parse.js");
                
                const data = await pdf(buffer);
                extractedText = data.text || "";
            } catch (err: any) {
                console.error("[UPLOAD] PDF extraction failed:", err);
                extractedText = ""; 
            }
        }
        
        // --- TEXT SANITIZATION ---
        // Ensure only clean, readable text is stored. 
        // Strips binary blobs, image artifacts, and non-printable control characters.
        const sanitizeText = (text: string) => {
            if (!text) return "";
            return text
                // 1. Remove zero-width spaces and invisible formatting marks
                .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, "")
                // 2. Remove all control characters except \n, \t, \r
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
                // 3. Keep printable ASCII + common Latin-1 characters (accents, etc.)
                //    This is the most effective filter to ensure "Normal Text" and strip image binary noise.
                .replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF]/g, " ")
                // 4. Normalize line endings
                .replace(/\r\n|\r/g, "\n")
                // 5. Collapse multiple spaces and tabs
                .replace(/[ \t]+/g, " ")
                // 6. Normalize newlines (keep structure, but remove excessive gaps)
                .replace(/\n{3,}/g, "\n\n")
                // 7. Clean up each line and join back
                .split("\n")
                .map(line => line.trim())
                .join("\n")
                .trim();
        };

        extractedText = sanitizeText(extractedText);

        if (!extractedText || extractedText.trim().length < 10) {
            return NextResponse.json({ error: "Could not extract text from file" }, { status: 422 });
        }

        const db = adminDb;
        if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

        const now = new Date().toISOString();
        const collectionId = `kc_${userId.slice(0, 8)}_${Date.now()}`;
        const tags = extractTags(extractedText, file.name);
        const chunks = chunkText(extractedText);

        // Store collection metadata
        await db
            .collection("user_knowledge_collections")
            .doc(userId)
            .collection("collections")
            .doc(collectionId)
            .set({
                collection_id: collectionId,
                user_id: userId,
                name: collectionName,
                file_name: file.name,
                file_type: ext,
                file_size_bytes: file.size,
                chunk_count: chunks.length,
                character_count: extractedText.length,
                tags,
                created_at: now,
                updated_at: now,
                status: "indexing",
                progress: 0,
                indexed_chunks: 0,
                total_chunks: chunks.length,
            });

        // Store chunks in batch
        const chunkRef = db
            .collection("user_knowledge_chunks")
            .doc(collectionId)
            .collection("chunks");

        const batchSize = 100;
        let indexedCount = 0;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = db.batch();
            const batchChunks = chunks.slice(i, i + batchSize);
            for (let j = 0; j < batchChunks.length; j++) {
                const chunkId = `chunk_${i + j}`;
                const chunk = batchChunks[j];
                batch.set(chunkRef.doc(chunkId), {
                    chunk_id: chunkId,
                    collection_id: collectionId,
                    user_id: userId,
                    text: chunk.text,
                    chunk_index: i + j,
                    metadata: {
                        file_name: file.name,
                        char_start: chunk.start,
                        tags: extractTags(chunk.text, file.name).slice(0, 8),
                    },
                    created_at: now,
                });
            }
            await batch.commit();
            indexedCount += batchChunks.length;

            // Update incremental progress
            await db
                .collection("user_knowledge_collections")
                .doc(userId)
                .collection("collections")
                .doc(collectionId)
                .update({
                    indexed_chunks: indexedCount,
                    progress: Math.round((indexedCount / chunks.length) * 100),
                    updated_at: new Date().toISOString(),
                });
        }

        // Final status update to ready
        await db
            .collection("user_knowledge_collections")
            .doc(userId)
            .collection("collections")
            .doc(collectionId)
            .update({
                status: "ready",
                progress: 100,
                updated_at: new Date().toISOString(),
            });

        return NextResponse.json({
            success: true,
            collection_id: collectionId,
            collection_name: collectionName,
            file_name: file.name,
            chunk_count: chunks.length,
            character_count: extractedText.length,
            tags: tags.slice(0, 10),
        });

    } catch (err: unknown) {
        console.error("[KNOWLEDGE_UPLOAD] Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 }
        );
    }
}
