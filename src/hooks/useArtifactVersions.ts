import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

export interface ArtifactVersion {
    version: number;           // 0-indexed (v0 = first run, v1 = after first edit, etc.)
    versionLabel: number;      // 1-indexed for display (Version 1, Version 2, ...)
    created_at: string;
    artifact_content: any;
    continuation_instruction: string | null;
    produced_by: "initial" | "continuation";
}

/**
 * Subscribes in real-time to jobs/{jobId}/artifact_versions sub-collection.
 * Returns all historical versions sorted ascending (v0 first).
 */
export function useArtifactVersions(jobId: string | null) {
    const [versions, setVersions] = useState<ArtifactVersion[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!jobId) {
            setVersions([]);
            return;
        }

        setLoading(true);

        const versionsRef = collection(db, "jobs", jobId, "artifact_versions");
        const q = query(versionsRef, orderBy("version", "asc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        version: Number(data.version ?? 0),
                        versionLabel: Number(data.version ?? 0) + 1,
                        created_at: data.created_at ?? new Date().toISOString(),
                        artifact_content: data.artifact_content ?? null,
                        continuation_instruction: data.continuation_instruction ?? null,
                        produced_by: data.produced_by ?? "initial",
                    } as ArtifactVersion;
                });
                setVersions(docs);
                setLoading(false);
            },
            (err) => {
                console.warn("[useArtifactVersions] snapshot error:", err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [jobId]);

    return { versions, loading };
}

/**
 * Splits envelope steps into per-version buckets.
 *
 * Original steps have IDs like: step_plan_<ts>, step_assign_<ts> etc.
 * Continuation steps have IDs like: step_plan_cont_1_<ts>, step_assign_cont_2_<ts> etc.
 *
 * Returns a map from versionLabel (1-indexed) → steps[].
 */
export function splitStepsByVersion(steps: any[]): Map<number, any[]> {
    const map = new Map<number, any[]>();

    for (const step of steps) {
        const id: string = step.step_id || "";
        // Continuation steps contain "_cont_N_"
        const match = id.match(/_cont_(\d+)_/);
        if (match) {
            // _cont_1_ means it was created for version 2 (continuation_count = 1 → nextVersion = 1+1 = 2? 
            // Actually nextVersion = currentContinuationCount + 1 and step ids use nextVersion directly)
            // e.g., step_plan_cont_2_<ts> → belongs to Version 2
            const v = parseInt(match[1], 10);
            if (!map.has(v)) map.set(v, []);
            map.get(v)!.push(step);
        } else {
            // Original steps → Version 1
            if (!map.has(1)) map.set(1, []);
            map.get(1)!.push(step);
        }
    }

    return map;
}

/**
 * Calculates per-version token usage from the job's token_usage object.
 * If token_usage is a flat number, it's attributed to v1 only.
 * If it's the full object, uses total_tokens for overall.
 */
export function getTokensForVersion(
    versionLabel: number,
    tokenUsage: any,
    continuationCount: number
): { tokens: number; cost: number } {
    if (!tokenUsage) return { tokens: 0, cost: 0 };

    // If it's a plain number (legacy), all tokens → v1
    if (typeof tokenUsage === "number") {
        return versionLabel === 1 ? { tokens: tokenUsage, cost: 0 } : { tokens: 0, cost: 0 };
    }

    if (typeof tokenUsage === "object") {
        const total = Number(tokenUsage.total_tokens ?? 0);
        const cost = Number(tokenUsage.cost ?? 0);

        // If we don't have per-version breakdowns, divide evenly by version count
        // as an estimate (will be replaced if backend tracks per-version in future)
        const totalVersions = continuationCount + 1;
        const perVersion = Math.round(total / totalVersions);
        const perCost = cost / totalVersions;

        return { tokens: perVersion, cost: perCost };
    }

    return { tokens: 0, cost: 0 };
}
