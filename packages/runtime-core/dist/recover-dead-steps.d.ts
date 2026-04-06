/**
 * Dead-Step Recovery Engine — Phase 2 Hardening
 *
 * Scans for steps stuck in 'executing' state where the owner instance has crashed
 * or the lease has expired. Reclaims these steps by resetting them to 'ready'
 * or marking them as 'failed' if retries are exhausted.
 */
/**
 * Scan all executing envelopes and recover any dead steps.
 */
export declare function recoverGlobalDeadSteps(params?: {
    stale_threshold_ms?: number;
    limit?: number;
}): Promise<void>;
/**
 * Recover dead steps for a single envelope.
 */
export declare function recoverEnvelopeDeadSteps(envelopeId: string, staleThresholdMs?: number): Promise<void>;
//# sourceMappingURL=recover-dead-steps.d.ts.map