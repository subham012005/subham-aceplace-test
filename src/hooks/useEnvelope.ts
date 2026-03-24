/**
 * useEnvelope Hook — Phase 2
 * Subscribe to a single execution_envelopes document in real-time.
 * Steps are embedded inside envelope.steps[] — no external collection.
 */

"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { ExecutionEnvelope, EnvelopeStep } from "@/lib/runtime/types";

export interface UseEnvelopeReturn {
  envelope: ExecutionEnvelope | null;
  steps: EnvelopeStep[];
  loading: boolean;
  error: string | null;
}

export function useEnvelope(envelopeId: string | null): UseEnvelopeReturn {
  const [envelope, setEnvelope] = useState<ExecutionEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!envelopeId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Phase 2: read from execution_envelopes, steps are embedded in envelope.steps[]
    const unsubscribe = onSnapshot(
      doc(db, "execution_envelopes", envelopeId),
      (snapshot) => {
        if (snapshot.exists()) {
          setEnvelope({ ...snapshot.data(), envelope_id: snapshot.id } as ExecutionEnvelope);
        } else {
          setEnvelope(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[useEnvelope] Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [envelopeId]);

  // Steps come directly from envelope.steps[] — no separate query needed
  const steps: EnvelopeStep[] = envelope?.steps ?? [];

  return { envelope, steps, loading, error };
}
