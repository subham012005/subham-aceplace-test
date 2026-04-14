/**
 * Runtime Guardrails — Hard Assertions
 *
 * These assertions fire at key execution boundaries and fail hard (throw)
 * rather than silently continuing on invariant violations.
 *
 * Integration points in parallel-runner.ts:
 *   assertEnvelopeNotTerminal   — before boot transitions + before each step
 *   assertIdentityContext        — before identity verification
 *   assertAgentIdentityContext   — before per-agent step execution
 *   assertEnvelopeHasSteps       — after first load in runEnvelopeParallel
 *   assertAgentLease             — after lease acquisition and re-read
 *   assertStepNotCompleted       — before claiming a step
 *   assertDependenciesSatisfied  — before claiming a step
 *
 * Every function here throws with a prefixed GUARD_* error code.
 * Callers must NOT catch-and-continue on GUARD_* errors.
 */

import type { EnvelopeStep, ExecutionEnvelope } from "../types";

const TERMINAL_STATUSES = new Set([
  "approved",
  "completed",
  "rejected",
  "failed",
  "quarantined",
]);

/**
 * Envelope must not be in a terminal state before executing.
 * Attempting to run a terminal envelope is a programming error.
 */
export function assertEnvelopeNotTerminal(envelope: ExecutionEnvelope): void {
  if (TERMINAL_STATUSES.has(envelope.status)) {
    throw new Error(`GUARD_ENVELOPE_TERMINAL:${envelope.status}`);
  }
}

/**
 * Primary identity_context must be present and carry a non-empty fingerprint.
 * A missing or empty fingerprint means the envelope was built incorrectly —
 * execution must not proceed.
 */
export function assertIdentityContext(envelope: ExecutionEnvelope): void {
  if (!envelope.identity_context) {
    throw new Error("GUARD_IDENTITY_CONTEXT_MISSING");
  }
  const fp = envelope.identity_context.identity_fingerprint;
  if (!fp) {
    throw new Error("GUARD_IDENTITY_FINGERPRINT_MISSING");
  }
}

/**
 * Per-agent identity_context must be present and carry a valid fingerprint.
 * Multi-agent envelopes embed one IdentityContext per agent in identity_contexts.
 * Single-agent envelopes use identity_context (agent_id must match).
 */
export function assertAgentIdentityContext(
  envelope: ExecutionEnvelope,
  agentId: string
): void {
  const ctx = envelope.multi_agent
    ? envelope.identity_contexts?.[agentId]
    : envelope.identity_context?.agent_id === agentId
      ? envelope.identity_context
      : undefined;

  if (!ctx) {
    throw new Error(`GUARD_AGENT_IDENTITY_CONTEXT_MISSING:${agentId}`);
  }
  if (!ctx.identity_fingerprint) {
    throw new Error(`GUARD_AGENT_IDENTITY_FINGERPRINT_MISSING:${agentId}`);
  }
}

/**
 * Per-agent identity_context must be present, carry a valid fingerprint,
 * and be PRECISELY verified. Silent identity failures are prohibited.
 */
export function assertAgentIdentityVerified(
  envelope: ExecutionEnvelope,
  agentId: string
): void {
  assertAgentIdentityContext(envelope, agentId);
  const ctx = envelope.multi_agent
    ? envelope.identity_contexts?.[agentId]
    : envelope.identity_context;

  if (!ctx?.verified) {
    throw new Error(`GUARD_IDENTITY_NOT_VERIFIED:${agentId}`);
  }
  
  // Hard invariant: Verified identity must have a non-empty fingerprint
  if (!ctx?.identity_fingerprint || ctx.identity_fingerprint === "pending_verification") {
    throw new Error(`GUARD_IDENTITY_INVALID_FINGERPRINT:${agentId}`);
  }
}

/**
 * Per-agent lease must exist, be active, not expired, and owned by this instance.
 * A missing or expired lease means a step is about to execute without authority —
 * this is an invariant violation that must fail hard.
 */
export function assertAgentLease(
  envelope: ExecutionEnvelope,
  agentId: string,
  instanceId: string
): void {
  const lease = envelope.authority_leases?.[agentId];
  if (!lease) {
    throw new Error(`GUARD_LEASE_MISSING:${agentId}`);
  }
  if (!lease.lease_id) {
    throw new Error(`GUARD_LEASE_ID_MISSING:${agentId}`);
  }
  if (lease.status === "expired" || lease.status === "revoked") {
    throw new Error(`GUARD_LEASE_NOT_ACTIVE:${agentId}:${lease.status}`);
  }
  const expiresAt = new Date(lease.lease_expires_at).getTime();
  if (isNaN(expiresAt) || expiresAt < Date.now()) {
    throw new Error(`GUARD_LEASE_EXPIRED:${agentId}`);
  }
  if (!lease.current_instance_id || lease.current_instance_id !== instanceId) {
    throw new Error(
      `GUARD_LEASE_INSTANCE_MISMATCH:${agentId}:expected=${instanceId}:actual=${lease.current_instance_id || "NONE"}`
    );
  }
}

/**
 * Job owner instance from execution_queue claim must match the current runtime instance.
 */
export function assertClaimOwnership(
  envelope_id: string,
  claimedBy: string,
  instanceId: string
): void {
  if (claimedBy !== instanceId) {
    throw new Error(`GUARD_CLAIM_OWNERSHIP_MISMATCH:${envelope_id}:expected=${instanceId}:actual=${claimedBy}`);
  }
}

/**
 * Step must exist in the envelope's step graph before we try to execute it.
 */
export function assertStepExists(
  envelope: ExecutionEnvelope,
  stepId: string
): EnvelopeStep {
  const step = (envelope.steps ?? []).find((s) => s.step_id === stepId);
  if (!step) {
    throw new Error(`GUARD_STEP_NOT_FOUND:${stepId}`);
  }
  return step;
}

/**
 * A completed step must never be re-executed.
 * Duplicate execution corrupts the artifact chain and trace hash.
 */
export function assertStepNotCompleted(step: EnvelopeStep): void {
  if (step.status === "completed") {
    throw new Error(`GUARD_STEP_ALREADY_COMPLETED:${step.step_id}`);
  }
}

/**
 * All steps that this step depends on must be completed before it may execute.
 * Running a step with unsatisfied dependencies produces incorrect results.
 */
export function assertDependenciesSatisfied(
  step: EnvelopeStep,
  allSteps: EnvelopeStep[]
): void {
  const deps = step.depends_on ?? [];
  if (!deps.length) return;
  const byId = new Map(allSteps.map((s) => [s.step_id, s]));
  for (const depId of deps) {
    const dep = byId.get(depId);
    if (!dep || dep.status !== "completed") {
      throw new Error(
        `GUARD_DEPENDENCY_NOT_SATISFIED:${step.step_id}:needs=${depId}:dep_status=${dep?.status ?? "MISSING"}`
      );
    }
  }
}

/**
 * Envelope must have at least one step in its step graph.
 * An empty envelope cannot make progress and indicates a build error.
 */
export function assertEnvelopeHasSteps(envelope: ExecutionEnvelope): void {
  if (!envelope.steps || envelope.steps.length === 0) {
    throw new Error("GUARD_ENVELOPE_NO_STEPS");
  }
}
