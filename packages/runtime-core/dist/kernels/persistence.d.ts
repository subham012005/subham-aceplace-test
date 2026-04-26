/**
 * Persistence Kernel — Phase 2
 *
 * Manages ONLY execution_envelopes (with embedded steps[] and authority_lease).
 * No reads/writes to execution_steps or leases collections.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { ExecutionEnvelope, EnvelopeStep, EnvelopeStatus, Artifact } from "../types";
export { claimNextEnvelope } from "./queue";
export declare function createEnvelope(envelope: ExecutionEnvelope): Promise<void>;
export declare function getEnvelope(envelopeId: string): Promise<ExecutionEnvelope | null>;
export declare function updateEnvelope(envelopeId: string, updates: Partial<ExecutionEnvelope>): Promise<void>;
export declare function getUserEnvelopes(userId: string): Promise<ExecutionEnvelope[]>;
export declare function getActiveEnvelopes(): Promise<ExecutionEnvelope[]>;
/**
 * Update a specific step inside envelope.steps[] by step_id.
 * Reads the envelope, patches the step, writes back atomically.
 */
export declare function updateEnvelopeStep(envelopeId: string, stepId: string, updates: Partial<EnvelopeStep>): Promise<void>;
/**
 * Get a specific step from envelope.steps[] by step_id.
 */
export declare function getEnvelopeStep(envelopeId: string, stepId: string): Promise<EnvelopeStep | null>;
/**
 * Get the next step with status === "ready".
 * Returns null if no ready step exists.
 */
export declare function getNextReadyStep(envelope: ExecutionEnvelope): EnvelopeStep | null;
export declare function setEnvelopeStatus(envelopeId: string, status: EnvelopeStatus): Promise<void>;
export declare function addTrace(envelopeId: string, stepId: string, agentId: string, identityFingerprint: string, eventType: string, userId?: string, metadata?: Record<string, unknown>, message?: string): Promise<void>;
export declare function createArtifact(artifact: Artifact): Promise<void>;
export declare function getArtifact(artifactId: string): Promise<Artifact | null>;
/**
 * Searches for evidence that a step has already been completed.
 * Checks for STEP_COMPLETED traces and step-type specific artifacts.
 */
export declare function findStepCompletionEvidence(envelopeId: string, stepId: string, stepType: string): Promise<boolean>;
export declare function linkJobToEnvelope(jobId: string, envelopeId: string): Promise<void>;
/**
 * Sync the legacy job status with the envelope's current state.
 */
export declare function syncJobStatus(jobId: string, status: string, extraData?: Record<string, any>): Promise<void>;
export declare function getJob(jobId: string): Promise<{
    envelope_id: string;
} | null>;
export declare function deleteAgent(agentId: string): Promise<void>;
/**
 * Enqueue a created envelope for the runtime-worker to claim and execute.
 * Writes to `execution_queue` Firestore collection.
 */
export declare function enqueueEnvelope(envelope_id: string): Promise<void>;
//# sourceMappingURL=persistence.d.ts.map