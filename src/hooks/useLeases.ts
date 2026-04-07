/**
 * useLeases Hook — Phase 2
 *
 * In Phase 2, leases are EMBEDDED inside execution_envelopes.authority_lease.
 * This hook reads active leases from envelopes instead of a separate leases collection.
 */

"use client";

import { useState, useEffect } from "react";
import { aceApi } from "@/lib/api-client";
import type { AuthorityLease } from "@aceplace/runtime-core/shared";

export interface ActiveLease {
  envelope_id: string;
  authority_lease: AuthorityLease;
}

export interface UseLeaseReturn {
  activeLeases: ActiveLease[];
  loading: boolean;
  error: string | null;
}

/**
 * useLeases Hook — Phase 2 (Hardened)
 * 
 * Fetches active leases from the secure /api/runtime/leases/active endpoint.
 * Uses polling to maintain fresh state without direct Firestore permissions.
 */
export function useLeases(): UseLeaseReturn {
  const [activeLeases, setActiveLeases] = useState<ActiveLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchLeases = async () => {
      try {
        const data = await aceApi.getActiveLeases();
        if (isMounted) {
          setActiveLeases(data.activeLeases || []);
          setError(null);
        }
      } catch (err: any) {
        console.error("[useLeases] Fetch failed:", err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLeases();
    const interval = setInterval(fetchLeases, 8000); // Poll every 8 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { activeLeases, loading, error };
}
