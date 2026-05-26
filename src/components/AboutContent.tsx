"use client";

import React from "react";
import {
  Shield,
  Cpu,
  GitBranch,
  Lock,
  Layers,
  Activity,
  Database,
  FileText,
  CheckCircle,
  ArrowRight,
  Zap,
  Server,
} from "lucide-react";

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-cyan-500/60 uppercase">{label}</span>
      <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1 italic">{title}</h2>
      <div className="h-[1px] bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent mt-3" />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  items,
  accent = "cyan",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  accent?: string;
}) {
  const color =
    accent === "purple"
      ? "text-purple-400 border-purple-500/20 bg-purple-500/5"
      : "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
  const dot = accent === "purple" ? "bg-purple-500" : "bg-cyan-500";
  return (
    <div className={`border rounded-none p-5 ${color} relative`}>
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-60" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-60" />
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-slate-400 text-xs font-mono">
            <span className={`w-1 h-1 rounded-full ${dot} mt-1.5 shrink-0`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowStep({ step, label, desc }: { step: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-none border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-[10px] font-black font-mono shrink-0">
          {step}
        </div>
        <div className="w-[1px] h-full bg-cyan-500/10 mt-1" />
      </div>
      <div className="pb-6">
        <div className="text-[11px] font-black uppercase tracking-widest text-cyan-400 italic">{label}</div>
        <div className="text-slate-400 text-xs font-mono mt-1 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function ArchPlane({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className={`border ${color} p-4 relative`}>
      <div className="text-[10px] font-black font-mono tracking-[0.25em] uppercase mb-3 opacity-70">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 text-slate-300">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AboutContent() {
  return (
    <>
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-6xl mx-auto px-8 py-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/60 uppercase">
              ACEPLACE // Runtime Documentation
            </span>
          </div>
          <div className="flex items-start gap-6">
            <div className="w-1 h-20 bg-gradient-to-b from-cyan-500 to-purple-500 shrink-0" />
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter italic text-white leading-none">
                ABOUT ACEPLACE
              </h1>
              <p className="text-cyan-400 text-sm font-mono tracking-[0.2em] uppercase mt-3">
                Deterministic Runtime Infrastructure For Autonomous Systems
              </p>
              <p className="text-slate-400 text-sm leading-relaxed mt-4 max-w-3xl font-mono">
                ACEPLACE (Agent Continuity Execution Place) is a deterministic autonomous runtime environment — not a
                chatbot, not a workflow toy. It is identity-bound, envelope-driven, authority-controlled execution
                infrastructure built for governed multi-agent orchestration at scale.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            {[
              "Deterministic Runtime",
              "Execution Envelopes",
              "Authority Leases",
              "Stateless Agents",
              "Firestore Persistence",
              "Traceable Execution",
            ].map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono font-bold tracking-widest uppercase border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 px-3 py-1"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12 space-y-20">
        <section>
          <SectionHeader label="01 // Positioning" title="What Is ACEPLACE" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-red-500/15 bg-red-500/5 p-6">
              <div className="text-[10px] font-mono font-black tracking-[0.25em] text-red-400 mb-4">ACEPLACE IS NOT</div>
              {[
                "A chatbot framework",
                "A workflow toy",
                "A generic orchestration app",
                "A simple AI wrapper",
                "An autonomous chat agent system",
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-500 text-xs font-mono py-1.5 border-b border-white/5">
                  <span className="text-red-500/60">✕</span> {t}
                </div>
              ))}
            </div>
            <div className="border border-cyan-500/20 bg-cyan-500/5 p-6">
              <div className="text-[10px] font-mono font-black tracking-[0.25em] text-cyan-400 mb-4">ACEPLACE IS</div>
              {[
                "Deterministic runtime infrastructure",
                "Identity-bound execution system",
                "Authority-controlled execution runtime",
                "Envelope-driven execution platform",
                "Traceable multi-agent runtime",
                "Structured execution infrastructure",
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300 text-xs font-mono py-1.5 border-b border-white/5">
                  <span className="text-cyan-400">✓</span> {t}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 border border-white/5 bg-white/2 p-5">
            <p className="text-slate-400 font-mono text-xs leading-relaxed">
              <span className="text-cyan-400 font-black">Canonical Runtime Law: </span>
              Agents are stateless. The envelope holds state. Execution flows as:&nbsp;
              <span className="text-white font-black">Execution Envelope → Runtime Worker → Agent Engine</span>
            </p>
          </div>
        </section>

        <section>
          <SectionHeader label="02 // Architecture" title="Three-Plane Architecture" />
          <div className="space-y-3">
            <ArchPlane
              label="Control Plane — ACELOGIC "
              items={[
                "Identity Authority",
                "Lease Issuance",
                "Agent Verification",
                "Fingerprint Validation",
                "Orchestration Governance",
              ]}
              color="border-purple-500/25"
            />
            <div className="flex justify-center">
              <ArrowRight className="text-slate-600 w-4 h-4 rotate-90" />
            </div>
            <ArchPlane
              label="Execution Plane — Runtime Worker"
              items={[
                "Envelope Dispatch",
                "Step Sequencing",
                "Lease Validation",
                "State Transitions",
                "Trace Persistence",
              ]}
              color="border-cyan-500/25"
            />
            <div className="flex justify-center">
              <ArrowRight className="text-slate-600 w-4 h-4 rotate-90" />
            </div>
            <ArchPlane
              label="Compute Plane — Agent Engines"
              items={["COO (Planner)", "Researcher (Analyst)", "Worker (Executor)", "Grader (Evaluator)", "BYO-LLM Providers"]}
              color="border-emerald-500/25"
            />
          </div>
        </section>

        <section>
          <SectionHeader label="03 // Core Capabilities" title="Runtime Feature Set" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard
              icon={Shield}
              title="Identity Verification"
              items={[
                "Deterministic agent fingerprints",
                "ACELOGIC identity authority",
                "Purpose hashes",
                "Persistent orchestration roles",
                "Runtime continuity preserved",
              ]}
            />
            <InfoCard
              icon={Lock}
              title="Authority Lease System"
              items={[
                "Lease required before each step",
                "Expires after completion",
                "New lease issued per valid state",
                "Prevents uncontrolled execution",
                "Enforces deterministic sequencing",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={Layers}
              title="Execution Envelopes"
              items={[
                "Runtime source of truth",
                "Holds all execution state",
                "Immutable except runtime fields",
                "Contains traces & artifacts",
                "Lease validation state",
              ]}
            />
            <InfoCard
              icon={Activity}
              title="Execution Traceability"
              items={[
                "Agent identity per step",
                "Timestamps on every action",
                "Orchestration transitions logged",
                "Grading events captured",
                "Artifact lineage maintained",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={Database}
              title="Firestore Persistence"
              items={[
                "Envelope state persisted",
                "Execution traces stored",
                "Agent identities maintained",
                "Artifact lineage archived",
                "Cross-session continuity",
              ]}
            />
            <InfoCard
              icon={Cpu}
              title="Stateless Agent Model"
              items={[
                "Agents hold no internal state",
                "All state lives in envelope",
                "Deterministic across sessions",
                "No random replacement agents",
                "Continuity via persistence layer",
              ]}
              accent="purple"
            />
          </div>
        </section>

        <section>
          <SectionHeader label="04 // Runtime Lifecycle" title="Execution Flow" />
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <FlowStep
                step="01"
                label="Envelope Initialization"
                desc="Task deployed. Execution envelope created with full context: grounding, instructions, constraints, participating agents."
              />
              <FlowStep
                step="02"
                label="Identity Verification"
                desc="ACELOGIC verifies all agent identities. Fingerprints validated. Orchestration roles confirmed."
              />
              <FlowStep
                step="03"
                label="Authority Lease Acquisition"
                desc="Runtime-worker requests execution lease from control plane. Lease grants authorization for the next step only."
              />
              <FlowStep
                step="04"
                label="Deterministic Execution Dispatch"
                desc="Runtime-worker dispatches the appropriate stateless agent engine. Agent reads envelope state, executes, writes result back."
              />
            </div>
            <div>
              <FlowStep
                step="05"
                label="Lease Expiry & Validation"
                desc="Lease expires after step completion. Runtime validates transition to next state before issuing new lease."
              />
              <FlowStep
                step="06"
                label="Artifact Generation"
                desc="Worker agent produces deliverable artifacts. Grader agent evaluates quality, correctness, and compliance."
              />
              <FlowStep
                step="07"
                label="Trace Persistence"
                desc="All execution events, timestamps, agent actions, and transitions written to Firestore trace store."
              />
              <FlowStep
                step="08"
                label="Human-in-the-Loop"
                desc="Artifact enters human review. User approves or denies. Runtime does not autonomously finalize outputs."
              />
            </div>
          </div>
        </section>

        <section>
          <SectionHeader label="05 // Pre-Connected Agents" title="Deterministic Agent Fleet" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                role: "COO",
                fn: "Planner",
                desc: "Orchestrates task decomposition, step sequencing, and execution strategy.",
              },
              {
                role: "Researcher",
                fn: "Analyst",
                desc: "Retrieves external information, validates claims, synthesizes research via web search.",
              },
              {
                role: "Worker",
                fn: "Executor",
                desc: "Produces artifacts, generates reports, and implements execution deliverables.",
              },
              {
                role: "Grader",
                fn: "Evaluator",
                desc: "Deterministically evaluates output quality, correctness, and runtime compliance.",
              },
            ].map((a) => (
              <div key={a.role} className="border border-white/8 bg-white/2 p-5 relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20" />
                <div className="text-[10px] font-mono text-slate-600 mb-1 uppercase tracking-widest">{a.fn}</div>
                <div className="text-xl font-black uppercase italic text-white mb-2">{a.role}</div>
                <p className="text-slate-400 text-xs font-mono leading-relaxed">{a.desc}</p>
                <div className="mt-3 text-[10px] font-mono text-slate-600">Stateless · Identity-Bound · Persistent</div>
              </div>
            ))}
          </div>
          <div className="mt-4 border border-white/5 bg-white/2 p-4">
            <p className="text-slate-400 font-mono text-xs">
              <span className="text-cyan-400 font-black">Session Continuity: </span>
              If the system powers off, disconnects, or restarts — the same deterministic agents are restored. The runtime
              does not generate random replacement agents.
            </p>
          </div>
        </section>

        <section>
          <SectionHeader label="06 // Governance Model" title="Runtime Governance" />
          <div className="grid md:grid-cols-3 gap-4">
            <InfoCard
              icon={GitBranch}
              title="#us# Protocol"
              items={[
                "Structured execution protocol",
                "Enforced at runtime layer",
                "Governs inter-agent messaging",
                "Deterministic and auditable",
                "Protocol compliance required",
              ]}
            />
            <InfoCard
              icon={CheckCircle}
              title="Human-in-the-Loop"
              items={[
                "Artifacts not auto-finalized",
                "User approves or denies",
                "Review before acceptance",
                "Continuation workflows (coming)",
                "Redeploy on denial",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={FileText}
              title="Artifact Persistence"
              items={[
                "PDF export supported",
                "Execution lineage archived",
                "Trace-linked sourcing",
                "Grading history preserved",
                "Portable operational deliverables",
              ]}
            />
          </div>
        </section>

        <section>
          <SectionHeader label="07 // Inference" title="Bring Your Own LLM" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <p className="text-slate-400 font-mono text-xs leading-relaxed">
                ACEPLACE uses BYO-LLM architecture. Connect your own provider API keys. All inference costs are billed
                directly to your configured provider account.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {["OpenAI", "Anthropic", "Gemini", "OpenRouter", "Private Endpoints"].map((p) => (
                  <span key={p} className="text-[10px] font-mono border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <InfoCard
              icon={Server}
              title="Dashboard Telemetry"
              items={[
                "Token usage per agent",
                "Runtime request counts",
                "Execution cost estimates",
                "Orchestration activity",
                "Provider health status",
              ]}
              accent="purple"
            />
          </div>
        </section>

        <section>
          <div className="border border-cyan-500/20 bg-cyan-500/5 p-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/60" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/60" />
            <div className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/60 uppercase mb-2">Current Runtime Mode</div>
            <div className="text-2xl font-black uppercase italic text-cyan-400 mb-4">
              Developer Sandbox · Public Runtime Preview
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <ul className="space-y-1">
                {[
                  "Pre-created deterministic agents",
                  "NXQ-hosted runtime infrastructure",
                  "BYO-LLM execution",
                  "Deterministic orchestration",
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <Zap className="w-3 h-3 text-cyan-500/60" />
                    {t}
                  </li>
                ))}
              </ul>
              <ul className="space-y-1">
                {[
                  "Execution trace persistence",
                  "Grading workflows",
                  "Human approval governance",
                  "Runtime observability",
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <Zap className="w-3 h-3 text-cyan-500/60" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
