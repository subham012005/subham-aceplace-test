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
  BookOpen,
  Users,
  Eye,
  RefreshCw,
} from "lucide-react";

/* ─── Shared sub-components ─── */

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-cyan-500/60 uppercase">
        {label}
      </span>
      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mt-1 italic">
        {title}
      </h2>
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
      : accent === "emerald"
      ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
      : "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
  const dot =
    accent === "purple"
      ? "bg-purple-500"
      : accent === "emerald"
      ? "bg-emerald-500"
      : "bg-cyan-500";
  return (
    <div className={`border rounded-none p-5 ${color} relative`}>
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-60" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-60" />
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] font-black uppercase tracking-widest">
          {title}
        </span>
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

function FlowStep({
  step,
  label,
  desc,
}: {
  step: string;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-none border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-[10px] font-black font-mono shrink-0">
          {step}
        </div>
        <div className="w-[1px] h-full bg-cyan-500/10 mt-1" />
      </div>
      <div className="pb-6">
        <div className="text-[11px] font-black uppercase tracking-widest text-cyan-400 italic">
          {label}
        </div>
        <div className="text-slate-400 text-xs font-mono mt-1 leading-relaxed">
          {desc}
        </div>
      </div>
    </div>
  );
}

function ArchPlane({
  label,
  items,
  color,
  note,
}: {
  label: string;
  items: string[];
  color: string;
  note?: string;
}) {
  return (
    <div className={`border ${color} p-4 relative`}>
      <div className="text-[10px] font-black font-mono tracking-[0.25em] uppercase mb-3 opacity-70">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
      {note && (
        <p className="text-slate-500 font-mono text-[10px] mt-3 italic">{note}</p>
      )}
    </div>
  );
}

/* ─── Main export ─── */

export default function AboutContent() {
  return (
    <>
      {/* ── Hero ── */}
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/60 uppercase">
              ACEPLACE™ // Runtime Documentation
            </span>
          </div>
          <div className="flex items-start gap-4 md:gap-6">
            <div className="w-1 h-20 bg-gradient-to-b from-cyan-500 to-purple-500 shrink-0" />
            <div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic text-white leading-none">
                ABOUT ACEPLACE™
              </h1>
              <p className="text-cyan-400 text-sm font-mono tracking-[0.2em] uppercase mt-3">
                ACELOGIC™ + ACEAGENTS™ + ACEPLACE™
              </p>
              <p className="text-slate-400 text-sm leading-relaxed mt-4 max-w-3xl font-mono">
                Deterministic Agent Identity to Governed Autonomous Execution.
                Every agent you create has a persistent identity. Every action
                is governed. Every outcome remains accountable.
              </p>
            </div>
          </div>

          {/* Stack flow */}
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
            {[
              { label: "ACELOGIC™", sub: "Deterministic Identity Authority" },
              { label: "ACEAGENT™", sub: "Canonical Digital Worker" },
              { label: "ACEPLACE™", sub: "Governed Execution Infrastructure" },
              { label: "Autonomous Work", sub: "Human Oversight" },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <div className="border border-cyan-500/20 bg-cyan-500/5 px-4 py-2 text-center">
                  <div className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
                    {item.label}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                    {item.sub}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="text-slate-600 w-4 h-4 hidden sm:block" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            {[
              "Deterministic Runtime",
              "Execution Envelopes",
              "Authority Leases",
              "Stateless Agents",
              "Identity Continuity",
              "Traceable Execution",
              "Governed Orchestration",
              "Human Oversight",
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

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-12 space-y-16 md:space-y-20">

        {/* ── 01 ACEAGENT ── */}
        <section>
          <SectionHeader label="01 // Identity" title="What Is An ACEAGENT™?" />
          <div className="border border-cyan-500/15 bg-cyan-500/3 p-6 md:p-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/40" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/40" />
            <p className="text-slate-300 font-mono text-sm leading-relaxed">
              Agents created through{" "}
              <span className="text-cyan-400 font-black">ACELOGIC™</span> are
              known as{" "}
              <span className="text-white font-black">ACEAGENTS™</span> — canonical
              digital workers possessing{" "}
              <span className="text-cyan-400">deterministic identity</span>,
              lifecycle continuity, execution accountability, and governed
              participation within autonomous systems.
            </p>
            <p className="text-slate-400 font-mono text-xs leading-relaxed mt-4">
              Unlike traditional AI agents that instantiate, perform a task, and
              disappear — ACEAGENTS™ persist across sessions, runtime restarts,
              orchestration cycles, and governed execution workflows. Every
              ACEAGENT™ maintains a persistent continuity record linking
              identity, actions, decisions, artifacts, governance events, and
              operational history throughout its lifecycle.
            </p>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[
                "Persistent across sessions & restarts",
                "Continuity records across lifecycle",
                "No random agent replacement",
              ].map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-mono text-slate-400"
                >
                  <CheckCircle className="w-3 h-3 text-cyan-500/60 shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 02 Positioning ── */}
        <section>
          <SectionHeader label="02 // Positioning" title="What Is ACEPLACE™?" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-red-500/15 bg-red-500/5 p-6">
              <div className="text-[10px] font-mono font-black tracking-[0.25em] text-red-400 mb-4">
                ACEPLACE™ IS NOT
              </div>
              {[
                "A chatbot framework",
                "A workflow toy",
                "A generic orchestration application",
                "A simple AI wrapper",
                "An autonomous chat agent platform",
              ].map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-slate-500 text-xs font-mono py-1.5 border-b border-white/5"
                >
                  <span className="text-red-500/60">✕</span> {t}
                </div>
              ))}
            </div>
            <div className="border border-cyan-500/20 bg-cyan-500/5 p-6">
              <div className="text-[10px] font-mono font-black tracking-[0.25em] text-cyan-400 mb-4">
                ACEPLACE™ IS
              </div>
              {[
                "Deterministic runtime infrastructure",
                "Identity-bound execution platform",
                "Authority-controlled autonomous execution",
                "Envelope-driven runtime architecture",
                "Traceable multi-agent orchestration",
                "Governed autonomous workforce infrastructure",
                "Continuity-preserving agent execution",
                "Accountability-driven autonomous systems",
              ].map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-slate-300 text-xs font-mono py-1.5 border-b border-white/5"
                >
                  <span className="text-cyan-400">✓</span> {t}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 border border-white/5 bg-white/2 p-5">
            <p className="text-slate-400 font-mono text-xs leading-relaxed">
              <span className="text-cyan-400 font-black">
                Canonical Runtime Law:{" "}
              </span>
              Agents are stateless. The envelope holds state. Execution flows
              as:{" "}
              <span className="text-white font-black">
                Execution Envelope → Runtime Worker → Agent Engine
              </span>
              . Identity flows through ACELOGIC™. Governance flows through
              ACEPLACE™. Continuity flows through persistent records.
            </p>
          </div>
        </section>

        {/* ── 03 Stack ── */}
        <section>
          <SectionHeader
            label="03 // Architecture"
            title="The Four-Plane Stack"
          />
          <div className="space-y-3">
            <ArchPlane
              label="Control Plane — ACELOGIC™"
              items={[
                "Identity Authority",
                "Deterministic Fingerprints",
                "Agent Verification",
                "Purpose Hash Validation",
                "Authority Lease Issuance",
                "Orchestration Governance",
                "Runtime Trust Enforcement",
                "Identity Continuity Management",
              ]}
              color="border-purple-500/25"
              note="ACELOGIC™ establishes identity continuity before execution is permitted."
            />
            <div className="flex justify-center">
              <ArrowRight className="text-slate-600 w-4 h-4 rotate-90" />
            </div>
            <ArchPlane
              label="Agent Plane — ACEAGENT™"
              items={[
                "Canonical Digital Workers",
                "Persistent Identity",
                "Deterministic Fingerprints",
                "Lifecycle Continuity",
                "Governed Participation",
                "Role Persistence",
                "Continuity Records",
                "Operational Accountability",
              ]}
              color="border-blue-500/25"
              note="Every ACEAGENT™ maintains identity continuity throughout autonomous execution."
            />
            <div className="flex justify-center">
              <ArrowRight className="text-slate-600 w-4 h-4 rotate-90" />
            </div>
            <ArchPlane
              label="Execution Plane — ACEPLACE™"
              items={[
                "Execution Envelopes",
                "Runtime Workers",
                "Lease Validation",
                "State Transitions",
                "Artifact Persistence",
                "Execution Traceability",
                "Governance Enforcement",
                "Continuity Preservation",
              ]}
              color="border-cyan-500/25"
              note="ACEPLACE™ governs how deterministic identities perform work."
            />
            <div className="flex justify-center">
              <ArrowRight className="text-slate-600 w-4 h-4 rotate-90" />
            </div>
            <ArchPlane
              label="Compute Plane — Agent Engines"
              items={[
                "COO (Planner)",
                "Researcher (Analyst)",
                "Worker (Executor)",
                "Grader (Evaluator)",
                "BYO-LLM Providers",
              ]}
              color="border-emerald-500/25"
              note="Agent engines remain stateless. Runtime continuity exists within the execution envelope and persistence layer."
            />
          </div>
        </section>

        {/* ── 04 Knowledge Base ── */}
        <section>
          <SectionHeader
            label="04 // Knowledge"
            title="Knowledge Base & Grounding"
          />
          <p className="text-slate-400 font-mono text-xs leading-relaxed mb-8 max-w-3xl">
            ACEPLACE™ enables organizations to govern not only{" "}
            <span className="text-white">how</span> ACEAGENTS™ execute work,
            but also{" "}
            <span className="text-white">
              what knowledge, instructions, protocols, and operational context
            </span>{" "}
            they execute against. Knowledge is managed through the ACEPLACE™
            Knowledge Base and injected directly into governed execution
            workflows.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard
              icon={BookOpen}
              title="Knowledge Collections"
              items={[
                "PDF Documents",
                "Technical Documentation",
                "Operational Playbooks",
                "Research Repositories",
                "Protocol Libraries",
                "Text-Based Knowledge Assets",
                "Activated dynamically per workflow",
              ]}
            />
            <InfoCard
              icon={FileText}
              title="Instruction Profiles"
              items={[
                "Grounded Execution Strategist",
                "Quality Assurance Standards",
                "Compliance Protocols",
                "Industry-Specific Workflows",
                "Enterprise Operating Procedures",
                "Reusable behavioral frameworks",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={Zap}
              title="Runtime Context Injection"
              items={[
                "Objectives & Constraints",
                "Requirements & Domain Knowledge",
                "Project Context",
                "Operational Instructions",
                "Synchronized into envelope pre-dispatch",
              ]}
            />
            <InfoCard
              icon={Shield}
              title="Context Governance"
              items={[
                "Knowledge not stored inside agents",
                "Attached via governed injection",
                "Deterministic execution ensured",
                "Reproducible outcomes",
                "Auditable grounding",
                "Controlled knowledge updates",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={Database}
              title="Active Grounding Context"
              items={[
                "Knowledge Collections",
                "Instruction Profiles",
                "Runtime Context Blocks",
                "Web Research Results",
                "Enterprise Documentation",
                "External Data Sources",
              ]}
            />
            <InfoCard
              icon={Eye}
              title="Knowledge Traceability"
              items={[
                "Sources used per execution",
                "Active context blocks recorded",
                "Instruction profiles applied",
                "Influencing documents logged",
                "Consuming ACEAGENTS™ tracked",
                "Complete context lineage",
              ]}
              accent="purple"
            />
          </div>

          {/* Governed Knowledge Operations */}
          <div className="mt-6 border border-purple-500/20 bg-purple-500/5 p-6 relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-purple-500/60" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-purple-500/60" />
            <div className="text-[10px] font-mono font-black tracking-[0.3em] text-purple-400 uppercase mb-3">
              Governed Knowledge Operations
            </div>
            <p className="text-slate-400 font-mono text-xs leading-relaxed mb-4">
              Knowledge remains under organizational control.
              <span className="text-white font-black"> ACEAGENTS™ do not permanently learn</span> from uploaded information.
              Instead, knowledge is processed per execution workflow:
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              {["Indexed", "Activated", "Injected", "Traced", "Governed"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-[10px] font-black font-mono text-purple-400 uppercase tracking-widest">
                    {step}
                  </div>
                  {i < 4 && <span className="text-slate-700 text-xs">→</span>}
                </div>
              ))}
            </div>
            <p className="text-slate-500 font-mono text-[10px] leading-relaxed italic">
              Knowledge remains separate from identity while remaining fully traceable throughout execution.
            </p>
          </div>
        </section>

        {/* ── 05 Core Capabilities ── */}
        <section>
          <SectionHeader label="05 // Capabilities" title="Core Runtime Features" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard
              icon={Shield}
              title="Deterministic Identity"
              items={[
                "ACELOGIC™ identity authority",
                "Deterministic fingerprints",
                "Purpose hashes",
                "Identity verification",
                "Persistent agent continuity",
                "Governed orchestration roles",
                "Continuity preservation",
              ]}
            />
            <InfoCard
              icon={Lock}
              title="Authority Lease System"
              items={[
                "Execution authority per step",
                "Lease expires after completion",
                "Runtime validation required",
                "Controlled state transitions",
                "Deterministic sequencing enforced",
                "Prevents uncontrolled execution",
                "Maintains governed authority",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={Layers}
              title="Execution Envelopes"
              items={[
                "Runtime source of truth",
                "Holds all execution state",
                "Immutable execution history",
                "Artifact references",
                "Lease validation state",
                "Execution continuity layer",
                "Governed state management",
              ]}
            />
            <InfoCard
              icon={Activity}
              title="Execution Traceability"
              items={[
                "Agent identity per action",
                "Timestamped execution events",
                "Continuity records",
                "Task ownership tracking",
                "Artifact lineage",
                "Compliance history",
                "Governance audit trail",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={Database}
              title="Continuity & Persistence"
              items={[
                "Envelope state persistence",
                "Execution trace retention",
                "Identity continuity",
                "Artifact lineage archival",
                "Cross-session restoration",
                "Governed operational history",
                "Lifecycle accountability",
              ]}
            />
            <InfoCard
              icon={Cpu}
              title="Stateless Agent Model"
              items={[
                "Agents store no internal state",
                "Runtime state in envelopes",
                "Deterministic recovery",
                "Identity continuity preserved",
                "No random agent replacement",
                "Governed execution consistency",
                "Persistent operational memory",
              ]}
              accent="purple"
            />
          </div>
        </section>

        {/* ── 06 Runtime Lifecycle ── */}
        <section>
          <SectionHeader label="06 // Lifecycle" title="Runtime Execution Flow" />
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <FlowStep
                step="01"
                label="Envelope Initialization"
                desc="Task deployed. Execution envelope created containing context, objectives, constraints, participating ACEAGENTS™, governance rules, continuity records, execution history, and grounding context."
              />
              <FlowStep
                step="02"
                label="Identity Verification"
                desc="ACELOGIC™ verifies agent identities. Fingerprints validated. Roles confirmed. Authority established. Continuity records verified."
              />
              <FlowStep
                step="03"
                label="Authority Lease Acquisition"
                desc="Runtime worker requests execution authority. ACELOGIC™ issues a lease for a single approved execution step."
              />
              <FlowStep
                step="04"
                label="Deterministic Execution"
                desc="Runtime worker dispatches the appropriate stateless agent engine. Agent reads envelope state, performs execution, and writes results back. Execution recorded against agent continuity history."
              />
            </div>
            <div>
              <FlowStep
                step="05"
                label="Lease Expiry & Validation"
                desc="Execution authority expires. Runtime validates state transition. New lease issued only if governance requirements are satisfied."
              />
              <FlowStep
                step="06"
                label="Artifact Generation"
                desc="Worker agents create deliverables. Grader agents evaluate correctness, quality, compliance, and governance adherence. Artifacts linked to originating ACEAGENT™ identities."
              />
              <FlowStep
                step="07"
                label="Trace Persistence"
                desc="Execution events written to persistence. Identity history maintained. Artifacts archived. Lineage preserved. Continuity records updated."
              />
              <FlowStep
                step="08"
                label="Human Oversight & Continuation"
                desc="Artifacts enter review. Humans Approve (finalize), Deny (reject/redeploy), or Edit/Continue (add direction while preserving the original envelope, continuity records, and artifact lineage). Runtime does not autonomously finalize outputs."
              />
            </div>
          </div>
        </section>

        {/* ── 07 Agent Fleet ── */}
        <section>
          <SectionHeader
            label="07 // Agent Fleet"
            title="Sandbox: Pre-Connected Deterministic Agents"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                role: "COO",
                fn: "Planner",
                items: [
                  "Task decomposition",
                  "Execution planning",
                  "Step sequencing",
                  "Governance-aware orchestration",
                ],
              },
              {
                role: "Researcher",
                fn: "Analyst",
                items: [
                  "Information retrieval",
                  "Validation",
                  "Research synthesis",
                  "External grounding",
                ],
              },
              {
                role: "Worker",
                fn: "Executor",
                items: [
                  "Artifact generation",
                  "Implementation",
                  "Report production",
                  "Task execution",
                ],
              },
              {
                role: "Grader",
                fn: "Evaluator",
                items: [
                  "Output evaluation",
                  "Quality scoring",
                  "Compliance review",
                  "Governance validation",
                ],
              },
            ].map((a) => (
              <div key={a.role} className="border border-white/8 bg-white/2 p-5 relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20" />
                <div className="text-[10px] font-mono text-slate-600 mb-1 uppercase tracking-widest">
                  {a.fn}
                </div>
                <div className="text-xl font-black uppercase italic text-white mb-3">
                  {a.role}
                </div>
                <ul className="space-y-1.5">
                  {a.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-slate-400 text-xs font-mono"
                    >
                      <span className="w-1 h-1 rounded-full bg-cyan-500/60 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 text-[10px] font-mono text-slate-600">
                  Stateless · Identity-Bound · Persistent
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 08 BYO-LLM ── */}
        <section>
          <SectionHeader label="08 // Inference" title="Bring Your Own LLM" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-slate-400 font-mono text-xs leading-relaxed">
                <span className="text-cyan-400 font-black">
                  Your Models. Your Costs. Your Choice.
                </span>{" "}
                ACEPLACE™ uses a BYO-LLM architecture. Connect your own
                provider accounts while ACEPLACE™ governs execution. All
                inference costs are billed directly to your configured provider
                account.
              </p>
              <div className="border border-white/5 bg-white/2 p-4">
                <p className="text-slate-400 font-mono text-xs">
                  <span className="text-cyan-400 font-black">
                    ACEPLACE™ governs execution.
                  </span>{" "}
                  You control inference.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  "OpenAI",
                  "Anthropic",
                  "Google Gemini",
                  "Azure OpenAI",
                  "NVIDIA NIM",
                  "OpenRouter",
                  "Private Endpoints",
                ].map((p) => (
                  <span
                    key={p}
                    className="text-[10px] font-mono border border-white/10 bg-white/5 px-3 py-1 text-slate-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <InfoCard
              icon={Server}
              title="Dashboard Telemetry"
              items={[
                "Token usage per ACEAGENT™",
                "Runtime request counts",
                "Execution cost estimates",
                "Orchestration activity",
                "Provider health status",
              ]}
              accent="purple"
            />
          </div>
        </section>

        {/* ── 09 Dashboard ── */}
        <section>
          <SectionHeader
            label="09 // Observability"
            title="Dashboard Telemetry & Continuity Records"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Activity,
                label: "Runtime Operations",
                items: [
                  "Token usage per ACEAGENT™",
                  "Runtime request counts",
                  "Execution cost estimates",
                  "Orchestration activity",
                  "Provider health status",
                ],
                accent: "cyan" as const,
              },
              {
                icon: Users,
                label: "Identity & Continuity",
                items: [
                  "Identity verification events",
                  "Continuity records",
                  "Agent lifecycle history",
                  "Cross-session restoration",
                  "Authority lease activity",
                ],
                accent: "purple" as const,
              },
              {
                icon: Shield,
                label: "Governance & Accountability",
                items: [
                  "Governance approval metrics",
                  "Execution trace volume",
                  "Artifact lineage tracking",
                  "Execution audit trails",
                  "Human review history",
                ],
                accent: "cyan" as const,
              },
              {
                icon: Eye,
                label: "Agent Activity Intelligence",
                items: [
                  "Which agent performed each task",
                  "Execution timestamps per action",
                  "Task ownership across workflows",
                  "Agent decision history",
                  "Artifacts traced to originating agents",
                ],
                accent: "purple" as const,
              },
            ].map((card) => (
              <InfoCard
                key={card.label}
                icon={card.icon}
                title={card.label}
                items={card.items}
                accent={card.accent}
              />
            ))}
          </div>
          <div className="mt-4 border border-white/5 bg-white/2 p-4">
            <p className="text-slate-400 font-mono text-xs">
              <span className="text-cyan-400 font-black">
                Complete Accountability:{" "}
              </span>
              Every action performed within ACEPLACE™ is traceable to a
              deterministic ACEAGENT™ identity, creating a complete continuity
              record across execution, governance, decisions, and artifact
              generation.
            </p>
          </div>
        </section>

        {/* ── 10 Governance ── */}
        <section>
          <SectionHeader label="10 // Governance" title="Runtime Governance Model" />
          <div className="grid md:grid-cols-3 gap-4">
            <InfoCard
              icon={CheckCircle}
              title="Human-in-the-Loop"
              items={[
                "Artifacts not automatically finalized",
                "Approve — finalize the artifact",
                "Deny — reject and stop/redeploy",
                "Edit / Continue — add direction",
                "Preserves original envelope",
                "Continuity records maintained",
                "Human authority enforced",
              ]}
              accent="purple"
            />
            <InfoCard
              icon={GitBranch}
              title="Execution Protocol"
              items={[
                "Structured execution governance",
                "Runtime-enforced controls",
                "Deterministic agent communication",
                "Auditable orchestration",
                "Protocol compliance required",
                "Continuity-aware management",
              ]}
            />
            <InfoCard
              icon={FileText}
              title="Artifact Persistence"
              items={[
                "PDF export",
                "Execution lineage archived",
                "Trace-linked sourcing",
                "Governance history preserved",
                "Portable deliverables",
                "Long-term archival",
                "Continuity preservation",
              ]}
              accent="purple"
            />
          </div>
        </section>

        {/* ── 11 Runtime Mode ── */}
        <section>
          <div className="border border-cyan-500/20 bg-cyan-500/5 p-6 md:p-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/60" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/60" />
            <div className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/60 uppercase mb-2">
              Current Runtime Mode
            </div>
            <div className="text-xl md:text-2xl font-black uppercase italic text-cyan-400 mb-6">
              Developer Sandbox · Public Runtime Preview
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                "Pre-created deterministic ACEAGENTS™",
                "NXQ-hosted runtime infrastructure",
                "BYO-LLM execution",
                "Deterministic orchestration",
                "Execution trace persistence",
                "Continuity records",
                "Governance workflows",
                "Human approval enforcement",
                "Runtime observability",
                "Identity continuity",
                "Canonical agent lifecycle management",
                "Agent activity intelligence",
                "Execution accountability",
              ].map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-mono text-slate-400"
                >
                  <Zap className="w-3 h-3 text-cyan-500/60 shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <p className="text-slate-500 font-mono text-[10px] mt-6 leading-relaxed">
              Future enterprise deployments support private infrastructure,
              containers, APIs, SDKs, customer-controlled execution
              environments, and enterprise-scale autonomous workforce governance.
            </p>
          </div>
        </section>

      </div>
    </>
  );
}
