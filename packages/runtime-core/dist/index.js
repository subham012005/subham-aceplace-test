"use strict";
/**
 * @aceplace/runtime-core public index
 *
 * Exposes core runtime kernel logic, the dispatcher, state machine,
 * and deterministic evaluation loops. Framework agnostic.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapStepTypeToUSMessage = exports.handleUSMessage = exports.createUSMessage = exports.planEnvelopeSteps = exports.buildDefaultIdentityContext = exports.buildEnvelope = exports.emitRuntimeMetric = exports.recoverEnvelopeDeadSteps = exports.recoverGlobalDeadSteps = exports.renewPerAgentLease = exports.validatePerAgentLease = exports.releasePerAgentLease = exports.acquirePerAgentLease = exports.selectParallelStepBatch = exports.getRunnableSteps = exports.finalizeEnvelopeStep = exports.claimEnvelopeStep = exports.runEnvelopeParallel = exports.expireStaleLeases = exports.hasValidLease = exports.releaseLease = exports.acquireLease = exports.removeAgentSecret = exports.listSecretNames = exports.getAgentSecrets = exports.setAgentSecrets = exports.finalizeQueueEntry = exports.requeueEnvelope = exports.claimNextEnvelope = exports.enqueueEnvelope = exports.getJob = exports.syncJobStatus = exports.linkJobToEnvelope = exports.createArtifact = exports.addTrace = exports.getNextReadyStep = exports.getEnvelopeStep = exports.updateEnvelopeStep = exports.updateEnvelope = exports.getEnvelope = exports.createEnvelope = exports.setDb = exports.getDb = exports.registerAgentIdentity = exports.computeFingerprint = exports.buildIdentityContext = exports.verifyIdentityForAgent = exports.verifyIdentity = exports.canTransition = exports.transition = void 0;
exports.TIER_DEFINITIONS = exports.STEP_STATUS_DISPLAY = exports.ENVELOPE_STATUS_DISPLAY = exports.STEP_EXECUTION_MIN_WINDOW_MS = exports.MAX_LEASE_DURATION_SECONDS = exports.DEFAULT_LEASE_DURATION_SECONDS = exports.PROTOCOL_VERB_LABELS = exports.ALLOWED_PROTOCOL_VERBS = exports.DEFAULT_STEP_PIPELINE = exports.STEP_TYPE_CONFIG = exports.STEP_STATUS_TRANSITIONS = exports.ENVELOPE_STATUS_TRANSITIONS = exports.STALE_CLAIM_THRESHOLD_MS = exports.COLLECTIONS = exports.executeFallbackStep = exports.resolveAssignedAgentId = exports.assertEnvelopeHasSteps = exports.assertDependenciesSatisfied = exports.assertStepNotCompleted = exports.assertStepExists = exports.assertClaimOwnership = exports.assertAgentLease = exports.assertAgentIdentityContext = exports.assertEnvelopeNotTerminal = exports.runtimeIdFromRequest = exports.getLicenseFromRequest = exports.resolveLicenseById = exports.isLicenseExpired = exports.checkCapability = exports.auditLicenseCheck = exports.aceLogicResurrectionVerify = exports.aceLogicLeaseRelease = exports.aceLogicLeaseRenew = exports.aceLogicLeaseAcquire = exports.aceLogicVerifyIdentity = exports.aceLogicIntrospect = exports.acelogicExecutionGuard = exports.rejectEnvelope = exports.approveEnvelope = exports.getEnvelopeState = exports.dispatch = exports.aggregateTelemetryWindow = exports.storeUSMessage = void 0;
// State machine
var state_machine_1 = require("./state-machine");
Object.defineProperty(exports, "transition", { enumerable: true, get: function () { return state_machine_1.transition; } });
Object.defineProperty(exports, "canTransition", { enumerable: true, get: function () { return state_machine_1.canTransition; } });
// Identity kernel
var identity_1 = require("./kernels/identity");
Object.defineProperty(exports, "verifyIdentity", { enumerable: true, get: function () { return identity_1.verifyIdentity; } });
Object.defineProperty(exports, "verifyIdentityForAgent", { enumerable: true, get: function () { return identity_1.verifyIdentityForAgent; } });
Object.defineProperty(exports, "buildIdentityContext", { enumerable: true, get: function () { return identity_1.buildIdentityContext; } });
Object.defineProperty(exports, "computeFingerprint", { enumerable: true, get: function () { return identity_1.computeFingerprint; } });
Object.defineProperty(exports, "registerAgentIdentity", { enumerable: true, get: function () { return identity_1.registerAgentIdentity; } });
// Persistence kernel
var db_1 = require("./db");
Object.defineProperty(exports, "getDb", { enumerable: true, get: function () { return db_1.getDb; } });
Object.defineProperty(exports, "setDb", { enumerable: true, get: function () { return db_1.setDb; } });
var persistence_1 = require("./kernels/persistence");
Object.defineProperty(exports, "createEnvelope", { enumerable: true, get: function () { return persistence_1.createEnvelope; } });
Object.defineProperty(exports, "getEnvelope", { enumerable: true, get: function () { return persistence_1.getEnvelope; } });
Object.defineProperty(exports, "updateEnvelope", { enumerable: true, get: function () { return persistence_1.updateEnvelope; } });
Object.defineProperty(exports, "updateEnvelopeStep", { enumerable: true, get: function () { return persistence_1.updateEnvelopeStep; } });
Object.defineProperty(exports, "getEnvelopeStep", { enumerable: true, get: function () { return persistence_1.getEnvelopeStep; } });
Object.defineProperty(exports, "getNextReadyStep", { enumerable: true, get: function () { return persistence_1.getNextReadyStep; } });
Object.defineProperty(exports, "addTrace", { enumerable: true, get: function () { return persistence_1.addTrace; } });
Object.defineProperty(exports, "createArtifact", { enumerable: true, get: function () { return persistence_1.createArtifact; } });
Object.defineProperty(exports, "linkJobToEnvelope", { enumerable: true, get: function () { return persistence_1.linkJobToEnvelope; } });
Object.defineProperty(exports, "syncJobStatus", { enumerable: true, get: function () { return persistence_1.syncJobStatus; } });
Object.defineProperty(exports, "getJob", { enumerable: true, get: function () { return persistence_1.getJob; } });
Object.defineProperty(exports, "enqueueEnvelope", { enumerable: true, get: function () { return persistence_1.enqueueEnvelope; } });
var queue_1 = require("./kernels/queue");
Object.defineProperty(exports, "claimNextEnvelope", { enumerable: true, get: function () { return queue_1.claimNextEnvelope; } });
Object.defineProperty(exports, "requeueEnvelope", { enumerable: true, get: function () { return queue_1.requeueEnvelope; } });
Object.defineProperty(exports, "finalizeQueueEntry", { enumerable: true, get: function () { return queue_1.finalizeQueueEntry; } });
var secrets_1 = require("./kernels/secrets");
Object.defineProperty(exports, "setAgentSecrets", { enumerable: true, get: function () { return secrets_1.setAgentSecrets; } });
Object.defineProperty(exports, "getAgentSecrets", { enumerable: true, get: function () { return secrets_1.getAgentSecrets; } });
Object.defineProperty(exports, "listSecretNames", { enumerable: true, get: function () { return secrets_1.listSecretNames; } });
Object.defineProperty(exports, "removeAgentSecret", { enumerable: true, get: function () { return secrets_1.removeAgentSecret; } });
// Lease management
var authority_1 = require("./kernels/authority");
Object.defineProperty(exports, "acquireLease", { enumerable: true, get: function () { return authority_1.acquireLease; } });
Object.defineProperty(exports, "releaseLease", { enumerable: true, get: function () { return authority_1.releaseLease; } });
Object.defineProperty(exports, "hasValidLease", { enumerable: true, get: function () { return authority_1.hasValidLease; } });
Object.defineProperty(exports, "expireStaleLeases", { enumerable: true, get: function () { return authority_1.expireStaleLeases; } });
// Parallel runner — execution plane primitives
var parallel_runner_1 = require("./parallel-runner");
Object.defineProperty(exports, "runEnvelopeParallel", { enumerable: true, get: function () { return parallel_runner_1.runEnvelopeParallel; } });
Object.defineProperty(exports, "claimEnvelopeStep", { enumerable: true, get: function () { return parallel_runner_1.claimEnvelopeStep; } });
Object.defineProperty(exports, "finalizeEnvelopeStep", { enumerable: true, get: function () { return parallel_runner_1.finalizeEnvelopeStep; } });
Object.defineProperty(exports, "getRunnableSteps", { enumerable: true, get: function () { return parallel_runner_1.getRunnableSteps; } });
Object.defineProperty(exports, "selectParallelStepBatch", { enumerable: true, get: function () { return parallel_runner_1.selectParallelStepBatch; } });
// Per-agent authority leases
var per_agent_authority_1 = require("./per-agent-authority");
Object.defineProperty(exports, "acquirePerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.acquirePerAgentLease; } });
Object.defineProperty(exports, "releasePerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.releasePerAgentLease; } });
Object.defineProperty(exports, "validatePerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.validatePerAgentLease; } });
Object.defineProperty(exports, "renewPerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.renewPerAgentLease; } });
var recover_dead_steps_1 = require("./recover-dead-steps");
Object.defineProperty(exports, "recoverGlobalDeadSteps", { enumerable: true, get: function () { return recover_dead_steps_1.recoverGlobalDeadSteps; } });
Object.defineProperty(exports, "recoverEnvelopeDeadSteps", { enumerable: true, get: function () { return recover_dead_steps_1.recoverEnvelopeDeadSteps; } });
var emitRuntimeMetric_1 = require("./telemetry/emitRuntimeMetric");
Object.defineProperty(exports, "emitRuntimeMetric", { enumerable: true, get: function () { return emitRuntimeMetric_1.emitRuntimeMetric; } });
// Envelope builder
var envelope_builder_1 = require("./envelope-builder");
Object.defineProperty(exports, "buildEnvelope", { enumerable: true, get: function () { return envelope_builder_1.buildEnvelope; } });
Object.defineProperty(exports, "buildDefaultIdentityContext", { enumerable: true, get: function () { return envelope_builder_1.buildDefaultIdentityContext; } });
// Step planner
var step_planner_1 = require("./step-planner");
Object.defineProperty(exports, "planEnvelopeSteps", { enumerable: true, get: function () { return step_planner_1.planEnvelopeSteps; } });
// #us# message engine
var us_message_engine_1 = require("./us-message-engine");
Object.defineProperty(exports, "createUSMessage", { enumerable: true, get: function () { return us_message_engine_1.createUSMessage; } });
Object.defineProperty(exports, "handleUSMessage", { enumerable: true, get: function () { return us_message_engine_1.handleUSMessage; } });
Object.defineProperty(exports, "mapStepTypeToUSMessage", { enumerable: true, get: function () { return us_message_engine_1.mapStepTypeToUSMessage; } });
Object.defineProperty(exports, "storeUSMessage", { enumerable: true, get: function () { return us_message_engine_1.storeUSMessage; } });
var aggregateTelemetryWindow_1 = require("./telemetry/aggregateTelemetryWindow");
Object.defineProperty(exports, "aggregateTelemetryWindow", { enumerable: true, get: function () { return aggregateTelemetryWindow_1.aggregateTelemetryWindow; } });
// Dispatching Engine
var engine_1 = require("./engine");
Object.defineProperty(exports, "dispatch", { enumerable: true, get: function () { return engine_1.dispatch; } });
Object.defineProperty(exports, "getEnvelopeState", { enumerable: true, get: function () { return engine_1.getEnvelopeState; } });
Object.defineProperty(exports, "approveEnvelope", { enumerable: true, get: function () { return engine_1.approveEnvelope; } });
Object.defineProperty(exports, "rejectEnvelope", { enumerable: true, get: function () { return engine_1.rejectEnvelope; } });
// Acelogic Guards & Capability Introspection
var acelogic_guard_1 = require("./acelogic-guard");
Object.defineProperty(exports, "acelogicExecutionGuard", { enumerable: true, get: function () { return acelogic_guard_1.acelogicExecutionGuard; } });
var service_1 = require("./acelogic/service");
Object.defineProperty(exports, "aceLogicIntrospect", { enumerable: true, get: function () { return service_1.aceLogicIntrospect; } });
Object.defineProperty(exports, "aceLogicVerifyIdentity", { enumerable: true, get: function () { return service_1.aceLogicVerifyIdentity; } });
Object.defineProperty(exports, "aceLogicLeaseAcquire", { enumerable: true, get: function () { return service_1.aceLogicLeaseAcquire; } });
Object.defineProperty(exports, "aceLogicLeaseRenew", { enumerable: true, get: function () { return service_1.aceLogicLeaseRenew; } });
Object.defineProperty(exports, "aceLogicLeaseRelease", { enumerable: true, get: function () { return service_1.aceLogicLeaseRelease; } });
Object.defineProperty(exports, "aceLogicResurrectionVerify", { enumerable: true, get: function () { return service_1.aceLogicResurrectionVerify; } });
var capability_1 = require("./acelogic/capability");
Object.defineProperty(exports, "auditLicenseCheck", { enumerable: true, get: function () { return capability_1.auditLicenseCheck; } });
Object.defineProperty(exports, "checkCapability", { enumerable: true, get: function () { return capability_1.checkCapability; } });
var resolve_license_1 = require("./acelogic/resolve-license");
Object.defineProperty(exports, "isLicenseExpired", { enumerable: true, get: function () { return resolve_license_1.isLicenseExpired; } });
Object.defineProperty(exports, "resolveLicenseById", { enumerable: true, get: function () { return resolve_license_1.resolveLicenseById; } });
var http_context_1 = require("./acelogic/http-context");
Object.defineProperty(exports, "getLicenseFromRequest", { enumerable: true, get: function () { return http_context_1.getLicenseFromRequest; } });
Object.defineProperty(exports, "runtimeIdFromRequest", { enumerable: true, get: function () { return http_context_1.runtimeIdFromRequest; } });
// Runtime guardrails
var guards_1 = require("./runtime/guards");
Object.defineProperty(exports, "assertEnvelopeNotTerminal", { enumerable: true, get: function () { return guards_1.assertEnvelopeNotTerminal; } });
Object.defineProperty(exports, "assertAgentIdentityContext", { enumerable: true, get: function () { return guards_1.assertAgentIdentityContext; } });
Object.defineProperty(exports, "assertAgentLease", { enumerable: true, get: function () { return guards_1.assertAgentLease; } });
Object.defineProperty(exports, "assertClaimOwnership", { enumerable: true, get: function () { return guards_1.assertClaimOwnership; } });
Object.defineProperty(exports, "assertStepExists", { enumerable: true, get: function () { return guards_1.assertStepExists; } });
Object.defineProperty(exports, "assertStepNotCompleted", { enumerable: true, get: function () { return guards_1.assertStepNotCompleted; } });
Object.defineProperty(exports, "assertDependenciesSatisfied", { enumerable: true, get: function () { return guards_1.assertDependenciesSatisfied; } });
Object.defineProperty(exports, "assertEnvelopeHasSteps", { enumerable: true, get: function () { return guards_1.assertEnvelopeHasSteps; } });
var resolution_1 = require("./runtime/resolution");
Object.defineProperty(exports, "resolveAssignedAgentId", { enumerable: true, get: function () { return resolution_1.resolveAssignedAgentId; } });
// LLM Fallback (TypeScript-native agent execution)
var llm_fallback_1 = require("./llm-fallback");
Object.defineProperty(exports, "executeFallbackStep", { enumerable: true, get: function () { return llm_fallback_1.executeFallbackStep; } });
// Types & constants
__exportStar(require("./types"), exports);
var constants_1 = require("./constants");
Object.defineProperty(exports, "COLLECTIONS", { enumerable: true, get: function () { return constants_1.COLLECTIONS; } });
Object.defineProperty(exports, "STALE_CLAIM_THRESHOLD_MS", { enumerable: true, get: function () { return constants_1.STALE_CLAIM_THRESHOLD_MS; } });
Object.defineProperty(exports, "ENVELOPE_STATUS_TRANSITIONS", { enumerable: true, get: function () { return constants_1.ENVELOPE_STATUS_TRANSITIONS; } });
Object.defineProperty(exports, "STEP_STATUS_TRANSITIONS", { enumerable: true, get: function () { return constants_1.STEP_STATUS_TRANSITIONS; } });
Object.defineProperty(exports, "STEP_TYPE_CONFIG", { enumerable: true, get: function () { return constants_1.STEP_TYPE_CONFIG; } });
Object.defineProperty(exports, "DEFAULT_STEP_PIPELINE", { enumerable: true, get: function () { return constants_1.DEFAULT_STEP_PIPELINE; } });
Object.defineProperty(exports, "ALLOWED_PROTOCOL_VERBS", { enumerable: true, get: function () { return constants_1.ALLOWED_PROTOCOL_VERBS; } });
Object.defineProperty(exports, "PROTOCOL_VERB_LABELS", { enumerable: true, get: function () { return constants_1.PROTOCOL_VERB_LABELS; } });
Object.defineProperty(exports, "DEFAULT_LEASE_DURATION_SECONDS", { enumerable: true, get: function () { return constants_1.DEFAULT_LEASE_DURATION_SECONDS; } });
Object.defineProperty(exports, "MAX_LEASE_DURATION_SECONDS", { enumerable: true, get: function () { return constants_1.MAX_LEASE_DURATION_SECONDS; } });
Object.defineProperty(exports, "STEP_EXECUTION_MIN_WINDOW_MS", { enumerable: true, get: function () { return constants_1.STEP_EXECUTION_MIN_WINDOW_MS; } });
Object.defineProperty(exports, "ENVELOPE_STATUS_DISPLAY", { enumerable: true, get: function () { return constants_1.ENVELOPE_STATUS_DISPLAY; } });
Object.defineProperty(exports, "STEP_STATUS_DISPLAY", { enumerable: true, get: function () { return constants_1.STEP_STATUS_DISPLAY; } });
Object.defineProperty(exports, "TIER_DEFINITIONS", { enumerable: true, get: function () { return constants_1.TIER_DEFINITIONS; } });
//# sourceMappingURL=index.js.map