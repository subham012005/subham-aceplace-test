/**
 * @aceplace/runtime-core public index
 *
 * Exposes core runtime kernel logic, the dispatcher, state machine,
 * and deterministic evaluation loops. Framework agnostic.
 */
export { transition, canTransition } from "./state-machine";
export { verifyIdentity, verifyIdentityForAgent, buildIdentityContext, computeFingerprint, registerAgentIdentity, } from "./kernels/identity";
export { getDb } from "./db";
export { createEnvelope, getEnvelope, updateEnvelope, updateEnvelopeStep, getEnvelopeStep, getNextReadyStep, addTrace, createArtifact, linkJobToEnvelope, syncJobStatus, getJob, enqueueEnvelope, } from "./kernels/persistence";
export { claimNextEnvelope, requeueEnvelope, finalizeQueueEntry, } from "./kernels/queue";
export { setAgentSecrets, getAgentSecrets, listSecretNames, removeAgentSecret, } from "./kernels/secrets";
export { acquireLease, releaseLease, hasValidLease, expireStaleLeases, } from "./kernels/authority";
export { runEnvelopeParallel, claimEnvelopeStep, finalizeEnvelopeStep, getRunnableSteps, selectParallelStepBatch, } from "./parallel-runner";
export { acquirePerAgentLease, releasePerAgentLease, validatePerAgentLease, renewPerAgentLease, } from "./per-agent-authority";
export { recoverGlobalDeadSteps, recoverEnvelopeDeadSteps, } from "./recover-dead-steps";
export { emitRuntimeMetric } from "./telemetry/emitRuntimeMetric";
export { buildEnvelope, buildDefaultIdentityContext } from "./envelope-builder";
export { planEnvelopeSteps } from "./step-planner";
export { createUSMessage, handleUSMessage, mapStepTypeToUSMessage, storeUSMessage, } from "./us-message-engine";
export { aggregateTelemetryWindow, } from "./telemetry/aggregateTelemetryWindow";
export { dispatch, getEnvelopeState, approveEnvelope, rejectEnvelope } from "./engine";
export { acelogicExecutionGuard } from "./acelogic-guard";
export { aceLogicIntrospect, aceLogicVerifyIdentity, aceLogicLeaseAcquire, aceLogicLeaseRenew, aceLogicLeaseRelease, aceLogicResurrectionVerify, } from "./acelogic/service";
export { auditLicenseCheck, checkCapability } from "./acelogic/capability";
export { isLicenseExpired, resolveLicenseById } from "./acelogic/resolve-license";
export { getLicenseFromRequest, runtimeIdFromRequest } from "./acelogic/http-context";
export { assertEnvelopeNotTerminal, assertIdentityContext, assertAgentIdentityContext, assertAgentLease, assertClaimOwnership, assertStepExists, assertStepNotCompleted, assertDependenciesSatisfied, assertEnvelopeHasSteps, } from "./runtime/guards";
export { resolveAssignedAgentId } from "./runtime/resolution";
export { executeFallbackStep } from "./llm-fallback";
export * from "./types";
export * from "./constants";
export type { LicenseManifest } from "./acelogic/types";
//# sourceMappingURL=index.d.ts.map