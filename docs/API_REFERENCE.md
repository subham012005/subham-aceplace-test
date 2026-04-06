# ACEPLACE — API Reference

> Full REST API reference for the Next.js backend.

---

## Base URL

| Environment | URL |
|------------|-----|
| Local dev | `http://localhost:3000` |
| Production | Your deployment URL |

> All routes accept and return `application/json` unless noted.

---

## Authentication

- **Dashboard routes** — Firebase Auth (session cookie via client SDK)
- **Cron routes** — `Authorization: Bearer <CRON_SECRET>` header
- **Administrative routes** — `Authorization: Bearer <MASTER_RUNTIME_SECRET>` header
- **Runtime routes** — `Authorization: Bearer <token>` header, where the token is either:
  - A **Firebase ID token** (Dashboard / Workstation users), or
  - A **master API key** stored in Firestore `api_keys` (external agents)

---

## Runtime API (`/api/runtime/`)

All runtime routes use the **same authentication mechanism** via `verifyUserApiKey`:

- First, they try to decode the bearer token as a **Firebase ID token** and derive `userId` / `orgId`.
- If that fails, they look up the token in the `api_keys` collection as a **master secret**.

### POST `/api/runtime/dispatch`

Submit a task using the **single-agent** deterministic runtime. Creates an envelope, triggers the runtime loop, and returns immediately.

**Request body:**
```json
{
  "prompt": "Write a market analysis for electric vehicles",
  "user_id": "<firebase_auth_uid>",
  "org_id": "default",
  "agent_id": "agent_coo"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `prompt` | ✅ | Task description |
| `user_id` | ❌ | Ignored; derived from bearer token when using Firebase ID tokens |
| `org_id` | ❌ | Defaults to `"default"` if not present on the decoded token |
| `agent_id` | ❌ | Defaults to `"agent_coo"` |

**Response `200 OK`:**
```json
{
  "success": true,
  "envelope_id": "env_abcd1234...",
  "envelope": { ...ExecutionEnvelope },
  "message": "Envelope created. Runtime loop started."
}
```

After dispatch, subscribe to `execution_envelopes/{envelope_id}` via Firestore for real-time status updates.

---

### POST `/api/runtime/dispatch/from-dashboard`

Dashboard-only helper for dispatching tasks into the deterministic runtime from an authenticated workstation session.  
This is the route used by the **TaskComposer** UI when the **Deterministic Runtime** toggle is ON.

**Auth:**

- Requires `Authorization: Bearer <firebase_id_token>` from the logged-in user.

**Request body:**
```json
{
  "prompt": "Write a market analysis for electric vehicles",
  "job_id": "job_20260331_abc1234",
  "agent_id": "agent_coo"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `prompt` | ✅ | Task description |
| `job_id` | ❌ | Optional UI correlation id; if provided, the legacy job record will be linked to this envelope |
| `agent_id` | ❌ | Defaults to `"agent_coo"` |

**Response `200 OK`:**
Same as `POST /api/runtime/dispatch`:
```json
{
  "success": true,
  "envelope_id": "env_abcd1234...",
  "envelope": { "...": "ExecutionEnvelope" },
  "message": "Envelope created. Runtime loop started."
}
```

---

### POST `/api/runtime/handoff`

Submit a task using the **multi-agent** handoff path with explicit role assignments.

**Request body:**
```json
{
  "protocol": "#us#",
  "version": "1.0",
  "message_type": "#us#.task.handoff",
  "execution": {
    "org_id": "my_org",
    "requested_by_user_id": "<firebase_auth_uid>",
    "session_id": "sess_abc",
    "draft_id": "draft_xyz",
    "license_id": "dev_license"
  },
  "authority": {
    "approval_required": false
  },
  "payload": {
    "task": {
      "description": "Research and produce a report on EV market trends",
      "context": {},
      "attachments": []
    },
    "role_assignments": [
      { "role": "COO", "agent_id": "agent_coo" },
      { "role": "Researcher", "agent_id": "agent_researcher" },
      { "role": "Worker", "agent_id": "agent_worker" },
      { "role": "Grader", "agent_id": "agent_grader" }
    ]
  }
}
```

**Validation rules:**
- `protocol` must be `"#us#"`
- `message_type` must be `"#us#.task.handoff"`
- `role_assignments` must include at least a `COO` role
- Each role appears at most once
- `agent_id` must be a non-empty string for each assignment

**Response `200 OK`:**
```json
{
  "success": true,
  "envelope_id": "env_xyz..."
}
```

---

### GET `/api/runtime/envelope/[id]`

Fetch the current state of an envelope.

**Response `200 OK`:**
```json
{
  "envelope": { ...ExecutionEnvelope },
  "messages": [ ...ProtocolMessage[] ]
}
```

**Response `404`:** `{ "error": "Envelope not found" }`

---

### POST `/api/runtime/envelope/[id]/approve`

Human governance — approve an envelope in `awaiting_human` state.

**Response `200 OK`:** `{ "success": true }`

---

### POST `/api/runtime/envelope/[id]/reject`

Human governance — reject an envelope in `awaiting_human` state.

**Request body:**
```json
{ "reason": "Quality insufficient — rework required" }
```

**Response `200 OK`:** `{ "success": true }`

---

### POST `/api/runtime/lease/acquire`

Acquire an authority lease for an instance (single-agent path).

**Request body:**
```json
{
  "envelope_id": "env_abc",
  "instance_id": "inst_xyz",
  "duration_seconds": 300
}
```

**Response `200 OK`:**
```json
{
  "acquired": true,
  "authority_lease": {
    "holder_instance_id": "inst_xyz",
    "leased_at": "...",
    "expires_at": "..."
  }
}
```

---

### POST `/api/runtime/lease/release`

Release an authority lease.

**Request body:**
```json
{
  "lease_id": "lease_abc",
  "envelope_id": "env_xyz",
  "reason": "step_completed"
}
```

**Response `200 OK`:** `{ "success": true }`

---

### POST `/api/runtime/identity/verify`

Verify an agent's identity fingerprint.

**Request body:**
```json
{
  "agent_id": "agent_coo",
  "identity_fingerprint": "sha256hex..."
}
```

**Response `200 OK`:**
```json
{
  "verified": true,
  "agent_id": "agent_coo",
  "verified_at": "..."
}
```

---

### POST `/api/runtime/identity/register`

**Administrative only** — automated agent onboarding and fingerprinting. Requires `MASTER_RUNTIME_SECRET`.

**Request body:**
```json
{
  "display_name": "Market Analyst",
  "role": "Researcher",
  "mission": "Analyse real-time market data",
  "org_id": "my_org"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `display_name` | ✅ | Human-readable name |
| `role` | ✅ | One of `COO`, `Researcher`, `Worker`, `Grader` |
| `mission` | ✅ | Agent's mission statement |
| `org_id` | ✅ | Organisation owner |
| `agent_id` | ❌ | Optional ID override |

**Response `201 Created`:**
```json
{
  "success": true,
  "agent_id": "agent_market_analyst_abc123",
  "identity_fingerprint": "sha256hex...",
  "message": "Agent identity registered and fingerprinted successfully."
}
```
```

---

### GET/POST `/api/runtime/checkpoint/[id]`

Save or restore an execution checkpoint (pause/resume support).

---

## ACELOGIC API (`/api/acelogic/`)

### GET `/api/acelogic/introspect`

Returns the license capabilities for the current request context.

**Response:**
```json
{
  "license_id": "dev_license",
  "org_id": "default",
  "tier": 1,
  "gates": [1, 2, 3, 4, 5, 6],
  "modules": ["identity_core", "fork_detection"],
  "limits": {}
}
```

---

### POST `/api/acelogic/identity`

Verify agent identity against the ACELOGIC license.

**Request body:** `{ "agent_id": "...", "identity_fingerprint": "...", "instance_id": "..." }`

---

### POST `/api/acelogic/authority/lease`

ACELOGIC-managed lease operations (acquire, renew, release).

**Query param:** `?action=acquire|renew|release`

---

## Explorer API (`/api/explorer/`)

All Explorer routes are **read-only** and never mutate state.

| Route | Purpose |
|-------|---------|
| `GET /api/explorer/envelopes` | List envelopes for org |
| `GET /api/explorer/envelope/[id]` | Get single envelope with full detail |
| `GET /api/explorer/envelope/[id]/messages` | List protocol messages for envelope |
| `GET /api/explorer/envelope/[id]/traces` | List execution traces |
| `GET /api/explorer/envelope/[id]/artifacts` | List artifacts produced |
| `GET /api/explorer/telemetry` | Query telemetry events |

---

## Jobs API (`/api/jobs/`) — Legacy

Legacy-style job records and governance routes, preserved for **UI compatibility** with Phase 1.
These routes now use the in-process `workflowEngine` and can optionally trigger the deterministic
runtime engine in the background when `use_deterministic` is enabled.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/jobs/intake` | POST | Create job via local workflow engine; may also trigger deterministic runtime dispatch |
| `/api/jobs/approve` | POST | Approve a graded job |
| `/api/jobs/reject` | POST | Reject a graded job |
| `/api/jobs/resurrect` | POST | Resurrect a failed/rejected job |

See legacy [n8n webhook endpoints](#legacy-n8n-webhooks) below for the original webhook spec.

---

## Dashboard API (`/api/dashboard/`)

Internal routes for dashboard statistics.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/dashboard/stats` | GET | Aggregate runtime stats (active leases, envelope counts, etc.) |

---

## Cron API (`/api/cron/`)

**Header required:** `Authorization: Bearer <CRON_SECRET>`

| Route | Method | Recommended Schedule |
|-------|--------|---------------------|
| `/api/cron/lease-cleanup` | GET | Every 5 minutes |
| `/api/cron/telemetry-rollup` | GET | Every hour |

---

## Error Reference

| HTTP Status | Meaning |
|------------|---------|
| `400` | Bad request — missing/invalid fields |
| `401` | Unauthorized — missing CRON_SECRET |
| `403` | Forbidden — ACELOGIC guard blocked (license/capability check failed) |
| `404` | Resource not found |
| `409` | Conflict — invalid state transition or duplicate claim |
| `500` | Internal server error — check runtime logs |

Common runtime error codes (in response body):
- `ENVELOPE_CREATED`, `HANDOFF_ENVELOPE_CREATED`
- `STEP_COMPLETED_PLAN`, `STEP_COMPLETED_ASSIGN`, `STEP_COMPLETED_PRODUCE_ARTIFACT`, `STEP_COMPLETED_EVALUATE`
- `STEP_FAILED`, `EXECUTION_COMPLETED`
- `HUMAN_APPROVED`, `HUMAN_REJECTED`
- `RUNTIME_CRASHED`          — fingerprint mismatch
EXECUTION_BLOCKED        — ACELOGIC guard denied
INVALID_TRANSITION       — state machine violation
COO_ROLE_REQUIRED        — handoff missing COO assignment
```

---

## Firestore Realtime Subscription Pattern

Always prefer Firestore real-time subscriptions over polling:

```typescript
import { onSnapshot, doc, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Subscribe to a single envelope
const unsub = onSnapshot(
  doc(db, "execution_envelopes", envelopeId),
  (snap) => {
    const envelope = snap.data() as ExecutionEnvelope;
    updateUI(envelope);
  }
);

// Subscribe to all envelopes for a user
const unsub2 = onSnapshot(
  query(collection(db, "execution_envelopes"), where("user_id", "==", userId)),
  (snap) => {
    const envelopes = snap.docs.map((d) => d.data() as ExecutionEnvelope);
    updateList(envelopes);
  }
);

// Cleanup
return () => { unsub(); unsub2(); };
```

---

## Legacy n8n Webhooks

Original Phase 1 n8n-backed job webhooks. These are **not called directly** by the current
Next.js backend; they are kept here as a historical reference and for migrations only.

**Base URL:** `https://subhamnxq.app.n8n.cloud/webhook`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook/job-intake` | POST | Create job |
| `/webhook/job?job_id=<id>` | GET | Get job by ID |
| `/webhook/jobs?user_id=<uid>` | GET | List user's jobs |
| `/webhook/job-approve` | POST | Approve graded job |
| `/webhook/job-reject` | POST | Reject graded job |
| `/webhook/resurrect` | POST | Resurrect failed/rejected job |

### Legacy Job Lifecycle

```
assigned → in_progress → completed → graded → approved
                                             ↘ rejected
                  ↑______________________________↙
                              resurrected
```

### Grader Output Schema

After `status = "graded"`, the job contains:
```json
{
  "score": 85,
  "pass_fail": "pass",
  "risk_flags": ["flag_a"],
  "reasoning_summary": "Quality assessment..."
}
```
