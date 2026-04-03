"use client";

/**
 * LeaseManager — Active lease display with expiration countdown and revocation.
 * T-027 | Sprint 5
 */

import React, { useEffect, useState } from "react";
import { Clock, ShieldAlert, X } from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { cn } from "@/lib/utils";
import { useLeases } from "@/hooks/useLeases";

export function LeaseManager() {
  const { activeLeases, loading } = useLeases();
  const [now, setNow] = useState(Date.now());

  // Tick every second for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRevoke = async (leaseId: string) => {
    try {
      await fetch("/api/runtime/lease/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lease_id: leaseId, reason: "manual_revocation" }),
      });
    } catch (err) {
      console.error("[LeaseManager] Revoke failed:", err);
    }
  };

  const formatCountdown = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "EXPIRED";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <HUDFrame title="Active Leases" variant="glass">
      {loading ? (
        <div className="flex items-center justify-center p-6">
          <Clock className="w-4 h-4 text-cyan-500 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2">Loading...</span>
        </div>
      ) : activeLeases.length === 0 ? (
        <div className="flex items-center justify-center p-6 text-slate-600">
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">No Active Leases</span>
        </div>
      ) : (
        <div className="space-y-2 py-2">
          {activeLeases.map((lease) => {
            const remaining = new Date(lease.authority_lease.expires_at).getTime() - now;
            const isUrgent = remaining < 60000;

            return (
              <div
                key={lease.envelope_id}
                className={cn(
                  "flex items-center gap-3 p-3 border transition-all",
                  isUrgent
                    ? "border-red-500/30 bg-red-500/5 animate-pulse"
                    : "border-purple-500/20 bg-purple-500/5",
                )}
              >
                <ShieldAlert className={cn("w-4 h-4", isUrgent ? "text-red-500" : "text-purple-400")} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-white truncate">{lease.envelope_id}</span>
                  </div>
                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">
                    Holder: {lease.authority_lease.holder_instance_id}
                  </span>
                </div>

                <span className={cn(
                  "text-xs font-black tabular-nums",
                  isUrgent ? "text-red-500" : "text-purple-400",
                )}>
                  {formatCountdown(lease.authority_lease.expires_at)}
                </span>

                <button
                  onClick={() => handleRevoke(lease.envelope_id)}
                  className="p-1.5 hover:bg-red-500/10 rounded transition-colors cursor-target"
                  title="Revoke lease"
                >
                  <X className="w-3 h-3 text-slate-600 hover:text-red-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </HUDFrame>
  );
}
