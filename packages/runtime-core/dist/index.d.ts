/**
 * @aceplace/runtime-core public index
 *
 * Exposes core runtime kernel logic, the dispatcher, state machine,
 * and deterministic evaluation loops. Framework agnostic.
 */
export { transition, canTransition } from "./state-machine";
export { verifyIdentity, verifyIdentityForAgent, buildIdentityContext, computeFingerprint, } from "./kernels/identity";
export { getDb } from "./db";
export { createEnvelope, getEnvelope, updateEnvelope, updateEnvelopeStep, getEnvelopeStep, getNextReadyStep, addTrace, createArtifact, linkJobToEnvelope, syncJobStatus, getJob, enqueueEnvelope, } from "./kernels/persistence";
export { storeAgentSecret, getAgentSecret, getAgentSecrets, deleteAllAgentSecrets, } from "./kernels/secrets";
export { acquirePerAgentLease, validatePerAgentLease, renewPerAgentLease, releasePerAgentLease, } from "./per-agent-authority";
export { runEnvelopeParallel, } from "./parallel-runner";
export { buildEnvelope, buildDefaultIdentityContext } from "./envelope-builder";
export { planEnvelopeSteps } from "./step-planner";
export { createUSMessage, handleUSMessage, mapStepTypeToUSMessage, storeUSMessage, } from "./us-message-engine";
export { dispatch, getEnvelopeState, approveEnvelope, rejectEnvelope } from "./engine";
export { acelogicExecutionGuard } from "./acelogic-guard";
export { aceLogicIntrospect, aceLogicVerifyIdentity, aceLogicLeaseAcquire, aceLogicLeaseRenew, aceLogicLeaseRelease, aceLogicResurrectionVerify, } from "./acelogic/service";
export { auditLicenseCheck, checkCapability } from "./acelogic/capability";
export { isLicenseExpired, resolveLicenseById } from "./acelogic/resolve-license";
export { getLicenseFromRequest, runtimeIdFromRequest } from "./acelogic/http-context";
export * from "./types";
export * from "./constants";
export type { LicenseManifest } from "./acelogic/types";
//# sourceMappingURL=index.d.ts.map