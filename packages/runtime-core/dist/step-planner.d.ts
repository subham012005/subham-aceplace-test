/**
 * Deterministic step graph (COO → Researcher → Worker → Grader [→ human] → complete)
 * per ACEPLACE Execution Envelope + Step Planner spec.
 */
import type { EnvelopeStep, RuntimeRole } from "./types";
export declare function planEnvelopeSteps(params: {
    require_human_approval?: boolean;
    role_assignments: Partial<Record<RuntimeRole, string>>;
}): EnvelopeStep[];
//# sourceMappingURL=step-planner.d.ts.map