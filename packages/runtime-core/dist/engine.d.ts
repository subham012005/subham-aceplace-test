/**
 * Runtime Engine Orchestrator — Phase 2
 *
 * Dispatch creates an execution_envelope with embedded steps[] and authority_lease=null.
 * Execution is driven by the parallel multi-agent runner (parallel-runner.ts).
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { ExecutionEnvelope, DispatchResponse } from "./types";
/**
 * Dispatch a new task — creates an envelope and enqueues it for the runtime-worker.
 */
export declare function dispatch(params: {
    prompt: string;
    userId: string;
    jobId?: string;
    orgId?: string;
    agentId?: string;
    knowledge_context?: {
        collections?: string[];
        direct_text?: string;
        enabled: boolean;
    };
    instruction_context?: {
        profiles?: string[];
        enabled: boolean;
    };
    web_search_context?: {
        enabled: boolean;
        queries?: string[];
        sources_used?: string[];
    };
}): Promise<DispatchResponse>;
/**
 * Get the current state of an envelope by ID.
 */
export declare function getEnvelopeState(envelopeId: string): Promise<{
    envelope: ExecutionEnvelope;
    messages: unknown[];
} | null>;
/**
 * Approve the envelope after human review — advances to "approved" state.
 */
export declare function approveEnvelope(envelopeId: string): Promise<void>;
/**
 * Reject the envelope at a human review gate.
 */
export declare function rejectEnvelope(envelopeId: string, reason?: string): Promise<void>;
//# sourceMappingURL=engine.d.ts.map