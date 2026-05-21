# ACEPLACE

## Deterministic Multi-Agent Runtime Infrastructure

ACEPLACE is a deterministic multi-agent runtime platform for governed autonomous execution across enterprise, telecom, sovereign, and distributed infrastructure environments.

The platform is built around an envelope-driven execution architecture that separates orchestration, execution, governance, continuity, observability, and artifact production into deterministic runtime layers.

ACEPLACE is not a chatbot orchestration framework.

It is a governed runtime system designed to support:

- deterministic orchestration
- lease-governed execution
- canonical identity continuity
- recoverable runtime state
- traceable execution lineage
- observable runtime telemetry
- provenance-linked artifact generation

This repository contains the hardened Phase 2 runtime architecture powering ACEPLACE deterministic execution systems.

---

# 🏗️ Repository Architecture

This project is a **TypeScript Monorepo** powered by **NPM Workspaces**.

The runtime is intentionally separated into:

- Control Plane
- Execution Plane
- Shared Runtime Kernel

This separation enforces deterministic runtime governance and prevents execution authority from leaking into orchestration or UI layers.

---

# 🧠 Deterministic Runtime Philosophy

ACEPLACE runtime systems operate under several core principles:

- Execution Envelopes are the single runtime source of truth
- Agents are stateless runtime workers
- Runtime authority is lease-governed
- Identity must be verified before execution
- Invalid runtime states fail closed
- Every action is traceable and observable
- Canonical continuity must persist across failures
- Runtime execution must remain deterministic

This architecture enables:

- deterministic orchestration
- recoverable execution continuity
- runtime governance enforcement
- traceable artifact provenance
- lease-based execution safety
- sovereign deployment compatibility
- carrier-grade runtime visibility

---

# 🖥️ 1. Control Plane (Web UI)

## Location

```bash
src/
```

The root `src/` directory contains the ACEPLACE Next.js 16 Control Plane.

## Role

Enrollment, governance, orchestration observation, and runtime administration.

## Responsibilities

- execution envelope creation
- Firestore queue insertion
- runtime telemetry dashboards
- mission observation
- human approval / rejection
- trace visualization
- grader review
- runtime configuration
- deterministic knowledge grounding
- protocol module administration

## Strict Runtime Rule

No execution logic resides inside the Control Plane.

The Control Plane only:

- creates envelopes
- validates orchestration state
- visualizes runtime activity
- imports deterministic schemas from `@aceplace/runtime-core`

Execution authority never exists inside the web layer.

---

# ⚙️ 2. Execution Plane (Runtime Worker)

## Location

```bash
apps/runtime-worker/
```

The Runtime Worker is the canonical deterministic execution tier.

## Role

Lease acquisition, identity validation, runtime orchestration, and execution dispatch.

## Responsibilities

- claiming execution envelopes
- identity verification
- authority lease acquisition
- runtime validation
- deterministic step execution
- trace persistence
- artifact generation
- grading orchestration
- continuity restoration
- quarantine enforcement

The Runtime Worker executes the deterministic `#us#` protocol lifecycle.

---

# 📦 3. Shared Runtime Kernel

## Location

```bash
packages/runtime-core/
```

The internal runtime kernel shared between the Web UI and Runtime Worker.

## Role

Canonical deterministic runtime specification.

## Responsibilities

- identity verification kernels
- runtime state machines
- deterministic transitions
- lease governance
- `#us#` protocol routing
- envelope decomposition
- continuity restoration
- runtime validation rules
- trace schemas
- orchestration sequencing

This package acts as the deterministic runtime truth layer.

---

# 🔄 Canonical Agent Continuity

ACEPLACE preserves canonical runtime identity continuity across:

- worker restarts
- reconnects
- runtime migration
- infrastructure failover
- browser refresh
- distributed node recovery
- runtime interruptions
- orchestration failover events

The runtime restores the same canonical ACELOGIC identity after recovery instead of generating replacement orchestration identities.

This preserves:

- execution lineage
- trace history
- runtime provenance
- authority relationships
- deterministic continuity
- lease history
- runtime fingerprints
- orchestration continuity

Identity continuity persists independently from:

- model provider
- deployment region
- runtime session
- orchestration node
- infrastructure layer
- inference backend

This allows deterministic execution continuity across unstable or distributed runtime environments without creating forked orchestration identities.

---

# 📦 Execution Envelope Lifecycle

```text
TASK CREATED
    ↓
ENVELOPE GENERATED
    ↓
IDENTITY VERIFIED
    ↓
LEASE ACQUIRED
    ↓
STEP EXECUTED
    ↓
TRACE PERSISTED
    ↓
LEASE EXPIRED
    ↓
NEXT STEP VALIDATION
```

Every runtime step requires:

- valid lease authority
- deterministic validation
- identity verification
- scoped execution approval

Invalid transitions are quarantined immediately.

Execution only progresses after runtime validation succeeds.

---

# 🛡️ Runtime Guarantees

| Guarantee | Description |
|---|---|
| Identity-Bound | Every agent has canonical ACELOGIC identity |
| Lease-Governed | Execution requires valid scoped authority |
| Observable | Runtime activity is fully traceable |
| Recoverable | Continuity persists across failures |
| Deterministic | Runtime transitions are validated |
| Artifact-Producing | Outputs maintain provenance lineage |
| Fail-Closed | Invalid states quarantine automatically |
| Continuity-Protected | Canonical identity persists across recovery |

---

# 🚀 Quick Setup

## 1. Install Dependencies

```bash
npm install
```

## 2. Run Control Plane

```bash
npm run dev
```

## 3. Run Runtime Worker

```bash
npm run worker
```

For full environment setup and service-account configuration see:

```bash
docs/QUICK_START.md
```

---

# 🧪 End-to-End Runtime Testing

ACEPLACE includes a hardened deterministic E2E runtime test suite validating:

- envelope creation
- runtime execution
- lease governance
- trace persistence
- quarantine behavior
- continuity recovery
- identity validation

## Run E2E Tests

```bash
npm run test:e2e
```

---

# ✅ Verified Runtime Paths

## Quarantine Path (Passed)

Validates:

- identity mismatches
- invalid leases
- unauthorized claims
- tampered envelopes
- forked execution attempts

All invalid states immediately quarantine.

---

## Success Path (Proven)

Validates:

- deterministic multi-agent expansion
- state transitions
- trace persistence
- artifact production
- grading execution
- lease sequencing
- continuity restoration

---

# 📖 Documentation Reference

| Document | Description |
|---|---|
| `ARCHITECTURE.md` | High-level runtime architecture |
| `RUNTIME_INTERNALS.md` | Deterministic runtime kernels |
| `FIRESTORE_SCHEMA.md` | Canonical collection mappings |
| `API_REFERENCE.md` | Control Plane APIs |
| `QUICK_START.md` | Environment setup |
| `LEASE_GOVERNANCE.md` | Authority lease lifecycle |
| `CONTINUITY_MODEL.md` | Canonical continuity architecture |

---

# 🛡️ Identity & Runtime Security

ACEPLACE implements mandatory SHA-256 runtime identity fingerprinting.

Every runtime agent is verified against its canonical ACELOGIC registry identity before execution authority is granted.

---

# Hardened Runtime Guardrails

## Queue Claim Ownership

Every execution envelope is guarded by atomic claim ownership.

Only the Runtime Worker that claimed the envelope from the execution queue may advance the deterministic state machine.

---

## Fail-Closed Identity

Production environments reject:

- unverified identities
- pending identities
- invalid fingerprints
- unauthorized execution claims

Development override:

```env
ALLOW_PENDING_IDENTITY=true
```

Local development only.

---

## Immediate Quarantine

Any of the following trigger immediate envelope quarantine:

- identity mismatch
- lease conflict
- fork detection
- invalid runtime transition
- unauthorized worker claim
- trace corruption
- continuity inconsistency

Quarantine halts all downstream execution.

---

# 🧠 Deterministic Knowledge Grounding

ACEPLACE supports deterministic runtime grounding through the Deterministic Knowledge Base.

Runtime knowledge may include:

- company knowledge bases
- SOPs
- whitepapers
- protocol modules
- compliance policies
- operational constraints
- runtime directives
- deployment configurations
- infrastructure specifications

Knowledge is synchronized into governed runtime contexts without retraining foundation models.

This enables:

- grounded orchestration
- organization-specific execution
- deterministic conditioning
- contextual continuity

---

# 🌐 Intelligence Model Independence

ACEPLACE agents are model-agnostic.

Runtime systems may connect to:

- OpenAI
- Anthropic
- Gemini
- OpenRouter
- local inference systems
- sovereign AI infrastructure
- private enterprise models

Providers may change without changing:

- agent identity
- continuity
- governance
- provenance
- runtime authority
- execution lineage

> Intelligence is replaceable.  
> Identity persists.

---

# 🌍 Enterprise & Sovereign Runtime Readiness

ACEPLACE runtime architecture is designed to support:

- enterprise orchestration systems
- sovereign infrastructure deployments
- telecom AI-RAN environments
- distributed edge execution
- deterministic infrastructure governance
- carrier-grade observability
- private runtime clusters

Future deployment tiers may support:

- Bring Your Own Infrastructure (BYOI)
- Bring Your Own LLM (BYO-LLM)
- sovereign cloud deployments
- air-gapped execution
- regional execution governance
- dedicated orchestration clusters
- carrier-grade runtime telemetry

---

# 📡 Telecommunications & AI-RAN Runtime Systems

ACEPLACE Tier 3–5 deployments may include deterministic infrastructure agents for:

- AI-RAN orchestration
- telecom runtime governance
- distributed edge execution
- latency governance
- failover continuity
- carrier-grade observability
- sovereign telecom infrastructure

Specialized runtime systems may include:

- Node Stability Agents
- Edge Coordination Agents
- Spectrum Coordination Agents
- Latency Governance Agents
- Runtime Recovery Agents
- Failover Continuity Agents
- Infrastructure Routing Agents

These systems operate under:

- lease governance
- deterministic orchestration
- observable runtime enforcement
- continuity-protected execution

---

# 🔭 Observability & Traceability

ACEPLACE provides deterministic runtime visibility across all execution layers.

Observable runtime systems include:

- Step Graph
- Agent Activity Log
- Execution Trace Stream
- Mission Queue
- Mission Archive
- Lease Transition Timeline
- Artifact Lineage Graph

Runtime visibility includes:

- agent execution order
- timestamps
- lease transitions
- trace events
- grading events
- artifact provenance
- continuity checkpoints

---

# 🏁 Runtime Positioning

ACEPLACE is designed as deterministic runtime infrastructure for governed autonomous execution systems.

The platform combines:

- orchestration
- execution
- governance
- continuity
- observability
- validation
- provenance
- artifact production

inside a lease-governed deterministic runtime model.

---

# 📄 License

**Private Internal Repository**  
ACEPLACE Runtime Infrastructure  
All Rights Reserved.