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
}): Promise<void> {
  const ref = getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(params.envelope_id);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const plan = params.decomposition_plan;
    const workerSteps: EnvelopeStep[] = plan.work_units.map((wu, i) => ({
      step_id: `worker_${wu.work_unit_id}`,
      step_type: "artifact_produce",
      role: "Worker",
      status: "pending",
      depends_on: [plan.parent_step_id],
      assigned_agent_id: plan.worker_agent_ids[i] ?? plan.worker_agent_ids[0],
      input_ref: { work_unit: wu as unknown as Record<string, unknown> },
      output_ref: {},
      retry_count: 0,
      max_retries: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const updatedSteps = (envelope.steps || [])
      .filter((s) => s.role !== "Worker")
      .map((s) =>
        s.role === "Grader"
          ? { ...s, depends_on: workerSteps.map((w) => w.step_id) }
          : s
      );

    tx.update(ref, {
      steps: [...updatedSteps, ...workerSteps],
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
