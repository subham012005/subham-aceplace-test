"use client";

import { useState, useEffect } from "react";
import { aceApi } from "@/lib/api-client";
import type { ExecutionEnvelope, EnvelopeStep } from "@/lib/runtime/types";

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

  // Steps come directly from envelope.steps[] — no separate query needed
  const steps: EnvelopeStep[] = envelope?.steps ?? [];

  return { envelope, steps, loading, error };
}
