# ACEPLACE — Quick Start Guide

> Get up and running in minutes.

---

## Prerequisites

| Requirement | Details |
|------------|---------|
| **Node.js LTS** | v18 or v20 recommended |
| **npm** | Comes with Node.js |
| **Firebase project** | Database + Auth — need client config + service account |
| **Python 3.10+** | Optional — only for Python agent engine (LLM step execution) |

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# ─── Firebase Client (browser) ────────────────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ─── Firebase Admin (server-side — from your service account JSON) ─────────────
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ─── ACELOGIC License ──────────────────────────────────────────────────────────
# Option A — Seed a real license doc: node scripts/seed-license.js
# Option B — Use dev fallback (no Firestore license needed):
ACELOGIC_DEV_LICENSE_FALLBACK=true
ACELOGIC_DEV_LICENSE_TIER=builder

# ─── Runtime ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME=true
AGENT_ENGINE_URL=http://localhost:8001

# ─── Cron Security ─────────────────────────────────────────────────────────────
CRON_SECRET=your_cron_secret_here

# ─── Optional: Remote ACELOGIC ─────────────────────────────────────────────────
# ACELOGIC_API_URL=https://your-acelogic-instance/api
```

> **Important:** `FIREBASE_PRIVATE_KEY` must have literal `\n` characters (not actual newlines) when stored in `.env.local`. The value must be wrapped in double quotes.

---

## 3. Seed Data (First Time Only)

### Seed a Development License

```bash
node scripts/seed-license.js
```

This creates a `licenses/dev_license` document in Firestore with Builder capabilities.

**Skip this step** by setting `ACELOGIC_DEV_LICENSE_FALLBACK=true` instead.

### Seed Agent Identities

```bash
node scripts/seed-identities-standalone.js
```

This creates `agents/agent_coo`, `agents/agent_researcher`, `agents/agent_worker`, `agents/agent_grader`.

---

## 4. Start the Next.js App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

---

## 5. Start the Python Agent Engine (Optional)

Only needed if you want actual LLM step execution. Without it, the runtime will attempt calls to `http://localhost:8001` and fail gracefully.

```bash
cd agent-engine

# Create virtual environment
python -m venv .venv

# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1
# If blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# Activate (Command Prompt)
.venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Configure agent-engine environment
# Edit agent-engine/.env with your Firebase + model API keys

# Start the engine
uvicorn main:app --host 0.0.0.0 --port 8001
```

The engine will be available at `http://localhost:8001`.  
Check `/health` to verify it's running, `/config` to see model assignments.

---

## 6. Deploy (Production)

```bash
npm run build
npm start
```

Or deploy to Vercel — all environment variables must be set in the Vercel project settings.

### Firestore Indexes

Deploy composite indexes when you add new query patterns:

```bash
firebase deploy --only firestore:indexes
```

### Cron Jobs

Set up two scheduled jobs in your hosting platform (Vercel Cron, Cloud Scheduler, etc.):

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Every 5 minutes | `GET /api/cron/lease-cleanup` | Expire stale leases |
| Every hour | `GET /api/cron/telemetry-rollup` | Aggregate metrics |

Both require: `Authorization: Bearer <CRON_SECRET>` header.

---

## Common Issues

### "Admin not initialized"
The `FIREBASE_PRIVATE_KEY` is malformed. Make sure newlines are `\n` (escaped) inside double quotes.

### "License / guard errors"
Either seed `licenses/dev_license` with `node scripts/seed-license.js` or set `ACELOGIC_DEV_LICENSE_FALLBACK=true`.

### "Firestore index required"
Firestore is missing a composite index. Follow the link in the error message or add the index to `firestore.indexes.json` and deploy.

### Runtime loop not progressing
1. Check the Python agent engine is running at `AGENT_ENGINE_URL` (default: `http://localhost:8001`)
2. Check Firestore for the envelope document — look at `status` and `steps[].status`
3. Check `execution_traces` for error events

---

## Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Dev server | `npm run dev` | Start Next.js in development mode |
| Build | `npm run build` | Production build |
| Start | `npm start` | Run production build |
| Lint | `npm run lint` | ESLint check |
| Type check | `npx tsc --noEmit` | TypeScript validation |

### Utility Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `seed-license.js` | Seed a dev license to Firestore |
| `seed-identities-standalone.js` | Seed the 4 default agent identities |
| `migrate-to-phase2.js` | Migrate Phase 1 job data to Phase 2 envelope format |
| `list-envelopes.ts` | List all envelopes (`npx ts-node scripts/list-envelopes.ts`) |
| `list-agents.ts` | List all agent identities |
| `read-traces.ts` | Dump execution traces for debugging |
| `verify-invariants.ts` | Check data integrity invariants |
| `dump.ts` | Dump Firestore collection for inspection |

---

## Mental Model

```
┌─────────────────────────────────────────────────────────┐
│  USER submits task via                                    │
│    A) Dashboard TaskComposer →                            │
│         POST /api/runtime/dispatch/from-dashboard         │
│         (which calls the core /api/runtime/dispatch)      │
│    B) Multi-agent → POST /api/runtime/handoff             │
└─────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  ENVELOPE created in Firestore execution_envelopes        │
│  Steps embedded inside envelope (no external collections) │
└─────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  RUNTIME LOOP runs (Node.js, async)                       │
│  For each step:                                           │
│    1. Verify identity fingerprint                         │
│    2. Check ACELOGIC license/capability                   │
│    3. Acquire lease (prevents fork)                       │
│    4. Send #us# protocol message                          │
│    5. Call Python agent-engine for LLM output             │
│    6. Store artifact, update step status                  │
└─────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  DASHBOARD updates in real-time via Firestore onSnapshot  │
│  Human governance: Approve / Reject / Resurrect          │
└─────────────────────────────────────────────────────────┘
```
