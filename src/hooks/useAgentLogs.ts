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
  step_id?: string;
  agent_id: string;
  agent_role: string;
  event: string;
  timestamp: string;
  input_summary?: string;
  output_summary?: string;
  error?: string;
  duration_ms?: number;
  metadata?: any;
}

export interface UnifiedLogEntry {
  id: string;
  type: "agent" | "trace";
  timestamp: string;
  envelope_id: string;
  step_id?: string;
  trace_id?: string;
  artifact_id?: string;
  agent_id: string;
  agent_role: string;
  event: string;
  message?: string;
  summary?: string;
  output_summary?: string;
  input_summary?: string;
  error?: string;
  duration_ms?: number;
  metadata?: any;
}

export interface UseAgentLogsReturn {
  logs: UnifiedLogEntry[];
  loading: boolean;
  error: string | null;
}

/**
 * useAgentLogs — Live subscription to BOTH agent_logs and execution_traces.
 * Unifies them into a single chronological stream for the Activity panel.
 */
export function useAgentLogs(envelopeId: string | null): UseAgentLogsReturn {
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [traces, setTraces] = useState<any[]>([]);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [loadingTraces, setLoadingTraces] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!envelopeId) {
      setLoadingAgent(false);
      setLoadingTraces(false);
      setAgentLogs([]);
      setTraces([]);
      return;
    }

    setLoadingAgent(true);
    setLoadingTraces(true);

    // 1. Subscription to agent_logs
    const qAgent = query(
      collection(db, "agent_logs"),
      where("envelope_id", "==", envelopeId),
      orderBy("timestamp", "asc"),
      limit(200)
    );

    const unsubAgent = onSnapshot(qAgent, (snap) => {
      setAgentLogs(snap.docs.map(d => ({ ...d.data(), log_id: d.id } as AgentLog)));
      setLoadingAgent(false);
    }, (err) => {
      console.error("[useAgentLogs] Agent logs error:", err);
      setError(err.message);
      setLoadingAgent(false);
    });

    // 2. Subscription to execution_traces
    const qTraces = query(
      collection(db, "execution_traces"),
      where("envelope_id", "==", envelopeId),
      orderBy("timestamp", "asc"),
      limit(300)
    );

    const unsubTraces = onSnapshot(qTraces, (snap) => {
      setTraces(snap.docs.map(d => ({ ...d.data(), trace_id: d.id })));
      setLoadingTraces(false);
    }, (err) => {
      console.error("[useAgentLogs] Trace logs error:", err);
      setLoadingTraces(false);
    });

    return () => {
      unsubAgent();
      unsubTraces();
    };
  }, [envelopeId]);

  // Unified Sort and Map
  const unifiedLogs: UnifiedLogEntry[] = [
    ...agentLogs.map(l => ({
      id: l.log_id,
      type: "agent" as const,
      timestamp: l.timestamp,
      envelope_id: l.envelope_id,
      step_id: l.step_id,
      agent_id: l.agent_id,
      agent_role: l.agent_role,
      event: l.event,
      summary: l.event === "COMPLETE" ? l.output_summary : l.input_summary,
      error: l.error,
      duration_ms: l.duration_ms,
      metadata: l.metadata,
    })),
    ...traces.map(t => ({
      id: t.trace_id,
      type: "trace" as const,
      timestamp: t.timestamp,
      envelope_id: t.envelope_id,
      step_id: t.step_id,
      trace_id: t.trace_id,
      artifact_id: t.artifact_id || t.metadata?.artifact_id,
      agent_id: t.agent_id,
      agent_role: t.agent_role || (t.agent_id === "runtime_worker" ? "system" : "unknown"),
      event: t.event_type,
      message: t.message,
      metadata: t.metadata,
    }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { 
    logs: unifiedLogs, 
    loading: loadingAgent || loadingTraces, 
    error 
  };
}
