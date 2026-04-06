/**
 * Researcher fan-out / Grader fan-in helpers (ACEPLACE spec).
 */
import type { DecompositionPlan } from "./types";
export declare function createDecompositionPlan(params: {
    objective: string;
    worker_agent_ids: string[];
    parent_step_id: string;
}): DecompositionPlan;
export declare function expandWorkerSteps(params: {
    envelope_id: string;
    decomposition_plan: DecompositionPlan;
}): Promise<void>;
export declare function aggregateArtifacts(artifactIds: string[]): Promise<string>;
//# sourceMappingURL=decomposition.d.ts.map