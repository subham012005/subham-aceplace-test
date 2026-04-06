/**
 * Prime guard cache for a batch of steps before parallel execution (deduped per agent).
 */
export declare function batchPrimeExecutionGuards(agents: {
    agent_id: string;
    identity_fingerprint: string;
    instance_id: string;
    org_id: string;
    license_id: string;
}[]): Promise<void>;
//# sourceMappingURL=batch-execution-guard.d.ts.map