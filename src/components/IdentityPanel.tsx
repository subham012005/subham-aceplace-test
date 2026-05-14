"use client";

/**
 * IdentityPanel — Agent identity display with fingerprint and verification badge.
 * T-028 | Sprint 5
 */

import React from "react";
import { Fingerprint, ShieldCheck, ShieldAlert, Globe } from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { cn } from "@/lib/utils";
import { useIdentity } from "@/hooks/useIdentity";
import { TIER_DEFINITIONS } from "@aceplace/runtime-core/shared";
import type { LicenseTier } from "@aceplace/runtime-core/shared";

interface IdentityPanelProps {
  agentId: string;
}

export function IdentityPanel({ agentId }: IdentityPanelProps) {
  const { identity, loading } = useIdentity(agentId);

  if (loading) {
    return (
      <HUDFrame title="Agent Identity" variant="dark">
        <div className="flex items-center justify-center p-6">
          <Fingerprint className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Verifying...</span>
        </div>
      </HUDFrame>
    );
  }

  if (!identity) {
    return (
      <HUDFrame title="Agent Identity" variant="dark">
        <div className="flex items-center justify-center p-6 text-slate-600">
          <ShieldAlert className="w-4 h-4 mr-2" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Identity Not Registered</span>
        </div>
      </HUDFrame>
    );
  }

  const tierDef = TIER_DEFINITIONS[identity.tier as LicenseTier];
  const isVerified = !!identity.last_verified_at;

  // Normalize stored `hex:0x<hash>` → display as `0x<hash>`
  const normalizedFp = identity.fingerprint
    ? "0x" + identity.fingerprint.replace(/^hex:0x|^0x|^hex:/i, "")
    : null;

  return (
    <HUDFrame title="Agent Identity" variant="dark">
      <div className="space-y-4 py-2">
        {/* Agent Name + Verification Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-purple-500/30 flex items-center justify-center scifi-clip bg-purple-500/5">
              <Fingerprint className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-tight">
                {identity.display_name || identity.agent_id}
              </p>
              <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                {identity.agent_class || "Standard Agent"}
              </p>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-black uppercase tracking-widest",
            isVerified
              ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
              : "border-orange-400/30 text-orange-400 bg-orange-400/5",
          )}>
            {isVerified ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
            {isVerified ? "Verified" : "Unverified"}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">ACELOGIC ID</span>
            <p className="text-[10px] font-mono text-cyan-400 truncate">{identity.acelogic_id}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">License Tier</span>
            <p className="text-[10px] font-black text-amber-400 uppercase">{tierDef?.name || `Tier ${identity.tier}`}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Jurisdiction</span>
            <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" /> {identity.jurisdiction || "Global"}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Fingerprint</span>
            <p className="text-[10px] font-mono text-purple-400 truncate" title={normalizedFp || undefined}>{normalizedFp || "—"}</p>
          </div>
        </div>

        {/* Mission */}
        {identity.mission && (
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Mission</span>
            <p className="text-[11px] text-slate-400 italic leading-relaxed border-l-2 border-purple-500/30 pl-3">
              {identity.mission}
            </p>
          </div>
        )}
      </div>
    </HUDFrame>
  );
}
