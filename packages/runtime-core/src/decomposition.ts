/**
 * Researcher fan-out / Grader fan-in helpers (ACEPLACE spec).
 */

import { randomUUID } from "crypto";
import type {
  DecompositionPlan,
  EnvelopeStep,
  ExecutionEnvelope,
  WorkUnit,
} from "./types";
import { getDb } from "./db";
import { COLLECTIONS } from "./constants";

export function createDecompositionPlan(params: {
  objective: string;
  worker_agent_ids: string[];
  parent_step_id: string;
}): DecompositionPlan {
  const work_units: WorkUnit[] = params.worker_agent_ids.map((_, i) => ({
    work_unit_id: `wu_${randomUUID().replace(/-/g, "")}`,
    title: `Section ${i + 1}`,
    objective: params.objective,
    instructions: `Produce section ${i + 1} for the shared objective.`,
  }));

  return {
    decomposition_id: `decomp_${randomUUID().replace(/-/g, "")}`,
    parent_step_id: params.parent_step_id,
    worker_agent_ids: params.worker_agent_ids,
    work_units,
    aggregation: {
      strategy: "sectioned_report",
      ordered_work_unit_ids: work_units.map((w) => w.work_unit_id),
    },
  };
}

export async function expandWorkerSteps(params: {
  envelope_id: string;
  decomposition_plan: DecompositionPlan;
  research_artifact_id?: string;
}): Promise<void> {
  const ref = getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(params.envelope_id);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const plan = params.decomposition_plan;
    const workerSteps: EnvelopeStep[] = plan.work_units.map((wu, i) => ({
      step_id: `worker_${wu.work_unit_id}`,
      step_type: "produce_artifact",
      role: "Worker",
      status: "pending",
      depends_on: [plan.parent_step_id],
      assigned_agent_id: plan.worker_agent_ids[i] ?? plan.worker_agent_ids[0],
      input_ref: { 
        work_unit: wu as unknown as Record<string, unknown>,
        artifact_id: params.research_artifact_id 
      },
      output_ref: {},
      retry_count: 0,
      max_retries: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // 🤖 ALIGNMENT: Inject identities for new agents into the envelope
    const nextIdentities = { ...(envelope.identity_contexts || {}) };
    for (const step of workerSteps) {
      const aid = step.assigned_agent_id;
      if (aid && !nextIdentities[aid]) {
        nextIdentities[aid] = {
          agent_id: aid,
          identity_fingerprint: "deferred_verification",
          verified: false,
        };
      }
    }

    const existingSteps = (envelope.steps || []);
    // Transition the parent step (Assign) to completed in this same transaction
    const updatedSteps = existingSteps.map((s) => {
      if (s.step_id === plan.parent_step_id) return { ...s, status: "completed" };
      if (s.role === "Grader") return { ...s, depends_on: workerSteps.map((w) => w.step_id) };
      return s;
    }).filter(s => s.role !== "Worker" || s.status === "completed"); // Only remove old Workers if they aren't somehow already completed

    tx.update(ref, {
      steps: [...updatedSteps, ...workerSteps],
      identity_contexts: nextIdentities,
      decomposition_plan: plan,
      updated_at: new Date().toISOString(),
    });
  });
}

export async function aggregateArtifacts(artifactIds: string[]): Promise<string> {
  const docs = await Promise.all(
    artifactIds.map((id) => getDb().collection(COLLECTIONS.ARTIFACTS).doc(id).get())
  );
  return docs.map((d) => (d.exists ? String((d.data() as { artifact_content?: string })?.artifact_content ?? "") : "")).join("\n\n---\n\n");
}
