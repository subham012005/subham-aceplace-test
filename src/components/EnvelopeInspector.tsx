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
      {/* Step Graph Timeline */}
      <HUDFrame title="EXECUTION ENGINE GRAPH" variant="dark">
        <div className="p-4">
          <StepGraph steps={steps} currentStepId={null} />
        </div>
      </HUDFrame>
    </div>
  );
}
