# NXQ Workstation

> **Phase 2 — Deterministic Multi-Agent Runtime**

NXQ Workstation is a **multi-agent AI task execution platform** powered by a deterministic, envelope-driven runtime. Tasks are submitted, decomposed into typed execution steps, executed by specialized AI agents (COO → Researcher → Worker → Grader), and tracked in real-time through a governance-enabled dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS v4, GSAP animations |
| **Database** | Google Firestore (real-time) |
| **Auth** | Firebase Auth |
| **Agent Engine** | Python 3.10 + FastAPI |
| **UI Components** | shadcn/ui, Radix UI, Lucide React |

---

## Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](./docs/QUICK_START.md) | Setup, environment variables, seeding, running |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, execution paths, state machine |
| [RUNTIME_INTERNALS.md](./docs/RUNTIME_INTERNALS.md) | Deep dive into runtime kernels, parallel runner, protocol |
| [API_REFERENCE.md](./docs/API_REFERENCE.md) | All REST API endpoints with request/response schemas |
| [FIRESTORE_SCHEMA.md](./docs/FIRESTORE_SCHEMA.md) | Firestore collections, field definitions, indexes |
| [PHASE_2_IMPLEMENTATION_PLAN.md](./docs/PHASE_2_IMPLEMENTATION_PLAN.md) | Original specification and task tracker |

---

## Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (see docs/QUICK_START.md for all variables)
# Minimum required: Firebase config + ACELOGIC_DEV_LICENSE_FALLBACK=true

# 3. Seed agent identities (first time)
node scripts/seed-identities-standalone.js

# 4. Start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

For the Python agent engine (LLM execution):
```bash
cd agent-engine
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

---

## Project Structure

```
nxq-workstation/
├── src/
│   ├── app/                        # Next.js App Router pages + API routes
│   │   ├── api/
│   │   │   ├── runtime/            # Dispatch, handoff, envelope, lease, identity
│   │   │   ├── acelogic/           # ACELOGIC license/capability control plane
│   │   │   ├── explorer/           # Read-only query APIs
│   │   │   ├── jobs/               # Legacy job governance actions
│   │   │   └── cron/               # Scheduled maintenance (lease cleanup, telemetry)
│   │   ├── dashboard/              # Dashboard pages
│   │   └── login/                  # Auth page
│   ├── components/                 # React UI components
│   ├── context/                    # AuthContext, SettingsContext
│   ├── hooks/                      # Firestore real-time subscription hooks
│   └── lib/
│       ├── runtime/                # Deterministic runtime engine (TypeScript)
│       │   ├── kernels/            # Identity, Authority, Persistence, Communications
│       │   └── telemetry/          # Metric emission + aggregation
│       ├── acelogic/               # License resolution + capability checks
│       ├── explorer/               # Explorer service layer
│       ├── firebase.ts             # Client Firebase SDK init
│       └── firebase-admin.ts       # Server Firebase Admin init
├── agent-engine/                   # Python FastAPI LLM execution service
│   ├── main.py                     # Entry point (routes)
│   ├── config.py                   # Agent model configuration
│   ├── graph/                      # Runtime loop + step handler nodes
│   └── services/                   # Firestore client
├── docs/                           # Documentation
├── scripts/                        # Data seeding + admin utilities
├── public/                         # Static assets
├── firestore.indexes.json          # Firestore composite index definitions
└── .env.local                      # Environment variables (not committed)
```

---

## How it Works

1. **Submit** — User submits a task via the Dashboard Task Composer
2. **Envelope** — The runtime creates a Canonical Execution Envelope in Firestore with an embedded step graph
3. **Identity** — Each participating agent's SHA-256 fingerprint is verified
4. **Lease** — An authority lease is acquired (prevents fork conflicts)
5. **Execute** — Steps run deterministically: COO plans → Researcher assigns → Worker produces → Grader evaluates
6. **Govern** — Human operators approve or reject via the Governance Panel
7. **Observe** — The Envelope Inspector shows real-time step progress, protocol messages, and artifacts

---

## Key Concepts

- **Execution Envelope** — The single source of truth. Contains all state: steps, leases, identity, artifacts.
- **ACELOGIC** — License and capability guard. Controls what operations each agent can perform.
- **#us# Protocol** — Typed machine grammar for agent-to-agent communication. Only 5 verbs allowed.
- **Fork Detection** — Lease-based mechanism that prevents duplicate execution (quarantines conflicts).
- **Explorer** — Read-only audit interface over all execution data.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | ✅ | Firebase client config (6 vars) |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Service account email |
| `FIREBASE_PRIVATE_KEY` | ✅ | Service account private key |
| `ACELOGIC_DEV_LICENSE_FALLBACK` | Dev only | Skip license Firestore lookup |
| `ACELOGIC_DEV_LICENSE_TIER` | Dev only | License tier for fallback (default: `1`) |
| `NEXT_PUBLIC_USE_DETERMINISTIC_RUNTIME` | ❌ | Enable runtime path (default: `true`) |
| `AGENT_ENGINE_URL` | ❌ | Python engine URL (default: `http://localhost:8001`) |
| `CRON_SECRET` | Prod | Bearer token for cron routes |
| `ACELOGIC_API_URL` | ❌ | Remote ACELOGIC instance (optional) |

Full details in [docs/QUICK_START.md](./docs/QUICK_START.md).

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Admin not initialized" | Malformed `FIREBASE_PRIVATE_KEY` | Ensure `\n` is escaped in `.env.local` |
| License/guard errors | Missing license doc | Run `node scripts/seed-license.js` or set `ACELOGIC_DEV_LICENSE_FALLBACK=true` |
| "Index required" in Firestore | Missing composite index | Follow error link or deploy `firestore.indexes.json` |
| Steps stuck at "pending" | Agent engine not running | Start the Python agent engine on port 8001 |
| "QUARANTINED" envelope | Fork conflict detected | Requires manual investigation and envelope reset |
