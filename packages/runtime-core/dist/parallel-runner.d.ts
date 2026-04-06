/**
 * Parallel envelope runner — per-agent leases, step claims, #us# message engine
 * (ACEPLACE RUNTIME + State Machine spec).
 */
import type { EnvelopeStep, ExecutionEnvelope, StepStatus } from "./types";
export declare function getRunnableSteps(envelope: ExecutionEnvelope): EnvelopeStep[];
export declare function selectParallelStepBatch(params: {
    runnableSteps: EnvelopeStep[];
    maxParallelSteps?: number;
}): EnvelopeStep[];
export declare function claimEnvelopeStep(params: {
    envelope_id: string;
    step_id: string;
    instance_id: string;
}): Promise<void>;
export declare function finalizeEnvelopeStep(params: {
    envelope_id: string;
    step_id: string;
    status: Extract<StepStatus, "completed" | "failed" | "ready">;
    output_ref?: EnvelopeStep["output_ref"];
    retry_count?: number;
}): Promise<void>;
/**
 * Entry: multi-agent deterministic runtime loop with bounded parallelism.
 */
export declare function runEnvelopeParallel(params: {
    envelope_id: string;
    instance_id: string;
    max_parallel_steps?: number;
}): Promise<void>;
//# sourceMappingURL=parallel-runner.d.ts.map