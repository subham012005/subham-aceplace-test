"use client";

import { useState, useEffect } from "react";
import { aceApi } from "@/lib/api-client";
import type { ExecutionEnvelope, EnvelopeStep } from "@aceplace/runtime-core/shared";

export interface UseEnvelopeReturn {
  envelope: ExecutionEnvelope | null;
  steps: EnvelopeStep[];
  loading: boolean;
  error: string | null;
}

/**
 * useEnvelope Hook — Phase 2 (Hardened)
 * 
 * Subscribes to a single execution_envelopes document via the secure /api/runtime/envelope/[id] endpoint.
 */
export function useEnvelope(envelopeId: string | null): UseEnvelopeReturn {
  const [envelope, setEnvelope] = useState<ExecutionEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!envelopeId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchEnvelope = async () => {
      try {
        const data = await aceApi.getEnvelope(envelopeId);
        if (isMounted) {
          // The API returns { envelope, messages }, so we need to extract `envelope`
          setEnvelope(data.envelope ? data.envelope : data);
          setError(null);
        }
      } catch (err: any) {
        console.error("[useEnvelope] Fetch failed:", err);
        if (isMounted) {
          setError(err.message || "Failed to load envelope context.");
          // Ensure loading stops on error
          setLoading(false);
        }
      } finally {
        if (isMounted && !error) {
          setLoading(false);
        }
      }
    };

    fetchEnvelope();
    const interval = setInterval(fetchEnvelope, 5000); // Poll every 5 seconds for detail view

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [envelopeId]);

  // Deterministic sorting to enforce strict Phase 2 execution order in the UI
  const PIPELINE_ORDER = [
    "plan",
    "assign",
    "produce_artifact",
    "artifact_produce", // alias support
    "evaluate",
    "evaluation",       // alias support
    "human_approval",
    "complete"
  ];

  const steps: EnvelopeStep[] = (envelope?.steps ?? []).slice().sort((a, b) => {
    const idxA = PIPELINE_ORDER.indexOf(a.step_type);
    const idxB = PIPELINE_ORDER.indexOf(b.step_type);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  return { envelope, steps, loading, error };
}
