"use client";

/**
 * EnvelopeInspector — Full envelope viewer with step graph and cards.
 * T-024 | Sprint 5
 */

import React from "react";
import { Activity, Clock, Hash, Layers } from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { StepGraph } from "./StepGraph";
import { EnvelopeStepCard } from "./EnvelopeStepCard";
import { cn } from "@/lib/utils";
import { ENVELOPE_STATUS_DISPLAY } from "@/lib/runtime/constants";
import { useEnvelope } from "@/hooks/useEnvelope";
import type { ExecutionEnvelope } from "@/lib/runtime/types";

interface EnvelopeInspectorProps {
  executionId: string;
}

export function EnvelopeInspector({ executionId }: EnvelopeInspectorProps) {
  const { envelope, steps, loading, error } = useEnvelope(executionId);

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
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">
          {error || "Envelope not found"}
        </span>
      </div>
    );
  }

  const statusDisplay = ENVELOPE_STATUS_DISPLAY[envelope.status];
  const completedCount = envelope.steps.filter((s) => s.status === "completed").length;
  const totalCount = envelope.steps.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Envelope Header */}
      <HUDFrame title="Execution Envelope" variant="glass">
        <div className="space-y-4 py-2">
          {/* Status + Progress */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-cyan-500" />
              <span className={cn(
                "text-[8px] font-black uppercase tracking-[0.2em] border px-2 py-0.5",
                statusDisplay?.color, statusDisplay?.bgColor, statusDisplay?.borderColor,
              )}>
                {statusDisplay?.label || envelope.status}
              </span>
            </div>
            <span className="text-[10px] font-black text-white tabular-nums">
              {completedCount}/{totalCount} STEPS
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-white/5 w-full">
            <div
              className={cn(
                "h-full transition-all duration-700 ease-out",
                progress === 100 ? "bg-emerald-500" : "bg-cyan-500",
                progress < 100 && progress > 0 && "animate-pulse",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-0.5">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Execution ID</span>
              <p className="text-[9px] font-mono text-cyan-500 truncate">{envelope.envelope_id}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Agent</span>
              <p className="text-[9px] font-mono text-white uppercase">{envelope.identity_context.agent_id}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Created</span>
              <p className="text-[9px] font-mono text-slate-400">
                {new Date(envelope.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Identity Context */}
          <div className="flex items-center gap-2 p-2 bg-white/[0.02] border border-white/5">
            <Hash className="w-3 h-3 text-purple-400" />
            <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Fingerprint:</span>
            <span className="text-[8px] font-mono text-purple-400 truncate">
              {envelope.identity_context.fingerprint || envelope.identity_context.identity_fingerprint}
            </span>
            <span className={cn(
              "text-[7px] font-black uppercase tracking-widest ml-auto",
              envelope.identity_context.verified ? "text-emerald-500" : "text-orange-400",
            )}>
              {envelope.identity_context.verified ? "✓ VERIFIED" : "⏳ PENDING"}
            </span>
          </div>
        </div>
      </HUDFrame>

      {/* Step Graph Timeline */}
      <HUDFrame title="Execution Graph" variant="dark">
        <StepGraph steps={steps} currentStepId={null} />
      </HUDFrame>

      {/* Step Cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-500/50">Step Details</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>
        {steps.map((step) => (
          <EnvelopeStepCard
            key={step.step_id}
            step={step}
            isActive={step.status === "executing"}
          />
        ))}
      </div>
    </div>
  );
}
