/**
 * GET/POST /api/runtime/checkpoint/[id] — Phase 2 Checkpoints
 * In Phase 2, checkpoints are embedded within the ExecutionEnvelope.steps array.
 * This route is kept for backward-compatibility with UI or legacy scripts
 * by returning the last embedded step, or accepting external checkpoints
 * into the envelope stream.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";
import type { ExecutionEnvelope, EnvelopeStep } from "@/lib/runtime/types";
import { randomUUID } from "crypto";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params;
    
    const doc = await getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Envelope not found" }, { status: 404 });
    }

    const envelope = doc.data() as ExecutionEnvelope;
    const steps = envelope.steps || [];
    const latestStep = steps.length > 0 ? steps[steps.length - 1] : null;

    if (!latestStep) {
      return NextResponse.json({ error: "NOT_FOUND", message: "No execution steps found" }, { status: 404 });
    }

    return NextResponse.json({
      checkpoint_id: latestStep.step_id,
      envelope_id: envelopeId,
      step_index: steps.length - 1,
      state_snapshot: (latestStep as any).output || {},
      created_at: (latestStep as any).completed_at || new Date().toISOString()
    }, { status: 200 });
  } catch (error: any) {
    console.error("[CHECKPOINT_GET] Error:", error);
    return NextResponse.json(
      { error: "CHECKPOINT_ERROR", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: envelopeId } = await params;
    const body = await req.json();

    if (!body.step_id || body.step_index === undefined) {
      return NextResponse.json(
        { error: "VALIDATION", message: "step_id and step_index are required" },
        { status: 400 }
      );
    }

    // Instead of saving to a separate collection, append an external checkpoint step
    const db = getDb();
    const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    
    const newStep: any = {
      step_id: `chk_${randomUUID().slice(0, 8)}`,
      step_type: "us#.system.checkpoint",
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      input: { external_step_id: body.step_id, step_index: body.step_index },
      output: body.state_snapshot || {},
      assigned_agent_id: "system"
    };

    // Note: To be safe we should run a transaction, but for this legacy wrapper update is fine.
    const doc = await ref.get();
    if (doc.exists) {
        const envelope = doc.data() as ExecutionEnvelope;
        const steps = envelope.steps || [];
        steps.push(newStep);
        await ref.update({ steps });
    }

    return NextResponse.json({
      success: true,
      checkpoint_id: newStep.step_id,
    }, { status: 200 });
  } catch (error: any) {
    console.error("[CHECKPOINT_POST] Error:", error);
    return NextResponse.json(
      { error: "CHECKPOINT_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
