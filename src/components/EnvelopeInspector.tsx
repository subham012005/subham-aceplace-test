"use client";

/**
 * EnvelopeInspector — Full envelope viewer with step graph and cards.
 * Phase 2 Compliance: Issue #3 — Missing envelope_id, state, current_step,
 * lease_holder, trace_count visibility.
 * T-024 | Sprint 5 (Updated Phase 2)
 */

import React, { useState } from "react";
import {
  Activity,
  Clock,
  Hash,
  Copy,
  Check,
  ShieldCheck,
  User,
  GitBranch,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { StepGraph } from "./StepGraph";
import { cn } from "@/lib/utils";
import { ENVELOPE_STATUS_DISPLAY } from "@aceplace/runtime-core/shared";
import { useEnvelope } from "@/hooks/useEnvelope";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";

interface EnvelopeInspectorProps {
  executionId: string;
  hideFailureBanner?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  executing:      "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
  completed:      "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  failed:         "text-rose-400 border-rose-500/40 bg-rose-500/10",
  quarantined:    "text-orange-400 border-orange-500/40 bg-orange-500/10",
  planned:        "text-blue-400 border-blue-500/40 bg-blue-500/10",
  leased:         "text-purple-400 border-purple-500/40 bg-purple-500/10",
  awaiting_human: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  approved:       "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  rejected:       "text-rose-400 border-rose-500/40 bg-rose-500/10",
};

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 group/copy cursor-pointer" title={value}>
      <span className="text-[8px] font-mono text-cyan-400 truncate max-w-[140px]">{value}</span>
      {copied ? (
        <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
      ) : (
        <Copy className="w-2.5 h-2.5 text-slate-700 group-hover/copy:text-cyan-500 shrink-0 transition-colors" />
      )}
    </button>
  );
}

export function EnvelopeInspector({ executionId, hideFailureBanner = false }: EnvelopeInspectorProps) {
  const { envelope, steps, loading, error } = useEnvelope(executionId);
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Activity className="w-6 h-6 text-cyan-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-3">Loading Envelope...</span>
      </div>
    );
  }

  if (error || !envelope) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-600">
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">{error || "Envelope not found"}</span>
      </div>
    );
  }

  const statusConfig = ENVELOPE_STATUS_DISPLAY[envelope.status];
  const statusDisplay = statusConfig?.label ?? envelope.status?.toUpperCase();
  const statusColor = statusConfig 
    ? cn(statusConfig.color, statusConfig.borderColor, statusConfig.bgColor)
    : (STATUS_COLORS[envelope.status] ?? "text-slate-400 border-slate-500/30 bg-slate-500/10");
  const completedCount = envelope.steps.filter((s) => s.status === "completed").length;
  const totalCount = envelope.steps.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentStep = envelope.steps.find((s) => s.status === "executing");
  const traceCount = (envelope as any).trace_count ?? 0;

  const identityContexts = (envelope as any).identity_contexts || {};
  const authorityLeases = (envelope as any).authority_leases || {};
  const agents = Object.keys(identityContexts);

  const failureReason = (envelope as any).failure_reason;
  const isMissingConfig = failureReason?.includes("MISSING_INTELLIGENCE_CONFIG");

  return (
    <div className="space-y-4">
      {/* Failure Banner */}
      {!hideFailureBanner && envelope.status === "failed" && failureReason && (
        <div className="border border-rose-500/30 bg-rose-500/10 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block">Integrity Breach / Execution Failed</span>
              <p className="text-[11px] font-mono text-rose-200 leading-tight">
                {failureReason}
              </p>
            </div>
          </div>
          
          {isMissingConfig && (
            <button 
              onClick={() => router.push('/system-config')}
              className="w-full py-2 border border-rose-500/30 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all group"
            >
              Configure Intelligence Providers
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      )}

      {/* Fallback Suggested Banner */}
      {envelope.fallback_suggested && (
        <div className="border border-orange-500/30 bg-orange-500/10 p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start gap-3">
            <Activity className="w-4 h-4 text-orange-500 shrink-0 mt-0.5 animate-spin-slow" />
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 block">Fallback Pending Approval</span>
              <p className="text-[10px] font-mono text-orange-200 leading-tight">
                {envelope.fallback_metadata?.reason || "System requires approval to switch model/runtime."}
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Envelope Metadata Panel */}
      <HUDFrame title="EXECUTION ENVELOPE" variant="dark">
        <div className="space-y-4 py-1">

          {/* envelope_id + state */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 block mb-0.5">Envelope ID</span>
              <CopyableId value={envelope.envelope_id ?? executionId} />
            </div>
            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 border text-[8px] font-black uppercase tracking-widest shrink-0", statusColor)}>
              <Activity className="w-3 h-3" />
              {statusDisplay}
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Step Progress</span>
              <span className="text-[8px] font-black text-slate-400">{completedCount} / {totalCount} ({progress}%)</span>
            </div>
            <div className="h-1 bg-white/5 border border-white/5 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-cyan-500 shadow-[0_0_8px_#06b6d4] transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Active Agents & Identity */}
          <div className="space-y-2">
            <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 block mb-1">
              Active Agent Identities ({agents.length})
            </span>
            <div className="space-y-1.5">
              {agents.map((aid) => {
                const ctx = identityContexts[aid];
                const lease = authorityLeases[aid];
                const isActive = lease?.status === "active";
                return (
                  <div key={aid} className="flex items-center justify-between gap-3 p-2 border border-white/5 bg-black/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <User className={cn("w-2.5 h-2.5", isActive ? "text-cyan-400" : "text-slate-600")} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 truncate">
                          {aid}
                        </span>
                        {ctx?.verified && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" title="Verified" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-2.5 h-2.5 text-slate-700" />
                        <span className="text-[7px] font-mono text-slate-500 truncate" title={ctx?.identity_fingerprint}>
                          {ctx?.identity_fingerprint?.slice(0, 12)}…
                        </span>
                      </div>
                    </div>
                    {lease && (
                      <div className="text-right shrink-0">
                        <div className={cn("text-[7px] font-black uppercase tracking-widest mb-0.5", isActive ? "text-amber-400" : "text-slate-700")}>
                          {isActive ? "ACTIVE LEASE" : "EXPIRED"}
                        </div>
                        <div className="text-[7px] font-mono text-slate-600 flex items-center justify-end gap-1">
                           <Clock className="w-2 h-2" />
                           {new Date(lease.lease_expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {agents.length === 0 && (
                <div className="text-[8px] text-slate-70) italic p-2 border border-dashed border-white/5">
                  No identities bound to envelope.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
             <div className="space-y-0.5">
               <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1"><GitBranch className="w-2.5 h-2.5" /> Current Step</span>
               {currentStep ? (
                 <p className="text-[8px] font-mono text-blue-400 truncate">{currentStep.step_id}</p>
               ) : (
                 <p className="text-[8px] font-mono text-slate-700 italic">—</p>
               )}
             </div>
             <div className="space-y-0.5 text-right">
               <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1 justify-end"><Hash className="w-2.5 h-2.5" /> Events</span>
               <p className="text-[8px] font-mono text-purple-400">{traceCount}</p>
             </div>
          </div>
        </div>
      </HUDFrame>

      {/* Step Graph Timeline */}
      <HUDFrame title="EXECUTION STEP GRAPH" variant="dark">
        <div className="p-4">
          <StepGraph steps={steps} currentStepId={currentStep?.step_id ?? null} />
        </div>
      </HUDFrame>
    </div>
  );
}
