# ACEPLACE — Phase 2: Deterministic Runtime Implementation Plan

> **Version:** 1.1  
> **Date:** 2026-03-22  
> **Status:** IMPLEMENTATION — In Progress  
> **Tracks Progress In:** `docs/phase2_tasks.csv`

---

## 🤖 AI Agent Instructions

> **READ THIS FIRST.** This section is specifically for AI coding agents (Copilot, Claude, Gemini, etc.) that are tasked with implementing Phase 2 of the ACEPLACE. Follow these instructions exactly.

### How to Use This Plan

1. **Read this entire document first** to understand the full Phase 2 architecture, the 5 kernels, the envelope format, and the Firestore schema before writing any code.
2. **Read the reference docs** in `docs/` folder — especially `API_REFERENCE.md` for Phase 1 context and the three Phase 2 PDF specifications for deep architecture understanding.
3. **Check the task tracker** at `docs/phase2_tasks.csv` to see what has been completed and what remains. Always start by reading this CSV.
4. **Follow the Sprint order** (Sprint 1 → Sprint 2 → ... → Sprint 6). Tasks within earlier sprints are dependencies for later sprints. Do NOT skip ahead.
5. **Respect existing code patterns.** Study the Phase 1 code (hooks, components, API routes) and match the same coding style, naming conventions, and file structure.

### How to Implement a Feature

For each task you pick up from the CSV:

1. **Check the CSV** — Open `docs/phase2_tasks.csv` and find the task row. Confirm its `Status` is `Not Started`.
2. **Read the task details** — Use the `TaskName`, `Description`, `FilePath`, and `Notes` columns to understand what to build.
3. **Find the corresponding section in this plan** — Section 4 has detailed requirements for each feature. Section 5 has the file-level map. Use these as your specification.
4. **Check dependencies** — Look at the task's `Sprint` number. All tasks in previous sprints (lower sprint numbers) should be `Done` first. If they're not, implement those first.
5. **Create or modify the file** at the path specified in the `FilePath` column.
6. **Follow these code rules:**
   - All TypeScript types go in `packages/runtime-core/src/types.ts`
   - All constants/enums go in `packages/runtime-core/src/constants.ts`
   - Server-side Firestore code uses `firebase-admin` (see `src/lib/firebase-admin.ts`)
   - Client-side Firestore code uses `firebase` SDK (see `src/lib/firebase.ts`)
   - React hooks use the pattern from `src/hooks/useJobs.ts` (Firestore `onSnapshot` subscriptions)
   - UI components use the design language from existing components (HUDFrame, SciFiFrame, cyan/slate theme, HUD-style labels)
   - API routes follow the Next.js App Router pattern (see `src/app/api/jobs/` for examples)
7. **Verify your work** — After implementation, check:
   - `npx tsc --noEmit` — zero type errors
   - `npm run build` — successful build
   - Manual: the feature works as described in the plan

### How to Mark a Task as Done in the CSV

After you have **fully implemented and verified** a task, update `docs/phase2_tasks.csv`:

1. **Open** the file `docs/phase2_tasks.csv`
2. **Find the row** matching the `TaskID` you completed (e.g., `T-001`)
3. **Change the `Status` column** from `Not Started` to `Done`
4. **Fill in the `CompletedDate` column** with today's date in `YYYY-MM-DD` format (e.g., `2026-03-18`)
5. **Optionally add notes** in the `Notes` column if there are important details about the implementation

**Example — before:**
```csv
T-001,Sprint 1,Foundation,TypeScript Types,"Create all TypeScript interfaces...",packages/runtime-core/src/types.ts,Not Started,Critical,,Foundational — all other files depend on this
```

**Example — after:**
```csv
T-001,Sprint 1,Foundation,TypeScript Types,"Create all TypeScript interfaces...",packages/runtime-core/src/types.ts,Done,Critical,2026-03-18,Created 15 interfaces covering envelopes steps leases and identities
```

### Status Values for CSV

| Status | Meaning |
|---|---|
| `Not Started` | Task has not been picked up yet |
| `In Progress` | Task is currently being worked on (set this when you start) |
| `Done` | Task is fully implemented and verified |
| `Blocked` | Task cannot proceed — add reason in Notes column |

### Important Rules

- **One task at a time.** Complete and mark one task as `Done` before moving to the next.
- **Always update the CSV.** Never leave a completed task unmarked. The CSV is the single source of truth for project progress.
- **Sprint order matters.** Sprint 1 tasks are prerequisites for Sprint 2, etc. The dependency chain is: Foundation → Kernels → API → Hooks → UI → Integration.
- **Do not break existing Phase 1 features.** The n8n-based job system must continue to work. Phase 2 runs in parallel via a feature flag (`NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME`).
- **Match the existing design language.** All new UI components should use the same sci-fi/HUD aesthetic — dark backgrounds, cyan/slate accents, `tracking-widest`, `font-black`, `uppercase`, `text-[9px]` labels, border effects, etc.

---

## 1. Project Context

### Phase 1 (COMPLETED ✅)
Phase 1 built the ACEPLACE frontend as a Next.js 16 application with:
- **Firebase Auth** for user identity
- **Firestore** real-time subscriptions for job state
- **n8n Webhooks** as the backend orchestration layer (job-intake, approve, reject, resurrect)
- **4 Agent Roles:** COO (planning), Researcher (info gathering), Worker (creation), Grader (validation)
- **Job Lifecycle:** `queued → assigned → in_progress → completed → graded → approved/rejected`
- **Governance UI:** Approve, Reject, Continuity Restore actions
- **Fork Protection:** Fork event detection and quarantine UI
- **Dashboard:** Real-time stats, agent overview, mission queue, activity log, task detail views

### Phase 2 (THIS PLAN)
Phase 2 is a **strategic migration** from n8n-based orchestration to a **custom, code-driven deterministic runtime** built around the **ACEPLACE Canonical Execution Envelope** format. Everything becomes an immutable envelope.

---

## 2. Phase 2 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   ACEPLACE WORKSTATION UI                     │
│  (Next.js — Dashboard, Governance, Envelope Inspector)   │
└──────────────────────┬──────────────────────────────────┘
                       │ Firestore Real-time
┌──────────────────────▼──────────────────────────────────┐
│              DETERMINISTIC RUNTIME ENGINE                │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Identity │ │Authority │ │ Execution │ │Persistence│  │
│  │  Kernel  │ │  Kernel  │ │  Kernel   │ │  Kernel   │  │
│  └──────────┘ └──────────┘ └───────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────┐    │
│  │            Communications Kernel                  │    │
│  │         (Machine Grammar #us# Protocol)           │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    FIRESTORE                             │
│  jobs | envelopes | leases | traces | artifacts          │
│  fork_events | continuity_restore_events                 │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Core Concepts

### 3.1 Canonical Execution Envelope
A universal, source-neutral execution format that allows ACEPLACE to accept tasks from any system (NOVA Companion, API, manual input, external AIs).

**Envelope Structure:**
| Field | Purpose |
|---|---|
| `execution_id` | Unique UUID for each execution |
| `agent_id` | ACELOGIC agent identifier |
| `identity_context` | Agent identity with SHA-256 fingerprint verification |
| `authority_context` | Lease-based authority (lease_id, granted_at, expires_at) |
| `execution_context` | Status tracking (created → running → awaiting_human → completed) |
| `steps[]` | Ordered step graph with `step_hash` integrity verification |
| `attachments[]` | Input/output data for steps |

### 3.2 Licensing Tiers
| Tier | Name | Capabilities |
|---|---|---|
| **Free** | Personal | Basic identity + mission validation (Gates 1-3) |
| **Builder** | Professional | Lease enforcement, multi-step graphs, checkpointing (Gates 1-6) |
| **Growth** | Enterprise | Multi-agent orchestration, fork detection |

### 3.3 Machine Grammar #us# Protocol (v1.0)
Structured communication protocol for agent-to-agent and agent-to-system messages:
- `us#.task.plan` — Planning phase
- `us#.task.research` — Research gathering
- `us#.artifact.produce` — Artifact creation
- `us#.artifact.grade` — Grading/validation
- `us#.governance.approve` — Human approval
- `us#.governance.reject` — Human rejection
- `us#.system.checkpoint` — State persistence

### 3.4 Execution Statuses
```
created → identity_verified → lease_acquired → running → awaiting_human → completed
                                                   ↓
                                              quarantine (on conflict)
                                              failed (on error)
```

---

## 4. Detailed Feature Breakdown

### 4.1 Kernel System (Backend/Runtime)

#### A. Identity Kernel
- Verify agent identity via SHA-256 fingerprint
- Bind each execution to a specific ACELOGIC identity
- Reject unknown or tampered identities
- Store identity verification state in envelope

#### B. Authority Kernel
- Issue time-bound leases for execution
- Enforce "No lease = no execution" rule
- Handle conflicting lease attempts → `quarantine` state
- Lease fields: `lease_id`, `granted_at`, `expires_at`, `revoked`
- Auto-expire stale leases

#### C. Execution Kernel (Graph Runner)
- Parse and execute the envelope's `steps[]` graph deterministically
- Each step has: `step_id`, `step_type`, `agent_id`, `input`, `output`, `step_hash`, `status`
- Step types: `plan`, `research`, `produce`, `grade`, `human_review`
- Validate `step_hash` before execution (tamper detection)
- Support checkpointing (pause/resume from any step)
- Handle `awaiting_human` state for governance gates

#### D. Persistence Kernel
- All agent states stored in Firestore (agents remain stateless)
- New Firestore collections: `envelopes`, `execution_steps`, `leases`, `agent_identities`
- Full execution trace logging to `job_traces`
- Artifact storage to `artifacts` collection
- Checkpoint save/restore for mid-execution recovery

#### E. Communications Kernel
- Implement `#us#` protocol message routing
- Agent-to-agent message passing via structured envelopes
- System event broadcasting (status changes, alerts)
- Protocol message validation and logging

### 4.2 Envelope Builder (API Layer)

#### A. New API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/runtime/dispatch` | POST | Accept a task, build an envelope, start execution |
| `/api/runtime/envelope/[id]` | GET | Fetch envelope state |
| `/api/runtime/envelope/[id]/steps` | GET | List execution steps |
| `/api/runtime/envelope/[id]/step/[stepId]` | GET | Get single step detail |
| `/api/runtime/lease/acquire` | POST | Request execution lease |
| `/api/runtime/lease/release` | POST | Release/revoke lease |
| `/api/runtime/checkpoint/[id]` | GET/POST | Save/restore checkpoint |
| `/api/runtime/identity/verify` | POST | Verify agent identity |

#### B. Envelope Builder Service
- Accept raw task prompt
- Identify the appropriate agent pipeline (COO → Researcher → Worker → Grader)
- Build a full Canonical Execution Envelope with step graph
- Assign step hashes for integrity
- Store envelope in Firestore

### 4.3 Frontend UI Enhancements

#### A. Envelope Inspector Component
- Visualize the full execution envelope as a step-by-step graph
- Show step status (pending → running → completed/failed)
- Display step hash verification status (✅ verified / ❌ tampered)
- Show step input/output data
- Real-time updates via Firestore subscription

#### B. Lease Manager UI
- Show active leases for running executions
- Display lease expiration countdown
- Allow manual lease revocation (for operators)
- Visual indicator for quarantined executions (lease conflicts)

#### C. Identity Panel
- Display agent identity fingerprint for each running task
- Show identity verification status
- Display ACELOGIC ID and jurisdiction info
- Link to identity audit log

#### D. Enhanced Governance Panel
- Integration with envelope step graph
- Approve/Reject at specific governance gates (not just final state)
- Show which step triggered `awaiting_human`
- Display grading results inline with step context

#### E. Runtime Dashboard Stats
- New stats: Active Leases, Envelope Count, Step Completion Rate, Identity Checks
- Replace n8n-specific stats with runtime-native metrics
- Execution latency tracking per step type

### 4.4 Firestore Schema Expansion

#### New Collections

**`envelopes`**
| Field | Type | Description |
|---|---|---|
| `execution_id` | string | Primary key |
| `job_id` | string | Reference to parent job |
| `agent_id` | string | Executing agent |
| `identity_context` | object | `{ fingerprint, verified, acelogic_id }` |
| `authority_context` | object | `{ lease_id, granted_at, expires_at }` |
| `status` | string | Envelope execution status |
| `created_at` | ISO string | Creation timestamp |
| `updated_at` | ISO string | Last update |
| `step_count` | number | Total steps in graph |
| `completed_steps` | number | Steps completed |
| `current_step_id` | string | Currently executing step |

**`execution_steps`**
| Field | Type | Description |
|---|---|---|
| `step_id` | string | Unique step identifier |
| `execution_id` | string | Parent envelope |
| `step_type` | string | plan/research/produce/grade/human_review |
| `agent_id` | string | Agent assigned to this step |
| `input` | object | Step input data |
| `output` | object | Step output data |
| `step_hash` | string | SHA-256 integrity hash |
| `status` | string | pending/running/completed/failed/skipped |
| `started_at` | ISO string | Step start time |
| `completed_at` | ISO string | Step completion time |

**`leases`**
| Field | Type | Description |
|---|---|---|
| `lease_id` | string | Primary key |
| `execution_id` | string | Bound execution |
| `agent_id` | string | Lease holder |
| `granted_at` | ISO string | Lease start |
| `expires_at` | ISO string | Lease expiration |
| `revoked` | boolean | Whether lease was manually revoked |
| `revoked_at` | ISO string | Revocation timestamp |

**`agent_identities`**
| Field | Type | Description |
|---|---|---|
| `agent_id` | string | Primary key |
| `acelogic_id` | string | ACELOGIC system identifier |
| `fingerprint` | string | SHA-256 identity hash |
| `public_key` | string | Agent public key |
| `jurisdiction` | string | Operating jurisdiction |
| `mission` | string | Agent mission statement |
| `tier` | string | License tier (free/builder/growth) |
| `created_at` | ISO string | Registration date |
| `last_verified_at` | ISO string | Last verification time |

### 4.5 Migration: n8n → Deterministic Runtime

#### Phase 2A — Parallel Operation
- Build runtime engine alongside existing n8n webhooks
- New `/api/runtime/*` routes coexist with `/api/jobs/*` routes
- Feature flag: `USE_DETERMINISTIC_RUNTIME` in env
- TaskComposer gets a toggle to use new runtime

#### Phase 2B — Full Migration
- Replace all n8n webhook calls with runtime engine
- Deprecate `/api/jobs/intake` in favor of `/api/runtime/dispatch`  
- Update `useJobs` hook to subscribe to `envelopes` collection
- Migrate existing Firestore data structure

---

## 5. File-Level Implementation Map

### 5.1 New Files to Create

#### Runtime Engine Core
| File Path | Purpose |
|---|---|
| `packages/runtime-core/src/engine.ts` | Main deterministic execution engine |
| `packages/runtime-core/src/envelope-builder.ts` | Builds Canonical Execution Envelopes from prompts |
| `packages/runtime-core/src/kernels/identity.ts` | Identity Kernel — fingerprint verification |
| `packages/runtime-core/src/kernels/authority.ts` | Authority Kernel — lease management |
| `packages/runtime-core/src/kernels/execution.ts` | Execution Kernel — step graph runner |
| `packages/runtime-core/src/kernels/persistence.ts` | Persistence Kernel — Firestore state management |
| `packages/runtime-core/src/kernels/communications.ts` | Communications Kernel — #us# protocol |
| `packages/runtime-core/src/types.ts` | TypeScript types for envelopes, steps, leases, identities |
| `packages/runtime-core/src/constants.ts` | Protocol constants, step types, status enums |
| `packages/runtime-core/src/hash.ts` | SHA-256 hashing utilities for step integrity |

#### API Routes
| File Path | Purpose |
|---|---|
| `src/app/api/runtime/dispatch/route.ts` | Accept task, build envelope, start execution |
| `src/app/api/runtime/envelope/[id]/route.ts` | GET envelope by execution_id |
| `src/app/api/runtime/envelope/[id]/steps/route.ts` | GET steps for an envelope |
| `src/app/api/runtime/lease/acquire/route.ts` | POST acquire a lease |
| `src/app/api/runtime/lease/release/route.ts` | POST release a lease |
| `src/app/api/runtime/checkpoint/[id]/route.ts` | GET/POST checkpoint data |
| `src/app/api/runtime/identity/verify/route.ts` | POST verify agent identity |

#### React Hooks
| File Path | Purpose |
|---|---|
| `src/hooks/useEnvelope.ts` | Subscribe to a single envelope + its steps |
| `src/hooks/useEnvelopes.ts` | Subscribe to all user envelopes |
| `src/hooks/useLeases.ts` | Subscribe to active leases |
| `src/hooks/useIdentity.ts` | Subscribe to agent identity data |
| `src/hooks/useRuntimeStats.ts` | Runtime-specific dashboard statistics |

#### UI Components
| File Path | Purpose |
|---|---|
| `src/components/EnvelopeInspector.tsx` | Step-by-step execution graph viewer |
| `src/components/EnvelopeStepCard.tsx` | Individual step card with hash verification |
| `src/components/LeaseManager.tsx` | Active lease display and management |
| `src/components/IdentityPanel.tsx` | Agent identity display panel |
| `src/components/RuntimeGovernance.tsx` | Enhanced governance with step-level gates |
| `src/components/StepGraph.tsx` | Visual step graph (timeline/flowchart) |
| `src/components/RuntimeStats.tsx` | New runtime metrics cards |

### 5.2 Files to Modify

| File Path | Changes |
|---|---|
| `src/hooks/useJobs.ts` | Add envelope reference fields to Job interface |
| `src/lib/api-client.ts` | Add runtime API methods to `ACEPLACEApiClient` |
| `src/components/TaskComposer.tsx` | Add runtime dispatch option |
| `src/components/TaskDetail.tsx` | Integrate EnvelopeInspector when available |
| `src/app/dashboard/page.tsx` | Add runtime stats, lease info, identity panel |
| `src/app/dashboard/jobs/[jobId]/page.tsx` | Show envelope execution view |

---

## 6. Implementation Order (Recommended)

### Sprint 1 — Foundation (Types + Firestore Schema)
1. Create `packages/runtime-core/src/types.ts` with all TypeScript interfaces
2. Create `packages/runtime-core/src/constants.ts` with enums and protocol constants
3. Create `packages/runtime-core/src/hash.ts` with SHA-256 utilities
4. Expand Firestore schema (new collections)

### Sprint 2 — Kernel System
5. Implement Identity Kernel
6. Implement Authority Kernel (lease management)
7. Implement Persistence Kernel (Firestore operations)
8. Implement Communications Kernel (#us# protocol)
9. Implement Execution Kernel (graph runner)

### Sprint 3 — Envelope Builder + API
10. Create Envelope Builder service
11. Create runtime API routes (dispatch, envelope, lease, checkpoint, identity)
12. Create main runtime engine orchestrator

### Sprint 4 — React Hooks
13. Create `useEnvelope` and `useEnvelopes` hooks
14. Create `useLeases` hook
15. Create `useIdentity` hook
16. Create `useRuntimeStats` hook

### Sprint 5 — UI Components
17. Build EnvelopeInspector + StepGraph
18. Build EnvelopeStepCard
19. Build LeaseManager
20. Build IdentityPanel
21. Build RuntimeGovernance
22. Build RuntimeStats

### Sprint 6 — Integration + Migration
23. Integrate runtime into TaskComposer
24. Integrate EnvelopeInspector into TaskDetail/JobDetail
25. Update Dashboard with runtime stats
26. Add feature flag for runtime toggle
27. Update API client with runtime methods
28. End-to-end testing

---

## 7. Verification Plan

### Automated
- TypeScript compilation: `npx tsc --noEmit` — zero errors
- Build validation: `npm run build` — successful build
- Lint: `npm run lint` — no new lint errors

### Manual Testing
1. **Envelope Creation:** Submit a task via TaskComposer → verify envelope created in Firestore `envelopes` collection
2. **Step Graph:** Open envelope inspector → verify all steps rendered with correct status
3. **Lease System:** Trigger execution → verify lease appears in `leases` collection with valid expiry
4. **Identity Verification:** Check agent identity panel shows fingerprint and verification status
5. **Governance Gate:** Let execution reach `awaiting_human` → verify UI shows governance controls
6. **Hash Integrity:** Verify step hashes computed and displayed correctly
7. **Checkpoint/Resume:** Pause execution → resume → verify continues from last step

---

## 8. Environment Variables (New)

```env
# Phase 2 Runtime
NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME=false   # Feature flag
RUNTIME_ENGINE_SECRET=<secret>                 # Internal auth for runtime
ACELOGIC_IDENTITY_SALT=<salt>                  # For SHA-256 identity hashing
```

---

## 9. Dependencies (No New Packages Expected)

Phase 2 is implemented using existing project dependencies:
- **Firebase/Firestore** — already in project
- **SHA-256 hashing** — native `crypto` API (browser) or `crypto` module (Node.js)
- **UUID generation** — `crypto.randomUUID()` (native)

No additional npm packages are required.

---

## 10. Risk Factors

| Risk | Mitigation |
|---|---|
| n8n still needed during transition | Feature flag allows parallel operation |
| Complex step graph execution | Comprehensive logging + checkpoint system |
| Lease conflicts | Quarantine state with manual resolution UI |
| Identity verification overhead | Cache verified identities for session duration |
| Firestore cost increase (more collections) | Efficient queries, subcollection indexing |

---

> **Task Tracking:** Every feature listed in Section 6 is tracked as an individual row in `docs/phase2_tasks.csv`. When a feature is implemented, the AI agent should update the CSV by changing the `Status` column to `Done` and writing the completion date in `CompletedDate`.
