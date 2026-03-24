/**
 * Execution Kernel — Phase 2
 *
 * DEPRECATED: Step graph execution now happens inside runtime-loop.ts
 * This file is kept to satisfy any existing imports but delegates to
 * the new runtime loop.
 *
 * For step execution, use: src/lib/runtime/runtime-loop.ts
 * For human review, use: engine.ts approveEnvelope() / rejectEnvelope()
 *
 * Phase 2 | Envelope-Driven Runtime
 */

export { runEnvelope } from "../runtime-loop";
export { approveEnvelope as approveStep, rejectEnvelope as rejectStep } from "../engine";

// Stub for any legacy imports
export async function resumeAfterHumanReview(
  envelopeId: string,
  _stepId: string,
  approved: boolean
): Promise<{ success: boolean }> {
  const { approveEnvelope, rejectEnvelope } = await import("../engine");
  if (approved) {
    await approveEnvelope(envelopeId);
  } else {
    await rejectEnvelope(envelopeId, "human_rejected");
  }
  return { success: true };
}
