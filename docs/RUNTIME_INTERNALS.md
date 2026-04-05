# NXQ Workstation — Runtime Internals

> Deep reference for the TypeScript runtime engine and Python agent engine.

---

## TypeScript Runtime (`packages/runtime-core/`)

### File Map

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces (envelope, steps, leases, protocol messages) |
| `constants.ts` | Firestore collection names, state machine transitions, step config, display config |
| `engine.ts` | Public dispatcher — single-agent path entry point |
| `ace-handoff.ts` | Multi-agent handoff entry point (`#us#.task.handoff`) |
| `runtime-loop.ts` | Sequential single-agent execution loop |
| `parallel-runner.ts` | Multi-agent parallel step execution loop |
| `step-planner.ts` | Builds the `steps[]` array from role assignments |
| `envelope-builder.ts` | Constructs a new `ExecutionEnvelope` from a dispatch request |
| `state-machine.ts` | Atomic envelope status transitions (Firestore transactions) |
| `per-agent-authority.ts` | Per-agent lease acquire/validate/release (multi-agent) |
| `acelogic-guard.ts` | Calls ACELOGIC (in-process or remote) for execution authorization |
| `batch-execution-guard.ts` | Pre-flight batch guard for parallel step batches |
| `lease-heartbeat.ts` | Keeps per-agent leases alive during long-running steps |
| `us-message-engine.ts` | Creates, handles, and routes `#us#` protocol messages |
| `hash.ts` | SHA-256 utilities, trace ID generation |
| `db.ts` | Returns the initialized `firebase-admin` Firestore instance |
| `execution-guard-cache.ts` | In-memory cache for recent ACELOGIC guard results |
| `decomposition.ts` | Decomposes large tasks into parallel work units |
| `kernels/identity.ts` | Identity verification, fingerprint computation |
| `kernels/authority.ts` | Single-agent lease acquire/release/validation |
| `kernels/persistence.ts` | All Firestore read/write operations |
| `kernels/communications.ts` | `#us#` message emission and lookup |
| `kernels/execution.ts` | (Stub/unused directly) execution kernel primitives |
| `telemetry/emitRuntimeMetric.ts` | Emits runtime metrics to Firestore |
| `telemetry/aggregateTelemetryWindow.ts` | Aggregates raw events into rollups |

---

## Kernel Reference

### Identity Kernel (`kernels/identity.ts`)

Verifies that the `agent_id` in the envelope matches a stored agent document.

**Key functions:**
- `buildIdentityContext(agentId)` — Fetches agent from Firestore, computes fingerprint
- `verifyIdentity(envelopeId, agentId, envelope)` — Checks fingerprint matches stored; transitions envelope to `quarantined` on mismatch
- `verifyIdentityForAgent(envelopeId, envelope, agentId)` — Multi-agent version
- `computeFingerprint(canonicalIdentityJson)` — SHA-256 of canonical JSON string

**Fingerprint computation:**
```typescript
SHA-256(agent.canonical_identity_json)  →  identity_fingerprint
```

---

### Authority Kernel (`kernels/authority.ts`)

Manages **single-agent** execution leases embedded in the envelope.

**Key functions:**
- `acquireLease(envelopeId, instanceId, durationSeconds?)` — Atomic Firestore transaction; quarantines if a different instance already holds the lease (fork detection)
- `releaseLease(envelopeId)` — Clears `authority_lease` from envelope
- `hasValidLease(envelope, instanceId)` — Checks lease holder + expiry

**Lease TTL:** Default 5 minutes (`DEFAULT_LEASE_DURATION_SECONDS = 300`)  
**Fork detection:** If `authority_lease.holder_instance_id !== instanceId`, transitions to `quarantined`.

---

### Persistence Kernel (`kernels/persistence.ts`)

All Firestore read/write operations for the runtime. Always uses `firebase-admin`.

**Key functions:**
- `createEnvelope(envelope)` — Write new envelope document
- `getEnvelope(envelopeId)` — Read envelope by ID
- `updateEnvelope(envelopeId, patch)` — Partial update envelope
- `updateEnvelopeStep(envelopeId, stepId, patch)` — Atomic step update
- `getNextReadyStep(envelope)` — Returns first step with `status === "ready"`
- `linkJobToEnvelope(jobId, envelopeId)` — Updates legacy job doc with envelope reference (UI pointer)
- `addTrace(...)` — Appends to `execution_traces`
- `createArtifact(...)` — Writes to `artifacts`

---

### Communications Kernel (`kernels/communications.ts`)

Creates and logs `#us#` protocol messages.

**Key functions:**
- `sendMessage(params)` — Creates a `ProtocolMessage`, persists to `protocol_messages`, returns `message_id`
- `getEnvelopeMessages(envelopeId)` — Fetches all messages for an envelope

---

### Per-Agent Authority (`per-agent-authority.ts`)

Manages **multi-agent** per-agent leases stored in `envelope.authority_leases[agentId]`.

**Key functions:**
- `acquirePerAgentLease(envelopeId, agentId, instanceId)` — Atomic lease acquisition in envelope transaction
- `releasePerAgentLease(envelopeId, agentId)` — Clears per-agent lease
- `validatePerAgentLease(envelope, agentId, instanceId)` — Throws if lease invalid/expired/held by different instance
- `renewPerAgentLease(envelopeId, agentId, instanceId)` — Extends lease TTL (called by heartbeat manager)

**Default per-agent lease TTL:** 60 seconds (renewed by heartbeat every 30s)

---

### ACELOGIC Guard (`acelogic-guard.ts`)

Checks if an agent is authorized before execution.

**Key function:**
- `acelogicExecutionGuard(params)` — Returns `ExecutionGuardResult { allowed, identity_context, lease }`

**Resolution order:**
1. If `ACELOGIC_API_URL` is set → call remote ACELOGIC REST API
2. Otherwise → call in-process `runAceLogicExecutionGuard()` from `src/lib/acelogic/service.ts`

Results cached in `execution-guard-cache.ts` (TTL: 55s, max 500 entries) to avoid repeated Firestore reads.

---

### Lease Heartbeat Manager (`lease-heartbeat.ts`)

During multi-agent step execution, keeps per-agent leases alive with periodic renewals.

```typescript
leaseHeartbeatManager.start(key, { envelope_id, agent_id, instance_id })
// ... step executes ...
leaseHeartbeatManager.stop(key)
```

Heartbeat interval: 30 seconds. Lease TTL: 60 seconds. Renews via `renewPerAgentLease()`.

---

## Parallel Runner (`parallel-runner.ts`)

The multi-agent bounded-parallelism execution loop.

**Algorithm:**
1. Boot envelope status through `created → leased → planned → executing`
2. Loop until terminal state:
   - Check for `human_approval` step ready → pause envelope (`awaiting_human`)
   - Find all `ready`/`pending` + dependency-satisfied steps
   - Select a batch (max 20 by default, one step per agent)
   - **Claim** each step atomically (Firestore transaction sets `status: "executing"`)
   - Batch-prime ACELOGIC guard cache
   - Execute all claimed steps concurrently (`Promise.allSettled`)
   - On failure: retry up to `max_retries` (default 2), then mark `failed` and transition envelope
3. If no steps running and no steps remaining → transition to `completed` or `failed`

**Step claim transaction:**
```
Atomically:
  if step.status === "ready" | "pending":
    step.status = "executing"
    step.claimed_by_instance_id = instance_id
    step.claimed_at = now
```

**Step execution flow per agent:**
```
1. verifyIdentityForAgent()     — check fingerprint
2. acelogicExecutionGuard()     — check license/capability
3. acquirePerAgentLease()       — acquire per-agent lease
4. leaseHeartbeatManager.start()
5. createUSMessage()            — build typed #us# message
6. storeUSMessage()             — persist to execution_messages
7. handleUSMessage()            — execute step logic (chained messages)
8. finalizeEnvelopeStep()       — update step status + output_ref
9. leaseHeartbeatManager.stop()
10. releasePerAgentLease()
```

---

## US Message Engine (`us-message-engine.ts`)

Handles the `#us#` protocol message routing and step execution.

**Key functions:**
- `createUSMessage(params)` — Constructs a typed `USMessage`
- `storeUSMessage(message)` — Persists to `execution_messages`, returns `message_id`
- `handleUSMessage(message)` — Routes to step handler (COO/Researcher/Worker/Grader), may return a follow-up message
- `mapStepTypeToUSMessage(stepType)` → `ProtocolVerb`

**Message chaining:** `handleUSMessage` can return a follow-up message (e.g., COO plan → Worker assignment). The runner chains up to 5 hops (`depth < 5`).

---

## State Machine (`state-machine.ts`)

All envelope status transitions go through `transition(envelopeId, targetStatus, metadata?)`.

```typescript
// Atomic Firestore transaction:
// 1. Read current status
// 2. Check ENVELOPE_STATUS_TRANSITIONS[current].includes(target)
// 3. If allowed: write new status + updated_at
// 4. If not allowed: throw "INVALID_TRANSITION"
```

Transitions table (from `constants.ts`):
```
created     → leased | failed
leased      → planned | quarantined | failed
planned     → executing | failed
executing   → awaiting_human | approved | completed | failed | quarantined
awaiting_human → approved | rejected | failed
approved    → (terminal)
completed   → (terminal)
rejected    → (terminal)
failed      → (terminal)
quarantined → (terminal — manual recovery required)
```

---

## Step Planner (`step-planner.ts`)

Builds the `steps[]` array for a new envelope from role assignments.

**Single-agent default pipeline:**
```
plan → assign → produce_artifact → evaluate → [human_approval if required]
```

**Multi-agent pipeline:**
- Uses role assignments to assign each step to the appropriate agent
- Computes `depends_on` for sequential steps
- Inserts `human_approval` step if `require_human_approval: true`

---

## Hash & Integrity (`hash.ts`)

```typescript
hashString(input: string): Promise<string>  // SHA-256 hex
generateTraceId(): string                   // random UUID hex
computeStepHash(step: EnvelopeStep): Promise<string>  // For tamper detection
```

---

## Python Agent Engine (`agent-engine/`)

FastAPI service implementing the LLM step execution layer.

### File Map

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, routes (`/execute-step`, `/execute`, `/health`, `/config`) |
| `config.py` | Agent model config (model, temperature, provider per role) |
| `graph/runtime_loop.py` | Python-side runtime loop + `STEP_HANDLERS` dispatch map |
| `graph/nodes/coo.py` | COO agent step handler |
| `graph/nodes/researcher.py` | Researcher agent step handler |
| `graph/nodes/worker.py` | Worker agent step handler |
| `graph/nodes/grader.py` | Grader agent step handler |
| `services/firestore.py` | Firestore client (create_artifact, append_trace, update_envelope_step) |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/execute-step` | POST | Execute a single step synchronously. Called by TS `runtime-loop.ts`. Returns `{ artifact_id }` |
| `/execute` | POST | Trigger full Python runtime loop in background. Alternative entry. |
| `/health` | GET | Health check |
| `/config` | GET | Returns model config per agent |

### `STEP_HANDLERS` dispatch map

```python
STEP_HANDLERS = {
  "plan":             (coo.handle,        "#us#.task.plan"),
  "assign":           (researcher.handle, "#us#.task.assign"),
  "produce_artifact": (worker.handle,     "#us#.artifact.produce"),
  "evaluate":         (grader.handle,     "#us#.evaluation.score"),
}
```

---

## ACELOGIC API Layer (`src/app/api/acelogic/`)

REST endpoints for the ACELOGIC control plane:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/acelogic/authority/lease` | GET/POST | Acquire, renew, or release authority leases |
| `/api/acelogic/identity` | POST | Verify agent identity against license |
| `/api/acelogic/continuity` | POST | Resurrection verification |
| `/api/acelogic/introspect` | GET | Inspect license capabilities |

---

## Cron Jobs (`src/app/api/cron/`)

Secured with `Authorization: Bearer <CRON_SECRET>` header.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cron/lease-cleanup` | GET | Expire stale per-agent leases; attempt dead-step recovery |
| `/api/cron/telemetry-rollup` | GET | Aggregate `telemetry_events` into rollup windows |

Schedule these in Vercel Cron, Cloud Scheduler, or equivalent.

---

## Explorer API (`src/app/api/explorer/`)

Read-only query interface. Safe to call frequently — never mutates state.

Routes expose: envelopes, messages, traces, artifacts, telemetry per org/envelope.

---

## React Hooks (`src/hooks/`)

| Hook | Subscription | Returns |
|------|-------------|---------|
| `useEnvelopes` | All envelopes for org | `ExecutionEnvelope[]` |
| `useEnvelope(id)` | Single envelope real-time | `ExecutionEnvelope \| null` |
| `useLeases` | Active leases snapshot | Lease records |
| `useIdentity(agentId)` | Agent identity doc | `AgentIdentity \| null` |
| `useRuntimeStats` | Computed stats | `RuntimeStats` |
| `useJobs` | Job collection (legacy) | Job records + envelope refs |
| `useJobActions` | Governance actions | Approve/reject/resurrect callbacks |

All hooks use Firestore `onSnapshot` for real-time updates.

---

## UI Components (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `TaskComposer.tsx` | Task submission form (toggles between deterministic runtime dispatch and legacy jobs intake) |
| `TaskDetail.tsx` | Full task/envelope detail view |
| `EnvelopeInspector.tsx` | Step-by-step envelope visualization |
| `EnvelopeStepCard.tsx` | Individual step card with status + hash |
| `StepGraph.tsx` | Visual step dependency graph |
| `LeaseManager.tsx` | Active lease display + manual revocation |
| `IdentityPanel.tsx` | Agent identity + fingerprint display |
| `RuntimeGovernance.tsx` | Human approval/rejection controls |
| `RuntimeStats.tsx` | Dashboard stats cards |
| `Sidebar.tsx` | Navigation sidebar |
| `HUDFrame.tsx` | Sci-fi HUD border frame wrapper |
| `AceWaveform.tsx` | NOVA voice waveform animation |
| `MarkdownReport.tsx` | Renders artifact markdown content |
| `ProtocolViewer.tsx` | Protocol message log viewer |
| `KernelStatusBadge.tsx` | Kernel health status indicator |
| `TargetCursor.tsx` | Custom HUD-style cursor |
| `ErrorBoundary.tsx` | React error boundary wrapper |
| `SettingsModal.tsx` | User settings (API keys, model selection) |

---

## Coding Conventions

1. **Types** — All TypeScript interfaces must be in `src/lib/runtime/types.ts`
2. **Constants** — Enums/config in `src/lib/runtime/constants.ts`
3. **Server Firestore** — Always use `firebase-admin` (see `src/lib/firebase-admin.ts`)
4. **Client Firestore** — Use Firebase SDK (see `src/lib/firebase.ts`)
5. **API Routes** — Next.js App Router pattern (`route.ts` with named exports)
6. **UI** — Sci-fi/HUD aesthetic: dark backgrounds, cyan/slate accents, `tracking-widest`, `uppercase`, `text-[9px]` labels
7. **No new collections** — Data lives inside envelopes; avoid ad-hoc Firestore collections
