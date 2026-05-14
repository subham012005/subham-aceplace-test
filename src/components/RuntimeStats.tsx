"use client";

/**
 * RuntimeStats — Dashboard stats cards for runtime metrics.
 * T-030 | Sprint 5
 */

import React from "react";
import { Layers, ShieldCheck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRuntimeStats } from "@/hooks/useRuntimeStats";

export function RuntimeStats() {
  const { stats, loading } = useRuntimeStats();

  const reliability = stats.total_envelopes > 0
    ? Math.round((stats.completed_envelopes / stats.total_envelopes) * 100)
    : 100;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const cards = [
    {
      label: "Active Leases",
      value: stats.active_leases,
      icon: ShieldCheck,
      color: "text-purple-400",
      borderColor: "border-purple-500/30",
    },
    {
      label: "Envelopes",
      value: stats.total_envelopes,
      icon: Layers,
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
    },
    {
      label: "Avg Latency",
      value: formatDuration(stats.average_step_duration_ms ?? 0),
      icon: Activity,
      color: "text-amber-400",
      borderColor: "border-amber-500/30",
    },
    {
      label: "Reliability",
      value: `${reliability}%`,
      icon: ShieldCheck,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "border bg-black/20 p-4 flex flex-col items-center gap-2 transition-all hover:bg-white/[0.03]",
            card.borderColor,
          )}
        >
          <card.icon className={cn("w-5 h-5", card.color, loading && "animate-pulse")} />
          <span className={cn("text-2xl font-black italic tracking-tighter tabular-nums", card.color)}>
            {loading ? "—" : card.value}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {card.label}
          </span>
        </div>
      ))}
    </div>
  );
}
