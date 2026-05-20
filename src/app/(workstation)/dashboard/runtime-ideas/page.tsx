"use client";

import React, { useState } from "react";
import { Zap, ArrowRight, ExternalLink, Shield, Activity, BookOpen, TrendingUp, Building2, Scale, Server, FileSearch, Cpu } from "lucide-react";
import Link from "next/link";

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-cyan-500/60 uppercase">{label}</span>
      <h2 className="text-xl font-black uppercase tracking-tight text-white mt-1 italic">{title}</h2>
      <div className="h-[1px] bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent mt-3" />
    </div>
  );
}

const runtimeIdeas = [
  {
    id: "market-intel",
    icon: TrendingUp,
    category: "Strategic Intelligence",
    title: "Strategic Market Intelligence",
    type: "Research + Strategic Analysis",
    goal: "Generate executive-level market intelligence using uploaded documents and live web research.",
    agents: ["COO","Researcher","Worker","Grader"],
    outputs: ["Competitor analysis","Market expansion reports","Investment strategy summaries","Executive briefings","Citation-backed PDF artifacts"],
    prompt: `Objective:
Generate a strategic market intelligence report for a company
entering new international markets.

Context:
Use uploaded business documents, operational reports, and live web
research to evaluate competitive positioning, market conditions,
infrastructure readiness, and expansion risks.

Requirements:
- Analyze competitor activity
- Compare pricing strategies
- Evaluate regional growth opportunities
- Identify operational risks
- Include citation-backed findings

Constraints:
- Executive formatting
- Concise institutional language
- No unsupported claims

Expected Output:
- Board-level strategy report
- Market comparison matrix
- Risk summary
- PDF-ready artifact`,
  },
  {
    id: "due-diligence",
    icon: FileSearch,
    category: "Investment",
    title: "Investment Due Diligence",
    type: "Financial + Operational Intelligence",
    goal: "Analyze uploaded company documentation and generate institutional-grade investment analysis.",
    agents: ["COO","Researcher","Worker","Grader"],
    outputs: ["Investment risk reports","SWOT analysis","Operational assessments","Strategic recommendation summaries","Diligence review artifacts"],
    prompt: `Objective:
Generate a due diligence report for a growth-stage technology company.

Context:
Use uploaded financials, operational documents, market reports, and
live web research to evaluate company positioning, execution risks,
scalability, and competitive strength.

Requirements:
- Assess operational scalability
- Identify strategic weaknesses
- Compare market positioning
- Evaluate execution risk
- Include external validation research

Expected Output:
- Investment intelligence report
- Strategic assessment matrix
- Executive diligence summary
- PDF-ready artifact`,
  },
  {
    id: "telecom",
    icon: Cpu,
    category: "Telecommunications",
    title: "Telecom & AI-RAN Orchestration",
    type: "Telecommunications + Infrastructure Intelligence",
    goal: "Generate AI-RAN infrastructure analysis and telecom deployment planning using uploaded technical documentation and live industry research.",
    agents: ["COO","Researcher","Worker","Grader"],
    outputs: ["AI-RAN deployment reports","Telecom infrastructure assessments","Edge compute strategy plans","Latency optimization analysis","Sovereign telecom frameworks"],
    prompt: `Objective:
Generate a telecommunications infrastructure strategy report for
AI-RAN deployment across multiple international regions.

Context:
Use uploaded telecom architecture documents, infrastructure
specifications, Open RAN standards, and live web research on
carrier modernization and edge compute deployments.

Requirements:
- Evaluate AI-RAN readiness
- Analyze edge compute requirements
- Assess telecom infrastructure risks
- Compare vendor ecosystems
- Include infrastructure modernization recommendations
- Validate findings with cited sources

Constraints:
- Carrier-grade formatting
- Executive presentation structure
- Deterministic compliance standards
- Citation-backed analysis

Expected Output:
- AI-RAN deployment roadmap
- Infrastructure comparison matrix
- Telecom risk assessment
- Executive telecom strategy artifact
- PDF-ready deliverable`,
  },
  {
    id: "sop",
    icon: BookOpen,
    category: "Operational Intelligence",
    title: "SOP & Operational Framework",
    type: "Operational Intelligence",
    goal: "Convert uploaded operational documents into structured SOP and execution frameworks.",
    agents: ["COO","Worker","Grader"],
    outputs: ["Standard operating procedures","Operational workflows","Execution playbooks","Governance documentation","Compliance-ready operational artifacts"],
    prompt: `Objective:
Generate standardized operational procedures from uploaded
organizational documentation.

Context:
Use uploaded process documentation, operational manuals, and
governance frameworks to create structured execution procedures.

Requirements:
- Organize workflows logically
- Standardize terminology
- Maintain compliance formatting
- Create implementation-ready procedures

Expected Output:
- Operational handbook
- Structured SOP framework
- Implementation documentation
- PDF-ready artifact`,
  },
  {
    id: "legal",
    icon: Scale,
    category: "Legal & Compliance",
    title: "Legal & Compliance Analysis",
    type: "Compliance + Legal Intelligence",
    goal: "Perform multi-document legal synthesis with deterministic traceability and citation-backed analysis.",
    agents: ["COO","Researcher","Worker","Grader"],
    outputs: ["Compliance summaries","Legal risk assessments","Regulatory mapping","Governance analysis","Citation-supported legal artifacts"],
    prompt: `Objective:
Generate a regulatory compliance assessment using uploaded legal
frameworks and live regulatory research.

Context:
Use uploaded legal documentation, compliance standards, operational
policies, and live regulatory updates to evaluate organizational
exposure and compliance readiness.

Requirements:
- Identify regulatory risks
- Summarize legal obligations
- Compare compliance standards
- Validate findings with citations

Expected Output:
- Compliance intelligence report
- Legal risk summary
- Regulatory mapping artifact
- PDF-ready document`,
  },
  {
    id: "infrastructure",
    icon: Server,
    category: "Technical Systems",
    title: "Software & Infrastructure Architecture",
    type: "Technical Systems Planning",
    goal: "Generate technical system architecture plans and infrastructure recommendations from uploaded engineering requirements.",
    agents: ["COO","Researcher","Worker","Grader"],
    outputs: ["Infrastructure architecture plans","Deployment strategies","Systems documentation","Technical implementation reports","Infrastructure comparison matrices"],
    prompt: `Objective:
Generate a distributed infrastructure architecture strategy for
a multi-region AI platform.

Context:
Use uploaded engineering documentation, infrastructure specifications,
runtime requirements, and deployment constraints.

Requirements:
- Analyze scalability requirements
- Compare deployment architectures
- Evaluate infrastructure resilience
- Include orchestration recommendations

Expected Output:
- Architecture strategy report
- Infrastructure deployment roadmap
- Systems comparison matrix
- PDF-ready technical artifact`,
  },
];

function IdeaCard({ idea, onSelect, selected }: { idea: typeof runtimeIdeas[0]; onSelect: () => void; selected: boolean }) {
  const Icon = idea.icon;
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border p-5 relative transition-all duration-200 group ${
        selected
          ? "border-cyan-500/40 bg-cyan-500/8 shadow-[inset_0_0_30px_rgba(6,182,212,0.05)]"
          : "border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/5"
      }`}
    >
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-40" />
      {selected && <div className="absolute inset-y-0 left-0 w-[2px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />}
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-cyan-400" : "text-slate-600 group-hover:text-slate-400"}`} />
        <div>
          <div className="text-[9px] font-mono tracking-widest text-slate-600 uppercase mb-1">{idea.category}</div>
          <div className={`text-[11px] font-black uppercase italic tracking-wide ${selected ? "text-cyan-400" : "text-slate-300"}`}>{idea.title}</div>
          <div className="text-[10px] font-mono text-slate-500 mt-1">{idea.type}</div>
        </div>
      </div>
    </button>
  );
}

export default function RuntimeIdeasPage() {
  const [selected, setSelected] = useState<string>("market-intel");
  const idea = runtimeIdeas.find(r => r.id === selected)!;
  const Icon = idea.icon;

  const [copied, setCopied] = useState(false);
  const copyPrompt = () => {
    navigator.clipboard.writeText(idea.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      {/* Hero */}
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />
        <div className="relative max-w-7xl mx-auto px-8 py-12">
          <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/60 uppercase">ACEPLACE // Runtime Execution Examples</span>
          <div className="flex items-start gap-5 mt-4">
            <div className="w-1 h-16 bg-gradient-to-b from-purple-500 to-cyan-500 shrink-0" />
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">RUNTIME IDEAS</h1>
              <p className="text-purple-400 text-sm font-mono tracking-[0.15em] uppercase mt-2">Deterministic Multi-Agent Execution Examples</p>
              <p className="text-slate-400 text-xs font-mono mt-3 max-w-3xl leading-relaxed">
                Real execution scenarios that ACEPLACE can orchestrate using deterministic runtime agents, execution envelopes, grounding systems, and human-in-the-loop governance. Select a scenario to view the runtime instructions and load them into Task Composer.
              </p>
            </div>
          </div>
          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            {["Strategic Intelligence","Market Research","Telecom & AI-RAN","Infrastructure Planning","Legal & Compliance","Technical Architecture","Investment Due Diligence","Enterprise Research"].map(c => (
              <span key={c} className="text-[10px] font-mono border border-white/8 bg-white/3 text-slate-500 px-2 py-1 uppercase tracking-wider">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">

          {/* Left: card list */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">Execution Scenarios</div>
            {runtimeIdeas.map(r => (
              <IdeaCard key={r.id} idea={r} onSelect={() => setSelected(r.id)} selected={selected === r.id} />
            ))}
          </div>

          {/* Right: detail */}
          <div className="space-y-5">
            {/* Header */}
            <div className="border border-white/8 bg-white/2 p-6 relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/15" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/15" />
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase mb-1">{idea.category} · {idea.type}</div>
                  <h2 className="text-2xl font-black uppercase italic text-white">{idea.title}</h2>
                  <p className="text-slate-400 text-xs font-mono mt-2 leading-relaxed">{idea.goal}</p>
                </div>
              </div>
            </div>

            {/* Agents + Outputs */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-cyan-500/15 bg-cyan-500/5 p-4">
                <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400 mb-3">AGENTS INVOLVED</div>
                <div className="space-y-1">
                  {idea.agents.map(a => (
                    <div key={a} className="flex items-center gap-2 text-xs font-mono text-slate-300 py-1 border-b border-white/5 last:border-0">
                      <Zap className="w-3 h-3 text-cyan-500/50" /> {a}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-purple-500/15 bg-purple-500/5 p-4">
                <div className="text-[10px] font-mono font-black tracking-widest text-purple-400 mb-3">EXAMPLE OUTPUTS</div>
                <div className="space-y-1">
                  {idea.outputs.map(o => (
                    <div key={o} className="flex items-start gap-2 text-xs font-mono text-slate-300 py-1 border-b border-white/5 last:border-0">
                      <ArrowRight className="w-3 h-3 text-purple-500/50 mt-0.5 shrink-0" /> {o}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Runtime guarantees */}
            <div className="border border-white/5 bg-white/2 p-4 flex flex-wrap gap-4">
              {[
                { icon: Shield, label: "Deterministic Execution", color: "text-cyan-400" },
                { icon: Activity, label: "Authority-Controlled Runtime", color: "text-emerald-400" },
                { icon: Building2, label: "Human-in-the-Loop Governance", color: "text-purple-400" },
              ].map(({ icon: I, label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <I className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>

            {/* Prompt block */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Runtime Instructions</span>
                <button
                  onClick={copyPrompt}
                  className="text-[10px] font-mono border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? "Copied ✓" : "Copy to clipboard"}
                </button>
              </div>
              <pre className="bg-black/60 border border-white/8 p-5 font-mono text-xs text-slate-300 rounded-none overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {idea.prompt}
              </pre>
              <div className="mt-2 text-[10px] font-mono text-slate-500 italic">Human Approval Requirement: Approve or Deny Artifact</div>
            </div>

            {/* CTA */}
            <Link
              href="/dashboard/composer"
              className="flex items-center justify-center gap-3 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 px-6 py-4 hover:bg-cyan-500/20 transition-colors w-full group"
            >
              <Zap className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest italic">Open Task Composer</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Artifact types */}
        <div className="mt-14">
          <SectionHeader label="Output" title="Generated Artifact Types" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              "PDF Reports","Executive Briefings","Intelligence Summaries","Infrastructure Strategies",
              "Market Analysis","Legal Reviews","Operational Frameworks","Technical Documentation",
              "Deployment Plans","Research Synthesis","Board-Level Reports","Citation-Backed Deliverables"
            ].map(t => (
              <div key={t} className="border border-white/8 bg-white/2 px-4 py-3 text-[10px] font-mono text-slate-400 flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-cyan-500/40 shrink-0" /> {t}
              </div>
            ))}
          </div>
        </div>

        {/* Execution visibility reminder */}
        <div className="mt-10 border border-white/5 bg-white/2 p-6 grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400 mb-3">DETERMINISTIC EXECUTION VISIBILITY</div>
            <p className="text-slate-400 text-xs font-mono leading-relaxed">All execution is fully traceable. Users can observe which agent executed each step, timestamps, orchestration order, lease transitions, runtime trace events, grading events, and artifact generation flow.</p>
          </div>
          <div>
            <div className="text-[10px] font-mono font-black tracking-widest text-purple-400 mb-3">HUMAN-IN-THE-LOOP GOVERNANCE</div>
            <p className="text-slate-400 text-xs font-mono leading-relaxed">Artifacts are never automatically finalized. Every execution produces a human review checkpoint. Users approve or deny before runtime acceptance. Future: CONTINUE TASK to extend execution without restarting.</p>
          </div>
        </div>

        {/* Coming soon */}
        <div className="mt-6 border border-cyan-500/10 bg-cyan-500/3 p-5">
          <div className="text-[10px] font-mono font-black tracking-widest text-cyan-400/60 mb-3">COMING SOON</div>
          <div className="flex flex-wrap gap-2">
            {["BYOI — Bring Your Own Infrastructure","Sovereign Cloud Deployments","Private Runtime Environments","Dedicated Orchestration Clusters","Enterprise Execution Governance","Custom Agent Fleets","Continuation Workflows","Advanced Step Graph","Runtime Federation","Sovereign Telecom Environments"].map(t => (
              <span key={t} className="text-[10px] font-mono border border-white/8 bg-white/3 text-slate-500 px-2 py-1">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
