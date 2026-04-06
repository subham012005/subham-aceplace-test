# ACEPLACE — System Architecture

> **Version:** 2.0 (Phase 2 — Deterministic Runtime)
> **Last Updated:** 2026-03-30

---

## Overview

ACEPLACE is a **multi-agent AI task execution platform** built on a deterministic, envelope-driven runtime. It replaces the previous n8n-based orchestration with a code-native, auditable, fork-resistant execution model.

The system is split into three tiers:

| Tier | Technology | Role |
|------|-----------|------|
| **Frontend + API** | Next.js 16 (TypeScript) | Dashboard UI, REST API routes, Enqueues work |
| **Runtime Worker** | Node.js (TypeScript) | Claims envelopes, executes deterministic state machine, `#us#` message routing |
| **Agent Engine** | Python 3.10 + FastAPI | LLM step execution, artifact production |

All tiers communicate through **Firestore** as the shared state store. The worker communicates directly with the Python agent engine via HTTP for step dispatch.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ACEPLACE WORKSTATION (Next.js)                        │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │  Dashboard  │  │  Task        │  │  Envelope Inspector /       │  │
│  │  UI         │  │  Composer    │  │  Governance Panel           │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────────┬─────────────┘  │
│         │                │                          │                │
│  ┌──────▼──────────────────────────────────────────▼─────────────┐  │
│  │                                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │         apps/runtime-worker (DETERMINISTIC ENGINE)       │   │  │
│  │  │                + packages/runtime-core                   │   │  │
│  │  │  parallel-runner.ts · state-machine.ts · step-planner.ts │   │  │
│  │  │                                                         │   │  │
│  │  │  kernels/: identity · authority · persistence           │   │  │
│  │  │           communications · execution                    │   │  │
│  │  │  telemetry/: emitRuntimeMetric · aggregateTelemetry    │   │  │
│  │  └──────────────────────────┬──────────────────────────────┘   │  │
│  │                             │                                   │  │
│  │  ┌─────────────────────┐    │    ┌──────────────────────────┐  │  │
│  │  │  acelogic/          │    │    │  explorer/               │  │  │
│  │  │  (License/Identity) │    │    │  (Read-only query API)   │  │  │
│  │  └─────────────────────┘    │    └──────────────────────────┘  │  │
│  └─────────────────────────────┼───────────────────────────────────┘  │
│                                │ HTTP                                  │
└────────────────────────────────┼───────────────────────────────────────┘
                                 │
               ┌─────────────────▼──────────────────┐
               │   PYTHON AGENT ENGINE (FastAPI)      │
               │   agent-engine/                      │
               │                                      │
               │   POST /execute-step                 │
               │   POST /execute                      │
               │   GET  /health · /config             │
               │                                      │
               │   graph/: runtime_loop · nodes/      │
               │   services/: firestore               │
               └─────────────────┬──────────────────┘
                                 │
               ┌─────────────────▼──────────────────┐
               │           GOOGLE FIRESTORE           │
               │                                      │
               │  execution_envelopes  (PRIMARY)      │
               │  agents · artifacts                  │
               │  execution_traces · licenses         │
               │  execution_messages · protocol_msgs  │
               │  telemetry_events · telemetry_rollups│
               │  envelope_metrics · agent_metrics    │
               │  license_audit_events                │
               │  jobs (legacy, read-only UI pointer) │
               └──────────────────────────────────────┘
```

---

## Core Concept: The Execution Envelope

The **Canonical Execution Envelope** is the single source of truth for every task. All execution state — steps, leases, identity context — is **embedded inside the envelope document** in Firestore. There are no separate `leases` or `execution_steps` collections.

```
ExecutionEnvelope {
  envelope_id         — Unique ID (env_*)
  org_id              — Organization scope
  status              — Lifecycle state (see state machine below)
  license_id          — ACELOGIC license binding

  identity_context    — Primary agent identity + SHA-256 fingerprint
  identity_contexts   — Per-agent identities (multi-agent mode)
  authority_lease     — Embedded lease (single-agent path)
  authority_leases    — Per-agent leases (multi-agent path)

  steps[]             — Ordered step graph (EMBEDDED — not external)
  artifact_refs[]     — IDs of produced artifacts
  trace_head_hash     — SHA-256 hash chain head (tamper detection)

  coordinator_agent_id — COO agent for multi-agent runs
  multi_agent          — True if using handoff path
  root_task_id         — Source task/draft ID
  decomposition_plan   — Optional parallel work decomposition

  created_at / updated_at
  prompt / user_id / job_id  (legacy UI fields, read-only)
}
```

---

## Envelope State Machine

State transitions are **atomic** (Firestore transactions) and strictly enforced. No skipping is allowed.

```
                    ┌─────────┐
                    │ created │
                    └────┬────┘
                         │ lease acquired
                    ┌────▼────┐
                    │ leased  │
                    └────┬────┘
                         │ steps planned
                    ┌────▼────┐
                    │ planned │
                    └────┬────┘
                         │ runner starts
                    ┌────▼─────┐
                    │executing │◄──┐
                    └────┬─────┘   │
                         │         │ (retry)
               ┌─────────┼────────────────┐
               │         │                │
               ▼         ▼                ▼
       ┌───────────┐ ┌──────────┐  ┌──────────┐
       │awaiting_  │ │completed │  │ failed   │
       │human      │ │(multi)   │  │          │
       └─────┬─────┘ └──────────┘  └──────────┘
             │
          ┌──┴────────┐
          │           │
          ▼           ▼
      ┌──────────┐ ┌─────────┐
      │ approved │ │rejected │
      └──────────┘ └─────────┘

  quarantined — terminal (fork conflict, manual recovery required)
```

---

## Two Execution Paths

### Path 1 — Single-Agent Dispatch (`/api/runtime/dispatch` + dashboard helper)

Used for simple tasks submitted via the dashboard TaskComposer.
The dashboard calls `POST /api/runtime/dispatch/from-dashboard`, which authenticates
the user via Firebase ID token and then invokes the core `dispatch()` entry point
behind the scenes.

```
POST /api/runtime/dispatch  (or /api/runtime/dispatch/from-dashboard from the UI)
  → engine.ts::dispatch()
  → Builds envelope with default COO agent
  → runtime-loop.ts::runEnvelope()
     → identity kernel: verify fingerprint
     → authority kernel: acquire single lease
     → For each step:
         → Send #us# protocol message
         → Call Python agent-engine POST /execute-step
         → Persist artifact
         → Update step + advance next step to "ready"
     → Transition envelope to approved/failed
```

### Path 2 — Multi-Agent Handoff (`/api/runtime/handoff`)

Used for complex tasks with multiple agent roles (COO, Researcher, Worker, Grader).

```
POST /api/runtime/handoff
  → ace-handoff.ts::acceptAceHandoff()
     → Validate #us#.task.handoff message
     → Resolve per-agent fingerprints
     → Build multi-agent execution envelope
     → persistence::enqueueEnvelope()

(In Background App: runtime-worker)
  → Claims envelope from execution_queue
  → parallel-runner.ts::runEnvelopeParallel()
     → For each step batch (bounded parallelism):
         → acelogicExecutionGuard() — license + identity check
         → acquirePerAgentLease() — per-agent authority
         → leaseHeartbeatManager.start()
         → Create + handle #us# protocol message
         → Finalize step (completed/failed/retry)
         → releasePerAgentLease()
     → Transition envelope on completion
```

---

## ACELOGIC System

ACELOGIC is the **license and capability control plane**. Every execution attempt goes through it.

```
ACELOGIC Guard Flow:
  1. Resolve license by license_id + org_id (from Firestore licenses/{id})
  2. Check license status === "active" and not expired
  3. Check "identity_core" capability (Gate 1 — all tiers)
  4. Optionally check "fork_detection" (Gate 5 — Builder+) for lease issuance
  5. Return: { allowed, identity_context, lease }
```

### Licensing Tiers

| Tier | Name | Gates | Key Capabilities |
|------|------|-------|-----------------|
| **Free** | Observer | 1–3 | Identity verification only |
| **Builder** | Operator | 1–6 | Lease enforcement, multi-step graphs |
| **Growth** | Sovereign | 1–6+ | Multi-agent orchestration, fork detection |

### Dev Mode (No License Needed)

Set `ACELOGIC_DEV_LICENSE_FALLBACK=true` in `.env.local`. The guard will use a synthetic dev license with `ACELOGIC_DEV_LICENSE_TIER` (default: `builder`).

---

## #us# Machine Grammar Protocol

All agent-to-agent communication uses the `#us#` typed protocol. **Only 5 verbs are legal:**

| Verb | Step Type | Role |
|------|-----------|------|
| `#us#.task.plan` | `plan` | COO strategic planning |
| `#us#.task.assign` | `assign` | Researcher task assignment |
| `#us#.artifact.produce` | `artifact_produce` | Worker output creation |
| `#us#.evaluation.score` | `evaluation` | Grader quality scoring |
| `#us#.execution.complete` | `complete` | Execution finalization |

Messages are persisted to `execution_messages` (canonical) or `protocol_messages` (legacy path).

---

## Agent Roles

| Role | Agent ID pattern | Responsibility |
|------|-----------------|---------------|
| **COO** | `agent_coo` | Planning, coordination, handoff |
| **Researcher** | `agent_researcher` | Task assignment, information gathering |
| **Worker** | `agent_worker` | Artifact production (LLM output) |
| **Grader** | `agent_grader` | Quality evaluation and scoring |

---

## Telemetry

Every significant runtime event emits a metric to Firestore:

- `ENVELOPE_CREATED` / `ENVELOPE_COMPLETED` / `ENVELOPE_FAILED`
- `STEP_STARTED` / `STEP_COMPLETED` / `STEP_FAILED` / `STEP_RETRY_SCHEDULED`
- `LEASE_ACQUIRED` / `LEASE_RELEASED`

Events land in `telemetry_events`. Cron rollups aggregate into `telemetry_rollups` and `envelope_metrics`.

---

## Explorer (Read-Only API Layer)

The Explorer provides auditable, read-only access to runtime data without mutating state. It exposes envelopes, messages, artifacts, traces, and telemetry via `/api/explorer/*` routes.

---

## Related Documents

- [QUICK_START.md](./QUICK_START.md) — Setup and running instructions
- [API_REFERENCE.md](./API_REFERENCE.md) — REST API endpoints
- [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md) — Database collections and schema
- [RUNTIME_INTERNALS.md](./RUNTIME_INTERNALS.md) — Deep runtime engine details
- [PHASE_2_IMPLEMENTATION_PLAN.md](./PHASE_2_IMPLEMENTATION_PLAN.md) — Original implementation specification
