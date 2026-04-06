"use client";

/**
 * EnvelopeStepCard — Individual step card with status, hash check, expandable I/O.
 * T-026 | Sprint 5
 */

import React, { useState } from "react";
import { CheckCircle2, AlertCircle, Clock, Cpu, Search, GraduationCap, ShieldCheck, Play, ChevronDown, ChevronUp, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_TYPE_CONFIG, STEP_STATUS_DISPLAY } from "@aceplace/runtime-core";
import type { EnvelopeStep, StepType } from "@aceplace/runtime-core";
import type { Artifact } from "@/hooks/useJobs";

const STEP_ICONS: Partial<Record<StepType, React.ElementType>> = {
  plan: Cpu,
  assign: Search,
  produce_artifact: Play,
  evaluate: GraduationCap,
};

interface EnvelopeStepCardProps {
  step: EnvelopeStep;
  isActive?: boolean;
  artifacts?: Artifact[];
}

export function EnvelopeStepCard({ step, isActive, artifacts = [] }: EnvelopeStepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const config = STEP_TYPE_CONFIG[step.step_type];
  const statusDisplay = STEP_STATUS_DISPLAY[step.status];
  const Icon = STEP_ICONS[step.step_type] || Cpu;

  const statusIcon: Record<string, React.ElementType> = {
    pending: Clock,
    ready: Cpu,
    executing: Cpu,
    awaiting_human: ShieldCheck,
    completed: CheckCircle2,
    failed: AlertCircle,
    blocked: AlertCircle,
    skipped: Clock,
  };

  const StatusIcon = statusIcon[step.status] ?? Clock;

  const resolveArtifact = (val: any) => {
    if (typeof val !== 'string' || !val.startsWith('art_')) return val;
    const found = artifacts.find(a => a.id === val || a.artifact_id === val);
    if (found) return `[ARTIFACT] ${found.title || found.artifact_id}`;
    return val;
  };

  return (
    <div
      className={cn(
        "border transition-all duration-300 relative overflow-hidden",
        isActive && "ring-1 ring-cyan-500/30",
        step.status === "executing" && "border-cyan-500/50 bg-cyan-500/5 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.1)]",
        step.status === "completed" && "border-emerald-500/30 bg-emerald-500/[0.03]",
        step.status === "failed" && "border-red-500/30 bg-red-500/[0.03]",
        step.status === "pending" && "border-white/10 bg-white/[0.01]",
        step.status === "ready" && "border-cyan-500/20 bg-cyan-500/[0.02]",
      )}
    >
      {/* status indicator bar */}
      <div className={cn(
          "absolute top-0 left-0 w-1 h-full opacity-50",
          step.status === "executing" ? "bg-cyan-500" : 
          step.status === "completed" ? "bg-emerald-500" : 
          step.status === "failed" ? "bg-red-500" : "bg-white/5"
      )} />
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left cursor-target"
      >
        {/* Step Icon */}
        <div
          className="w-8 h-8 border flex items-center justify-center scifi-clip bg-black/40"
          style={{ borderColor: `${config?.color || "#64748b"}50` }}
        >
          <Icon className="w-4 h-4" style={{ color: config?.color || "#64748b" }} />
        </div>

        {/* Step Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
              {config?.label || step.step_type}
            </span>
            <span className={cn("text-[8px] font-black uppercase tracking-widest", statusDisplay?.color || "text-slate-500")}>
              {statusDisplay?.label || step.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[8px] font-bold tracking-widest text-slate-600 uppercase">
              Agent: {step.assigned_agent_id}
            </span>
            <span className="text-[8px] font-mono text-slate-700 flex items-center gap-0.5">
              <Hash className="w-2 h-2" />
              {step.step_id?.slice(0, 12)}…
            </span>
          </div>
        </div>

        {/* Status Icon */}
        <StatusIcon className={cn(
          "w-4 h-4",
          step.status === "executing" && "text-cyan-500 animate-spin",
          step.status === "completed" && "text-emerald-500",
          step.status === "failed" && "text-red-500",
          step.status === "pending" && "text-slate-600",
        )} />

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-600" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-600" />
        )}
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3">
            {(step as any).started_at && (
              <div className="space-y-0.5">
                <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Started</span>
                <p className="text-[10px] font-mono text-slate-400">{new Date((step as any).started_at).toLocaleString()}</p>
              </div>
            )}
            {(step as any).completed_at && (
              <div className="space-y-0.5">
                <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Completed</span>
                <p className="text-[10px] font-mono text-slate-400">{new Date((step as any).completed_at).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Input Data */}
          {(step as any).input && Object.keys((step as any).input).length > 0 && (
            <div className="space-y-1">
              <span className="text-[7px] font-black uppercase tracking-widest text-cyan-500/50">Input Data</span>
              <pre className="text-[10px] font-mono text-slate-500 bg-black/40 border border-white/5 p-3 max-h-32 overflow-auto whitespace-pre-wrap">
              {JSON.stringify((step as any).input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output Data */}
          {((step as any).output || step.output_ref) && (
            <div className="space-y-1">
              <span className="text-[7px] font-black uppercase tracking-widest text-emerald-500/50">Output Intelligence</span>
              <pre className="text-[10px] font-mono text-emerald-400/90 bg-black/40 border border-emerald-500/10 p-3 max-h-48 overflow-auto whitespace-pre-wrap">
              {(() => {
                const out = (step as any).output || step.output_ref;
                if (typeof out === 'string') return resolveArtifact(out);
                if (typeof out === 'object') {
                   const resolved = { ...out };
                    Object.keys(resolved).forEach(k => {
                        resolved[k] = resolveArtifact(resolved[k]);
                    });
                    return JSON.stringify(resolved, null, 2);
                }
                return String(out);
              })()}
              </pre>
            </div>
          )}

          {/* Error */}
          {(step as any).error && (
            <div className="space-y-1">
              <span className="text-[7px] font-black uppercase tracking-widest text-red-500/50">Error</span>
              <p className="text-[10px] font-mono text-red-400/80 bg-red-500/5 border border-red-500/20 p-3">
              {(step as any).error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
