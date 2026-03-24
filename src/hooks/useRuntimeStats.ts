/**
 * useRuntimeStats Hook — Phase 2
 * Aggregate runtime metrics from execution_envelopes.
 * No leases or execution_steps collection queries.
 */

"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import type { ExecutionEnvelope } from "@/lib/runtime/types";

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

export function useRuntimeStats(): {
  stats: RuntimeStats;
  loading: boolean;
} {
  const [stats, setStats] = useState<RuntimeStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Phase 2: all stats come from execution_envelopes (steps embedded, leases embedded)
    const unsubscribe = onSnapshot(
      collection(db, "execution_envelopes"),
      (snapshot) => {
        const now = new Date();
        const docs = snapshot.docs.map((d) => d.data() as ExecutionEnvelope);

        let active_leases = 0;
        let total_steps_completed = 0;

        docs.forEach((env) => {
          // Count active leases (embedded in envelope)
          if (env.authority_lease && new Date(env.authority_lease.expires_at) > now) {
            active_leases++;
          }
          // Count completed steps across all envelopes
          total_steps_completed += (env.steps ?? []).filter(
            (s) => s.status === "completed"
          ).length;
        });

        setStats({
          active_leases,
          total_envelopes: docs.length,
          executing_envelopes: docs.filter((d) => d.status === "executing").length,
          completed_envelopes: docs.filter((d) => d.status === "approved").length,
          failed_envelopes: docs.filter((d) => d.status === "failed").length,
          quarantined_envelopes: docs.filter((d) => d.status === "quarantined").length,
          total_steps_completed,
        });
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, []);

  return { stats, loading };
}
