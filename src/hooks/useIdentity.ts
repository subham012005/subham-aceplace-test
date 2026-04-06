/**
 * useIdentity Hook — Subscribe to agent identity data.
 * T-022 | Sprint 4 | Hook
 */

"use client";

import { useState, useEffect } from "react";
import { aceApi } from "@/lib/api-client";
import type { AgentIdentity } from "@aceplace/runtime-core";

export interface UseIdentityReturn {
  identity: AgentIdentity | null;
  loading: boolean;
  error: string | null;
}

/**
 * useIdentity Hook — Subscribe to agent identity data.
 * T-022 | Sprint 4 | Hook (Hardened)
 * 
 * Fetches identity from the secure /api/runtime/identity/[agentId] endpoint.
 */
export function useIdentity(agentId: string | null): UseIdentityReturn {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchIdentity = async () => {
      try {
        const data = await aceApi.getAgentIdentity(agentId);
        if (isMounted) {
          setIdentity(data);
          setError(null);
        }
      } catch (err: any) {
        console.error("[useIdentity] Fetch failed:", err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchIdentity();
    const interval = setInterval(fetchIdentity, 15000); // Identity is stable, poll every 15s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [agentId]);

  return { identity, loading, error };
}
