/**
 * Per-agent authority leases on execution_envelopes.authority_leases[agent_id]
 * (ACEPLACE RUNTIME spec).
 *
 * AUDIT FIX P0#4:
 *   This module NEVER writes terminal envelope states (quarantined, failed, etc.).
 *   On fork detection it throws the domain error FORK_DETECTED.
 *   The caller (parallel-runner.ts) is responsible for routing that error
 *   through the state machine via transition().
 */
import type { AgentAuthorityLease, ExecutionEnvelope } from "./types";
export declare function acquirePerAgentLease(envelopeId: string, agentId: string, instanceId: string, options?: {
    forceRenew?: boolean;
    durationSeconds?: number;
}): Promise<AgentAuthorityLease>;
export declare function validatePerAgentLease(envelope: ExecutionEnvelope, agentId: string, instanceId: string): void;
/** Heartbeat / explicit renew — extends lease_expires_at for active same-instance holder. */
export declare function renewPerAgentLease(envelopeId: string, agentId: string, instanceId: string, durationSeconds?: number): Promise<AgentAuthorityLease>;
export declare function releasePerAgentLease(envelopeId: string, agentId: string): Promise<void>;
//# sourceMappingURL=per-agent-authority.d.ts.map