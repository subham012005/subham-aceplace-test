/**
 * NXQ Runtime — SHA-256 Hashing Utilities
 * 
 * Used for step integrity verification and identity fingerprinting.
 * Uses native crypto API — no external dependencies.
 * 
 * T-003 | Sprint 1 | Foundation
 */

import { createHash, randomUUID } from "crypto";

/**
 * Compute SHA-256 hash of a string.
 * Returns hex-encoded hash.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}

/**
 * Compute SHA-256 hash with a hex: prefix (ACELOGIC format).
 */
export function sha256Hex(input: string): string {
  return `hex:0x${sha256(input)}`;
}

/**
 * Compute a step hash from step data for tamper detection.
 * The hash covers: step_id, step_type, agent_id, and input data.
 */
export function computeStepHash(
  stepId: string,
  stepType: string,
  agentId: string,
  input: Record<string, unknown>
): string {
  const payload = JSON.stringify({ stepId, stepType, agentId, input }, Object.keys({ stepId, stepType, agentId, input }).sort());
  return sha256(payload);
}

/**
 * Verify a step hash matches the expected hash.
 */
export function verifyStepHash(
  stepId: string,
  stepType: string,
  agentId: string,
  input: Record<string, unknown>,
  expectedHash: string
): boolean {
  const computedHash = computeStepHash(stepId, stepType, agentId, input);
  return computedHash === expectedHash;
}

/**
 * Compute an identity fingerprint from agent data.
 * Used for ACELOGIC identity verification.
 */
export function computeIdentityFingerprint(
  agentId: string,
  acelogicId: string,
  salt?: string
): string {
  const input = `${agentId}:${acelogicId}:${salt || ""}`;
  return sha256Hex(input);
}

/**
 * Verify an identity fingerprint matches expected value.
 */
export function verifyIdentityFingerprint(
  agentId: string,
  acelogicId: string,
  expectedFingerprint: string,
  salt?: string
): boolean {
  const computed = computeIdentityFingerprint(agentId, acelogicId, salt);
  return computed === expectedFingerprint;
}

/**
 * Generate a unique execution ID.
 */
export function generateExecutionId(): string {
  return `exec_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Generate a unique step ID.
 */
export function generateStepId(index: number): string {
  return `step_${index}_${Date.now()}`;
}

/**
 * Generate a unique lease ID.
 */
export function generateLeaseId(): string {
  return `lease_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Generate a unique trace ID.
 */
export function generateTraceId(eventType: string): string {
  return `trace_${eventType.toLowerCase()}_${Date.now()}`;
}

/**
 * Generate a unique checkpoint ID.
 */
export function generateCheckpointId(): string {
  return `ckpt_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/**
 * Generate a unique message ID for protocol messages.
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
