/**
 * Deterministic Runtime Loop — Phase 2
 *
 * This is the core execution engine. No pipeline. No hardcoded agent order.
 * Drives execution entirely from execution_envelopes.steps[].
 *
 * Loop (runs until no ready steps remain):
 *   1.  Fetch envelope
 *   2.  Verify identity
 *   3.  Acquire authority lease
 *   4.  Find next step (status === "ready")
 *   5.  Generate #us# message
 *   6.  Call provider (Python agent-engine)
 *   7.  Persist output (artifact)
 *   8.  Update step status
 *   9.  Append execution_trace
 *   10. Update envelope status
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import * as persistence from "./kernels/persistence";
import * as identity from "./kernels/identity";
import * as authority from "./kernels/authority";
import * as communications from "./kernels/communications";
import { transition } from "./state-machine";
import { STEP_TYPE_CONFIG } from "./constants";
import { generateTraceId } from "./hash";
import type {
  ExecutionEnvelope,
  EnvelopeStep,
  ProtocolVerb,
  Artifact,
} from "./types";
import { randomUUID } from "crypto";

const AGENT_ENGINE_URL =
  process.env.AGENT_ENGINE_URL || "http://localhost:8001";

// ─── Main Runtime Loop ────────────────────────────────────────────────────────

/**
 * Run the deterministic runtime loop for an envelope.
 * Safe to call multiple times — idempotent via lease check.
 *
 * @param envelopeId  - ID of the execution envelope to run
 * @param instanceId  - Unique ID for THIS runtime instance (for fork detection)
 */
export async function runEnvelope(
  envelopeId: string,
  instanceId: string
): Promise<void> {
  // ── Step 1: Fetch envelope ─────────────────────────────────────────────────
  const envelope = await persistence.getEnvelope(envelopeId);
  if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);

  // Skip terminal states
  const terminal = ["approved", "rejected", "failed", "quarantined"];
  if (terminal.includes(envelope.status)) {
    console.log(`[RUNTIME] Envelope ${envelopeId} is terminal (${envelope.status}). Skipping.`);
    return;
  }

  // ── Step 2: Verify Identity ────────────────────────────────────────────────
  const agentId = envelope.identity_context.agent_id;
  const identityResult = await identity.verifyIdentity(envelopeId, agentId, envelope);

  if (!identityResult.verified) {
    console.error(`[RUNTIME] Identity verification failed for ${envelopeId}: ${identityResult.reason}`);
    return; // quarantine already set by verifyIdentity
  }

  const fingerprint = envelope.identity_context.identity_fingerprint;

  // ── Step 3: Acquire Authority Lease ───────────────────────────────────────
  const leaseResult = await authority.acquireLease(envelopeId, instanceId);

  if (!leaseResult.acquired) {
    console.error(`[RUNTIME] Lease acquisition failed for ${envelopeId}: ${leaseResult.reason}`);
    return; // quarantine already set by acquireLease on fork
  }

  const leaseHolder = leaseResult.authority_lease!.holder_instance_id;

  // Transition to executing (if not already)
  const freshEnvelope = (await persistence.getEnvelope(envelopeId))!;
  if (freshEnvelope.status === "leased" || freshEnvelope.status === "planned") {
    try { await transition(envelopeId, "executing"); } catch { /* already executing */ }
  }

  // ── Main Step Loop ─────────────────────────────────────────────────────────
  let continueLoop = true;

  while (continueLoop) {
    // Re-fetch envelope on each iteration for latest step state
    const current = await persistence.getEnvelope(envelopeId);
    if (!current) break;

    // Validate lease is still valid before each step (Rule #4: No lease = no execution)
    if (!authority.hasValidLease(current, instanceId)) {
      console.warn(`[RUNTIME] Lease expired mid-execution for ${envelopeId}. Stopping.`);
      break;
    }

    // ── Step 4: Find Next Ready Step ─────────────────────────────────────────
    const nextStep = persistence.getNextReadyStep(current);
    if (!nextStep) {
      // Check if all steps are done
      const allDone = current.steps.every(
        (s) => s.status === "completed" || s.status === "failed"
      );
      if (allDone) {
        const anyFailed = current.steps.some((s) => s.status === "failed");
        await transition(envelopeId, anyFailed ? "failed" : "approved");
        await appendTrace(envelopeId, "", agentId, fingerprint, "EXECUTION_COMPLETED");
      }
      break;
    }

    // ── Step 5: Mark step as executing ───────────────────────────────────────
    await persistence.updateEnvelopeStep(envelopeId, nextStep.step_id, {
      status: "executing",
    });

    // ── Step 5: Generate #us# Message ────────────────────────────────────────
    const stepConfig = STEP_TYPE_CONFIG[nextStep.step_type];
    const verb = stepConfig.protocol_verb as ProtocolVerb;

    const message = await communications.sendMessage({
      verb,
      senderAgentId: agentId,
      envelopeId,
      stepId: nextStep.step_id,
      identityFingerprint: fingerprint,
      leaseHolder,
      payload: {
        step_type: nextStep.step_type,
        input_ref: nextStep.input_ref ?? null,
        prompt: current.prompt,
      },
    });

    // ── Step 6: Call Provider (Python agent-engine) ───────────────────────────
    let outputRef: string | undefined;
    let stepFailed = false;
    let failReason = "";

    try {
      const response = await callProvider(envelope, nextStep, message.message_id);
      outputRef = response.artifact_id;
    } catch (err: any) {
      stepFailed = true;
      failReason = err.message;
      console.error(`[RUNTIME] Provider call failed for step ${nextStep.step_id}: ${failReason}`);
    }

    if (stepFailed) {
      // ── Step 8 (failure path) ─────────────────────────────────────────────
      await persistence.updateEnvelopeStep(envelopeId, nextStep.step_id, {
        status: "failed",
      });
      await appendTrace(envelopeId, nextStep.step_id, agentId, fingerprint, "STEP_FAILED", { reason: failReason });
      await transition(envelopeId, "failed", { step_id: nextStep.step_id, reason: failReason });
      continueLoop = false;
      continue;
    }

    // ── Step 8: Update Step Status ────────────────────────────────────────────
    await persistence.updateEnvelopeStep(envelopeId, nextStep.step_id, {
      status: "completed",
      output_ref: outputRef,
    });

    // Add artifact ref to envelope
    if (outputRef) {
      const envelopeRef = (await persistence.getEnvelope(envelopeId))!;
      await persistence.updateEnvelope(envelopeId, {
        artifact_refs: [...(envelopeRef.artifact_refs ?? []), outputRef],
      });
    }

    // ── Step 9: Append Execution Trace ────────────────────────────────────────
    await appendTrace(envelopeId, nextStep.step_id, agentId, fingerprint,
      `STEP_COMPLETED_${nextStep.step_type.toUpperCase()}`,
      { output_ref: outputRef, message_id: message.message_id }
    );

    // Advance next step to "ready" if pending
    await advanceNextPendingStep(envelopeId, nextStep.step_id);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Call the Python agent-engine for a step.
 * Returns the artifact_id of the produced output.
 */
async function callProvider(
  envelope: ExecutionEnvelope,
  step: EnvelopeStep,
  messageId: string
): Promise<{ artifact_id: string }> {
  const res = await fetch(`${AGENT_ENGINE_URL}/execute-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      envelope_id: envelope.envelope_id,
      step_id: step.step_id,
      step_type: step.step_type,
      input_ref: step.input_ref ?? null,
      message_id: messageId,
      agent_id: envelope.identity_context.agent_id,
      prompt: envelope.prompt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agent engine returned ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * After a step completes, find the next "pending" step and mark it "ready".
 */
async function advanceNextPendingStep(envelopeId: string, completedStepId: string): Promise<void> {
  const envelope = await persistence.getEnvelope(envelopeId);
  if (!envelope) return;

  const completedIndex = envelope.steps.findIndex((s) => s.step_id === completedStepId);
  if (completedIndex < 0) return;

  // Find the next pending step after the completed one
  for (let i = completedIndex + 1; i < envelope.steps.length; i++) {
    if (envelope.steps[i].status === "pending") {
      await persistence.updateEnvelopeStep(envelopeId, envelope.steps[i].step_id, {
        status: "ready",
      });
      break;
    }
  }
}

/**
 * Append a trace to execution_traces.
 */
async function appendTrace(
  envelopeId: string,
  stepId: string,
  agentId: string,
  fingerprint: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await persistence.addTrace(envelopeId, stepId, agentId, fingerprint, eventType, metadata);
}
