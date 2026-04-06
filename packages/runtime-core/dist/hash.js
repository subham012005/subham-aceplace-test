"use strict";
/**
 * ACEPLACE Runtime — SHA-256 Hashing Utilities
 *
 * Used for step integrity verification and identity fingerprinting.
 * Uses native crypto API — no external dependencies.
 *
 * T-003 | Sprint 1 | Foundation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.sha256Hex = sha256Hex;
exports.computeStepHash = computeStepHash;
exports.verifyStepHash = verifyStepHash;
exports.computeIdentityFingerprint = computeIdentityFingerprint;
exports.verifyIdentityFingerprint = verifyIdentityFingerprint;
exports.generateExecutionId = generateExecutionId;
exports.generateStepId = generateStepId;
exports.generateLeaseId = generateLeaseId;
exports.generateTraceId = generateTraceId;
exports.generateCheckpointId = generateCheckpointId;
exports.generateMessageId = generateMessageId;
const crypto_1 = require("crypto");
/**
 * Compute SHA-256 hash of a string.
 * Returns hex-encoded hash.
 */
function sha256(input) {
    return (0, crypto_1.createHash)("sha256").update(input, "utf-8").digest("hex");
}
/**
 * Compute SHA-256 hash with a hex: prefix (ACELOGIC format).
 */
function sha256Hex(input) {
    return `hex:0x${sha256(input)}`;
}
/**
 * Compute a step hash from step data for tamper detection.
 * The hash covers: step_id, step_type, agent_id, and input data.
 */
function computeStepHash(stepId, stepType, agentId, input) {
    const payload = JSON.stringify({ stepId, stepType, agentId, input }, Object.keys({ stepId, stepType, agentId, input }).sort());
    return sha256(payload);
}
/**
 * Verify a step hash matches the expected hash.
 */
function verifyStepHash(stepId, stepType, agentId, input, expectedHash) {
    const computedHash = computeStepHash(stepId, stepType, agentId, input);
    return computedHash === expectedHash;
}
/**
 * Compute an identity fingerprint from agent data.
 * Used for ACELOGIC identity verification.
 */
function computeIdentityFingerprint(agentId, acelogicId, salt) {
    const input = `${agentId}:${acelogicId}:${salt || ""}`;
    return sha256Hex(input);
}
/**
 * Verify an identity fingerprint matches expected value.
 */
function verifyIdentityFingerprint(agentId, acelogicId, expectedFingerprint, salt) {
    const computed = computeIdentityFingerprint(agentId, acelogicId, salt);
    return computed === expectedFingerprint;
}
/**
 * Generate a unique execution ID.
 */
function generateExecutionId() {
    return `exec_${(0, crypto_1.randomUUID)().replace(/-/g, "")}`;
}
/**
 * Generate a unique step ID.
 */
function generateStepId(index) {
    return `step_${index}_${Date.now()}`;
}
/**
 * Generate a unique lease ID.
 */
function generateLeaseId() {
    return `lease_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 16)}`;
}
/**
 * Generate a unique trace ID.
 */
function generateTraceId(eventType) {
    return `trace_${eventType.toLowerCase()}_${Date.now()}`;
}
/**
 * Generate a unique checkpoint ID.
 */
function generateCheckpointId() {
    return `ckpt_${Date.now()}_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 8)}`;
}
/**
 * Generate a unique message ID for protocol messages.
 */
function generateMessageId() {
    return `msg_${Date.now()}_${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 8)}`;
}
//# sourceMappingURL=hash.js.map