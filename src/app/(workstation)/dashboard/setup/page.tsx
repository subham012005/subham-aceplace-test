"use client";

import React, { useState } from "react";
import { CheckCircle, ChevronDown, ChevronRight, Terminal, AlertTriangle, Zap, ArrowRight, BookOpen } from "lucide-react";

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-cyan-500/60 uppercase">{label}</span>
      <h2 className="text-xl font-black uppercase tracking-tight text-white mt-1 italic">{title}</h2>
      <div className="h-[1px] bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent mt-3" />
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-black/60 border border-white/8 p-4 font-mono text-xs text-emerald-400 rounded-none overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

function Step({ num, title, children, done }: { num: number; title: string; children: React.ReactNode; done?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-white/8 bg-white/2">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors">
        <div className={`w-7 h-7 flex items-center justify-center border text-[10px] font-black font-mono shrink-0 ${done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"}`}>
          {done ? <CheckCircle className="w-4 h-4" /> : `0${num}`}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-white italic flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-white/5">{children}</div>}
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return <span className="inline-block text-[10px] font-mono border border-white/10 bg-white/5 px-2 py-0.5 text-slate-400 mr-1 mb-1">{text}</span>;
}

function InfoLine({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <ArrowRight className="w-3 h-3 text-cyan-500/50 mt-0.5 shrink-0" />
      <span className="text-xs font-mono text-slate-300">{text}{sub && <span className="text-slate-500 ml-1">— {sub}</span>}</span>
    </div>
  );
}

const checklist = [
  "Knowledge Base opened",
  "Document Repository — files uploaded & status READY",
  "Configuration Matrix — objective configured",
  "Protocol Modules — profiles activated",
  "Active Grounding Context — status ARMED",
  "System Config → Intelligence Providers — API key connected",
  "Agent Provider Assignment — all 4 agents assigned",
  "Task Composer — instructions entered",
  "Launch Tactical Agent — clicked",
  "Step Graph — execution in progress",
  "Grader Score — evaluated",
  "Artifact approved or denied",
];

export default function SetupPage() {
  const [checks, setChecks] = useState<boolean[]>(new Array(checklist.length).fill(false));
  const toggle = (i: number) => setChecks(c => { const n = [...c]; n[i] = !n[i]; return n; });
  const done = checks.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      {/* Hero */}
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5" />
        <div className="relative max-w-5xl mx-auto px-8 py-14">
          <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/60 uppercase">ACEPLACE // Operator Onboarding</span>
          <div className="flex items-start gap-5 mt-4">
            <div className="w-1 h-16 bg-gradient-to-b from-emerald-500 to-cyan-500 shrink-0" />
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">QUICK SETUP GUIDE</h1>
              <p className="text-emerald-400 text-sm font-mono tracking-[0.15em] uppercase mt-2">Deterministic Runtime Initialization</p>
              <p className="text-slate-400 text-xs font-mono mt-3 max-w-2xl leading-relaxed">
                Configure the deterministic runtime environment and launch your first autonomous execution task. Current environment: <span className="text-cyan-400 font-bold">Developer Sandbox · Public Runtime Preview</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-14">

        {/* Quick Flow */}
        <section>
          <SectionHeader label="Overview" title="Setup Flow" />
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
            {["Knowledge Base","Document Repository","Config Matrix","Protocol Modules","Active Grounding","System Config","Intelligence Providers","Agent Assignment","Task Composer","Launch Agent","Review Grade","Approve Artifact","Export PDF"].map((s, i, arr) => (
              <React.Fragment key={s}>
                <span className="border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 px-2 py-1 uppercase tracking-wider">{s}</span>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700" />}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section>
          <SectionHeader label="Steps" title="Runtime Configuration" />
          <div className="space-y-2">

            <Step num={1} title="Open Knowledge Base">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">The Knowledge Base is the deterministic grounding system. It directly influences COO planning, Researcher analysis, Worker artifact generation, and Grader evaluation scoring.</p>
              <div className="mt-3">
                <InfoLine text="Document Repository" sub="upload PDFs and TXT files" />
                <InfoLine text="Configuration Matrix" sub="primary command override context" />
                <InfoLine text="Protocol Modules" sub="behavioral instruction overlays" />
                <InfoLine text="Active Grounding Context" sub="confirms grounding is synchronized" />
              </div>
            </Step>

            <Step num={2} title="Upload Documents to Repository">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">Upload runtime grounding files. Supported types:</p>
              <div className="mt-2"><Pill text="PDF" /><Pill text="TXT" /></div>
              <p className="text-slate-500 text-xs font-mono mt-2">Examples: whitepapers · SOPs · legal frameworks · engineering documentation · research archives</p>
              <div className="mt-3 border border-emerald-500/20 bg-emerald-500/5 px-4 py-2">
                <span className="text-[10px] font-mono text-emerald-400 font-bold">STATUS: READY = collection indexed and available during execution</span>
              </div>
            </Step>

            <Step num={3} title="Configure the Matrix">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">The Configuration Matrix is the Primary Command Override. Define execution context at elevated priority.</p>
              <CodeBlock>{`Objective:   Generate investor briefing
Context:     Use uploaded runtime documents
Constraints: Executive formatting with citations`}</CodeBlock>
            </Step>

            <Step num={4} title="Activate Protocol Modules">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">Protocol Modules are deterministic behavioral instruction overlays — not documents. They influence reasoning, artifact structure, formatting, and compliance behavior.</p>
              <div className="mt-2">
                <Pill text="Grounded Execution Strategist" />
                <Pill text="Grounded Execution Quality Standard" />
                <Pill text="Venture Capital Execution Framework" />
              </div>
              <p className="text-slate-500 text-xs font-mono mt-2">Users may activate, combine, create, or disable profiles.</p>
            </Step>

            <Step num={5} title="Verify Active Grounding Context">
              <div className="pt-3 space-y-2">
                <div className="border border-cyan-500/20 bg-cyan-500/5 px-4 py-2 font-mono text-xs text-cyan-400">
                  Status: <span className="font-black">DIRECT KNOWLEDGE ARMED</span>
                </div>
                <p className="text-slate-400 text-xs font-mono leading-relaxed">When grounding is active, the next execution envelope inherits: uploaded documents · selected protocol modules · runtime configuration context · deterministic instruction overlays — before execution begins.</p>
              </div>
            </Step>

            <Step num={6} title="System Config → Intelligence Providers">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">ACEPLACE uses BYO-LLM. Connect your API provider key. Agents will <span className="text-red-400 font-bold">not execute</span> until a provider is connected.</p>
              <div className="mt-3">
                <InfoLine text="OpenAI" sub="GPT-4o, GPT-4-turbo" />
                <InfoLine text="Anthropic" sub="Claude 3.5 Sonnet, Haiku" />
                <InfoLine text="Gemini" sub="Gemini 1.5 Pro, Flash" />
                <InfoLine text="OpenRouter" sub="multi-model routing" />
                <InfoLine text="Private Endpoints" sub="custom / self-hosted" />
              </div>
              <div className="mt-3 border border-amber-500/20 bg-amber-500/5 px-4 py-2 flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-400 text-[10px] font-mono">All token usage is billed directly to your configured provider account. Multi-agent execution (COO + Researcher + Worker + Grader) consumes tokens across all stages.</p>
              </div>
            </Step>

            <Step num={7} title="Agent Provider Assignment">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">Assign a provider to each deterministic agent. Advanced users may use different providers per role.</p>
              <CodeBlock>{`COO        → Claude (planning & orchestration)
Researcher → Claude (research & synthesis)
Worker     → GPT-4o (artifact generation)
Grader     → Gemini (evaluation & scoring)`}</CodeBlock>
              <p className="text-slate-500 text-xs font-mono mt-2">Click <span className="text-white font-bold">SAVE CONFIGURATION</span> after assigning providers.</p>
            </Step>

            <Step num={8} title="Agent Identity Registry">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">View deterministic runtime identities, ACELOGIC IDs, fingerprints, runtime roles, and verification states. During sandbox phase, agents reconnect after refresh, restart, or disconnect — the runtime restores the same orchestration identities.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["COO","Researcher","Worker","Grader"].map(a => (
                  <div key={a} className="border border-white/8 bg-white/2 px-3 py-2 text-[10px] font-mono text-slate-400">
                    <span className="text-cyan-400 font-bold">{a}</span> · Identity-Bound · Persistent
                  </div>
                ))}
              </div>
            </Step>

            <Step num={9} title="Task Composer — Write Instructions">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">Open Task Composer and enter your execution instructions. The COO automatically orchestrates planning → research → execution → grading.</p>
              <CodeBlock>{`Objective:    Create a competitive market analysis report
Context:      Use uploaded runtime documents and live web research
Requirements: Include citations, compare competitor positioning
Constraints:  Executive-level formatting, board-ready artifact
Output:       PDF-ready report with grader score target 9.5+`}</CodeBlock>
            </Step>

            <Step num={10} title="Launch Tactical Agent">
              <p className="text-slate-400 text-xs font-mono pt-3 leading-relaxed">Click <span className="text-cyan-400 font-black">LAUNCH TACTICAL AGENT</span>. ACEPLACE then:</p>
              <div className="mt-3 space-y-1">
                {[
                  "Initializes execution envelope",
                  "Validates runtime lease",
                  "Synchronizes grounding context",
                  "Dispatches deterministic agents",
                  "Executes runtime steps sequentially",
                  "Generates artifacts",
                  "Performs grading evaluation",
                  "Persists execution traces to Firestore"
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-400 py-1 border-b border-white/5">
                    <span className="text-cyan-500/60 font-black">{String(i+1).padStart(2,"0")}.</span> {t}
                  </div>
                ))}
              </div>
            </Step>

          </div>
        </section>

        {/* Envelope & Lease explanation */}
        <section>
          <SectionHeader label="Runtime Concepts" title="Envelopes & Leases" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-cyan-500/20 bg-cyan-500/5 p-5">
              <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400 mb-3">EXECUTION ENVELOPE</div>
              <p className="text-slate-400 text-xs font-mono leading-relaxed">Every task executes inside a Deterministic Execution Envelope — the runtime source of truth. It holds execution state, orchestration instructions, participating agents, runtime traces, artifact lineage, and lease validation state.</p>
            </div>
            <div className="border border-purple-500/20 bg-purple-500/5 p-5">
              <div className="text-[10px] font-mono font-black tracking-widest text-purple-400 mb-3">AUTHORITY LEASE</div>
              <p className="text-slate-400 text-xs font-mono leading-relaxed">Each execution step requires a valid runtime lease. After a step completes, the lease expires, runtime validation occurs, and a new lease is issued. Execution continues only if authorized. This prevents uncontrolled execution and invalid orchestration state.</p>
            </div>
          </div>
        </section>

        {/* Checklist */}
        <section>
          <SectionHeader label="Validation" title="Runtime Verification Checklist" />
          <div className="border border-white/8 bg-white/2 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Progress</span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">{done} / {checklist.length} verified</span>
            </div>
            <div className="w-full bg-white/5 h-1 mb-5">
              <div className="h-1 bg-cyan-500 transition-all duration-500" style={{ width: `${(done / checklist.length) * 100}%` }} />
            </div>
            <div className="space-y-1">
              {checklist.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border ${checks[i] ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5 hover:bg-white/5"}`}
                >
                  <div className={`w-4 h-4 flex items-center justify-center border shrink-0 ${checks[i] ? "border-emerald-500 bg-emerald-500/20" : "border-white/20"}`}>
                    {checks[i] && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className={`text-xs font-mono ${checks[i] ? "text-emerald-400 line-through opacity-60" : "text-slate-400"}`}>{item}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Example task */}
        <section>
          <SectionHeader label="Example" title="First Task Example" />
          <div className="border border-white/8 bg-white/2 p-6">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Runtime Instructions — Electric Vehicle Market Expansion</div>
            <CodeBlock>{`Objective:
Generate a strategic expansion report for an EV manufacturer
preparing to enter three new international markets.

Context:
Use uploaded operational documents, manufacturing data, regional
market research, and supply chain reports as deterministic grounding
context. Include live web research on EV adoption trends, charging
infrastructure growth, regional regulations, and competitor activity.

Requirements:
- Analyze market readiness across target regions
- Compare competitor positioning and pricing strategies
- Identify infrastructure and supply chain risks
- Evaluate regulatory and compliance challenges
- Recommend phased expansion priorities

Constraints:
- Executive-level formatting
- Include citations and source references
- Concise institutional language
- Structure for board-level review

Expected Output:
- Executive strategy report     (PDF-ready)
- Regional market comparison matrix
- Risk assessment summary
- Expansion roadmap
- Grader score target: 9.5+

Human Approval Requirement: Approve or Deny`}</CodeBlock>
          </div>
        </section>

        {/* Debugging */}
        <section>
          <SectionHeader label="Debugging" title="Common Issues" />
          <div className="space-y-2">
            {[
              { issue: "Agents not executing", fix: "Verify API key connected in Intelligence Providers. Agents require a valid provider before dispatch." },
              { issue: "Grounding context not armed", fix: "Ensure document status is READY in Document Repository. Check Active Grounding Context panel." },
              { issue: "Lease expiry errors", fix: "Lease expiry is intentional runtime governance. The runtime will re-issue a new lease for the next valid state transition." },
              { issue: "Same agents after refresh", fix: "Expected behavior. Deterministic agent identities persist across sessions via Firestore. The runtime restores the same agents." },
              { issue: "High token usage", fix: "Multi-agent execution (COO + Researcher + Worker + Grader) each consume model inference. Review provider dashboard for token breakdown." },
            ].map(({ issue, fix }) => (
              <div key={issue} className="border border-white/8 p-4 flex gap-4">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-black uppercase text-white italic mb-1">{issue}</div>
                  <p className="text-slate-400 text-xs font-mono leading-relaxed">{fix}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
