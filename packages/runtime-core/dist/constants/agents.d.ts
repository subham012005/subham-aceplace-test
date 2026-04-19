/**
 * Canonical Agent Definitions — Phase 2
 *
 * This registry is the source of truth for the 4 core roles.
 * SHA-256 fingerprints are derived from these definitions.
 */
export interface CanonicalAgentDefinition {
    agent_id: string;
    acelogic_id: string;
    display_name: string;
    agent_class: string;
    mission: string;
    jurisdiction: string;
    governance_profile: string;
    owner_org_id: string;
    tier: number;
}
export declare const CANONICAL_AGENTS: CanonicalAgentDefinition[];
//# sourceMappingURL=agents.d.ts.map