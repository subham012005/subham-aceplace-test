# ACEPLACE Developer Onboarding Guide

This document explains the ACEPLACE project in simple words so a new developer can understand the codebase, run it locally, and know where to make changes.

For deeper detail, read these after this guide:

- `README.md` for the high-level runtime vision.
- `docs/QUICK_START.md` for setup details.
- `docs/API_REFERENCE.md` for detailed API request and response examples.
- `docs/FIRESTORE_SCHEMA.md` for database collections and document shapes.
- `docs/ARCHITECTURE.md` and `docs/RUNTIME_INTERNALS.md` for deeper runtime architecture.

## 1. What This Project Is

ACEPLACE is a governed multi-agent runtime platform.

In simple words:

- A user enters a task in the web dashboard.
- The system creates an execution envelope for that task.
- Runtime workers process the envelope step by step.
- Agents such as COO, Researcher, Worker, and Grader perform different parts of the work.
- Firestore stores the state, traces, artifacts, identities, leases, and telemetry.
- The dashboard shows progress and lets humans approve, reject, or inspect results.

The project is not just a chat UI. It is built around deterministic execution, meaning the runtime tries to keep identity, state, permissions, and execution order controlled and traceable.

## 2. Main Tech Stack

| Area | Technology |
| --- | --- |
| Frontend and API server | Next.js App Router |
| UI | React 19, Tailwind CSS 4, lucide-react, Radix UI/shadcn-style components |
| Language | TypeScript |
| Package structure | npm workspaces |
| Auth | Firebase Authentication |
| Database | Firestore |
| Server Firebase access | Firebase Admin SDK |
| Runtime worker | Node.js TypeScript worker |
| Shared runtime package | `@aceplace/runtime-core` |
| Agent execution engine | Python FastAPI service |
| Python agent libraries | LangChain, LangGraph, OpenAI, Anthropic, Google GenAI |
| Tests | Vitest |
| Deployment support | Next.js, Firebase indexes/rules, worker health server |

## 3. Repository Layout

```text
.
|-- src/                         Next.js web app, dashboard, API routes
|-- src/app/                     App Router pages and API routes
|-- src/components/              React UI components
|-- src/hooks/                   Client hooks for auth, jobs, envelopes, stats
|-- src/lib/                     Firebase clients, API client, helpers
|-- src/context/                 React context providers
|-- packages/runtime-core/       Shared deterministic runtime logic
|-- apps/runtime-worker/         Long-running worker that processes queued envelopes
|-- agent-engine/                Python FastAPI service that executes agent steps
|-- docs/                        Architecture, API, setup, schema, and validation docs
|-- scripts/                     Setup, certification, migration, and utility scripts
|-- infra/                       Infrastructure schema/support files
|-- public/                      Static assets
```

## 4. The Three Main Parts

### A. Control Plane: `src/`

This is the web app and API layer.

It handles:

- Login and Firebase Auth.
- Dashboard screens.
- Task composer.
- Knowledge base UI.
- Runtime observability.
- Job and envelope views.
- Human approve/reject actions.
- API routes that create and read runtime records.

Important rule: the web app should not directly run the full runtime worker loop. It creates or reads data and sends work into the runtime.

Useful folders:

- `src/app/(workstation)/dashboard/` - main workstation pages.
- `src/app/api/` - Next.js API routes.
- `src/components/TaskComposer.tsx` - task submission UI.
- `src/components/KnowledgeBasePanel.tsx` - knowledge and grounding UI.
- `src/components/TaskDetail.tsx` - job detail display.
- `src/components/StepGraph.tsx` - step progress visualization.
- `src/lib/api-client.ts` - client-side wrapper for calling local API routes.
- `src/lib/firebase.ts` - browser Firebase SDK setup.
- `src/lib/firebase-admin.ts` - server Firebase Admin setup.

### B. Runtime Core: `packages/runtime-core/`

This is the shared runtime kernel used by the web app and worker.

It contains:

- Runtime types.
- Execution envelope builders.
- State machine validation.
- Identity verification helpers.
- Lease and authority logic.
- Queue helpers.
- Parallel runner logic.
- Telemetry utilities.
- ACELOGIC license and capability checks.

Important files:

- `src/types.ts` - shared runtime types.
- `src/envelope-builder.ts` - creates execution envelopes.
- `src/state-machine.ts` - allowed runtime transitions.
- `src/parallel-runner.ts` - executes multi-step/multi-agent envelopes.
- `src/kernels/identity.ts` - identity verification kernel.
- `src/kernels/authority.ts` - lease/authority kernel.
- `src/kernels/queue.ts` - execution queue functions.
- `src/acelogic-guard.ts` - runtime capability guard.
- `src/constants/agents.ts` - default agent constants.

### C. Runtime Worker: `apps/runtime-worker/`

This is a long-running Node.js process.

It watches Firestore `execution_queue`, claims queued envelopes, then drives execution through `@aceplace/runtime-core`.

It does:

- Claim work from the queue.
- Acquire leases.
- Run envelope steps.
- Write traces, messages, artifacts, and final status.
- Requeue active work during shutdown when possible.
- Start the Python agent engine as a child process when launched directly.

Main file:

- `apps/runtime-worker/src/index.ts`

### D. Python Agent Engine: `agent-engine/`

This FastAPI service performs the actual LLM-backed step execution.

It exposes:

- `GET /health` - health check.
- `GET /config` - active agent model config.
- `POST /execute` - trigger a full envelope loop in the Python engine.
- `POST /execute-step` - execute one step and return an artifact id.

Important files:

- `agent-engine/main.py` - FastAPI entry point.
- `agent-engine/config.py` - provider/model settings.
- `agent-engine/provider_router.py` - routes calls to model providers.
- `agent-engine/graph/runtime_loop.py` - maps step types to agent handlers.
- `agent-engine/graph/nodes/coo.py` - COO/planner logic.
- `agent-engine/graph/nodes/researcher.py` - researcher logic.
- `agent-engine/graph/nodes/worker.py` - worker/artifact logic.
- `agent-engine/graph/nodes/grader.py` - grader/evaluator logic.
- `agent-engine/services/knowledge_service.py` - document/context and external research support.

## 5. Simple Runtime Flow

```text
User opens dashboard
  -> User writes a task in Task Composer
  -> Browser calls /api/runtime/dispatch/from-dashboard
  -> API creates an execution envelope in Firestore
  -> API adds a queue entry to execution_queue
  -> Runtime worker sees queued work
  -> Worker claims the envelope
  -> Worker verifies identity and lease authority
  -> Worker runs each step
  -> Worker calls Python agent engine for LLM output
  -> Artifacts and traces are saved to Firestore
  -> Dashboard updates in real time from Firestore
  -> User reviews, approves, rejects, or exports output
```

## 6. Key Runtime Concepts

### Execution Envelope

An execution envelope is the main record for a task. It contains status, steps, identity context, lease information, artifact references, and timestamps.

Main collection: `execution_envelopes`

### Step

A step is one unit of work inside an envelope. Common step types are:

- `plan`
- `assign`
- `produce_artifact`
- `evaluate`
- `human_approval`
- `complete`

### Agent

Agents are stateless roles. The main default agents are:

- `agent_coo` - plans and coordinates.
- `agent_researcher` - researches and analyzes.
- `agent_worker` - creates the artifact.
- `agent_grader` - evaluates quality.

### Lease

A lease is permission to execute a step. It helps prevent two workers from executing the same work at the same time.

### Trace

A trace is an event log entry. Traces help developers understand what happened during a run.

Main collection: `execution_traces`

### Artifact

An artifact is output produced by an agent, such as a plan, report, evaluation, or final result.

Main collection: `artifacts`

## 7. Firestore Collections

The most important collections are:

| Collection | Purpose |
| --- | --- |
| `execution_envelopes` | Main task state and embedded steps |
| `execution_queue` | Queue entries picked up by runtime worker |
| `agents` | Canonical agent identities and fingerprints |
| `artifacts` | Outputs produced by steps |
| `execution_traces` | Event log for runtime activity |
| `execution_messages` | Canonical protocol messages |
| `licenses` | ACELOGIC license/capability documents |
| `license_audit_events` | Audit log for guard checks |
| `telemetry_events` | Raw runtime metrics |
| `telemetry_rollups` | Aggregated metric windows |
| `api_keys` | External API key records |
| `jobs` | Legacy job records kept for UI compatibility |
| `job_traces` | Legacy trace display data |

Read `docs/FIRESTORE_SCHEMA.md` before changing database shapes.

## 8. Important API Groups

All API routes live under `src/app/api/`.

### Runtime APIs

| Route | Purpose |
| --- | --- |
| `POST /api/runtime/dispatch` | Create a deterministic runtime envelope |
| `POST /api/runtime/dispatch/from-dashboard` | Dashboard task submission route used by `TaskComposer` |
| `POST /api/runtime/handoff` | Multi-agent handoff path |
| `GET /api/runtime/envelope/[id]` | Read one envelope |
| `GET /api/runtime/envelope/[id]/steps` | Read envelope steps |
| `POST /api/runtime/lease/acquire` | Acquire execution lease |
| `POST /api/runtime/lease/release` | Release execution lease |
| `POST /api/runtime/identity/verify` | Verify an agent fingerprint |
| `POST /api/runtime/identity/register` | Register agent identity |
| `GET /api/runtime/stats` | Runtime dashboard stats |
| `GET /api/runtime/leases/active` | Active lease list |
| `GET /api/runtime/jobs` | Secure job list |
| `GET /api/runtime/jobs/[id]` | Secure job detail |
| `GET /api/runtime/jobs/[id]/traces` | Secure job traces |
| `GET /api/runtime/jobs/[id]/artifacts` | Secure job artifacts |

### Jobs APIs

These support legacy job UI compatibility.

| Route | Purpose |
| --- | --- |
| `POST /api/jobs/intake` | Create a job, optionally dispatch deterministic runtime |
| `GET /api/jobs` | List jobs |
| `GET /api/jobs/[jobId]` | Read one job |
| `DELETE /api/jobs/[jobId]` | Delete/purge a job |
| `POST /api/jobs/approve` | Approve job |
| `POST /api/jobs/reject` | Reject job |
| `POST /api/jobs/[jobId]/approve` | Approve specific job |
| `POST /api/jobs/[jobId]/reject` | Reject specific job |
| `POST /api/jobs/[jobId]/resurrect` | Retry/resurrect a job |
| `POST /api/jobs/[jobId]/fork-simulate` | Simulate fork/conflict behavior |
| `POST /api/jobs/[jobId]/fallback/approve` | Fallback approval |
| `POST /api/jobs/[jobId]/fallback/reject` | Fallback rejection |

### Knowledge and Instructions APIs

| Route | Purpose |
| --- | --- |
| `POST /api/knowledge/upload` | Upload/index knowledge document |
| `GET /api/knowledge/collections` | List knowledge collections |
| `DELETE /api/knowledge/collections` | Delete a collection |
| `GET /api/instructions` | List instruction profiles |
| `POST /api/instructions` | Create instruction profile |
| `DELETE /api/instructions` | Delete instruction profile |
| `GET /api/user/direct-knowledge` | Read user direct knowledge |
| `POST /api/user/direct-knowledge` | Save user direct knowledge |
| `GET /api/user/knowledge-snippets` | List snippets |
| `POST /api/user/knowledge-snippets` | Create snippet |
| `DELETE /api/user/knowledge-snippets` | Delete snippet |

### User and Config APIs

| Route | Purpose |
| --- | --- |
| `GET /api/user/intelligence-providers` | Read user's model provider config |
| `POST /api/user/intelligence-providers` | Save model provider config |
| `GET /api/user/master-secret` | Read or manage user API secret |
| `GET /api/sandbox/info` | Sandbox metadata |
| `GET /api/sandbox/usage-limits` | Sandbox usage limits |
| `POST /api/sandbox/legal-accept` | Accept sandbox legal terms |

### Explorer APIs

Explorer routes are mostly read-only inspection APIs.

| Route | Purpose |
| --- | --- |
| `GET /api/explorer/envelopes` | List envelopes |
| `GET /api/explorer/envelopes/[envelope_id]` | Envelope detail |
| `GET /api/explorer/envelopes/[envelope_id]/summary` | Envelope summary |
| `GET /api/explorer/traces/[envelope_id]` | Envelope traces |
| `GET /api/explorer/messages/[envelope_id]` | Protocol messages |
| `GET /api/explorer/artifacts/[envelope_id]` | Artifacts |
| `GET /api/explorer/telemetry/envelope/[envelope_id]` | Envelope telemetry |
| `GET /api/explorer/telemetry/agent/[agent_id]` | Agent telemetry |

### ACELOGIC APIs

| Route | Purpose |
| --- | --- |
| `GET /api/acelogic/license/introspect` | Inspect active license/capability context |
| `POST /api/acelogic/identity/verify` | Verify ACELOGIC identity |
| `POST /api/acelogic/authority/lease/acquire` | Acquire ACELOGIC lease |
| `POST /api/acelogic/authority/lease/renew` | Renew ACELOGIC lease |
| `POST /api/acelogic/authority/lease/release` | Release ACELOGIC lease |
| `POST /api/acelogic/continuity/resurrection/verify` | Verify continuity recovery |

### Cron APIs

Cron routes need `Authorization: Bearer <CRON_SECRET>`.

| Route | Purpose |
| --- | --- |
| `GET /api/cron/lease-cleanup` | Expire or clean stale leases |
| `GET /api/cron/telemetry-rollup` | Aggregate telemetry events |
| `GET /api/cron/session-cleanup` | Clean stale session data |

## 9. Authentication and Authorization

The project uses Firebase Auth for normal dashboard users.

Client-side API calls use `src/lib/api-client.ts`, which gets the current Firebase ID token and sends it as:

```text
Authorization: Bearer <firebase_id_token>
```

Server routes can use:

- Firebase ID tokens for user requests.
- Master/runtime secrets for administrative routes.
- `CRON_SECRET` for cron routes.
- Optional `INTERNAL_SERVICE_TOKEN` between services.

Do not put service-account secrets in client-side code. Only `NEXT_PUBLIC_*` variables are safe for the browser.

## 10. Environment Variables

Common variables used by the project:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Browser | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser/server | Firebase project id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Browser | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Browser | Firebase sender id |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser | Firebase app id |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Browser | Firebase analytics id |
| `FIREBASE_CLIENT_EMAIL` | Server | Admin SDK service account email |
| `FIREBASE_PRIVATE_KEY` | Server | Admin SDK private key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server/scripts | Optional full service account JSON |
| `GOOGLE_CLOUD_PROJECT` | Server/worker | Google project fallback |
| `NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME` | Browser/server | Runtime feature toggle |
| `AGENT_ENGINE_URL` | Server/worker | Python engine URL, usually `http://localhost:8001` |
| `INTERNAL_SERVICE_TOKEN` | Server/Python | Optional service-to-service auth token |
| `CRON_SECRET` | API/Cron | Protect cron endpoints |
| `ACELOGIC_DEV_LICENSE_FALLBACK` | Server/worker | Allow local dev license fallback |
| `ACELOGIC_DEV_LICENSE_TIER` | Server/worker | Dev fallback tier |
| `ACELOGIC_API_URL` | Server/worker | Optional remote ACELOGIC service |
| `ALLOW_PENDING_IDENTITY` | Server/worker | Development identity bypass |
| `OPENAI_API_KEY` | Agent engine/runtime | OpenAI provider key |
| `ANTHROPIC_API_KEY` | Agent engine/runtime | Anthropic provider key |
| `PORT` | Worker/hosting | Health server port |
| `PUBLIC_URL` | Worker | Self-ping URL for hosted worker |

See `docs/QUICK_START.md` for a full `.env.local` example.

## 11. Local Setup

### Install dependencies

```bash
npm install
```

### Create environment file

Create `.env.local` in the repo root. At minimum, configure Firebase client values, Firebase Admin values, and development license fallback.

Important: `FIREBASE_PRIVATE_KEY` should keep escaped newline characters:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Start the Next.js app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Start the runtime worker

```bash
npm run worker
```

This worker may also start the Python agent engine as a child process.

### Start the Python agent engine manually

Use this if you want to run it separately.

```bash
cd agent-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Default engine URL:

```text
http://localhost:8001
```

Health check:

```text
http://localhost:8001/health
```

## 12. Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build Next.js app |
| `npm start` | Start production Next.js app |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run runtime worker E2E test |
| `npm run worker` | Start runtime worker with ts-node |
| `npm run worker:build` | Build runtime worker |
| `npm run worker:start` | Start built runtime worker |
| `npx tsc --noEmit` | TypeScript check |
| `npm run audit` | npm audit with moderate threshold |

Workspace-specific:

```bash
npm run build --workspace=@aceplace/runtime-core
npm run typecheck --workspace=@aceplace/runtime-core
npm run build --workspace=@aceplace/runtime-worker
npm run typecheck --workspace=@aceplace/runtime-worker
```

## 13. Main UI Screens

| Route | File | Purpose |
| --- | --- | --- |
| `/dashboard` | `src/app/(workstation)/dashboard/page.tsx` | Main dashboard |
| `/dashboard/composer` | `src/app/(workstation)/dashboard/composer/page.tsx` | Create and launch tasks |
| `/dashboard/jobs/[jobId]` | `src/app/(workstation)/dashboard/jobs/[jobId]/page.tsx` | Job detail and execution view |
| `/dashboard/knowledge` | `src/app/(workstation)/dashboard/knowledge/page.tsx` | Knowledge base and instruction profiles |
| `/dashboard/setup` | `src/app/(workstation)/dashboard/setup/page.tsx` | Guided setup |
| `/dashboard/runtime-usage` | `src/app/(workstation)/dashboard/runtime-usage/page.tsx` | Runtime usage screen |
| `/dashboard/runtime-ideas` | `src/app/(workstation)/dashboard/runtime-ideas/page.tsx` | Runtime ideas screen |
| `/dashboard/about` | `src/app/(workstation)/dashboard/about/page.tsx` | About/runtime explanation |
| `/system-config` | `src/app/(workstation)/system-config/page.tsx` | System config and provider settings |
| `/login` | `src/app/login/page.tsx` | Login |
| `/legal/*` | `src/app/legal/` | Legal pages |

## 14. Where To Make Common Changes

| Task | Start here |
| --- | --- |
| Change UI text or layout | `src/components/` and `src/app/(workstation)/...` |
| Add a dashboard API call | `src/lib/api-client.ts` |
| Add a Next API route | `src/app/api/.../route.ts` |
| Change runtime types | `packages/runtime-core/src/types.ts` |
| Change envelope creation | `packages/runtime-core/src/envelope-builder.ts` |
| Change state transitions | `packages/runtime-core/src/state-machine.ts` |
| Change worker queue behavior | `packages/runtime-core/src/kernels/queue.ts` and `apps/runtime-worker/src/index.ts` |
| Change lease behavior | `packages/runtime-core/src/kernels/authority.ts` |
| Change identity verification | `packages/runtime-core/src/kernels/identity.ts` |
| Change model provider assignments | `src/components/IntelligenceProviders.tsx` and user provider API routes |
| Change Python LLM execution | `agent-engine/graph/nodes/` and `agent-engine/provider_router.py` |
| Change Firestore schema | Read `docs/FIRESTORE_SCHEMA.md` first, then update code and indexes |

## 15. Safe Development Rules

These rules matter because this project has runtime governance and identity continuity.

- Keep UI-only changes in UI files.
- Do not change backend runtime behavior when only changing labels or display text.
- Do not change identity hashing or fingerprint logic without reading runtime docs and tests.
- Do not write directly to legacy `jobs` from runtime code unless the compatibility path already expects it.
- Prefer Firestore real-time listeners for UI updates instead of polling.
- Keep execution authority in the worker/runtime core, not in React components.
- When adding API routes, define auth expectations clearly.
- When changing Firestore queries, update `firestore.indexes.json` if a new composite index is needed.
- Avoid force-pushing shared branches.

## 16. Testing and Verification

For small UI changes:

```bash
npm run lint
npx tsc --noEmit
```

For runtime logic changes:

```bash
npm run test
npm run test:e2e
npm run typecheck --workspace=@aceplace/runtime-core
npm run typecheck --workspace=@aceplace/runtime-worker
```

For build checks:

```bash
npm run build
```

If TypeScript fails in generated Next files or old scripts, check whether the failure is related to your changed files before modifying unrelated code.

## 17. Debugging Tips

### Task does not start

Check:

- Browser user is authenticated.
- `/api/runtime/dispatch/from-dashboard` returns success.
- `execution_envelopes` has a new envelope.
- `execution_queue` has or had a queued entry.
- Runtime worker is running.

### Worker is not processing

Check:

- Worker logs.
- Firebase Admin env vars.
- Firestore permissions/service account.
- `execution_queue` entries with `status: "queued"`.
- Stale claims or failed queue entries.

### Agent output fails

Check:

- Python engine is running.
- `AGENT_ENGINE_URL` is correct.
- `/health` returns healthy.
- Model provider keys are configured.
- `INTERNAL_SERVICE_TOKEN` matches if enabled.
- `execution_traces` for error events.

### Dashboard does not update

Check:

- Firestore client config.
- Auth state.
- Firestore rules.
- Hooks in `src/hooks/`.
- Browser console for permission/index errors.

### Firestore says index required

Follow the Firestore error link or add an index in `firestore.indexes.json`, then deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

## 18. Deployment Notes

Typical production pieces:

- Next.js web app.
- Runtime worker process.
- Python agent engine service.
- Firebase Auth and Firestore.
- Firestore rules and indexes.
- Cron jobs for cleanup and telemetry.

Cron jobs:

| Schedule | Endpoint |
| --- | --- |
| Every 5 minutes | `GET /api/cron/lease-cleanup` |
| Every hour | `GET /api/cron/telemetry-rollup` |

Both need:

```text
Authorization: Bearer <CRON_SECRET>
```

## 19. New Developer First-Day Checklist

1. Read this document.
2. Read `README.md`.
3. Read `docs/QUICK_START.md`.
4. Install dependencies with `npm install`.
5. Create `.env.local`.
6. Run `npm run dev`.
7. Sign in and open `/dashboard`.
8. Run `npm run worker` in another terminal.
9. Open the Python engine health endpoint if using real LLM execution.
10. Submit a simple task from Task Composer.
11. Watch Firestore `execution_envelopes`, `execution_queue`, `execution_traces`, and `artifacts`.
12. Read `docs/API_REFERENCE.md` before changing API behavior.
13. Read `docs/FIRESTORE_SCHEMA.md` before changing stored data.
14. Run tests/checks before pushing.

## 20. Quick Glossary

| Term | Simple meaning |
| --- | --- |
| Control Plane | The web dashboard and API layer |
| Execution Plane | The worker layer that actually processes tasks |
| Runtime Core | Shared package containing deterministic runtime rules |
| Agent Engine | Python service that calls LLM providers and produces step output |
| Envelope | Main task state object |
| Step | One unit of work inside an envelope |
| Lease | Permission to execute a step |
| Trace | Runtime event log |
| Artifact | Output produced by a step |
| ACELOGIC | License, identity, authority, and continuity governance layer |
| Identity fingerprint | Hash used to verify an agent identity |
| Firestore | Main database for runtime state |
| BYO-LLM | User brings their own model provider/API key |

