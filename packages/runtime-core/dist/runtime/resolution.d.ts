import type { EnvelopeStep, ExecutionEnvelope } from "../types";
/**
 * Canonical agent resolution for Phase 2 runtime.
 * Every step must resolve to a concrete agent ID.
 * Priority:
 *  1. step.assigned_agent_id (explicitly set)
 *  2. envelope.role_assignments[step.role] (mapped via role)
 *
 * Throws AGENT_NOT_FOUND if no agent can be resolved.
 */
export declare function resolveAssignedAgentId(envelope: ExecutionEnvelope, step: EnvelopeStep): string;
//# sourceMappingURL=resolution.d.ts.map