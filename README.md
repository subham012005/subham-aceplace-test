# ACEPLACE

> **Phase 2 — Deterministic Multi-Agent Runtime**

ACEPLACE is a **multi-agent AI task execution platform** powered by a deterministic, envelope-driven runtime. This repository has been consolidated into a modern monorepo structure to strictly separate the **Control Plane** (Web UI/API) from the **Execution Plane** (Runtime Worker).

---

## 🏗️ Repository Architecture

This project is a TypeScript Monorepo powered by NPM Workspaces.

### 1. Control Plane (Web UI) — [src/](./src/)
The root `src/` directory contains the **Next.js 16 Control Plane**.
- **Role**: Enrollment, Governance, and Observation.
- **Responsibility**: Enqueuing execution envelopes into Firestore; human approval/rejection; real-time dashboard telemetry.
- **Strict Rule**: No execution logic resides here. It strictly imports `@aceplace/runtime-core` for schema and state-machine transitions.

### 2. Execution Plane (Worker) — [apps/runtime-worker/](./apps/runtime-worker/)
The **ACEPLACE Runtime Worker** is the canonical execution tier.
- **Role**: Lease acquisition, identity verification, and step execution.
- **Responsibility**: Claiming queued envelopes, acquiring per-agent authority leases, and orchestrating the `#us#` protocol message loop.

### 3. Shared Logic — [packages/runtime-core/](./packages/runtime-core/)
The internal core package used by both the Web UI and the Worker.
- **Role**: Truth of the Deterministic Runtime specification.
- **Responsibility**: Identity verification kernels, state-machine rules, `#us#` message routing, and decomposition logic.

---

## 🚀 Quick Setup

```bash
# 1. Install dependencies (Root)
npm install

# 2. Run Web Control Plane (Next.js)
npm run dev

# 3. Run Execution Plane (Runtime Worker)
npm run worker
```

For full environment variable setup and service account configuration, see [QUICK_START.md](./docs/QUICK_START.md).

---

## 🧪 End-to-End Testing (Phase 2 Hardened)

ACEPLACE features a **Deterministic E2E Runtime Test Suite** that verifies the full execution lifecycle (envelope → worker claim → trace) using a high-fidelity in-memory database driver.

```bash
# Run the E2E suite
npm run test:e2e
```

### Verified Paths:
- **Quarantine Path (Passed)**: Successfully validates identity fingerprint mismatches and quarantines tampered envelopes.
- **Success Path (Proven)**: Validates full multi-agent expansion and state transitions in a deterministic environment.

---

## 📖 Documentation Reference

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | High-level system design and execution paths |
| [RUNTIME_INTERNALS.md](./docs/RUNTIME_INTERNALS.md) | Deep-dive into runtime kernels and #us# protocol |
| [FIRESTORE_SCHEMA.md](./docs/FIRESTORE_SCHEMA.md) | Canonical collection definitions and field mappings |
| [API_REFERENCE.md](./docs/API_REFERENCE.md) | Control Plane REST API specifications |

---

## 🛡️ Identity & Security
ACEPLACE implements mandatory **SHA-256 identity fingerprinting**. Every agent in the multi-agent graph is verified against its canonical registry document before any execution-tier lease is granted. 

### Hardened Production Guardrails:
- **Queue Claim Ownership**: Every envelope execution is guarded by an atomic claim check — only the worker that claimed the envelope from the `execution_queue` can drive its state machine.
- **Fail-Closed Identity**: In production, `pending_verification` identities are strictly rejected. Set `ALLOW_PENDING_IDENTITY=true` only for local development.
- **Immediate Quarantine**: Any identity mismatch, lease conflict (fork), or unauthorized claim results in **Immediate Envelope Quarantine**, halting all downstream steps.
