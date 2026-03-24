"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, Fingerprint, Key, Activity } from "lucide-react";

export type KernelType = "identity" | "authority" | "execution" | "persistence" | "communications";
export type KernelStatus = "idle" | "active" | "verified" | "granted" | "failed" | "compromised";

interface KernelStatusBadgeProps {
  kernel: KernelType;
  status: KernelStatus;
  className?: string;
  showIcon?: boolean;
}

const KERNEL_CONFIG: Record<KernelType, { icon: any; label: string; color: string }> = {
  identity: { icon: Fingerprint, label: "Identity", color: "text-purple-400" },
  authority: { icon: Key, label: "Authority", color: "text-amber-400" },
  execution: { icon: Activity, label: "Execution", color: "text-cyan-400" },
  persistence: { icon: ShieldCheck, label: "Persistence", color: "text-emerald-400" },
  communications: { icon: Activity, label: "Comms", color: "text-blue-400" },
};

const STATUS_STYLING: Record<KernelStatus, string> = {
  idle: "text-slate-500 border-slate-500/30 bg-slate-500/5",
  active: "text-cyan-500 border-cyan-500/30 bg-cyan-500/5 animate-pulse",
  verified: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
  granted: "text-cyan-500 border-cyan-500/30 bg-cyan-500/5",
  failed: "text-rose-500 border-rose-500/30 bg-rose-500/5",
  compromised: "text-rose-600 border-rose-600/50 bg-rose-600/10",
};

export function KernelStatusBadge({ kernel, status, className, showIcon = true }: KernelStatusBadgeProps) {
  const config = KERNEL_CONFIG[kernel];
  const Icon = config.icon;
  const statusStyle = STATUS_STYLING[status];

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-2 py-0.5 border text-[7px] font-black uppercase tracking-[0.2em] scifi-clip",
      statusStyle,
      className
    )}>
      {showIcon && <Icon className="w-2.5 h-2.5" />}
      <span>{config.label}</span>
      <span className="opacity-30 mx-1">/</span>
      <span className="opacity-80">{status}</span>
    </div>
  );
}
