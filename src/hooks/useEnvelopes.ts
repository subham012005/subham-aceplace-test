/**
 * useEnvelopes Hook — Phase 2
 * Subscribe to all execution_envelopes for a user in real-time.
 */

"use client";

import { useState, useEffect } from "react";
import { aceApi } from "@/lib/api-client";
import type { ExecutionEnvelope } from "@aceplace/runtime-core/shared";

export interface UseEnvelopesReturn {
  envelopes: ExecutionEnvelope[];
  loading: boolean;
  error: string | null;
  counts: {
    total: number;
    executing: number;
    approved: number;
    failed: number;
    awaiting_human: number;
  };
}

/**
 * useEnvelopes Hook — Phase 2 (Hardened)
 * 
 * Subscribes to execution_envelopes via the secure /api/runtime/envelopes endpoint.
 */
export function useEnvelopes(userId: string | null): UseEnvelopesReturn {
  const [envelopes, setEnvelopes] = useState<ExecutionEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchEnvelopes = async () => {
      try {
        const data = await aceApi.getUserEnvelopes(userId);
        if (isMounted) {
          setEnvelopes(data.items || []);
          setError(null);
        }
      } catch (err: any) {
        console.error("[useEnvelopes] Fetch failed:", err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEnvelopes();
    const interval = setInterval(fetchEnvelopes, 10000); // Poll every 10 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userId]);

  const counts = {
    total: envelopes.length,
    executing: envelopes.filter((e) => e.status === "executing").length,
    approved: envelopes.filter((e) => e.status === "approved" || e.status === "completed")
      .length,
    failed: envelopes.filter((e) => e.status === "failed").length,
    awaiting_human: envelopes.filter((e) => e.status === "awaiting_human").length,
  };

  return { envelopes, loading, error, counts };
}
