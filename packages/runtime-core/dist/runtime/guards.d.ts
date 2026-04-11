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
/**
 * Envelope must not be in a terminal state before executing.
 * Attempting to run a terminal envelope is a programming error.
 */
export declare function assertEnvelopeNotTerminal(envelope: ExecutionEnvelope): void;
/**
 * Primary identity_context must be present and carry a non-empty fingerprint.
 * A missing or empty fingerprint means the envelope was built incorrectly —
 * execution must not proceed.
 */
export declare function assertIdentityContext(envelope: ExecutionEnvelope): void;
/**
 * Per-agent identity_context must be present and carry a valid fingerprint.
 * Multi-agent envelopes embed one IdentityContext per agent in identity_contexts.
 * Single-agent envelopes use identity_context (agent_id must match).
 */
export declare function assertAgentIdentityContext(envelope: ExecutionEnvelope, agentId: string): void;
/**
 * Per-agent lease must exist, be active, not expired, and owned by this instance.
 * A missing or expired lease means a step is about to execute without authority —
 * this is an invariant violation that must fail hard.
 */
export declare function assertAgentLease(envelope: ExecutionEnvelope, agentId: string, instanceId: string): void;
/**
 * Job owner instance from execution_queue claim must match the current runtime instance.
 */
export declare function assertClaimOwnership(envelope_id: string, claimedBy: string, instanceId: string): void;
/**
 * Step must exist in the envelope's step graph before we try to execute it.
 */
export declare function assertStepExists(envelope: ExecutionEnvelope, stepId: string): EnvelopeStep;
/**
 * A completed step must never be re-executed.
 * Duplicate execution corrupts the artifact chain and trace hash.
 */
export declare function assertStepNotCompleted(step: EnvelopeStep): void;
/**
 * All steps that this step depends on must be completed before it may execute.
 * Running a step with unsatisfied dependencies produces incorrect results.
 */
export declare function assertDependenciesSatisfied(step: EnvelopeStep, allSteps: EnvelopeStep[]): void;
/**
 * Envelope must have at least one step in its step graph.
 * An empty envelope cannot make progress and indicates a build error.
 */
export declare function assertEnvelopeHasSteps(envelope: ExecutionEnvelope): void;
//# sourceMappingURL=guards.d.ts.map