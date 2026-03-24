/**
 * useIdentity Hook — Subscribe to agent identity data.
 * T-022 | Sprint 4 | Hook
 */

"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { AgentIdentity } from "@/lib/runtime/types";

export interface UseIdentityReturn {
  identity: AgentIdentity | null;
  loading: boolean;
  error: string | null;
}

export function useIdentity(agentId: string | null): UseIdentityReturn {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, "agent_identities", agentId),
      (snapshot) => {
        if (snapshot.exists()) {
          setIdentity({ ...snapshot.data(), agent_id: snapshot.id } as AgentIdentity);
        } else {
          setIdentity(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[useIdentity] Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [agentId]);

  return { identity, loading, error };
}
