/**
 * useLeases Hook — Phase 2
 *
 * In Phase 2, leases are EMBEDDED inside execution_envelopes.authority_lease.
 * This hook reads active leases from envelopes instead of a separate leases collection.
 */

"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { ExecutionEnvelope, AuthorityLease } from "@/lib/runtime/types";

export interface ActiveLease {
  envelope_id: string;
  authority_lease: AuthorityLease;
}

export interface UseLeaseReturn {
  activeLeases: ActiveLease[];
  loading: boolean;
  error: string | null;
}

export function useLeases(): UseLeaseReturn {
  const [activeLeases, setActiveLeases] = useState<ActiveLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // Phase 2: leases live inside execution_envelopes.authority_lease
    // Query envelopes that are currently executing (which implies a lease)
    const q = query(
      collection(db, "execution_envelopes"),
      where("status", "in", ["leased", "executing"])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = new Date();
        const active: ActiveLease[] = [];

        snapshot.docs.forEach((doc) => {
          const envelope = doc.data() as ExecutionEnvelope;
          const lease = envelope.authority_lease;
          if (lease && new Date(lease.expires_at) > now) {
            active.push({ envelope_id: doc.id, authority_lease: lease });
          }
        });

        setActiveLeases(active);
        setLoading(false);
      },
      (err) => {
        console.error("[useLeases] Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { activeLeases, loading, error };
}
