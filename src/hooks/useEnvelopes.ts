/**
 * useEnvelopes Hook — Phase 2
 * Subscribe to all execution_envelopes for a user in real-time.
 */

"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import type { ExecutionEnvelope } from "@/lib/runtime/types";

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

export function useEnvelopes(userId: string | null): UseEnvelopesReturn {
  const [envelopes, setEnvelopes] = useState<ExecutionEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Phase 2: read from execution_envelopes collection
    const q = query(
      collection(db, "execution_envelopes"),
      where("user_id", "==", userId),
      orderBy("created_at", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          envelope_id: doc.id,
        })) as ExecutionEnvelope[];
        setEnvelopes(data);
        setLoading(false);
      },
      (err) => {
        console.error("[useEnvelopes] Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Phase 2: status lives directly on envelope.status (not execution_context.status)
  const counts = {
    total: envelopes.length,
    executing: envelopes.filter((e) => e.status === "executing").length,
    approved: envelopes.filter((e) => e.status === "approved").length,
    failed: envelopes.filter((e) => e.status === "failed").length,
    awaiting_human: envelopes.filter((e) => e.status === "awaiting_human").length,
  };

  return { envelopes, loading, error, counts };
}
