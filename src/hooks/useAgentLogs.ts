"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";

export interface AgentLog {
  log_id: string;
  envelope_id: string;
  step_id: string;
  agent_role: "coo" | "researcher" | "worker" | "grader" | string;
  agent_id: string;
  event: "START" | "COMPLETE" | "ERROR" | string;
  model: string;
  input_summary: string;
  output_summary: string;
  artifact_id: string;
  error: string;
  duration_ms: number;
  timestamp: string;
}

export interface UseAgentLogsReturn {
  logs: AgentLog[];
  loading: boolean;
  error: string | null;
}

/**
 * useAgentLogs — Live subscription to agent_logs collection filtered by envelope_id.
 * Powers the Agent Activity panel in the Job Detail page.
 */
export function useAgentLogs(envelopeId: string | null): UseAgentLogsReturn {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!envelopeId) {
      setLoading(false);
      setLogs([]);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "agent_logs"),
      where("envelope_id", "==", envelopeId),
      orderBy("timestamp", "asc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: AgentLog[] = snap.docs.map((doc) => doc.data() as AgentLog);
        setLogs(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useAgentLogs] Snapshot error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [envelopeId]);

  return { logs, loading, error };
}
