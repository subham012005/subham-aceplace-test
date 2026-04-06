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
exports.resolveLicenseById = exports.isLicenseExpired = exports.checkCapability = exports.auditLicenseCheck = exports.aceLogicResurrectionVerify = exports.aceLogicLeaseRelease = exports.aceLogicLeaseRenew = exports.aceLogicLeaseAcquire = exports.aceLogicVerifyIdentity = exports.aceLogicIntrospect = exports.acelogicExecutionGuard = exports.rejectEnvelope = exports.approveEnvelope = exports.getEnvelopeState = exports.dispatch = exports.storeUSMessage = exports.mapStepTypeToUSMessage = exports.handleUSMessage = exports.createUSMessage = exports.planEnvelopeSteps = exports.buildDefaultIdentityContext = exports.buildEnvelope = exports.runEnvelopeParallel = exports.releasePerAgentLease = exports.renewPerAgentLease = exports.validatePerAgentLease = exports.acquirePerAgentLease = exports.deleteAllAgentSecrets = exports.getAgentSecrets = exports.getAgentSecret = exports.storeAgentSecret = exports.enqueueEnvelope = exports.getJob = exports.syncJobStatus = exports.linkJobToEnvelope = exports.createArtifact = exports.addTrace = exports.getNextReadyStep = exports.getEnvelopeStep = exports.updateEnvelopeStep = exports.updateEnvelope = exports.getEnvelope = exports.createEnvelope = exports.getDb = exports.computeFingerprint = exports.buildIdentityContext = exports.verifyIdentityForAgent = exports.verifyIdentity = exports.canTransition = exports.transition = void 0;
exports.runtimeIdFromRequest = exports.getLicenseFromRequest = void 0;
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
// Persistence kernel
var db_1 = require("./db");
Object.defineProperty(exports, "getDb", { enumerable: true, get: function () { return db_1.getDb; } });
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
var secrets_1 = require("./kernels/secrets");
Object.defineProperty(exports, "storeAgentSecret", { enumerable: true, get: function () { return secrets_1.storeAgentSecret; } });
Object.defineProperty(exports, "getAgentSecret", { enumerable: true, get: function () { return secrets_1.getAgentSecret; } });
Object.defineProperty(exports, "getAgentSecrets", { enumerable: true, get: function () { return secrets_1.getAgentSecrets; } });
Object.defineProperty(exports, "deleteAllAgentSecrets", { enumerable: true, get: function () { return secrets_1.deleteAllAgentSecrets; } });
// Lease management
var per_agent_authority_1 = require("./per-agent-authority");
Object.defineProperty(exports, "acquirePerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.acquirePerAgentLease; } });
Object.defineProperty(exports, "validatePerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.validatePerAgentLease; } });
Object.defineProperty(exports, "renewPerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.renewPerAgentLease; } });
Object.defineProperty(exports, "releasePerAgentLease", { enumerable: true, get: function () { return per_agent_authority_1.releasePerAgentLease; } });
// Parallel runner
var parallel_runner_1 = require("./parallel-runner");
Object.defineProperty(exports, "runEnvelopeParallel", { enumerable: true, get: function () { return parallel_runner_1.runEnvelopeParallel; } });
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
// Types & constants
__exportStar(require("./types"), exports);
__exportStar(require("./constants"), exports);
//# sourceMappingURL=index.js.map