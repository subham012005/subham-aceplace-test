# NXQ Workstation — API Reference

> **Base URL:** `https://subhamnxq.app.n8n.cloud/webhook`  
> **Content-Type:** `application/json` for all requests and responses.

---

## 0. Conventions

### Job State Lifecycle

```
assigned → in_progress → completed → graded → approved
                                             ↘ rejected
                  ↑______________________________↙  (resurrect)
                              resurrected
                              
Terminal failure: failed
Governance actions: approved | rejected | resurrected
```

| Status | Description |
|---|---|
| `queued` | Job created, not yet picked up |
| `assigned` | Routed to an AI agent |
| `in_progress` | Agent is actively executing |
| `completed` | Agent finished, awaiting grading |
| `graded` | Grader scored the output; awaiting human decision |
| `approved` | Human operator approved the result |
| `rejected` | Human operator rejected the result |
| `failed` | Terminal failure during execution |
| `resurrected` | Failed/rejected job brought back into lifecycle |

---

## 1. Firestore Data Model

### Collection: `jobs`

This is the canonical single source of truth the frontend should subscribe to.

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Primary key / updateKey |
| `user_id` | `string` | Firebase Auth UID (used for filtering) |
| `prompt` | `string` | The submitted task prompt |
| `status` | `string` | Current lifecycle state (see above) |
| `updated_at` | `ISO string` | Last state-change timestamp |
| `artifact` | `string` | Execution output from the agent |
| `role` | `string` | Assigned AI role/agent |
| `provider` | `string` | AI provider (e.g. OpenAI) |
| `model` | `string` | Model used for execution |

#### Governance Fields (set on approve/reject)

| Field | Type | Set On |
|---|---|---|
| `approved_at` | `ISO string` | Approve |
| `approved_by` | `string` | Approve |
| `rejected_at` | `ISO string` | Reject |
| `rejected_by` | `string` | Reject |
| `failure_reason` | `string` | Reject |

#### Continuity Restore Fields (set on restore)

| Field | Type | Set On |
|---|---|---|
| `resurrection_reason` | `string` | Resurrect |
| `resurrected_by` | `string` | Resurrect |
| `resurrected_at` | `ISO string` | Resurrect |

---

### Collection: `continuity_restore_events`

Immutable event log. A new document is created for every continuity restore action.

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Unique event identifier |
| `job_id` | `string` | Reference to the parent job |
| `resurrection_reason` | `string` | Reason provided by operator |
| `resurrected_by` | `string` | Operator identifier |
| `previous_state` | `string` | State before restore (`failed` or `rejected`) |
| `created_at` | `ISO string` | Event creation timestamp |

---

## 2. Webhook Endpoints

### A. Create Job

**`POST /webhook/job-intake`**

Creates a new job and returns a `job_id` + `status_url` for polling.

#### Request Body
```json
{
  "user_id": "<firebase_auth_uid>",
  "prompt": "Your task description here"
}
```

#### Response `200 OK`
```json
{
  "job_id": "<id>",
  "status": "queued",
  "status_url": "https://subhamnxq.app.n8n.cloud/webhook/job?job_id=<id>",
  "message": "Job created successfully"
}
```

#### Notes
- On success, immediately store `job_id` and `status_url` in local UI state.
- Create a local optimistic row with `status = "queued"`.
- Begin Firestore subscription on `jobs/{job_id}` or start polling `status_url`.
- The workflow internally transitions through `assigned` → `in_progress` as routing metadata is set.

---

### B. Get Job by ID

**`GET /webhook/job?job_id=<id>`**

Fetches a single job snapshot. Use as the polling target if not using Firestore realtime.

#### Query Parameters
| Param | Required | Description |
|---|---|---|
| `job_id` | ✅ | The job identifier |

#### Response `200 OK`
```json
{
  "job_id": "<id>",
  "status": "<current_status>",
  "prompt": "...",
  "artifact": "...",
  "updated_at": "<iso>"
}
```

#### Polling Strategy
- Poll every **2–5 seconds** while `status` is in `[queued, assigned, in_progress, completed]`.
- **Stop polling** when status reaches a terminal state: `graded`, `approved`, `rejected`, `failed`.

---

### C. Get All Jobs for a User

**`GET /webhook/jobs?user_id=<uid>`**

Lists all jobs belonging to a specific user. Called on Dashboard / Jobs page load.

#### Query Parameters
| Param | Required | Description |
|---|---|---|
| `user_id` | ✅ | Firebase Auth UID — **throws if missing** |

#### Response `200 OK`
```json
[
  {
    "job_id": "<id>",
    "status": "approved",
    "prompt": "...",
    "updated_at": "<iso>"
  },
  ...
]
```

#### Notes
- Render results grouped/filtered by status.
- Missing `user_id` → workflow throws: `"Missing user_id in query"`.

---

### D. Approve Job

**`POST /webhook/job-approve`**

Human governance action. Approves a graded job.

#### Guards (enforced by backend)
- `job_id` must exist.
- Job `status` must be `"graded"` — otherwise throws: `"Approval allowed only after grading"`.

#### Request Body
```json
{
  "job_id": "<job_id>"
}
```

#### Response `200 OK`
```json
{
  "job_id": "<job_id>",
  "status": "approved",
  "approved_at": "<iso>",
  "approved_by": "operator"
}
```

#### Firestore Update
Sets: `status`, `approved_at`, `approved_by`

---

### E. Reject Job

**`POST /webhook/job-reject`**

Human governance action with mandatory reason. Rejects a graded job.

> **Important:** Uses status `"rejected"` — NOT `"failed"`. These are distinct states.

#### Guards (enforced by backend)
- `job_id` required — otherwise throws: `"Missing job_id in body"`.
- Job `status` must be `"graded"` — otherwise throws same grading guard as approve.

#### Request Body
```json
{
  "job_id": "<job_id>",
  "reason": "Why rejected..."
}
```

#### Response `200 OK`
```json
{
  "job_id": "<job_id>",
  "status": "rejected",
  "rejected_at": "<iso>",
  "rejected_by": "operator",
  "failure_reason": "Why rejected..."
}
```

#### Firestore Update
Sets: `status`, `rejected_at`, `rejected_by`, `failure_reason`

---

### F. Resurrect Job

**`POST /webhook/resurrect`**

Brings a `failed` or `rejected` job back into an active lifecycle. Also creates an immutable event record in `continuity_restore_events`.

#### Guards (enforced by backend)
- Continuity Restore only allowed from `failed` or `rejected` — otherwise throws: `"Continuity Restore allowed only from failed or rejected state"`.

#### Request Body
```json
{
  "job_id": "<job_id>",
  "reason": "Manual continuity restore",
  "resurrected_by": "governor"
}
```

#### Response `200 OK`
```json
{
  "job_id": "<job_id>",
  "status": "resurrected",
  "previous_state": "failed",
  "resurrected_at": "<iso>"
}
```

#### Firestore Updates
- **`jobs` doc:** sets `status`, `resurrection_reason`, `resurrected_by`, `resurrected_at`, `updated_at`
- **`continuity_restore_events`:** new document with `event_id`, `job_id`, `previous_state`, `resurrection_reason`, `resurrected_by`, `created_at`

---

## 3. Grading Layer Output

The grader (OpenAI) returns structured JSON attached to the job after `status` becomes `graded`:

```json
{
  "score": 85,
  "pass_fail": "pass",
  "risk_flags": ["flag_a", "flag_b"],
  "reasoning_summary": "Up to 3 sentences explaining the grade."
}
```

| Field | Type | Description |
|---|---|---|
| `score` | `number` (0–100) | Numerical quality score |
| `pass_fail` | `"pass"` \| `"fail"` | `pass` if score ≥ 70 |
| `risk_flags` | `string[]` | Array of identified risk labels |
| `reasoning_summary` | `string` | ≤ 3 sentence explanation |

---

## 4. Error Reference

The backend throws these specific errors. Map them to frontend toasts/messages:

| Scenario | Backend Error | Suggested UI Message |
|---|---|---|
| `GET /jobs` without `user_id` | `"Missing user_id in query"` | "Please log in to view jobs." |
| Approve/Reject without `job_id` | `"Missing job_id in body"` | "Job ID is required." |
| Approve/Reject before grading | `"Approval allowed only after grading"` | "This job isn't graded yet—wait for grading to finish." |
| Restore from wrong state | `"Continuity Restore allowed only from failed or rejected state"` | "Cannot restore unless job is failed or rejected." |

> After any action (approve/reject/resurrect), always refresh the job snapshot from Firestore or via `GET /job?job_id=...`.

---

## 5. Recommended Client Watcher Pattern

Always treat `jobs.status` as the **single source of truth**.

### Option A — Firestore Realtime (Preferred)
```typescript
// Subscribe to single job
onSnapshot(doc(db, "jobs", job_id), (snap) => {
  const job = snap.data();
  updateJobUI(job);
});

// Subscribe to continuity restore events for a job
onSnapshot(
  query(collection(db, "resurrection_events"), where("job_id", "==", job_id)),
  (snap) => renderContinuityRestoreTimeline(snap.docs.map(d => d.data()))
);
```

### Option B — Polling via `status_url`
```typescript
const poll = setInterval(async () => {
  const job = await fetch(status_url).then(r => r.json());
  updateJobUI(job);
  const terminal = ["graded", "approved", "rejected", "failed"];
  if (terminal.includes(job.status)) clearInterval(poll);
}, 3000);
```

---

## 6. Security Notes (Phase 1)

- The n8n webhook currently uses `callerPolicy: "any"` (open). This will be tightened in a later phase via Firebase Functions proxy or shared-secret header.
- **Frontend RBAC:** Only show governance controls (Approve / Reject / Restore) to users with roles ≥ `operator`.
- **Firestore Security Rules (minimum):**
  - Users may read only jobs matching their `user_id` or `organization_id`.
  - Only `operator` role may write `approved_*`, `rejected_*`, `resurrected_*` fields.
  - `resurrection_events` (continuity restore events) documents are create-only (no updates/deletes) and only writable by the backend/governor.
