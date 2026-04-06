/**
 * ACEPLACE Runtime — SHA-256 Hashing Utilities
 *
 * Used for step integrity verification and identity fingerprinting.
 * Uses native crypto API — no external dependencies.
 *
 * T-003 | Sprint 1 | Foundation
 */
/**
 * Compute SHA-256 hash of a string.
 * Returns hex-encoded hash.
 */
export declare function sha256(input: string): string;
/**
 * Compute SHA-256 hash with a hex: prefix (ACELOGIC format).
 */
export declare function sha256Hex(input: string): string;
/**
 * Compute a step hash from step data for tamper detection.
 * The hash covers: step_id, step_type, agent_id, and input data.
 */
export declare function computeStepHash(stepId: string, stepType: string, agentId: string, input: Record<string, unknown>): string;
/**
 * Verify a step hash matches the expected hash.
 */
export declare function verifyStepHash(stepId: string, stepType: string, agentId: string, input: Record<string, unknown>, expectedHash: string): boolean;
/**
 * Compute an identity fingerprint from agent data.
 * Used for ACELOGIC identity verification.
 */
export declare function computeIdentityFingerprint(agentId: string, acelogicId: string, salt?: string): string;
/**
 * Verify an identity fingerprint matches expected value.
 */
export declare function verifyIdentityFingerprint(agentId: string, acelogicId: string, expectedFingerprint: string, salt?: string): boolean;
/**
 * Generate a unique execution ID.
 */
export declare function generateExecutionId(): string;
/**
 * Generate a unique step ID.
 */
export declare function generateStepId(index: number): string;
/**
 * Generate a unique lease ID.
 */
export declare function generateLeaseId(): string;
/**
 * Generate a unique trace ID.
 */
export declare function generateTraceId(eventType: string): string;
/**
 * Generate a unique checkpoint ID.
 */
export declare function generateCheckpointId(): string;
/**
 * Generate a unique message ID for protocol messages.
 */
export declare function generateMessageId(): string;
//# sourceMappingURL=hash.d.ts.map