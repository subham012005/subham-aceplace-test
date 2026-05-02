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
            // Use pdf-parse for PDF extraction
            try {
                const { createRequire } = await import("module");
                const require = createRequire(import.meta.url);
                const pdf = require("pdf-parse");
                
                if (typeof pdf === 'function') {
                    const data = await pdf(buffer);
                    extractedText = data.text;
                } else if (pdf.PDFParse) {
                    const { PDFParse } = pdf;
                    const parser = new PDFParse({ data: buffer });
                    const result = await parser.getText();
                    extractedText = result.text || "";
                    await parser.destroy();
                } else {
                    throw new Error("PDF parser function not found");
                }
            } catch (err: any) {
                console.error("[UPLOAD] PDF extraction failed (primary):", err);
                
                // Fallback 1: Dynamic import
                try {
                    const pdfModule = await import("pdf-parse/node") as any;
                    if (pdfModule.PDFParse) {
                        const parser = new pdfModule.PDFParse({ data: buffer });
                        const result = await parser.getText();
                        extractedText = result.text || "";
                        await parser.destroy();
                    } else {
                        throw new Error("PDFParse not found in fallback module");
                    }
                } catch (fallbackErr: any) {
                    console.error("[UPLOAD] PDF extraction fallback failed:", fallbackErr);
                    // Fallback 2: Last resort raw buffer string cleanup
                    extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ");
                    if (extractedText.length < 50) {
                        extractedText = `[PDF: ${file.name}] Text extraction failed. Original Error: ${err.message}.`;
                    }
                }
            }
        }
        
        // --- TEXT SANITIZATION ---
        // Ensure only readable text is stored, removing weird PDF artifacts, binary blobs, and excessive noise.
        const sanitizeText = (text: string) => {
            return text
                .replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u0100-\u017F]/g, " ") // Keep basic Latin, extended Latin, and common whitespace
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")                // Explicitly remove non-printable control chars
                .replace(/\s+/g, " ")                                         // Normalize multiple spaces/newlines to single space
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
