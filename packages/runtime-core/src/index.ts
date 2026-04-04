/**
 * runtime-core public index
 *
 * Re-exports everything the worker and web-tier need from the canonical
 * source at src/lib/runtime/. This package acts as a stable, framework-agnostic
 * API facade — NO Next.js or HTTP imports allowed past this boundary.
 *
 * Note: During the phased migration, actual source files live in
 * ../../src/lib/runtime/. This package's index re-exports them to provide
 * a clean @nxq/runtime-core import surface for the runtime-worker.
 */

// State machine
export { transition, canTransition } from "../../src/lib/runtime/state-machine";

// Identity kernel
export {
  verifyIdentity,
  verifyIdentityForAgent,
  buildIdentityContext,
  computeFingerprint,
  registerAgentIdentity,
  deleteAgentIdentity,
} from "../../src/lib/runtime/kernels/identity";

// Persistence kernel
export {
  createEnvelope,
  getEnvelope,
  updateEnvelope,
  updateEnvelopeStep,
  getEnvelopeStep,
  getNextReadyStep,
  setEnvelopeStatus,
  addTrace,
  createArtifact,
  getArtifact,
  linkJobToEnvelope,
  syncJobStatus,
  getJob,
  deleteAgent,
} from "../../src/lib/runtime/kernels/persistence";

// Lease management
export {
  acquirePerAgentLease,
  validatePerAgentLease,
  renewPerAgentLease,
  releasePerAgentLease,
} from "../../src/lib/runtime/per-agent-authority";

// Parallel runner
export {
  runEnvelopeParallel,
  getRunnableSteps,
  selectParallelStepBatch,
  claimEnvelopeStep,
  finalizeEnvelopeStep,
} from "../../src/lib/runtime/parallel-runner";

// Envelope builder
export { buildEnvelope, buildDefaultIdentityContext } from "../../src/lib/runtime/envelope-builder";

// Step planner
export { planEnvelopeSteps } from "../../src/lib/runtime/step-planner";

// #us# message engine
export {
  createUSMessage,
  handleUSMessage,
  mapStepTypeToUSMessage,
  storeUSMessage,
} from "../../src/lib/runtime/us-message-engine";

// Types & constants
export * from "../../src/lib/runtime/types";
export * from "../../src/lib/runtime/constants";
