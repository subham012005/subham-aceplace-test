"use client";

/**
 * TraceStreamPanel — Real-time #us# execution trace stream from Firestore.
 * Phase 2 Compliance: Issue #6 — No trace visibility / empty trace logs.
 *
 * Subscribes to execution_traces/{id} filtered by user_id.
 * Shows per-agent identity fingerprint, event_type, and timestamp per trace.
 */

import React, { useEffect, useState } from "react";
import {
  Radio,
  Fingerprint,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

// ── Types ──────────────────────────────────────────────────────────────────
interface TraceEvent {
  id: string;
  envelope_id: string;
  agent_id?: string;
  identity_fingerprint?: string;
  event_type: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ── Color mapping ─────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, { label: string; style: string }> = {
  "step_executed":       { label: "#us#.step.executed",   style: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
  "us#.task.plan":       { label: "#us#.task.plan",       style: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  "us#.task.assign":     { label: "#us#.task.assign",     style: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  "us#.artifact.produce":{ label: "#us#.artifact.produce",style: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  "us#.evaluation.score":{ label: "#us#.evaluation.score",style: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  "identity_validated":  { label: "identity.validated",   style: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  "envelope_quarantined":{ label: "QUARANTINED",          style: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
};

function getEventStyle(type: string) {
  return (
    EVENT_COLORS[type] ?? {
      label: type,
      style: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    }
  );
}

function formatRelativeTime(ts: any): string {
  if (!ts) return "—";
  let date: Date;
  if (ts instanceof Timestamp) {
    date = ts.toDate();
  } else if (typeof ts === "object" && ts?._seconds) {
    date = new Date(ts._seconds * 1000);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return "—";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Row component ─────────────────────────────────────────────────────────
function TraceRow({ event }: { event: TraceEvent }) {
  const [expanded, setExpanded] = useState(false);
  const { label, style } = getEventStyle(event.event_type);
  const shortFp = event.identity_fingerprint
    ? event.identity_fingerprint.slice(0, 8) + "…"
    : null;

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-2.5 h-2.5 text-slate-600 shrink-0" />
        ) : (
          <ChevronRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
        )}

        {/* Event type badge */}
        <span className={cn("text-[7px] font-black uppercase tracking-widest border px-1.5 py-0.5 shrink-0 truncate max-w-[130px]", style)}>
          {label}
        </span>

        {/* Agent */}
        <span className="text-[7px] font-mono text-slate-500 truncate flex-1">
          {event.agent_id ?? "unknown"}
        </span>

        {/* Fingerprint badge */}
        {shortFp && (
          <span className="text-[7px] font-mono text-purple-400/70 flex items-center gap-0.5 shrink-0">
            <Fingerprint className="w-2 h-2" />
            {shortFp}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[7px] font-mono text-slate-700 shrink-0 ml-1">
          {formatRelativeTime(event.timestamp)}
        </span>
      </button>

      {expanded && (
        <div className="px-7 pb-3 space-y-2">
          {/* Envelope ID */}
          <div>
            <span className="text-[6px] font-black uppercase tracking-widest text-slate-600 block">Envelope</span>
            <p className="text-[7px] font-mono text-cyan-500">{event.envelope_id}</p>
          </div>

          {/* Full fingerprint */}
          {event.identity_fingerprint && (
            <div>
              <span className="text-[6px] font-black uppercase tracking-widest text-slate-600 block">Identity Fingerprint</span>
              <p className="text-[7px] font-mono text-purple-400 break-all">{event.identity_fingerprint}</p>
            </div>
          )}

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div>
              <span className="text-[6px] font-black uppercase tracking-widest text-slate-600 block mb-1">Metadata</span>
              <pre className="text-[7px] font-mono text-slate-400 bg-black/40 p-2 border border-white/5 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────
interface TraceStreamPanelProps {
  userId?: string | null;
  /** If provided, only show traces for this envelope */
  envelopeId?: string | null;
  maxItems?: number;
  className?: string;
}

export function TraceStreamPanel({
  userId,
  envelopeId,
  maxItems = 50,
  className,
}: TraceStreamPanelProps) {
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!userId && !envelopeId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let q;

      if (envelopeId) {
        // Filter by envelope if provided
        q = query(
          collection(db, "execution_traces"),
          where("envelope_id", "==", envelopeId),
          orderBy("timestamp", "desc"),
          limit(maxItems)
        );
      } else if (userId) {
        // Filter by user
        q = query(
          collection(db, "execution_traces"),
          where("user_id", "==", userId),
          orderBy("timestamp", "desc"),
          limit(maxItems)
        );
      } else {
        setLoading(false);
        return;
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const events: TraceEvent[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as TraceEvent));
          setTraces(events);
          setLoading(false);
        },
        (err) => {
          console.error("[TraceStreamPanel] Firestore error:", err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("[TraceStreamPanel] Query error:", err);
      setLoading(false);
    }
  }, [userId, envelopeId, maxItems]);

  return (
    <HUDFrame
      title="Execution Trace Stream"
      subtitle="#us# Protocol Events"
      className={className}
      headerAction={
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isLive
                ? "bg-cyan-500 animate-pulse shadow-[0_0_6px_#06b6d4]"
                : "bg-slate-600"
            )}
          />
          <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">
            {isLive ? "LIVE" : "PAUSED"}
          </span>
          <button
            onClick={() => setIsLive(!isLive)}
            className="text-[7px] font-black uppercase tracking-widest text-slate-600 hover:text-cyan-400 transition-colors border border-white/5 px-1.5 py-0.5"
          >
            {isLive ? "Pause" : "Resume"}
          </button>
        </div>
      }
    >
      <div className="mt-2 max-h-[340px] overflow-y-auto custom-scroll bg-black/30 border border-white/5">
        {loading ? (
          <div className="flex items-center gap-2 justify-center p-6">
            <Activity className="w-4 h-4 text-cyan-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Connecting to Trace Stream…
            </span>
          </div>
        ) : traces.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-white/5">
            <Radio className="w-5 h-5 text-slate-700 mx-auto mb-2" />
            <p className="text-[8px] uppercase font-black tracking-[0.3em] text-slate-600 italic">
              No trace events found
            </p>
            <p className="text-[7px] text-slate-700 mt-1 font-mono">
              Traces populate when the runtime worker executes steps
            </p>
          </div>
        ) : (
          traces.map((event) => <TraceRow key={event.id} event={event} />)
        )}
      </div>

      {/* Stats strip */}
      {traces.length > 0 && (
        <div className="flex items-center justify-between px-2 pt-2 border-t border-white/5 mt-2">
          <span className="text-[7px] font-mono text-slate-700">
            {traces.length} of {maxItems} max events loaded
          </span>
          <span className="text-[7px] font-mono text-cyan-500/50">
            Firestore: execution_traces
          </span>
        </div>
      )}
    </HUDFrame>
  );
}
