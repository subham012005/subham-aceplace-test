/**
 * Authority Kernel — Phase 2
 *
 * Lease is EMBEDDED inside execution_envelopes.authority_lease.
 * No separate leases collection.
 *
 * Rules:
 * - If no lease → acquire
 * - If lease expired → acquire (replace)
 * - If lease active AND different instance → STOP (quarantine = fork detected)
 * - Lease MUST be checked before EVERY step
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { ExecutionEnvelope, LeaseAcquireResult } from "../types";
/**
 * Acquire a time-bound execution lease embedded in the envelope.
 * Uses Firestore transaction to prevent race conditions.
 *
 * @param envelopeId  - ID of the envelope to lease
 * @param instanceId  - Unique ID for this runtime instance
 * @param durationSeconds - Lease duration (clamped to MAX_LEASE_DURATION_SECONDS)
 */
export declare function acquireLease(envelopeId: string, instanceId: string, durationSeconds?: number): Promise<LeaseAcquireResult>;
/**
 * Release the lease embedded in the envelope.
 * Clears authority_lease field.
 */
export declare function releaseLease(envelopeId: string, instanceId: string): Promise<boolean>;
/**
 * Check if the envelope has a valid (non-expired) lease for a given instance.
 * Must be called BEFORE every step execution.
 */
export declare function hasValidLease(envelope: ExecutionEnvelope, instanceId: string): boolean;
/**
 * Phase 2 stub — stale lease cleanup is performed directly by the cron route
 * by scanning execution_envelopes with expired embedded leases.
 * Kept here for backward-compat; returns 0 (no-op).
 */
export declare function expireStaleLeases(): Promise<number>;
//# sourceMappingURL=authority.d.ts.map