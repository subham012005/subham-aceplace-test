"use client";

import React from "react";
import { 
  Activity, CheckCircle2, XCircle, Clock, Cpu, Search, 
  GraduationCap, Zap, ShieldCheck, Key, AlertTriangle, Terminal,
  Fingerprint, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedLogEntry } from "@/hooks/useAgentLogs";

const AGENT_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  coo: {
    label: "COO  Planning Agent",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    Icon: Activity,
  },
  researcher: {
    label: "Researcher Agent",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    Icon: Search,
  },
  worker: {
    label: "Worker Agent",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    Icon: Cpu,
  },
  grader: {
    label: "Grader Agent",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    Icon: GraduationCap,
  },
  system: {
    label: "ACEPLACE Runtime",
    color: "text-slate-300",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    Icon: Terminal,
  },
};

const EVENT_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  // Agent Events
  START: { icon: Clock, color: "text-cyan-400", label: "Started" },
  COMPLETE: { icon: CheckCircle2, color: "text-emerald-400", label: "Completed" },
  ERROR: { icon: XCircle, color: "text-red-400", label: "Failed" },
  
  // Runtime Trace Events
  IDENTITY_VERIFIED: { icon: ShieldCheck, color: "text-blue-400", label: "Identity Verified" },
  IDENTITY_FAILED: { icon: AlertTriangle, color: "text-red-400", label: "Identity Review" },
  LEASE_ACQUIRED: { icon: Key, color: "text-amber-400", label: "Authority Acquired" },
  LEASE_RELEASED: { icon: Zap, color: "text-slate-400", label: "Authority Released" },
  AGENT_NOT_FOUND: { icon: Search, color: "text-red-500", label: "Resolution Failed" },
  PREFLIGHT_FAILED: { icon: XCircle, color: "text-red-500", label: "Preflight Failed" },
  STATUS_TRANSITION_COMPLETED: { icon: CheckCircle2, color: "text-emerald-500", label: "Finalized" },
  STATUS_TRANSITION_QUARANTINED: { icon: AlertTriangle, color: "text-orange-500", label: "Quarantined" },
  LLM_FALLBACK: { icon: RefreshCw, color: "text-amber-500", label: "LLM Fallback" },
};

function formatDuration(ms: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts.slice(11, 19);
  }
}

interface AgentLogPanelProps {
  logs: UnifiedLogEntry[];
  jobId?: string;
  envelopeId?: string;
  agentId?: string;
  loading?: boolean;
  className?: string;
}

export function AgentLogPanel({ logs, loading, jobId, envelopeId, agentId, className }: AgentLogPanelProps) {
  if (loading && logs.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/3 border border-white/5 animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  if (!loading && logs.length === 0) {
    return (
      <div className={cn("p-6 border border-dashed border-white/10 bg-white/[0.02] rounded-sm space-y-6", className)}>
        <div className="flex flex-col items-center justify-center space-y-3 py-4 border-b border-white/5">
          <Zap className="w-8 h-8 text-cyan-500/40 animate-pulse" />
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
            Dimensional Synchronization Active
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Initialization Manifest</p>
          
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col p-3 bg-black/40 border border-white/5 group hover:border-cyan-500/30 transition-colors gap-1.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Job Identity</span>
              <span className="text-[10px] font-mono text-cyan-400/80 break-all leading-tight">{jobId || "PENDING"}</span>
            </div>

            <div className="flex flex-col p-3 bg-black/40 border border-white/5 group hover:border-purple-500/30 transition-colors gap-1.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Nexus Envelope</span>
              <span className="text-[10px] font-mono text-purple-400/80 break-all leading-tight">{envelopeId || "INITIALIZING"}</span>
            </div>

            <div className="flex flex-col p-3 bg-black/40 border border-white/5 group hover:border-slate-500/30 transition-colors gap-1.5">
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Agent Fingerprint</span>
                <Fingerprint className="w-3 h-3 text-slate-500" />
              </div>
              <span className="text-[10px] font-mono text-slate-400 break-all leading-tight">
                {agentId ? "0x" + agentId.replace(/^hex:0x|^0x|^hex:/i, '') : "PENDING_REGISTRATION"}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">
            Awaiting execution traces...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {logs.map((log) => {
        const roleKey = log.agent_role?.toLowerCase() || "system";
        const agentCfg = AGENT_CONFIG[roleKey] || {
          label: log.agent_role || "Unknown",
          color: "text-slate-400",
          bgColor: "bg-slate-500/10",
          borderColor: "border-slate-500/30",
          Icon: Activity,
        };
        const evtCfg = EVENT_CONFIG[log.event] || {
          icon: Activity,
          color: "text-slate-400",
          label: log.event,
        };
        const EvtIcon = evtCfg.icon;
        const AgentIcon = agentCfg.Icon;

        return (
          <div
            key={log.id}
            className={cn(
              "flex items-start gap-3 p-3 border rounded-sm transition-all",
              log.type === "trace" ? "bg-black/20 border-white/5" : agentCfg.bgColor,
              log.type === "trace" ? "opacity-90" : "opacity-100",
              agentCfg.borderColor,
              (log.event === "ERROR" || log.event.includes("FAILED")) && "border-red-500/40 bg-red-500/5"
            )}
          >
            {/* Context Icon */}
            <div className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
              agentCfg.borderColor,
              log.type === "trace" ? "bg-white/5" : agentCfg.bgColor,
            )}>
              {log.type === "agent" ? (
                <AgentIcon className={cn("w-4 h-4", agentCfg.color)} />
              ) : (
                <EvtIcon className={cn("w-4 h-4", evtCfg.color)} />
              )}
            </div>

            {/* Log Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Agent/System label */}
                <span className={cn("text-[10px] font-black uppercase tracking-widest", agentCfg.color)}>
                  {agentCfg.label}
                </span>

                {/* Event badge */}
                <span className={cn(
                  "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
                  evtCfg.color
                )}>
                  <EvtIcon className="w-3 h-3" />
                  {evtCfg.label}
                </span>

                {/* Duration */}
                {(log.duration_ms ?? 0) > 0 && (
                  <span className="text-[10px] text-slate-600 font-mono">
                    {formatDuration(log.duration_ms!)}
                  </span>
                )}

              {/* ID Chips Container */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                {/* Envelope ID */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[2px]" title={`Envelope ID: ${log.envelope_id}`}>
                  <span className="text-[10px] font-black text-slate-500 uppercase">ENV</span>
                  <span className="text-[10px] font-mono text-cyan-500/80 break-all">{log.envelope_id || "SYSTEM"}</span>
                </div>

                {/* Step ID */}
                {log.step_id && (
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[2px]" title={`Step ID: ${log.step_id}`}>
                    <span className="text-[10px] font-black text-slate-500 uppercase">STP</span>
                    <span className="text-[10px] font-mono text-purple-400/80 break-all">{log.step_id}</span>
                  </div>
                )}

                {/* Trace/Log ID */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[2px]" title={`${log.type === "trace" ? "Trace" : "Log"} ID: ${log.id}`}>
                  <span className="text-[10px] font-black text-slate-500 uppercase">{log.type === "trace" ? "TRC" : "LOG"}</span>
                  <span className="text-[10px] font-mono text-slate-500 break-all">{log.id}</span>
                </div>

                {/* Artifact ID */}
                {(log.artifact_id || log.metadata?.artifact_id) && (
                  <div className="flex items-center gap-1 bg-emerald-500/5 border border-emerald-500/20 px-1.5 py-0.5 rounded-[2px]" title={`Artifact ID: ${log.artifact_id || log.metadata?.artifact_id}`}>
                    <span className="text-[10px] font-black text-emerald-500/70 uppercase">ART</span>
                    <span className="text-[10px] font-mono text-emerald-400/80 break-all">{log.artifact_id || log.metadata?.artifact_id}</span>
                  </div>
                )}

                {/* Agent Fingerprint / ID */}
                {log.agent_id && (
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[2px] ml-auto" title={`Agent ID: ${log.agent_id}`}>
                    <Fingerprint className="w-2.5 h-2.5 text-slate-600" />
                    <span className="text-[10px] font-mono text-slate-500 break-all">{"0x" + String(log.agent_id).replace(/^hex:0x|^0x|^hex:/i, '')}</span>
                  </div>
                )}
              </div>

                {/* Timestamp */}
                <span className="ml-auto text-[10px] text-slate-700 font-mono shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>

              {/* Main Content */}
              {log.summary && (
                <p className={cn(
                  "text-[10px] leading-relaxed line-clamp-2",
                  log.event === "COMPLETE" ? "text-slate-300" : "text-slate-500 italic"
                )}>
                  {log.summary}
                </p>
              )}

              {/* Trace Metadata / Message */}
              {log.type === "trace" && (log.message || log.metadata?.reason || log.metadata?.error) && (
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  {log.message || log.metadata?.reason || log.metadata?.error}
                </p>
              )}

              {/* Error */}
              {log.error && (
                <p className="text-[10px] text-red-400 leading-relaxed font-bold">
                  ⚠ {log.error}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
