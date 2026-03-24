"use client";

/**
 * StepGraph — Visual step graph timeline showing execution progress.
 * T-025 | Sprint 5
 */

import React from "react";
import { cn } from "@/lib/utils";
import { STEP_TYPE_CONFIG } from "@/lib/runtime/constants";
import type { EnvelopeStep } from "@/lib/runtime/types";

interface StepGraphProps {
  steps: EnvelopeStep[];
  currentStepId?: string | null;
}

export function StepGraph({ steps, currentStepId }: StepGraphProps) {
  if (steps.length === 0) return null;

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-3 px-2">
      {steps.map((step, index) => {
        const config = STEP_TYPE_CONFIG[step.step_type];
        const isCurrent = step.step_id === currentStepId;
        const isCompleted = step.status === "completed";
        const isFailed = step.status === "failed";
        const isRunning = step.status === "executing";
        const isAwaiting = false; // In Phase 2, awaiting_human is envelope-level, not step-level

        return (
          <React.Fragment key={step.step_id}>
            {/* Node */}
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              {/* Circle */}
              <div
                className={cn(
                  "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-500",
                  isCompleted && "border-emerald-500 bg-emerald-500/20",
                  isFailed && "border-red-500 bg-red-500/20",
                  isRunning && "border-cyan-500 bg-cyan-500/20 animate-pulse",
                  isAwaiting && "border-orange-400 bg-orange-400/20",
                  !isCompleted && !isFailed && !isRunning && !isAwaiting && "border-slate-700 bg-slate-700/10",
                  isCurrent && "ring-2 ring-cyan-500/50 ring-offset-1 ring-offset-slate-950",
                )}
              >
                <span
                  className={cn(
                    "text-[9px] font-black",
                    isCompleted && "text-emerald-400",
                    isFailed && "text-red-400",
                    isRunning && "text-cyan-400",
                    isAwaiting && "text-orange-400",
                    !isCompleted && !isFailed && !isRunning && !isAwaiting && "text-slate-600",
                  )}
                >
                  {index + 1}
                </span>
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[7px] font-black uppercase tracking-[0.15em] text-center leading-tight max-w-[70px]",
                  isCompleted && "text-emerald-500/70",
                  isFailed && "text-red-500/70",
                  isRunning && "text-cyan-500",
                  isAwaiting && "text-orange-400/70",
                  !isCompleted && !isFailed && !isRunning && !isAwaiting && "text-slate-600",
                )}
              >
                {config?.label?.split(" ")[0] || step.step_type}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-[2px] flex-1 min-w-[16px] transition-all duration-500",
                  isCompleted ? "bg-emerald-500/50" : "bg-slate-800",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
