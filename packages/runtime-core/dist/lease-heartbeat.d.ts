/**
 * Per-step lease heartbeat (ACEPLACE RUNTIME spec) — renew before expiry.
 */
export declare class LeaseHeartbeatManager {
    private timers;
    start(key: string, params: {
        envelope_id: string;
        agent_id: string;
        instance_id: string;
    }, intervalMs?: number): void;
    private renewWithRetry;
    stop(key: string): void;
    stopAllForEnvelope(envelopeId: string): void;
}
export declare const leaseHeartbeatManager: LeaseHeartbeatManager;
//# sourceMappingURL=lease-heartbeat.d.ts.map