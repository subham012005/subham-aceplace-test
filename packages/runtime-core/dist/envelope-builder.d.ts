/**
 * Envelope Builder — Phase 2
 *
 * Builds a canonical ExecutionEnvelope with steps[] EMBEDDED.
 * No separate ExecutionStep[] — everything lives inside the envelope document.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { ExecutionEnvelope, EnvelopeStep, IdentityContext } from "./types";
/**
 * Build a canonical ExecutionEnvelope with embedded steps[].
 * The first step is initialized to "ready"; all others are "pending".
 */
export declare function buildEnvelope(params: {
    envelopeId?: string;
    orgId?: string;
    jobId?: string;
    userId?: string;
    prompt?: string;
    identityContext?: IdentityContext;
    identity_contexts: Record<string, IdentityContext>;
    role_assignments?: Record<string, string>;
    stepPipeline?: string[];
    steps?: EnvelopeStep[];
}): ExecutionEnvelope;
/**
 * Build a minimal identity context (no agent store lookup).
 * Used for development/testing when agents collection doesn't exist.
 */
export declare function buildDefaultIdentityContext(agentId: string): IdentityContext;
//# sourceMappingURL=envelope-builder.d.ts.map