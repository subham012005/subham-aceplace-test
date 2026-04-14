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
export function resolveAssignedAgentId(
  envelope: ExecutionEnvelope,
  step: EnvelopeStep
): string {
  // 1. Resolve via role_assignments map (Canonical Phase 2)
  if (step.role && envelope.role_assignments?.[step.role]) {
    return envelope.role_assignments[step.role]!;
  }

  // 2. Explicit pinned assigned_agent_id (Fallback if role is missing or not mapped)
  if (step.assigned_agent_id && step.assigned_agent_id.trim() !== "") {
    return step.assigned_agent_id;
  }

  // 3. Throw hard error — no random fallbacks allowed in Phase 2
  throw new Error("AGENT_NOT_FOUND");
}
