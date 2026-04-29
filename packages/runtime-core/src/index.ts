/**
 * @aceplace/runtime-core public index
 *
 * Exposes core runtime kernel logic, the dispatcher, state machine,
 * and deterministic evaluation loops. Framework agnostic.
 */

// State machine
export { transition, canTransition } from "./state-machine";

// Identity kernel
export {
  verifyIdentity,
  verifyIdentityForAgent,
  buildIdentityContext,
  computeFingerprint,
  registerAgentIdentity,
} from "./kernels/identity";

// Persistence kernel
export { getDb, setDb } from "./db";
export {
  createEnvelope,
  getEnvelope,
  updateEnvelope,
  updateEnvelopeStep,
  getEnvelopeStep,
  getNextReadyStep,
  addTrace,
  createArtifact,
  linkJobToEnvelope,
  syncJobStatus,
  getJob,
  enqueueEnvelope,
  addTokenUsage,
} from "./kernels/persistence";
export {
  claimNextEnvelope,
  requeueEnvelope,
  finalizeQueueEntry,
} from "./kernels/queue";
export {
  setAgentSecrets,
  getAgentSecrets,
  listSecretNames,
  removeAgentSecret,
} from "./kernels/secrets";

// Lease management
export {
  acquireLease,
  releaseLease,
  hasValidLease,
  expireStaleLeases,
} from "./kernels/authority";

// Parallel runner — execution plane primitives
export {
  runEnvelopeParallel,
  claimEnvelopeStep,
  finalizeEnvelopeStep,
  getRunnableSteps,
  selectParallelStepBatch,
} from "./parallel-runner";

// Per-agent authority leases
export {
  acquirePerAgentLease,
  releasePerAgentLease,
  validatePerAgentLease,
  renewPerAgentLease,
} from "./per-agent-authority";
export {
  recoverGlobalDeadSteps,
  recoverEnvelopeDeadSteps,
} from "./recover-dead-steps";
export { emitRuntimeMetric } from "./telemetry/emitRuntimeMetric";

// Envelope builder
export { buildEnvelope, buildDefaultIdentityContext } from "./envelope-builder";

// Step planner
export { planEnvelopeSteps } from "./step-planner";

// #us# message engine
export {
  createUSMessage,
  handleUSMessage,
  mapStepTypeToUSMessage,
  storeUSMessage,
} from "./us-message-engine";
export {
  aggregateTelemetryWindow,
} from "./telemetry/aggregateTelemetryWindow";

// Dispatching Engine
export { dispatch, getEnvelopeState, approveEnvelope, rejectEnvelope } from "./engine";

// Acelogic Guards & Capability Introspection
export { acelogicExecutionGuard } from "./acelogic-guard";
export {
  aceLogicIntrospect,
  aceLogicVerifyIdentity,
  aceLogicLeaseAcquire,
  aceLogicLeaseRenew,
  aceLogicLeaseRelease,
  aceLogicResurrectionVerify,
} from "./acelogic/service";
export { auditLicenseCheck, checkCapability } from "./acelogic/capability";
export { isLicenseExpired, resolveLicenseById } from "./acelogic/resolve-license";
export { getLicenseFromRequest, runtimeIdFromRequest } from "./acelogic/http-context";

// Runtime guardrails
export {
  assertEnvelopeNotTerminal,
  assertAgentIdentityContext,
  assertAgentLease,
  assertClaimOwnership,
  assertStepExists,
  assertStepNotCompleted,
  assertDependenciesSatisfied,
  assertEnvelopeHasSteps,
} from "./runtime/guards";
export { resolveAssignedAgentId } from "./runtime/resolution";

// LLM Fallback (TypeScript-native agent execution)
export { executeFallbackStep } from "./llm-fallback";

// Types & constants
export * from "./types";
export { 
  COLLECTIONS, 
  STALE_CLAIM_THRESHOLD_MS, 
  ENVELOPE_STATUS_TRANSITIONS,
  STEP_STATUS_TRANSITIONS,
  STEP_TYPE_CONFIG,
  DEFAULT_STEP_PIPELINE,
  ALLOWED_PROTOCOL_VERBS,
  PROTOCOL_VERB_LABELS,
  DEFAULT_LEASE_DURATION_SECONDS,
  MAX_LEASE_DURATION_SECONDS,
  STEP_EXECUTION_MIN_WINDOW_MS,
  ENVELOPE_STATUS_DISPLAY,
  STEP_STATUS_DISPLAY,
  TIER_DEFINITIONS
} from "./constants";
export type { LicenseManifest } from "./acelogic/types";
