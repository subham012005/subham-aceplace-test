"use client";

import React from "react";
import { Activity, CheckCircle2, XCircle, Clock, Cpu, Search, GraduationCap, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentLog } from "@/hooks/useAgentLogs";

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
};

const EVENT_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  START: { icon: Clock, color: "text-cyan-400", label: "Started" },
  COMPLETE: { icon: CheckCircle2, color: "text-emerald-400", label: "Completed" },
  ERROR: { icon: XCircle, color: "text-red-400", label: "Failed" },
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
  logs: AgentLog[];
  loading: boolean;
  className?: string;
}

export function AgentLogPanel({ logs, loading, className }: AgentLogPanelProps) {
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
      <div className={cn("flex flex-col items-center justify-center py-12 space-y-3", className)}>
        <Zap className="w-8 h-8 text-slate-700" />
        <p className="text-slate-600 text-xs uppercase tracking-widest font-bold">
          Waiting for agent activity...
        </p>
        <p className="text-slate-700 text-[10px]">
          Logs will appear here in real-time as agents execute.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {logs.map((log) => {
        const agentCfg = AGENT_CONFIG[log.agent_role] || {
          label: log.agent_role,
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
            key={log.log_id}
            className={cn(
              "flex items-start gap-3 p-3 border rounded-sm transition-all",
              agentCfg.bgColor,
              agentCfg.borderColor,
              log.event === "ERROR" && "border-red-500/40 bg-red-500/5"
            )}
          >
            {/* Agent Icon */}
            <div className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
              agentCfg.borderColor,
              agentCfg.bgColor,
            )}>
              <AgentIcon className={cn("w-4 h-4", agentCfg.color)} />
            </div>

            {/* Log Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Agent label */}
                <span className={cn("text-[10px] font-black uppercase tracking-widest", agentCfg.color)}>
                  {agentCfg.label}
                </span>

                {/* Event badge */}
                <span className={cn(
                  "flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                  evtCfg.color
                )}>
                  <EvtIcon className="w-3 h-3" />
                  {evtCfg.label}
                </span>

                {/* Duration */}
                {log.duration_ms > 0 && (
                  <span className="text-[9px] text-slate-600 font-mono">
                    {formatDuration(log.duration_ms)}
                  </span>
                )}

                {/* Model */}
                {log.model && (
                  <span className="text-[8px] text-slate-700 font-mono truncate max-w-[120px]">
                    {log.model}
                  </span>
                )}

                {/* Timestamp */}
                <span className="ml-auto text-[9px] text-slate-700 font-mono shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>

              {/* Output summary (shown on COMPLETE) */}
              {log.event === "COMPLETE" && log.output_summary && (
                <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-2">
                  {log.output_summary}
                </p>
              )}

              {/* Input summary (shown on START) */}
              {log.event === "START" && log.input_summary && (
                <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-1 italic">
                  {log.input_summary}
                </p>
              )}

              {/* Error */}
              {log.event === "ERROR" && log.error && (
                <p className="text-[10px] text-red-400 leading-relaxed">
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
