/**
 * Identity Kernel — Phase 2
 *
 * Verifies agent identity by:
 * 1. Loading agent from agents/{agent_id}
 * 2. Recomputing SHA-256 fingerprint from canonical_identity_json
 * 3. Comparing with envelope.identity_context.identity_fingerprint
 *
 * On mismatch → set envelope.status = "quarantined", stop execution.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { ExecutionEnvelope, IdentityContext, IdentityVerifyResult } from "../types";
/**
 * Resolve identity_context for a step agent (multi-agent envelopes), then verify.
 */
export declare function verifyIdentityForAgent(envelopeId: string, envelope: ExecutionEnvelope, agentId: string): Promise<IdentityVerifyResult>;
/** Verify a single agent against envelope.identity_context (quarantines on mismatch). */
export declare function verifyIdentity(envelopeId: string, agentId: string, envelope: ExecutionEnvelope): Promise<IdentityVerifyResult>;
/**
 * Build an IdentityContext from a stored agent record.
 * Used when creating a new envelope.
 */
export declare function buildIdentityContext(agentId: string): Promise<IdentityContext | null>;
/**
 * Compute SHA-256 fingerprint of canonical_identity_json.
 */
export declare function computeFingerprint(canonicalJson: string): string;
/**
 * Register a new agent identity.
 * Handles canonical JSON generation, fingerprinting, and persistence.
 */
export declare function registerAgentIdentity(params: {
    display_name: string;
    role: string;
    mission: string;
    org_id: string;
    agent_id?: string;
    tier?: string;
}): Promise<{
    agent_id: string;
    identity_fingerprint: string;
}>;
/**
 * Remove an agent identity record and its associated data.
 */
export declare function deleteAgentIdentity(agentId: string): Promise<void>;
//# sourceMappingURL=identity.d.ts.map