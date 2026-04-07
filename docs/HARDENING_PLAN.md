# Implementation Plan - ACEPLACE Runtime Hardening

This plan details the steps to transition the ACEPLACE / NXQ runtime monorepo from an "architecturally corrected" state to a "production-grade deterministic runtime".

## User Review Required

> [!IMPORTANT]
> **Breaking Changes & Invariants**:
> -   `pending_verification` identity shortcut will be disabled by default in production.
> -   Any step execution without a valid lease or identity will FAIL HARD and trigger a quarantine transition.
> -   `src/` in the root will be strictly designated as the Control Plane. Any remaining runtime logic will be moved to `packages/runtime-core` or deleted.

## Proposed Changes

### 1. Enforce Single Runtime Ownership

#### [MODIFY] [runtime-worker/src/index.ts](file:///d:/NOVA/nxq-workstation/apps/runtime-worker/src/index.ts)
-   Reinforce comments and logging to assert this as the sole entry point.
-   Ensure no other process claims from `execution_queue`.

#### [DELETE] [Legacy Runtime Code]
-   Identify and remove any leftover runtime execution logic in `src/lib/runtime` or similar paths.
-   Convert `src/lib/workflow-engine.ts` to a thin orchestration layer that only enqueues to `execution_queue`.

---

### 2. Strict Identity Enforcement

#### [MODIFY] [kernels/identity.ts](file:///d:/NOVA/nxq-workstation/packages/runtime-core/src/kernels/identity.ts)
-   Refactor `verifyIdentity` to strictly reject `pending_verification` unless `ALLOW_PENDING_IDENTITY` is explicitly `"true"`.
-   Ensure `AGENT_NOT_FOUND` and `IDENTITY_DATA_MISSING` always trigger `quarantineEnvelope`.
-   Implement a helper/guard for `verifyIdentity` as requested.

#### [MODIFY] [runtime/guards.ts](file:///d:/NOVA/nxq-workstation/packages/runtime-core/src/runtime/guards.ts)
-   Strengthen `assertIdentityContext` and `assertAgentIdentityContext` to be even more pedantic about fingerprint presence.

---

### 3. Strict Lease Enforcement

#### [MODIFY] [per-agent-authority.ts](file:///d:/NOVA/nxq-workstation/packages/runtime-core/src/per-agent-authority.ts)
-   Ensure `acquirePerAgentLease` and `renewPerAgentLease` never allow multiple instances to hold the same agent lease.
-   Double-check that `FORK_DETECTED` is thrown reliably.

#### [MODIFY] [runtime/guards.ts](file:///d:/NOVA/nxq-workstation/packages/runtime-core/src/runtime/guards.ts)
-   Strengthen `assertAgentLease` to check `lease_id` presence and validity.

---

### 4. Runtime Guardrails

#### [MODIFY] [parallel-runner.ts](file:///d:/NOVA/nxq-workstation/packages/runtime-core/src/parallel-runner.ts)
-   Integrate more hard assertions before:
    -   Lease acquisition finalization.
    -   Step selection.
    -   Agent invocation.
    -   Result persistence.

---

### 5. E2E and Invariant Testing

#### [MODIFY] [e2e-runtime.test.ts](file:///d:/NOVA/nxq-workstation/apps/runtime-worker/src/__tests__/e2e-runtime.test.ts)
-   Add test cases for:
    -   Missing lease (should fail).
    -   Invalid identity (should quarantine).
    -   Fork detection (simulated conflict).
    -   Terminal state re-run prevention.

---

### 6. Documentation & Root src/ Cleanup

#### [MODIFY] [README.md](file:///d:/NOVA/nxq-workstation/README.md)
#### [MODIFY] [ARCHITECTURE.md](file:///d:/NOVA/nxq-workstation/docs/ARCHITECTURE.md)
#### [MODIFY] [RUNTIME_INTERNALS.md](file:///d:/NOVA/nxq-workstation/docs/RUNTIME_INTERNALS.md)
-   Align all docs with the ACEPLACE / `runtime-worker` / `runtime-core` / Agent Engine architecture.
-   Clarify the role of root `src/` (Web/Control Plane).

#### [CLEANUP] Root `src/`
-   Remove or rename confusing files like `src/lib/acelogic` if they are outdated.

---

### 7. Dependency Hardening & CI

#### [MODIFY] [package.json](file:///d:/NOVA/nxq-workstation/package.json)
-   Add `"audit": "npm audit --audit-level=moderate"`.
-   Update `vite` and other vulnerable dependencies found via audit.

#### [MODIFY] [ci.yml](file:///d:/NOVA/nxq-workstation/.github/workflows/ci.yml)
-   Add `npm audit` step.
-   Ensure it fails on moderate vulnerabilities.

## Open Questions

-   Are there any specific "identity fingerprint" mismatch transitions that should be handled differently than a hard quarantine? (Current plan: Identity mismatch = Quarantined).

## Verification Plan

### Automated Tests
-   `npm run test` (All unit tests).
-   `npx vitest apps/runtime-worker/src/__tests__/e2e-runtime.test.ts` (E2E tests).
-   `npm run audit`.

### Manual Verification
-   Verify documentation readability and correctness.
-   Check root `src/` for any remaining "runtime-looking" code.
