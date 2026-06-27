"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X as XIcon, Activity, Database, Shield, Zap, Lock, Eye, CheckCircle2, Box, Cpu } from "lucide-react";
import gsap from "gsap";

export default function LearnMorePage() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("");

  // The raw markdown content from ABOUT ACEPLACE.md
  const rawMarkdown = `# ABOUT ACEPLACE™

## ACELOGIC™ + ACEAGENTS™ + ACEPLACE™

### Deterministic Agent Identity to Governed Autonomous Execution

Every agent you create has a persistent identity. Every action is governed. Every outcome remains accountable.

ACELOGIC™ creates deterministic agent identities.

Those identities become ACEAGENTS™ — canonical digital workers with persistent identity, continuity, accountability, and governance throughout their operational lifecycle.

ACEPLACE™ governs how those identities perform autonomous work through deterministic execution, authority-controlled orchestration, traceable operations, grounded knowledge, and human oversight.

ACELOGIC™  
Deterministic Identity Authority  
       ↓  
ACEAGENT™  
Canonical Digital Worker  
       ↓  
ACEPLACE™  
Governed Execution Infrastructure  
       ↓  
Autonomous Work  
       ↓  
Human Oversight  
---

# WHAT IS AN ACEAGENT™?

Agents created through ACELOGIC™ are known as ACEAGENTS™.

An ACEAGENT™ is a canonical digital worker possessing deterministic identity, lifecycle continuity, execution accountability, and governed participation within autonomous systems.

Unlike traditional AI agents that are instantiated, perform a task, and disappear, ACEAGENTS™ persist across sessions, runtime restarts, orchestration cycles, and governed execution workflows.

Every ACEAGENT™ maintains a persistent continuity record linking identity, actions, decisions, artifacts, governance events, and operational history throughout its lifecycle.

If the system powers off, disconnects, or restarts, the same deterministic identities are restored.

The runtime does not generate random replacement agents.

Identity continuity remains preserved throughout the agent lifecycle.

---

# POSITIONING

## ACEPLACE™ IS NOT

✕ A chatbot framework

✕ A workflow toy

✕ A generic orchestration application

✕ A simple AI wrapper

✕ An autonomous chat agent platform

---

## ACEPLACE™ IS

✓ Deterministic runtime infrastructure

✓ Identity-bound execution platform

✓ Authority-controlled autonomous execution

✓ Envelope-driven runtime architecture

✓ Traceable multi-agent orchestration

✓ Governed autonomous workforce infrastructure

✓ Continuity-preserving agent execution

✓ Accountability-driven autonomous systems

---

# THE ACELOGIC™ + ACEAGENT™ + ACEPLACE™ STACK

## CONTROL PLANE — ACELOGIC™

Identity Authority

Deterministic Agent Fingerprints

Agent Verification

Purpose Hash Validation

Authority Lease Issuance

Orchestration Governance

Runtime Trust Enforcement

Identity Continuity Management

ACELOGIC™ establishes identity continuity before execution is permitted.

---

## AGENT PLANE — ACEAGENT™

Canonical Digital Workers

Persistent Identity

Deterministic Fingerprints

Lifecycle Continuity

Governed Participation

Role Persistence

Continuity Records

Operational Accountability

Every ACEAGENT™ maintains identity continuity throughout autonomous execution.

---

## EXECUTION PLANE — ACEPLACE™

Execution Envelopes

Runtime Workers

Lease Validation

State Transitions

Artifact Persistence

Execution Traceability

Governance Enforcement

Continuity Preservation

ACEPLACE™ governs how deterministic identities perform work.

---

## COMPUTE PLANE — AGENT ENGINES

COO (Planner)

Researcher (Analyst)

Worker (Executor)

Grader (Evaluator)

BYO-LLM Providers

Agent engines remain stateless.

Runtime continuity exists within the execution envelope and persistence layer.

---

# KNOWLEDGE BASE & GROUNDING

## Ground Knowledge. Govern Execution.

ACEPLACE™ enables organizations to govern not only how ACEAGENTS™ execute work, but also what knowledge, instructions, protocols, and operational context they execute against.

Knowledge is managed through the ACEPLACE™ Knowledge Base and injected directly into governed execution workflows.

---

## KNOWLEDGE COLLECTIONS

Organize operational knowledge into structured collections.

Supported sources include:

PDF Documents

Technical Documentation

Operational Playbooks

Research Repositories

Protocol Libraries

Text-Based Knowledge Assets

Collections can be activated dynamically per workflow.

---

## INSTRUCTION PROFILES

Deploy reusable behavioral frameworks across ACEAGENTS™.

Examples include:

Grounded Execution Strategist

Quality Assurance Standards

Compliance Protocols

Industry-Specific Workflows

Enterprise Operating Procedures

Instruction profiles become part of governed execution context.

---

## RUNTIME CONTEXT INJECTION

Inject task-specific knowledge directly into active workflows.

Users can provide:

Objectives

Constraints

Requirements

Domain Knowledge

Project Context

Operational Instructions

Injected context is synchronized into the execution envelope before agent dispatch.

---

## CONTEXT GOVERNANCE

Knowledge does not live inside agents.

Knowledge is attached to execution through governed context injection.

This ensures:

Deterministic execution

Reproducible outcomes

Auditable grounding

Traceable context lineage

Controlled knowledge updates

---

## ACTIVE GROUNDING CONTEXT

Every execution can be grounded against:

Knowledge Collections

Instruction Profiles

Runtime Context Blocks

Web Research Results

Enterprise Documentation

External Data Sources

Grounding context becomes part of the execution trace and continuity record.

---

## KNOWLEDGE TRACEABILITY

ACEPLACE™ records:

Which knowledge sources were used

Which context blocks were active

Which instruction profiles were applied

Which documents influenced outputs

Which ACEAGENTS™ consumed the information

This creates a complete lineage between knowledge, execution, and resulting artifacts.

---

## GOVERNED KNOWLEDGE OPERATIONS

Knowledge remains under organizational control.

ACEAGENTS™ do not permanently learn from uploaded information.

Instead, knowledge is:

Indexed

Activated

Injected

Traced

Governed

for each execution workflow.

Knowledge remains separate from identity while remaining fully traceable throughout execution.

---

# CANONICAL RUNTIME LAW

Agents are stateless.

The envelope holds state.

Execution flows as:

Execution Envelope → Runtime Worker → Agent Engine

Identity flows through ACELOGIC™.

Governance flows through ACEPLACE™.

Continuity flows through persistent records.

---

# CORE CAPABILITIES

## DETERMINISTIC IDENTITY

ACELOGIC™ identity authority

Deterministic fingerprints

Purpose hashes

Identity verification

Persistent agent continuity

Governed orchestration roles

Continuity preservation

---

## AUTHORITY LEASE SYSTEM

Execution authority granted per step

Lease expires after completion

Runtime validation required

Controlled state transitions

Deterministic sequencing enforced

Prevents uncontrolled execution

Maintains governed execution authority

---

## EXECUTION ENVELOPES

Runtime source of truth

Holds all execution state

Immutable execution history

Artifact references

Lease validation state

Execution continuity layer

Governed state management

---

## EXECUTION TRACEABILITY

Agent identity per action

Timestamped execution events

Continuity records

Task ownership tracking

Artifact lineage

Compliance history

Governance audit trail

Execution accountability

---

## CONTINUITY & PERSISTENCE

Envelope state persistence

Execution trace retention

Identity continuity

Artifact lineage archival

Cross-session restoration

Governed operational history

Continuity record preservation

Lifecycle accountability

---

## STATELESS AGENT MODEL

Agents store no internal state

Runtime state remains in envelopes

Deterministic recovery

Identity continuity preserved

No random agent replacement

Governed execution consistency

Persistent operational memory

---

# RUNTIME LIFECYCLE

## 01 — ENVELOPE INITIALIZATION

Task deployed.

Execution envelope created containing context, objectives, constraints, participating ACEAGENTS™, governance rules, continuity records, execution history, and grounding context.

---

## 02 — IDENTITY VERIFICATION

ACELOGIC™ verifies agent identities.

Fingerprints validated.

Roles confirmed.

Authority established.

Continuity records verified.

---

## 03 — AUTHORITY LEASE ACQUISITION

Runtime worker requests execution authority.

ACELOGIC™ issues a lease for a single approved execution step.

---

## 04 — DETERMINISTIC EXECUTION

Runtime worker dispatches the appropriate stateless agent engine.

Agent reads envelope state.

Agent performs execution.

Results written back to the envelope.

Execution recorded against agent continuity history.

---

## 05 — LEASE EXPIRY & VALIDATION

Execution authority expires.

Runtime validates state transition.

New lease issued only if governance requirements are satisfied.

---

## 06 — ARTIFACT GENERATION

Worker agents create deliverables.

Grader agents evaluate correctness, quality, compliance, and governance adherence.

Artifacts linked to originating ACEAGENT™ identities.

---

## 07 — TRACE PERSISTENCE

Execution events written to persistence.

Identity history maintained.

Artifacts archived.

Lineage preserved.

Continuity records updated.

---

## 08 — HUMAN OVERSIGHT & CONTINUATION

Artifacts enter review.

Humans can approve, deny, or continue the work.

Approve finalizes the artifact.

Deny rejects the artifact or triggers redeployment.

Edit / Continue allows the user to add direction, revisions, or extensions while preserving the original execution envelope.

Runtime does not autonomously finalize outputs.

Governance remains enforced through completion and continuation.

---

# SANDBOX MODE: PRE-CONNECTED DETERMINISTIC AGENT FLEET

## COO — PLANNER

Task decomposition

Execution planning

Step sequencing

Governance-aware orchestration

Stateless • Identity-Bound • Persistent

---

## RESEARCHER — ANALYST

Information retrieval

Validation

Research synthesis

External grounding

Stateless • Identity-Bound • Persistent

---

## WORKER — EXECUTOR

Artifact generation

Implementation

Report production

Task execution

Stateless • Identity-Bound • Persistent

---

## GRADER — EVALUATOR

Output evaluation

Quality scoring

Compliance review

Governance validation

Stateless • Identity-Bound • Persistent

---

# BRING YOUR OWN LLM

## Your Models. Your Costs. Your Choice.

ACEPLACE™ uses a BYO-LLM architecture.

Connect your own provider accounts while ACEPLACE™ governs execution.

Supported providers include:

OpenAI

Anthropic

Google Gemini

Azure OpenAI

NVIDIA NIM

OpenRouter

Private Endpoints

All inference costs are billed directly to your configured provider account.

ACEPLACE™ governs execution.

You control inference.

---

# DASHBOARD TELEMETRY & CONTINUITY RECORDS

## Runtime Operations

• Token usage per ACEAGENT™

• Runtime request counts

• Execution cost estimates

• Orchestration activity

• Provider health status

---

## Identity & Continuity

• Identity verification events

• Continuity records

• Agent lifecycle history

• Cross-session identity restoration

• Authority lease activity

---

## Governance & Accountability

• Governance approval metrics

• Execution trace volume

• Artifact lineage tracking

• Execution audit trails

• Human review history

---

## Agent Activity Intelligence

• See which ACEAGENT™ performed each task

• View execution timestamps for every action

• Track task ownership across workflows

• Review agent decision history

• Trace artifacts back to originating agents

Every action performed within ACEPLACE™ is traceable to a deterministic ACEAGENT™ identity, creating a complete continuity record across execution, governance, decisions, and artifact generation.

---

# GOVERNANCE MODEL

## HUMAN-IN-THE-LOOP

Artifacts are not automatically finalized.

After artifact generation, the human reviewer can:

Approve — finalize the artifact.

Deny — reject the artifact and stop or redeploy.

Edit / Continue — add instructions, request changes, or extend the work without restarting the task.

Governed execution remains under human authority.

Continuation workflows preserve the original envelope, continuity records, agent history, traces, and artifact lineage.

The user can continue work from the current governed state instead of starting over.

---

## EXECUTION PROTOCOL

Structured execution governance

Runtime-enforced controls

Deterministic agent communication

Auditable orchestration

Protocol compliance required

Continuity-aware execution management

---

## ARTIFACT PERSISTENCE

PDF export

Execution lineage

Trace-linked sourcing

Governance history

Portable deliverables

Long-term archival

Continuity preservation

---

# CURRENT RUNTIME MODE

## DEVELOPER SANDBOX

### Public Runtime Preview

Pre-created deterministic ACEAGENTS™

NXQ-hosted runtime infrastructure

BYO-LLM execution

Deterministic orchestration

Execution trace persistence

Continuity records

Governance workflows

Human approval enforcement

Runtime observability

Identity continuity

Canonical agent lifecycle management

Agent activity intelligence

Execution accountability

*Future enterprise deployments support private infrastructure, containers, APIs, SDKs, customer-controlled execution environments, and enterprise-scale autonomous workforce governance.*

`;

  // --- PARSER LOGIC ---
  // We parse the raw markdown into a structured object instead of just passing it to a renderer.

  // 1. Split into major sections based on H1 (#)
  const sections = rawMarkdown.split(/(?=^# )/m).filter(s => s.trim().length > 0);

  // Helper to parse a section into subsections (H2)
  const parseSubsections = (text: string) => {
    return text.split(/(?=^## )/m)
      .filter(s => s.trim().startsWith('##'))
      .map(sub => {
        const lines = sub.trim().split('\n');
        const titleLine = lines[0].replace(/^##\s*/, '').replace(/\*/g, '').trim();
        const content = lines.slice(1).join('\n').trim();
        return { title: titleLine, content, original: sub };
      });
  };

  const getSectionData = (titleSubstring: string) => {
    return sections.find(s => s.toUpperCase().includes(titleSubstring.toUpperCase())) || "";
  };

  // Setup GSAP reveal animations
  useEffect(() => {
    if (!contentRef.current) return;
    const elements = contentRef.current.querySelectorAll('.reveal-up');
    gsap.set(elements, { y: 30, opacity: 0 });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          gsap.to(entry.target, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // -- RENDERERS FOR SPECIFIC SECTIONS --

  const renderComparison = () => {
    const section = getSectionData("POSITIONING");
    if (!section) return null;

    const subs = parseSubsections(section);
    const isNotSection = subs.find(s => s.title.includes("IS NOT"));
    const isSection = subs.find(s => s.title.includes("IS") && !s.title.includes("NOT"));

    const notItems = isNotSection?.content.split('\n').filter(l => l.includes('✕')).map(l => l.replace('✕', '').trim()) || [];
    const isItems = isSection?.content.split('\n').filter(l => l.includes('✓')).map(l => l.replace('✓', '').trim()) || [];

    return (
      <div className="grid md:grid-cols-2 gap-8 my-16 reveal-up">
        {/* IS NOT Card */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] -z-10 group-hover:bg-red-500/20 transition-all duration-700"></div>
          <h3 className="text-2xl font-black text-red-400 tracking-widest uppercase mb-8 flex items-center gap-3">
            <XIcon className="w-8 h-8" /> ACEPLACE IS NOT
          </h3>
          <ul className="space-y-6">
            {notItems.map((item, i) => (
              <li key={i} className="flex items-start gap-4 text-gray-300">
                <span className="mt-1 text-red-500 shrink-0"><XIcon className="w-5 h-5" /></span>
                <span className="text-lg font-light tracking-wide">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* IS Card */}
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-8 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] -z-10 group-hover:bg-cyan-500/20 transition-all duration-700"></div>
          <h3 className="text-2xl font-black text-cyan-400 tracking-widest uppercase mb-8 flex items-center gap-3">
            <Check className="w-8 h-8" /> ACEPLACE IS
          </h3>
          <ul className="space-y-6">
            {isItems.map((item, i) => (
              <li key={i} className="flex items-start gap-4 text-gray-300">
                <span className="mt-1 text-cyan-500 shrink-0"><Check className="w-5 h-5" /></span>
                <span className="text-lg font-light tracking-wide">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderStack = () => {
    const section = getSectionData("STACK");
    if (!section) return null;

    const subs = parseSubsections(section);
    const icons = [Shield, Cpu, Box, Database];

    return (
      <div className="my-24 reveal-up">
        <h2 className="text-4xl font-black text-white tracking-[0.2em] uppercase mb-12 text-center drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">The Core Stack</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {subs.map((sub, i) => {
            const lines = sub.content.split('\n').filter(l => l.trim().length > 0 && !l.includes('---'));
            const lastLine = lines[lines.length - 1];
            const desc = lastLine && lastLine.length > 40 ? lines.pop() : ""; // The last long line is usually the summary
            const Icon = icons[i % icons.length];

            return (
              <div key={i} className="bg-[#05070a]/80 border border-white/5 hover:border-cyan-500/30 rounded-xl p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.1)] group flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 transition-transform duration-500">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-wider uppercase mb-4">{sub.title.split('—')[0]}</h3>
                <h4 className="text-xs font-black text-cyan-500/70 tracking-[0.2em] uppercase mb-4">{sub.title.split('—')[1]}</h4>
                <ul className="space-y-2 flex-grow mb-6">
                  {lines.map((line, j) => (
                    <li key={j} className="text-sm text-gray-400 font-light flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-cyan-500/50"></div>
                      {line}
                    </li>
                  ))}
                </ul>
                {desc && <p className="text-xs text-cyan-400/80 font-mono mt-auto pt-4 border-t border-white/5 leading-relaxed">{desc}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    const section = getSectionData("RUNTIME LIFECYCLE");
    if (!section) return null;

    const subs = parseSubsections(section);
    return (
      <div className="my-32 relative reveal-up">
        <h2 className="text-4xl font-black text-white tracking-[0.2em] uppercase mb-20 text-center">Runtime Lifecycle</h2>
        <div className="absolute left-4 md:left-1/2 top-32 bottom-0 w-[2px] bg-gradient-to-b from-cyan-500/50 via-cyan-500/10 to-transparent -translate-x-1/2 rounded-full"></div>

        <div className="space-y-12 md:space-y-24">
          {subs.map((sub, i) => {
            const isEven = i % 2 === 0;
            const lines = sub.content.split('\n').filter(l => l.trim().length > 0 && !l.includes('---'));
            const stepNum = sub.title.split('—')[0].trim();
            const stepTitle = sub.title.split('—')[1]?.trim() || "";

            return (
              <div key={i} className={`relative flex flex-col md:flex-row items-center ${isEven ? 'md:justify-start' : 'md:justify-end'} group`}>
                {/* Node */}
                <div className="absolute left-4 md:left-1/2 w-8 h-8 bg-[#05070a] border-2 border-cyan-500 rounded-full -translate-x-1/2 flex items-center justify-center z-10 group-hover:scale-125 group-hover:bg-cyan-500 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all duration-300">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full group-hover:bg-white"></div>
                </div>

                {/* Content Card */}
                <div className={`w-full pl-16 md:pl-0 md:w-[45%] ${isEven ? 'md:pr-16 text-left md:text-right' : 'md:pl-16 text-left'} transition-all duration-500 hover:-translate-y-1`}>
                  <div className="bg-[#05070a]/60 backdrop-blur-md border border-white/10 rounded-xl p-8 hover:border-cyan-500/30 hover:shadow-[0_10px_30px_rgba(6,182,212,0.05)] relative overflow-hidden">
                    <div className={`absolute top-0 ${isEven ? 'right-0' : 'left-0'} w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] -z-10`}></div>
                    <span className="text-4xl font-black text-cyan-500/20 absolute -top-2 -right-2 font-mono">{stepNum}</span>
                    <h3 className="text-xl font-bold text-white tracking-widest uppercase mb-4">{stepTitle}</h3>
                    <div className="space-y-3">
                      {lines.map((line, j) => (
                        <p key={j} className="text-gray-400 font-light text-sm md:text-base leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGenericGrid = (sectionTitle: string) => {
    const section = getSectionData(sectionTitle);
    if (!section) return null;

    const subs = parseSubsections(section);
    return (
      <div className="my-24 reveal-up">
        <h2 className="text-4xl font-black text-white tracking-[0.2em] uppercase mb-12 text-center">{sectionTitle.split('&')[0]}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subs.map((sub, i) => {
            const lines = sub.content.split('\n').filter(l => l.trim().length > 0 && !l.includes('---'));
            return (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-8 hover:bg-white/[0.04] transition-colors">
                <h3 className="text-lg font-bold text-cyan-400 tracking-wider uppercase mb-6 flex items-center gap-3">
                  <div className="w-2 h-2 bg-cyan-500 rounded-sm rotate-45"></div>
                  {sub.title}
                </h3>
                <div className="space-y-4">
                  {lines.map((line, j) => (
                    <p key={j} className="text-gray-300 font-light text-sm leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHero = () => {
    const section = getSectionData("ABOUT ACEPLACE");
    if (!section) return null;

    const lines = section.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
    const subtitle = lines[0].replace(/\*/g, '');
    const intro = lines.slice(1, 4).map(l => l.replace(/\*/g, ''));

    return (
      <div className="relative min-h-[70vh] flex flex-col items-center justify-center text-center py-20 px-4 reveal-up">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] -z-10 blur-3xl"></div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-black tracking-widest uppercase mb-8">
          <Activity className="w-4 h-4" /> System Overview
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-[0.2em] uppercase mb-8">
          ABOUT ACEPLACE
        </h1>
        <h2 className="text-xl md:text-2xl font-light text-cyan-400 tracking-widest uppercase max-w-3xl mb-12 leading-relaxed">
          {subtitle}
        </h2>
        <div className="max-w-4xl space-y-6">
          {intro.map((p, i) => (
            <p key={i} className={`text-lg md:text-xl ${i === 0 ? 'text-white font-medium' : 'text-gray-400 font-light'} leading-relaxed`}>
              {p}
            </p>
          ))}
        </div>
      </div>
    );
  };

  const renderFlowDiagram = () => {
    const flowSteps = [
      { title: "ACELOGIC™", desc: "Deterministic Identity Authority" },
      { title: "ACEAGENT™", desc: "Canonical Digital Worker" },
      { title: "ACEPLACE™", desc: "Governed Execution Infrastructure" },
      { title: "Autonomous Work", desc: "Execution Output" },
      { title: "Human Oversight", desc: "Governance & Continuity" }
    ];

    return (
      <div className="my-24 reveal-up flex flex-col items-center">
        <div className="flex flex-col items-center gap-4 w-full max-w-3xl">
          {flowSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div className="w-full bg-[#05070a]/80 border border-white/10 hover:border-cyan-500/50 rounded-xl p-6 text-center transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="text-2xl font-black text-white tracking-widest uppercase mb-2">{step.title}</h3>
                <p className="text-cyan-400 font-light tracking-wide uppercase text-sm">{step.desc}</p>
              </div>
              {i < flowSteps.length - 1 && (
                <div className="h-12 w-[2px] bg-gradient-to-b from-cyan-500/50 to-transparent flex flex-col justify-end items-center opacity-50">
                  <div className="w-2 h-2 bg-cyan-400 rotate-45 translate-y-[4px]"></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#020408] text-white tech-grid scanline overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-100">
      {/* Header */}
      <header className="w-full z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020408]/80 backdrop-blur-xl sticky top-0">
        <Link href="/" className="flex items-center gap-2 px-3 py-1.5 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-400 font-black text-[10px] md:text-xs uppercase tracking-widest transition-all scifi-clip">
          <ArrowLeft className="w-3 h-3" /> BACK
        </Link>
        <div className="flex items-center gap-3">
          <img src="/ace-symbol.png" alt="ACEPLACE" className="w-8 h-8 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
          <span className="text-sm font-mono font-black tracking-[0.3em] text-cyan-400 uppercase hidden sm:block">
            ACEPLACE <span className="text-white">WORKSTATION</span>
          </span>
        </div>
        <Link href="/dashboard" className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] md:text-xs uppercase tracking-widest transition-all scifi-clip">
          ACCESS
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12" ref={contentRef}>
        {renderHero()}
        {renderFlowDiagram()}
        {renderComparison()}
        {renderStack()}
        {renderGenericGrid("KNOWLEDGE BASE")}
        {renderGenericGrid("CORE CAPABILITIES")}
        {renderTimeline()}
        {renderGenericGrid("SANDBOX MODE")}

        {/* Footer info block */}
        <div className="mt-32 pt-16 border-t border-white/10 text-center reveal-up">
          <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase mb-8">BRING YOUR OWN LLM</h2>
          <p className="text-gray-400 font-light max-w-2xl mx-auto leading-relaxed mb-12">
            ACEPLACE uses a BYO-LLM architecture. Connect your own provider accounts while ACEPLACE governs execution. Supported providers include OpenAI, Anthropic, Google Gemini, Azure OpenAI, NVIDIA NIM, and OpenRouter.
          </p>
          <div className="inline-block p-[1px] rounded-full bg-gradient-to-r from-cyan-500/50 via-purple-500/50 to-cyan-500/50">
            <div className="px-8 py-4 rounded-full bg-[#05070a] text-sm font-bold tracking-widest text-white uppercase">
              ACEPLACE Governs Execution. You Control Inference.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
