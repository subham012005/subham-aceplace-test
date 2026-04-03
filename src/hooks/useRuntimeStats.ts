"use client";

import { useState, useEffect } from "react";
import { aceApi } from "@/lib/api-client";

export interface RuntimeStats {
  active_leases: number;
  total_envelopes: number;
  executing_envelopes: number;
  completed_envelopes: number;
  failed_envelopes: number;
  quarantined_envelopes: number;
  total_steps_completed: number;
  average_step_duration_ms?: number;
}

const EMPTY_STATS: RuntimeStats = {
  active_leases: 0,
  average_step_duration_ms: 0,
  total_envelopes: 0,
  executing_envelopes: 0,
  completed_envelopes: 0,
  failed_envelopes: 0,
  quarantined_envelopes: 0,
  total_steps_completed: 0,
};

/**
 * useRuntimeStats Hook — Phase 2 (Hardened)
 * 
 * Fetches runtime metrics via the secure /api/runtime/stats endpoint.
 */
export function useRuntimeStats(): {
  stats: RuntimeStats;
  loading: boolean;
} {
  const [stats, setStats] = useState<RuntimeStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const data = await aceApi.getRuntimeStats();
        if (isMounted) {
          setStats(data);
        }
      } catch (err: any) {
        console.error("[useRuntimeStats] Fetch failed:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Stats update frequently, poll every 10s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { stats, loading };
}
