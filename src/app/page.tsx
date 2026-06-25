"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  Eye,
  Shield,
  Zap,
  ChevronDown,
  Activity,
  Lock,
  Layers,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Tiny animated counter for the "stat" numbers
───────────────────────────────────────────── */
function AnimatedCounter({
  target,
  suffix = "",
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setValue(Math.floor(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    const delay = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 400);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return (
    <span>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Intersection observer helper hook
───────────────────────────────────────────── */
function useVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─────────────────────────────────────────────
   Section wrapper with fade+slide-up
───────────────────────────────────────────── */
function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useVisible();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DATA
═══════════════════════════════════════════ */
const FLOW_STEPS = [
  {
    label: "ACELOGIC™",
    sub: "Deterministic Identity",
    color: "cyan",
    icon: Lock,
  },
  {
    label: "ACEAGENT™",
    sub: "Canonical Digital Worker",
    color: "purple",
    icon: Activity,
  },
  {
    label: "ACEPLACE™",
    sub: "Governed Execution",
    color: "cyan",
    icon: Layers,
  },
  { label: "Autonomous Work", sub: "AI-Driven Operations", color: "blue", icon: Zap },
  { label: "Human Oversight", sub: "Accountability Layer", color: "emerald", icon: Eye },
];

const PROVIDERS = [
  { name: "OpenAI", tag: "GPT-4o" },
  { name: "Anthropic", tag: "Claude" },
  { name: "Google Gemini", tag: "Flash / Pro" },
  { name: "Azure OpenAI", tag: "Enterprise" },
  { name: "NVIDIA NIM", tag: "Inference" },
  { name: "Groq", tag: "Ultra-Fast" },
  { name: "OpenRouter", tag: "Multi-Model" },
  { name: "Private Endpoints", tag: "Self-Hosted" },
];

const TELEMETRY = [
  {
    icon: Zap,
    color: "cyan",
    title: "Runtime Operations",
    items: [
      "Token usage per ACEAGENT™",
      "Runtime request counts",
      "Execution cost estimates",
      "Orchestration activity",
      "Provider health status",
    ],
  },
  {
    icon: Database,
    color: "purple",
    title: "Identity & Continuity",
    items: [
      "Identity verification events",
      "Continuity records",
      "Agent lifecycle history",
      "Cross-session identity restoration",
      "Authority lease activity",
    ],
  },
  {
    icon: Shield,
    color: "emerald",
    title: "Governance & Accountability",
    items: [
      "Governance approval metrics",
      "Execution trace volume",
      "Artifact lineage tracking",
      "Execution audit trails",
      "Human review history",
    ],
  },
  {
    icon: Eye,
    color: "blue",
    title: "Agent Activity Intelligence",
    items: [
      "See which ACEAGENT™ performed each task",
      "View execution timestamps for every action",
      "Track task ownership across workflows",
      "Review agent decision history",
      "Trace artifacts back to originating agents",
    ],
  },
];

const STATS = [
  { value: 100, suffix: "%", label: "Deterministic Identity" },
  { value: 360, suffix: "°", label: "Governance Coverage" },
  { value: 0, suffix: " Gaps", label: "In Audit Trails" },
];

const COLOR_MAP: Record<string, { border: string; text: string; bg: string; dot: string; glow: string }> = {
  cyan: {
    border: "rgba(6,182,212,0.25)",
    text: "rgb(34,211,238)",
    bg: "rgba(6,182,212,0.06)",
    dot: "rgb(6,182,212)",
    glow: "rgba(6,182,212,0.15)",
  },
  purple: {
    border: "rgba(168,85,247,0.25)",
    text: "rgb(196,148,255)",
    bg: "rgba(168,85,247,0.06)",
    dot: "rgb(168,85,247)",
    glow: "rgba(168,85,247,0.15)",
  },
  emerald: {
    border: "rgba(16,185,129,0.25)",
    text: "rgb(52,211,153)",
    bg: "rgba(16,185,129,0.06)",
    dot: "rgb(16,185,129)",
    glow: "rgba(16,185,129,0.15)",
  },
  blue: {
    border: "rgba(59,130,246,0.25)",
    text: "rgb(96,165,250)",
    bg: "rgba(59,130,246,0.06)",
    dot: "rgb(59,130,246)",
    glow: "rgba(59,130,246,0.15)",
  },
};

/* ═══════════════════════════════════════════
   PAGE
═══════════════════════════════════════════ */
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setHeroReady(true), 100);
    const RELOAD_INTERVAL = 5 * 60 * 1000;
    const interval = setInterval(() => window.location.reload(), RELOAD_INTERVAL);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-transparent" suppressHydrationWarning />;
  }

  return (
    <div
      className="min-h-screen bg-transparent text-white tech-grid scanline"
      suppressHydrationWarning
    >
      {/* ── FIXED NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/[0.04] backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <img
            src="/ace-symbol.png"
            alt="ACEPLACE"
            className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
          />
          <span className="font-black text-white text-sm tracking-tight italic hidden sm:block">
            ACEPLACE <span className="text-cyan-500">WORKSTATION</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/learn-more"
            className="px-4 py-1.5 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 hover:border-cyan-500/50 text-cyan-400 font-black text-[10px] uppercase tracking-[0.25em] transition-all scifi-clip cursor-target"
          >
            Learn More
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] uppercase tracking-[0.25em] transition-all scifi-clip cursor-target shadow-[0_0_20px_rgba(6,182,212,0.25)]"
          >
            Workstation
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
        {/* ambient blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute rounded-full blur-[180px] animate-pulse"
            style={{
              width: 700,
              height: 700,
              background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -55%)",
            }}
          />
          <div
            className="absolute rounded-full blur-[220px]"
            style={{
              width: 400,
              height: 400,
              background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
              top: "30%",
              right: "-10%",
            }}
          />
          <div
            className="absolute rounded-full blur-[200px]"
            style={{
              width: 350,
              height: 350,
              background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)",
              bottom: "15%",
              left: "-5%",
            }}
          />
        </div>

        {/* vertical accent lines */}
        <div className="absolute top-0 bottom-0 left-12 md:left-24 w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent -z-10" />
        <div className="absolute top-0 bottom-0 right-12 md:right-24 w-px bg-gradient-to-b from-transparent via-purple-500/8 to-transparent -z-10" />

        <div className="max-w-5xl w-full mx-auto text-center space-y-10">
          {/* brand equation */}
          <div
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(-12px)",
              transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
            }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-white/10 bg-white/[0.03] rounded-sm mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-slate-500">
                Control Protocol v1.0.5-Delta Active
              </span>
            </div>
          </div>

          {/* LOGO + TITLE */}
          <div
            className="flex flex-col items-center gap-5"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "scale(1)" : "scale(0.94)",
              transition: "opacity 0.9s ease 0.2s, transform 0.9s ease 0.2s",
            }}
          >
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: "rgba(6,182,212,0.2)", transform: "scale(1.8)" }}
              />
              <img
                src="/ace-symbol.png"
                alt="ACEPLACE Symbol"
                className="relative w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:scale-110 transition-transform duration-500 cursor-target"
              />
            </div>

            <div className="space-y-2">
              <h1 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter leading-none">
                ACEPLACE{" "}
                <span
                  className="text-cyan-500"
                  style={{ textShadow: "0 0 40px rgba(6,182,212,0.4)" }}
                >
                  WORKSTATION
                </span>
              </h1>
              <p className="text-cyan-500/50 font-mono text-[10px] md:text-[11px] tracking-[0.45em] uppercase font-black">
                Dimensional Control Plane
              </p>
            </div>
          </div>

          {/* brand stack */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
            style={{
              opacity: heroReady ? 1 : 0,
              transition: "opacity 0.8s ease 0.4s",
            }}
          >
            {["ACELOGIC™", "ACEAGENTS™", "ACEPLACE™"].map((brand, i) => (
              <React.Fragment key={brand}>
                {i > 0 && (
                  <span className="text-cyan-500/30 font-black text-xl select-none">+</span>
                )}
                <span className="font-black text-base md:text-lg tracking-wide text-white/90 hover:text-white transition-colors">
                  {brand}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* headline */}
          <div
            className="space-y-4"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s",
            }}
          >
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight max-w-2xl mx-auto leading-snug">
              <span className="text-white">Deterministic Agent Identity</span>
              <span className="text-slate-600"> to </span>
              <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                Governed Autonomous Execution
              </span>
            </h2>
            <p className="text-sm md:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
              Every agent you create has a{" "}
              <span className="text-slate-300 font-semibold">persistent identity</span>. Every
              action is <span className="text-slate-300 font-semibold">governed</span>. Every
              outcome remains{" "}
              <span className="text-cyan-400 font-semibold">accountable</span>.
            </p>
          </div>

          {/* CTA row */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.8s ease 0.65s, transform 0.8s ease 0.65s",
            }}
          >
            <Link
              href="/dashboard"
              className="group relative overflow-hidden px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm uppercase tracking-[0.25em] transition-all scifi-clip flex items-center gap-3 cursor-target shadow-[0_0_60px_rgba(6,182,212,0.35)] hover:shadow-[0_0_80px_rgba(6,182,212,0.55)] active:scale-95"
            >
              <span className="relative z-10">Access Workstation</span>
              <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              {/* shimmer */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </Link>
            <Link
              href="/learn-more"
              className="px-10 py-4 border border-cyan-500/35 bg-cyan-500/5 hover:bg-cyan-500/12 hover:border-cyan-500/55 text-cyan-400 font-black text-sm uppercase tracking-[0.25em] transition-all scifi-clip flex items-center gap-3 cursor-target"
            >
              Learn More
            </Link>
          </div>

          {/* scroll hint */}
          <div
            className="flex justify-center pt-4"
            style={{
              opacity: heroReady ? 0.4 : 0,
              transition: "opacity 1s ease 1.2s",
            }}
          >
            <ChevronDown className="w-4 h-4 text-cyan-500 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          EXECUTION FLOW
      ════════════════════════════════════════ */}
      <section className="relative py-24 px-6 border-t border-white/[0.04] overflow-hidden">
        {/* faint section glow */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[1px]"
          style={{ background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.2),transparent)" }}
        />

        <div className="max-w-5xl mx-auto">
          <RevealSection className="text-center space-y-2 mb-16">
            <p className="text-[10px] font-mono uppercase tracking-[0.45em] text-cyan-500/50">
              Execution Architecture
            </p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              The{" "}
              <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                ACEPLACE™
              </span>{" "}
              Stack
            </h2>
          </RevealSection>

          {/* flow steps — horizontal on md+ */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-0">
            {FLOW_STEPS.map((step, i) => {
              const c = COLOR_MAP[step.color];
              const Icon = step.icon;
              return (
                <React.Fragment key={step.label}>
                  <RevealSection delay={i * 100} className="flex flex-col items-center">
                    <div
                      className="relative group cursor-target scifi-clip px-6 py-5 text-center transition-all duration-300 min-w-[150px]"
                      style={{
                        background: c.bg,
                        border: `1px solid ${c.border}`,
                        boxShadow: `0 0 0 transparent`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${c.glow}`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 transparent";
                      }}
                    >
                      <div
                        className="w-8 h-8 mx-auto mb-2 flex items-center justify-center rounded-sm"
                        style={{ background: c.bg, border: `1px solid ${c.border}` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: c.text }} />
                      </div>
                      <p className="text-[11px] md:text-xs font-black uppercase tracking-[0.2em] text-white">
                        {step.label}
                      </p>
                      <p
                        className="text-[9px] font-mono uppercase tracking-widest mt-0.5"
                        style={{ color: c.text, opacity: 0.7 }}
                      >
                        {step.sub}
                      </p>
                      {/* scanning line */}
                      <span
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none tech-scanline"
                        style={{ borderRadius: 0 }}
                      />
                    </div>
                  </RevealSection>

                  {i < FLOW_STEPS.length - 1 && (
                    <RevealSection
                      delay={i * 100 + 60}
                      className="flex md:flex-row flex-col items-center"
                    >
                      {/* Animated energy bar */}
                      <div className="hidden md:block h-px w-10 relative overflow-hidden">
                        <div
                          className="absolute inset-0"
                          style={{ background: "rgba(6,182,212,0.15)" }}
                        />
                        <div className="absolute inset-y-0 w-4 animate-energy-flow" />
                      </div>
                      {/* vertical on mobile */}
                      <div className="md:hidden flex flex-col items-center py-2">
                        <div
                          className="w-px h-6"
                          style={{ background: "rgba(6,182,212,0.2)" }}
                        />
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ background: "rgba(6,182,212,0.6)" }}
                        />
                      </div>
                    </RevealSection>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          STATS BAR
      ════════════════════════════════════════ */}
      <section className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto">
          <RevealSection>
            <div className="grid grid-cols-3 gap-px overflow-hidden scifi-clip" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="text-center py-8 px-4 glass"
                style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <p className="text-3xl md:text-4xl font-black text-cyan-400 tabular-nums"
                  style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-600 mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          WHAT IS AN ACEAGENT™?
      ════════════════════════════════════════ */}
      <section className="relative py-24 px-6 border-t border-white/[0.04] overflow-hidden">
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] blur-[160px] -z-10 rounded-full"
          style={{ background: "rgba(168,85,247,0.05)" }}
        />

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: heading */}
            <RevealSection className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.45em] text-cyan-500/50">
                  Core Concept
                </p>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
                  What is an{" "}
                  <span
                    className="text-cyan-400"
                    style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}
                  >
                    ACEAGENT™?
                  </span>
                </h2>
              </div>
              <p className="text-sm text-slate-400 leading-loose">
                Agents created through{" "}
                <span className="text-cyan-400 font-black">ACELOGIC™</span> are known
                as <span className="text-white font-black">ACEAGENTS™</span>—canonical
                digital workers with{" "}
                <span className="text-slate-200">deterministic identity</span>,
                continuity, and governance throughout their lifecycle.
              </p>
              <p className="text-sm text-slate-500 leading-loose">
                Unlike traditional AI agents that are instantiated, perform a task, and
                disappear, <span className="text-white font-semibold">ACEAGENTS™</span>{" "}
                maintain persistent identity, accountability, and operational continuity
                across governed autonomous work.
              </p>
            </RevealSection>

            {/* Right: feature pills */}
            <RevealSection delay={150} className="space-y-3">
              {[
                { label: "Persistent Identity", desc: "Survives across sessions and restarts", color: "cyan" },
                { label: "Deterministic Governance", desc: "Every decision is traceable and auditable", color: "purple" },
                { label: "Operational Continuity", desc: "No vanishing state, no orphaned tasks", color: "emerald" },
                { label: "Full Lifecycle History", desc: "From creation to retirement, nothing is lost", color: "blue" },
              ].map((feat, i) => {
                const c = COLOR_MAP[feat.color];
                return (
                  <div
                    key={feat.label}
                    className="group flex items-start gap-4 p-4 scifi-clip transition-all duration-300 cursor-target"
                    style={{
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${c.glow}`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: c.dot }}
                    />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.15em]" style={{ color: c.text }}>
                        {feat.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          BRING YOUR OWN LLM
      ════════════════════════════════════════ */}
      <section className="relative py-24 px-6 border-t border-white/[0.04] overflow-hidden">
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-px h-full -z-10"
          style={{ background: "linear-gradient(to bottom, transparent, rgba(6,182,212,0.08), transparent)" }}
        />

        <div className="max-w-5xl mx-auto space-y-12 text-center">
          <RevealSection className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.45em] text-cyan-500/50">
              Model Agnostic
            </p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Bring Your Own{" "}
              <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                LLM
              </span>
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
              Your Models. Your Costs. Your Choice.
            </p>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed pt-2">
              <span className="text-white font-semibold">ACEPLACE™</span> is model-agnostic.
              Connect your own provider accounts while ACEPLACE™ governs execution.
            </p>
          </RevealSection>

          {/* provider grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PROVIDERS.map((p, i) => (
              <RevealSection key={p.name} delay={i * 50}>
                <div
                  className="group glass scifi-clip p-4 text-center cursor-target transition-all duration-300 h-full"
                  style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(6,182,212,0.25)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(6,182,212,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-200 group-hover:text-white transition-colors">
                    {p.name}
                  </p>
                  <p className="text-[9px] font-mono text-cyan-500/50 mt-0.5 uppercase tracking-wider">
                    {p.tag}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>

          {/* mini flow */}
          <RevealSection delay={200} className="flex flex-col items-center gap-2 pt-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.4em] text-slate-600">
              All providers route through
            </p>
            <div
              className="scifi-clip px-10 py-4 text-center animate-breathing"
              style={{
                background: "rgba(6,182,212,0.06)",
                border: "1px solid rgba(6,182,212,0.25)",
              }}
            >
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-400"
                style={{ textShadow: "0 0 12px rgba(6,182,212,0.3)" }}>
                ACEPLACE™ — Governed Execution Layer
              </p>
              <p className="text-[9px] font-mono text-cyan-500/50 mt-0.5 uppercase tracking-widest">
                ACEPLACE™ governs execution. You control inference.
              </p>
            </div>
            <p className="text-[9px] font-mono uppercase tracking-[0.4em] text-slate-600">
              Billing goes directly to your provider
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          TELEMETRY
      ════════════════════════════════════════ */}
      <section className="relative py-24 px-6 border-t border-white/[0.04] overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.04) 0%, transparent 60%)",
          }}
        />

        <div className="max-w-5xl mx-auto space-y-12">
          <RevealSection className="text-center space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.45em] text-cyan-500/50">
              Observability
            </p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Real-Time Telemetry &{" "}
              <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                Continuity Records
              </span>
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Visibility across your governed autonomous workforce.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TELEMETRY.map((card, i) => {
              const c = COLOR_MAP[card.color];
              const Icon = card.icon;
              return (
                <RevealSection key={card.title} delay={i * 80}>
                  <div
                    className="group glass scifi-clip p-6 space-y-5 transition-all duration-300 cursor-target h-full"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = c.border;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${c.glow}`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    {/* header */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 scifi-clip flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300"
                        style={{ background: c.bg, border: `1px solid ${c.border}` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: c.text }} />
                      </div>
                      <p
                        className="text-[11px] font-black uppercase tracking-[0.25em]"
                        style={{ color: c.text }}
                      >
                        {card.title}
                      </p>
                    </div>

                    {/* items */}
                    <ul className="space-y-2.5">
                      {card.items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span
                            className="w-1 h-1 rounded-full mt-2 shrink-0"
                            style={{ background: c.dot }}
                          />
                          <span className="text-[11px] text-slate-400 leading-relaxed uppercase tracking-wide">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </RevealSection>
              );
            })}
          </div>

          {/* closing callout */}
          <RevealSection delay={200}>
            <div
              className="scifi-clip p-6 md:p-8 text-center relative overflow-hidden"
              style={{
                background: "rgba(6,182,212,0.04)",
                border: "1px solid rgba(6,182,212,0.12)",
              }}
            >
              {/* inner glow line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.3),transparent)" }}
              />
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
                Every action performed within{" "}
                <span className="text-white font-semibold">ACEPLACE</span> is traceable
                to a deterministic{" "}
                <span
                  className="text-cyan-400 font-semibold"
                  style={{ textShadow: "0 0 10px rgba(6,182,212,0.3)" }}
                >
                  ACEAGENT™
                </span>{" "}
                identity, creating a complete continuity record across execution,
                governance, and artifact generation.
              </p>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER CTA
      ════════════════════════════════════════ */}
      <section className="relative py-24 px-6 border-t border-white/[0.04] overflow-hidden text-center">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(6,182,212,0.07) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.15),transparent)",
          }}
        />

        <RevealSection className="space-y-8">
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.45em] text-cyan-500/50">
              Get Started
            </p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Ready to Deploy{" "}
              <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                Governed Agents?
              </span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Link
              href="/learn-more"
              className="px-10 py-4 border border-cyan-500/35 bg-cyan-500/5 hover:bg-cyan-500/12 hover:border-cyan-500/55 text-cyan-400 font-black text-sm uppercase tracking-[0.25em] transition-all scifi-clip flex items-center gap-3 cursor-target"
            >
              Learn More
            </Link>
            <Link
              href="/dashboard"
              className="group relative overflow-hidden px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm uppercase tracking-[0.25em] transition-all scifi-clip flex items-center gap-3 cursor-target shadow-[0_0_60px_rgba(6,182,212,0.35)] hover:shadow-[0_0_80px_rgba(6,182,212,0.55)] active:scale-95"
            >
              <span className="relative z-10">Access Workstation</span>
              <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 text-slate-700 font-mono text-[10px] uppercase tracking-[0.2em]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ACEPLACE™ · ACELOGIC™ · ACEAGENTS™ · All rights reserved.</span>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
