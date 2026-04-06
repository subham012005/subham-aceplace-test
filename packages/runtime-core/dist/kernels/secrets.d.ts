/**
 * Secrets Kernel — Phase 2
 *
 * Manages agent-specific credentials and environment variables.
 * Note: While currently stored in Firestore, these are restricted to
 * server-side runtime functions.
 *
 * Phase 2 | Secrets Management
 */
export interface AgentSecrets {
    agent_id: string;
    secrets: Record<string, string>;
    updated_at: string;
}
/**
 * Store or update secrets for an agent.
 */
export declare function setAgentSecrets(agent_id: string, secrets: Record<string, string>): Promise<void>;
/**
 * Retrieve all secrets for an agent.
 */
export declare function getAgentSecrets(agent_id: string): Promise<Record<string, string> | null>;
/**
 * List secret names (keys only) for an agent.
 * Use this for UI display to avoid leaking values.
 */
export declare function listSecretNames(agent_id: string): Promise<string[]>;
/**
 * Remove a specific secret key for an agent.
 */
export declare function removeAgentSecret(agent_id: string, key: string): Promise<void>;
//# sourceMappingURL=secrets.d.ts.map