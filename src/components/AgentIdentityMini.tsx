/**
 * AgentIdentityMini — Compact per-agent identity display for agent overview cards.
 * Shows ACELOGIC ID + fingerprint (truncated) for each of the 4 runtime agents.
 * Renders a styled "UNREGISTERED" badge when the agent doc doesn't exist in Firestore.
 *
 * Phase 2 Compliance: Issue #5 – Identity enforcement visibility for all agents.
 */
"use client";

import React from "react";
import { Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";
import { useIdentity } from "@/hooks/useIdentity";
import { cn } from "@/lib/utils";

interface AgentIdentityMiniProps {
  agentId: string;
}

export function AgentIdentityMini({ agentId }: AgentIdentityMiniProps) {
  const { identity, loading } = useIdentity(agentId);

  if (loading) {
    return (
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5">
        <Fingerprint className="w-2.5 h-2.5 text-purple-400/40 animate-pulse" />
        <span className="text-[7px] font-mono text-slate-700 uppercase tracking-widest animate-pulse">
          Verifying…
        </span>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5">
        <ShieldAlert className="w-2.5 h-2.5 text-rose-500/60 shrink-0" />
        <span className="text-[7px] font-black uppercase tracking-widest text-rose-500/60">
          Identity Unregistered
        </span>
      </div>
    );
  }

  const isVerified = !!identity.last_verified_at;
  const shortFp = identity.fingerprint
    ? identity.fingerprint.slice(0, 8) + "…"
    : "—";
  const shortId = identity.acelogic_id
    ? identity.acelogic_id.slice(0, 14) + "…"
    : "—";

  return (
    <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
      {/* Verification badge */}
      <div
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 border text-[6px] font-black uppercase tracking-widest",
          isVerified
            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
            : "border-orange-400/30 text-orange-400 bg-orange-400/5"
        )}
      >
        {isVerified ? (
          <ShieldCheck className="w-2 h-2" />
        ) : (
          <ShieldAlert className="w-2 h-2" />
        )}
        {isVerified ? "Identity Verified" : "Unverified"}
      </div>

      {/* ACELOGIC ID */}
      <div className="flex items-center gap-1">
        <span className="text-[6px] font-black uppercase text-slate-700 tracking-widest w-14 shrink-0">
          ACELOGIC:
        </span>
        <span className="text-[7px] font-mono text-cyan-400/80 truncate">
          {shortId}
        </span>
      </div>

      {/* Fingerprint */}
      <div className="flex items-center gap-1">
        <Fingerprint className="w-2 h-2 text-purple-400/60 shrink-0" />
        <span className="text-[7px] font-mono text-purple-400/80 truncate">
          {shortFp}
        </span>
      </div>
    </div>
  );
}
