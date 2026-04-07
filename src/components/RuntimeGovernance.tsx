"use client";

/**
 * RuntimeGovernance — Step-level governance gates for approve/reject.
 * T-029 | Sprint 5
 */

import React, { useState } from "react";
import { ShieldCheck, CheckCircle2, X, AlertCircle } from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import type { EnvelopeStep } from "@aceplace/runtime-core/shared";

interface RuntimeGovernanceProps {
  executionId: string;
  steps: EnvelopeStep[];
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string, reason: string) => void;
}

export function RuntimeGovernance({ executionId, steps, onApprove, onReject }: RuntimeGovernanceProps) {
  const [rejectingStepId, setRejectingStepId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // In Phase 2, human review is an envelope-level state (awaiting_human).
  // Steps don't have awaiting_human status — filter executing steps for display.
  const awaitingSteps = steps.filter((s) => s.status === "executing");

  const handleApprove = async (stepId: string) => {
    setProcessing(true);
    try {
      await fetch(`/api/runtime/envelope/${executionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", step_id: stepId }),
      });
      onApprove?.(stepId);
    } catch (err) {
      console.error("[RuntimeGovernance] Approve failed:", err);
    }
    setProcessing(false);
  };

  const handleReject = async (stepId: string) => {
    if (!rejectReason) return;
    setProcessing(true);
    try {
      await fetch(`/api/runtime/envelope/${executionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", step_id: stepId, reason: rejectReason }),
      });
      onReject?.(stepId, rejectReason);
      setRejectingStepId(null);
      setRejectReason("");
    } catch (err) {
      console.error("[RuntimeGovernance] Reject failed:", err);
    }
    setProcessing(false);
  };

  return (
    <HUDFrame title="Governance Gates" variant="glass">
      <div className="space-y-4 py-2">
        {awaitingSteps.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-slate-600">
            <ShieldCheck className="w-5 h-5 mr-2 opacity-30" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em]">No Pending Gates</span>
          </div>
        ) : (
          awaitingSteps.map((step) => (
            <div key={step.step_id} className="border border-orange-400/30 bg-orange-400/5 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    Human Review Required
                  </span>
                  <p className="text-[8px] font-bold tracking-widest text-slate-500 uppercase mt-0.5">
                    Step: {step.step_id} • Type: {step.step_type}
                  </p>
                </div>
              </div>

              {rejectingStepId === step.step_id ? (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    className="w-full bg-black/40 border border-red-500/20 p-3 text-sm font-mono text-red-400 focus:outline-none focus:border-red-500/50 resize-none h-24"
                  />
                  <div className="flex gap-3">
                    <button
                      disabled={processing || !rejectReason}
                      onClick={() => handleReject(step.step_id)}
                      className="flex-1 bg-red-500 text-black py-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all cursor-target"
                    >
                      Confirm Reject
                    </button>
                    <button
                      disabled={processing}
                      onClick={() => { setRejectingStepId(null); setRejectReason(""); }}
                      className="flex-1 bg-slate-800 text-slate-400 py-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all cursor-target"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={processing}
                    onClick={() => handleApprove(step.step_id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black py-3 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all cursor-target"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    disabled={processing}
                    onClick={() => setRejectingStepId(step.step_id)}
                    className="bg-red-500/10 border border-red-500/30 text-red-500 py-3 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all cursor-target"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </HUDFrame>
  );
}
