# ACEPLACE — Firestore Schema Reference

> **Phase 2 — Envelope-Driven Runtime**
> Steps and leases are **embedded inside envelopes**, not in separate collections.

---

## Collection Overview

| Collection | Phase | Purpose |
|-----------|-------|---------|
| `execution_envelopes` | Phase 2 ✅ Primary | Canonical execution records (envelope + steps + lease) |
| `agents` | Phase 2 ✅ | Agent identity store |
| `artifacts` | Phase 2 ✅ | Step output artifacts |
| `execution_traces` | Phase 2 ✅ | Immutable execution event log |
| `execution_messages` | Phase 2 ✅ | `#us#` protocol messages (canonical) |
| `licenses` | Phase 2 ✅ | ACELOGIC license manifests |
| `license_audit_events` | Phase 2 ✅ | Audit log for all license/capability checks |
| `telemetry_events` | Phase 2 ✅ | Raw runtime metric events |
| `telemetry_rollups` | Phase 2 ✅ | Aggregated telemetry windows |
| `envelope_metrics` | Phase 2 ✅ | Per-envelope metric snapshots |
| `agent_metrics` | Phase 2 ✅ | Per-agent metric snapshots |
| `protocol_messages` | Phase 1 legacy | `#us#` messages via legacy single-agent path |
| `jobs` | Phase 1 legacy | Job records (UI pointer only — do NOT write from runtime) |
| `job_traces` | Phase 1 legacy | Legacy trace log (UI display only) |

---

## `execution_envelopes` — PRIMARY

The **only authoritative source of execution state**. Contains the full envelope, embedded steps, and embedded lease.

```typescript
interface ExecutionEnvelope {
  // Identity
  envelope_id: string;               // "env_" + 20 hex chars
  org_id: string;                    // Organization scope
  status: EnvelopeStatus;            // see State Machine section

  // License binding
  license_id?: string;               // "dev_license" fallback in dev

  // Agent identity
  identity_context: IdentityContext;              // Primary agent
  identity_contexts?: Record<string, IdentityContext>; // Multi-agent

  // Authority (leases embedded — NOT in separate collection)
  authority_lease: AuthorityLease | null;                     // Single-agent
  authority_leases?: Record<string, AgentAuthorityLease | null>; // Multi-agent

  // Step graph (embedded — NOT in external collection)
  steps: EnvelopeStep[];

  // Multi-agent config
  multi_agent?: boolean;
  coordinator_agent_id?: string;
  root_task_id?: string;
  decomposition_plan?: DecompositionPlan | null;

  // Artifact references
  artifact_refs: string[];

  // Integrity
  trace_head_hash: string | null;   // SHA-256 hash chain

  // Timestamps
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601

  // Legacy UI fields (read-only, never write from runtime)
  job_id?: string;
  user_id?: string;
  prompt?: string;
}
```

### Embedded: `IdentityContext`

```typescript
interface IdentityContext {
  agent_id: string;
  identity_fingerprint: string;    // SHA-256 of canonical_identity_json
  fingerprint?: string;            // alias for UI compat
  verified: boolean;
  verified_at?: string;
  instance_id?: string;            // "inst_" + 16 hex chars
  gate_level?: number;             // ACELOGIC gate level (0–6)
  jurisdiction?: string;
}
```

### Embedded: `AuthorityLease` (single-agent)

```typescript
interface AuthorityLease {
  holder_instance_id: string;
  leased_at: string;               // ISO 8601
  expires_at: string;              // ISO 8601
}
```

### Embedded: `AgentAuthorityLease` (multi-agent, per agent)

```typescript
interface AgentAuthorityLease {
  lease_id: string;                // "lease_" + UUID hex
  agent_id: string;
  current_instance_id: string;
  lease_expires_at: string;        // ISO 8601
  acquired_at: string;
  last_renewed_at: string;
  status?: "active" | "expired" | "revoked";
}
```

### Embedded: `EnvelopeStep`

```typescript
interface EnvelopeStep {
  step_id: string;
  step_type: "plan" | "assign" | "produce_artifact" | "evaluate" | "human_approval" | "complete";
  status: "pending" | "ready" | "executing" | "awaiting_human" | "completed" | "failed" | "blocked" | "skipped";
  assigned_agent_id: string;
  depends_on?: string[];           // step_ids that must complete first
  role?: "COO" | "Researcher" | "Worker" | "Grader";
  retry_count?: number;
  max_retries?: number;            // default 2
  claimed_by_instance_id?: string | null;
  claimed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  input_ref?: string | EnvelopeStepIoRef;
  output_ref?: string | EnvelopeStepIoRef;
}

interface EnvelopeStepIoRef {
  message_id?: string | null;
  artifact_id?: string | null;
  artifact_ids?: string[];
  work_unit?: Record<string, unknown> | null;
}
```

### `EnvelopeStatus` values

| Status | Description | Terminal? |
|--------|-------------|----------|
| `created` | Envelope built, not yet running | No |
| `leased` | Lease acquired | No |
| `planned` | Steps planned | No |
| `executing` | Runtime loop is running steps | No |
| `awaiting_human` | Paused at human approval gate | No |
| `approved` | Human approved (single-agent terminal success) | **Yes** |
| `completed` | Runtime completed (multi-agent terminal success) | **Yes** |
| `rejected` | Human rejected at governance gate | **Yes** |
| `failed` | Step or system failure | **Yes** |
| `quarantined` | Fork conflict detected, requires manual intervention | **Yes** |

---

## `agents`

Agent identity records. Each agent must have a document here for fingerprint verification.

```typescript
interface AgentIdentity {
  agent_id: string;                // Primary key, e.g. "agent_coo"
  display_name: string;
  canonical_identity_json: string; // JSON string used for SHA-256 fingerprint
  identity_fingerprint: string;    // SHA-256(canonical_identity_json)
  fingerprint?: string;            // alias for UI compat
  agent_class: string;
  jurisdiction: string;
  created_at: string;
  last_verified_at?: string;
  // Extended fields (UI display)
  acelogic_id?: string;
  tier?: string;
  mission?: string;
}
```

---

## `artifacts`

All agent-produced outputs. Every step produces one artifact.

```typescript
interface Artifact {
  artifact_id: string;             // UUID
  execution_id: string;            // envelope_id
  identity_fingerprint: string;
  produced_by_agent: string;
  artifact_type: "plan" | "assignment" | "production" | "evaluation" | "final_result" | "other";
  artifact_content: string;        // The actual output (markdown, JSON, etc.)
  created_at: string;
}
```

---

## `execution_traces`

Append-only event log. Every significant event in a run writes a trace.

```typescript
interface ExecutionTrace {
  trace_id: string;                // UUID
  envelope_id: string;
  step_id: string;
  agent_id: string;
  identity_fingerprint: string;
  event_type: string;             // e.g. "ENVELOPE_CREATED", "STEP_COMPLETED_PLAN"
  timestamp: string;              // ISO 8601
  metadata?: Record<string, unknown>;
}
```

Common `event_type` values:
- `ENVELOPE_CREATED`, `HANDOFF_ENVELOPE_CREATED`
- `STEP_COMPLETED_PLAN`, `STEP_COMPLETED_ASSIGN`, `STEP_COMPLETED_PRODUCE_ARTIFACT`, `STEP_COMPLETED_EVALUATE`
- `STEP_FAILED`, `EXECUTION_COMPLETED`
- `HUMAN_APPROVED`, `HUMAN_REJECTED`
- `RUNTIME_CRASHED`

---

## `execution_messages`

Canonical `#us#` protocol message log (multi-agent path).

```typescript
interface USMessage {
  protocol: "#us#";
  version: "1.0";
  message_type: ProtocolVerb;       // one of 5 legal verbs
  execution: { envelope_id: string; step_id: string };
  identity: { agent_id: string; identity_fingerprint: string };
  authority: { lease_id?: string };
  payload: Record<string, unknown>;
  metadata: { timestamp: string };
}
```

---

## `licenses`

ACELOGIC license manifests. Read by the execution guard on every step.

Key fields:
```
license_id, org_id, tier ("free"|"builder"|"growth"), status ("active"|"expired"|"inactive")
deployment_mode, gates: number[], modules: string[], limits: {...}
created_at, expires_at
```

**Dev setup:** Seed a dev license via `node scripts/seed-license.js`  
**Dev shortcut:** Set `ACELOGIC_DEV_LICENSE_FALLBACK=true` to skip Firestore lookup.

---

## `telemetry_events`

Raw metric events emitted by `emitRuntimeMetric()`.

```
event_type, envelope_id, step_id?, agent_id?, org_id, timestamp
```

---

## `telemetry_rollups`

Aggregated windows produced by cron `GET /api/cron/telemetry-rollup`.

```
window_id, org_id, window_start, window_end
total_envelopes, completed_envelopes, failed_envelopes
total_steps, avg_step_duration_ms
```

---

## `secrets`

Agent secrets storage.

```typescript
interface AgentSecrets {
  agent_id: string;
  secrets: Record<string, string>;
  updated_at: string;
}
```

---

## `api_keys`

System API keys.

```typescript
interface SystemApiKey {
  key_id: string;
  hashed_key: string;
  user_id: string;
  status: "active" | "revoked";
  created_at: string;
}
```

---

## `execution_queue`

Queue for the runtime-worker to pick up execution.

```typescript
interface ExecutionQueueEntry {
  envelope_id: string;
  status: "queued";
  created_at: string;
}
```

---

## Firestore Index Rules

The current indexes are defined in `firestore.indexes.json`. Key composite indexes needed:

- `execution_envelopes` — `org_id ASC, created_at DESC`
- `execution_envelopes` — `user_id ASC, created_at DESC`
- `execution_traces` — `envelope_id ASC, timestamp DESC`
- `execution_messages` — `execution.envelope_id ASC, metadata.timestamp DESC`
- `telemetry_events` — `org_id ASC, timestamp DESC`

> If Firestore returns "index required" errors, follow the link in the error message or extend `firestore.indexes.json` and deploy with `firebase deploy --only firestore:indexes`.
