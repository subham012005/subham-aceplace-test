/**
 * LLM Fallback Execution — TypeScript-native agent execution.
 *
 * Replicates the Python agent-engine node logic (coo, researcher, worker, grader)
 * so the runtime-worker can execute jobs when the Python process is unavailable.
 *
 * Activated automatically when the Python agent-engine is unreachable.
 */
export interface LLMUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    model: string;
    provider: "anthropic" | "openai";
    cost: number;
}
export declare function executeFallbackStep(params: {
    envelope_id: string;
    step_id: string;
    step_type: string;
    agent_id: string;
    identity_fingerprint: string;
    prompt: string;
    input_ref: string | null;
    org_id?: string;
    fallback_approved?: boolean;
}): Promise<{
    success: boolean;
    artifact_id: string;
    usage: LLMUsage;
}>;
//# sourceMappingURL=llm-fallback.d.ts.map