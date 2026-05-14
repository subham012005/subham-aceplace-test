"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Shield, Globe, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 5 minutes = 300,000 ms
    const RELOAD_INTERVAL = 5 * 60 * 1000;

    const interval = setInterval(() => {
      window.location.reload();
    }, RELOAD_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-transparent" suppressHydrationWarning />;
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8 tech-grid scanline overflow-hidden" suppressHydrationWarning>
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/10 blur-[150px] rounded-full -z-10 animate-pulse" />

      <div className="max-w-4xl w-full space-y-12 text-center animate-in fade-in zoom-in duration-1000">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-1000">
            <img src="/ace-symbol.png" alt="ACEPLACE Symbol" className="w-32 h-32 object-contain drop-shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-500 hover:scale-110 hover:drop-shadow-[0_0_40px_rgba(6,182,212,0.6)] cursor-target" />
            <div className="flex flex-col items-center">
              <h1 className="text-6xl md:text-8xl font-black text-white italic tracking-tighter text-center">
                ACEPLACE <span className="text-cyan-500">WORKSTATION</span>
              </h1>
              <p className="text-cyan-500/60 font-mono text-[11px] md:text-sm tracking-[0.4em] font-black uppercase mt-2">Dimensional Control Plane</p>
            </div>
          </div>

          <h2 className="text-lg md:text-xl text-slate-400 font-bold max-w-2xl mx-auto leading-relaxed uppercase tracking-tight italic">
            Human governance for autonomous agents with <span className="text-white">deterministic identity</span> and <span className="text-cyan-500">high-fidelity orchestration</span>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto px-4">
          {[
            { icon: Shield, title: "Governance", desc: "Strict human-in-the-loop approval workflows.", color: "text-cyan-400" },
            { icon: Zap, title: "Agility", desc: "Fast agent dispatch and real-time lifecycle tracking.", color: "text-purple-400" },
            { icon: Globe, title: "Persistence", desc: "Identity persistence and state synchronization across nodes.", color: "text-blue-400" }
          ].map((feature) => (
            <div key={feature.title} className="glass p-8 scifi-clip border border-white/5 space-y-4 group hover:border-white/20 transition-all cursor-target">
              <div className="w-12 h-12 scifi-clip bg-white/5 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <feature.icon className={cn("w-6 h-6", feature.color)} />
              </div>
              <p className="text-[11px] uppercase font-black tracking-[0.2em] text-cyan-500/50">{feature.title}</p>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed uppercase tracking-tight">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-8">
          <Link
            href="/dashboard"
            className="group px-16 py-6 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xl uppercase tracking-[0.2em] transition-all shadow-[0_0_50px_rgba(6,182,212,0.3)] hover:shadow-[0_0_70px_rgba(6,182,212,0.6)] active:scale-95 scifi-clip flex items-center gap-3 cursor-target"
          >
            Access Workstation
          </Link>
          <div className="flex items-center gap-4 text-slate-600 font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Control Protocol v1.0.5-Delta Active
          </div>
        </div>
      </div>

      {/* Decorative Technical Lines */}
      <div className="absolute top-0 bottom-0 left-10 md:left-20 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent -z-10" />
      <div className="absolute top-0 bottom-0 right-10 md:right-20 w-[1px] bg-gradient-to-b from-transparent via-purple-500/10 to-transparent -z-10" />
      <div className="absolute top-10 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent -z-10" />
    </div>
  );
}
