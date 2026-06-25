"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AboutContent from "@/components/AboutContent";

export default function LearnMorePage() {
  return (
    <div className="min-h-screen bg-transparent text-white tech-grid scanline">
      {/* Top nav bar */}
      <header className="w-full z-20 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/5 bg-[#05070a]/80 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 hover:border-cyan-500/50 text-cyan-400 font-black text-[9px] md:text-[11px] uppercase tracking-[0.25em] transition-all scifi-clip cursor-target"
        >
          <ArrowLeft className="w-3 h-3" />
          BACK
        </Link>

        <div className="hidden sm:flex items-center gap-3">
          <img
            src="/ace-symbol.png"
            alt="ACEPLACE Symbol"
            className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]"
          />
          <span className="text-sm font-mono font-black tracking-[0.3em] text-cyan-400 uppercase">
            ACEPLACE <span className="text-white">WORKSTATION</span>
          </span>
        </div>

        <Link
          href="/dashboard"
          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[9px] md:text-[11px] uppercase tracking-[0.15em] md:tracking-[0.25em] transition-all scifi-clip cursor-target whitespace-nowrap"
        >
          <span className="hidden sm:inline">ACCESS WORKSTATION</span>
          <span className="sm:hidden">ACCESS</span>
        </Link>
      </header>

      {/* Page content */}
      <main>
        {/* Decorative side lines */}
        <div className="pointer-events-none fixed top-0 bottom-0 left-10 md:left-20 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent -z-10" />
        <div className="pointer-events-none fixed top-0 bottom-0 right-10 md:right-20 w-[1px] bg-gradient-to-b from-transparent via-purple-500/10 to-transparent -z-10" />

        <AboutContent />

        {/* Bottom CTA */}
        <section className="border-t border-white/5 bg-[#05070a]">
          <div className="flex flex-col items-center gap-6 py-20">
            <Link
              href="/dashboard"
              className="px-16 py-6 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xl uppercase tracking-[0.2em] transition-all shadow-[0_0_50px_rgba(6,182,212,0.3)] hover:shadow-[0_0_70px_rgba(6,182,212,0.6)] active:scale-95 scifi-clip cursor-target"
            >
              Access Workstation
            </Link>
            <div className="flex items-center gap-4 text-slate-600 font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Control Protocol v1.0.5-Delta Active
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
