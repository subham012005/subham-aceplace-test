"""
Deterministic Runtime Loop — Phase 2 ACEPLACE Agent Engine

Replaces graph/pipeline.py (LangGraph hardcoded COO→Researcher→Worker→Grader).
Drives execution entirely from execution_envelopes.steps[].

Loop:
  1.  Get envelope
  2.  Verify identity
  3.  Acquire authority lease
  4.  Find next ready step
  5.  Generate #us# message
  6.  Call agent node (LLM)
  7.  Persist artifact
  8.  Update step status
  9.  Append trace
  10. Update envelope status
"""

import time
from datetime import datetime, timezone

from services.firestore import (
    get_envelope,
    update_envelope,
    update_envelope_step,
    get_next_ready_step,
    advance_next_pending_step,
    acquire_envelope_lease,
    has_valid_lease,
    verify_identity,
    quarantine_envelope,
    create_artifact,
    append_trace,
    send_protocol_message,
)

# Step type → agent node function + #us# verb
from graph.nodes.coo import execute as coo_execute
from graph.nodes.researcher import execute as researcher_execute
from graph.nodes.worker import execute as worker_execute
from graph.nodes.grader import execute as grader_execute

STEP_HANDLERS = {
    "plan":             (coo_execute,        "#us#.task.plan"),
    "assign":           (researcher_execute, "#us#.task.assign"),
    "artifact_produce": (worker_execute,     "#us#.artifact.produce"),
    "evaluation":       (grader_execute,     "#us#.evaluation.score"),
}


def run_envelope(envelope_id: str, instance_id: str) -> None:
    """
    Deterministic runtime loop for a single envelope.
    Safe to call after restart — reads all state from Firestore.
    """
    print(f"[RUNTIME] Starting envelope {envelope_id} (instance: {instance_id})")

    # ── Step 1: Fetch envelope ─────────────────────────────────────────────────
    envelope = get_envelope(envelope_id)
    if not envelope:
        print(f"[RUNTIME] Envelope {envelope_id} not found. Aborting.")
        return

    # Operator-decided terminal states — do NOT re-enter these.
    # NOTE: "failed" is intentionally excluded here. After a server crash the
    # envelope may be left in "failed", but the resurrect route resets it to
    # "created" before calling /execute. If for any reason the reset didn't
    # happen, we log a warning but still attempt re-entry so the job isn't
    # silently dropped.
    hard_terminal = {"approved", "rejected", "quarantined"}
    current_status = envelope.get("status", "")
    if current_status in hard_terminal:
        print(f"[RUNTIME] Envelope {envelope_id} is in hard-terminal state ({current_status}). Skipping.")
        return
    if current_status == "failed":
        print(f"[RUNTIME] Envelope {envelope_id} status is 'failed' (likely a crash artifact). "
              f"Attempting resume — resetting status to 'created'.")
        update_envelope(envelope_id, {"status": "created"})
        envelope = get_envelope(envelope_id)
        if not envelope:
            return

    # (Removed single root identity verification and root lease acquisition)

    # Transition to executing
    _safe_transition(envelope_id, "executing")

    # ── Main Step Loop ─────────────────────────────────────────────────────────
    while True:
        # Re-fetch for latest state
        envelope = get_envelope(envelope_id)
        if not envelope:
            break

        # ── Step 4: Find Next Ready Step ──────────────────────────────────────
        step = get_next_ready_step(envelope)
        if step is None:
                steps = envelope.get("steps", [])
                all_done = all(s["status"] in ("completed", "failed") for s in steps)
                if all_done:
                    any_failed = any(s["status"] == "failed" for s in steps)
                    
                    # Manual Transition Phase: If all steps are successful, yield to human
                    final = "failed" if any_failed else "awaiting_human"
                    
                    _safe_transition(envelope_id, final)
                    append_trace(
                        envelope_id=envelope_id, 
                        step_id="", 
                        agent_id="system", 
                        identity_fingerprint="system", 
                        event_type="AWAITING_OPERATOR_DECISION" if not any_failed else "EXECUTION_FAILED"
                    )
                    
                    send_protocol_message(
                        envelope_id=envelope_id,
                        step_id="",
                        verb="#us#.execution.complete" if any_failed else "#us#.execution.awaiting_human",
                        sender_agent_id="system",
                        identity_fingerprint="system",
                        lease_holder=instance_id,
                        payload={"final_status": final},
                    )
                    # Sync job to awaiting_approval so UI shows governance controls
                    job_id = envelope.get("job_id")
                    if job_id:
                        from services.firestore import sync_job_with_envelope
                        sync_job_with_envelope(
                            job_id=job_id,
                            status="awaiting_approval" if not any_failed else "failed",
                            envelope_id=envelope_id,
                            extra={
                                "active_stage": "GOVERNANCE" if not any_failed else "FAILED",
                                "checkpoint_at": __import__("datetime").datetime.now(
                                    __import__("datetime").timezone.utc
                                ).isoformat(),
                            },
                        )
                break

        step_id = step["step_id"]
        step_type = step["step_type"]
        assigned_agent_id = step.get("assigned_agent_id", "unknown")
        handler_info = STEP_HANDLERS.get(step_type)

        if handler_info is None:
            print(f"[RUNTIME] Unknown step_type '{step_type}'. Marking failed.")
            update_envelope_step(envelope_id, step_id, {"status": "failed"})
            break

        handler_fn, verb = handler_info

        # ── Step 4.1: Unified Execution Gate ──────────────────────────────────
        # verify assigned_agent_id -> verify identity -> acquire/verify lease
        agent_id = assigned_agent_id
        fingerprint = verify_identity(envelope, agent_id)
        if not fingerprint:
            print(f"[RUNTIME] Per-step identity check failed for {agent_id}. Halting.")
            break

        if not acquire_envelope_lease(envelope_id, instance_id, agent_id):
            print(f"[RUNTIME] Per-agent lease acquisition failed for {agent_id}. Halting.")
            break

        # Re-fetch for updated leases
        envelope = get_envelope(envelope_id)
        if not envelope or not has_valid_lease(envelope, instance_id, agent_id):
            print(f"[RUNTIME] Lease invalid mid-loop for {agent_id}. Halting.")
            break

        # Mark step as executing
        update_envelope_step(envelope_id, step_id, {"status": "executing"})
        append_trace(envelope_id, step_id, agent_id, fingerprint,
                     f"STEP_STARTED_{step_type.upper()}")

        # ── Sync job status for stage start ────────────────────────────────────
        job_id = envelope.get("job_id")
        if job_id:
            STATUS_MAP = {
                "plan": "coo_planning",
                "assign": "research_execution",
                "artifact_produce": "worker_execution",
                "evaluation": "grading"
            }
            mapped_status = STATUS_MAP.get(step_type, f"{step_type}_execution")
            from services.firestore import sync_job_with_envelope
            sync_job_with_envelope(
                job_id=job_id,
                status=mapped_status,
                envelope_id=envelope_id,
                extra={"active_stage": step_type, "current_step": step_id},
            )

        # ── Step 5: Generate #us# Message ─────────────────────────────────────
        try:
            send_protocol_message(
                envelope_id=envelope_id,
                step_id=step_id,
                verb=verb,
                sender_agent_id=agent_id,
                identity_fingerprint=fingerprint,
                lease_holder=instance_id,
                payload={
                    "step_type": step_type,
                    "input_ref": step.get("input_ref"),
                    "prompt": envelope.get("prompt", ""),
                },
            )
        except ValueError as e:
            print(f"[RUNTIME] #us# protocol error: {e}")
            _fail_step_and_envelope(envelope_id, step_id, agent_id, fingerprint, str(e))
            break

        # ── Step 6: Call Agent Node ────────────────────────────────────────────
        try:
            output_content = handler_fn({
                "envelope_id": envelope_id,
                "step_id": step_id,
                "step_type": step_type,
                "agent_id": agent_id,
                "org_id": envelope.get("org_id", "default"),
                "identity_fingerprint": fingerprint,
                "prompt": envelope.get("prompt", ""),
                "input_ref": step.get("input_ref"),
            })
        except Exception as e:
            import traceback
            print(f"[RUNTIME] Agent node failed for step {step_id}: {e}")
            _fail_step_and_envelope(envelope_id, step_id, agent_id, fingerprint,
                                    f"Node error: {traceback.format_exc()}")
            break

        # ── Step 7: Persist Artifact ───────────────────────────────────────────
        artifact_id = create_artifact(
            envelope_id=envelope_id,
            agent_id=agent_id,
            identity_fingerprint=fingerprint,
            artifact_type=step_type,
            content=output_content if isinstance(output_content, str)
                    else str(output_content),
        )

        # Update artifact_refs in envelope
        envelope = get_envelope(envelope_id) or envelope
        existing_refs = envelope.get("artifact_refs", []) or []
        update_envelope(envelope_id, {"artifact_refs": existing_refs + [artifact_id]})

        # ── Step 8: Update Step Status ─────────────────────────────────────────
        update_envelope_step(envelope_id, step_id, {
            "status": "completed",
            "output_ref": artifact_id,
        })

        # ── Step 9: Append Trace ───────────────────────────────────────────────
        append_trace(envelope_id, step_id, agent_id, fingerprint,
                     f"STEP_COMPLETED_{step_type.upper()}",
                     {"artifact_id": artifact_id})

        # ── Step 10: Advance next pending step → ready (with input_ref) ───────────
        # CRITICAL: pass artifact_id so the next agent reads this step's output
        advance_next_pending_step(envelope_id, step_id, artifact_id)

        # ── Sync job status after each step ────────────────────────────────────────
        job_id = envelope.get("job_id")
        if job_id:
            STATUS_MAP = {
                "plan": "coo_planning",
                "assign": "research_execution",
                "artifact_produce": "worker_execution",
                "evaluation": "grading"
            }
            mapped_status = STATUS_MAP.get(step_type, f"{step_type}_execution")
            extra = {"active_stage": step_type, "last_completed_step": step_id}
            
            if step_type == "evaluation" and output_content:
                try:
                    import json
                    parsed_out = json.loads(output_content) if isinstance(output_content, str) else output_content
                    if "overall_score" in parsed_out:
                        extra["grade_score"] = parsed_out["overall_score"]
                    elif "score" in parsed_out:
                        extra["grade_score"] = parsed_out["score"]
                except Exception:
                    pass

            from services.firestore import sync_job_with_envelope
            sync_job_with_envelope(
                job_id=job_id,
                status=mapped_status,
                envelope_id=envelope_id,
                extra=extra,
            )

        print(f"[RUNTIME] Step {step_id} ({step_type}) completed → {artifact_id}")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_transition(envelope_id: str, new_status: str) -> None:
    """Update envelope status only if valid from current state."""
    VALID_TRANSITIONS = {
        "created":        {"leased", "failed"},
        "leased":         {"planned", "executing", "quarantined", "failed"},
        "planned":        {"executing", "failed"},
        "executing":      {"awaiting_human", "approved", "failed", "quarantined"},
        "awaiting_human": {"approved", "rejected", "failed"},
    }
    envelope = get_envelope(envelope_id)
    if not envelope:
        return
    current = envelope.get("status", "")
    allowed = VALID_TRANSITIONS.get(current, set())
    if new_status in allowed:
        update_envelope(envelope_id, {"status": new_status})


def _fail_step_and_envelope(
    envelope_id: str, step_id: str,
    agent_id: str, fingerprint: str, reason: str
) -> None:
    update_envelope_step(envelope_id, step_id, {"status": "failed"})
    append_trace(envelope_id, step_id, agent_id, fingerprint,
                 "STEP_FAILED", {"reason": reason})
    
    # Security/Identity breaches trigger QUARANTINE
    security_triggers = ["IDENTITY", "LEASE", "PROVIDER", "UNAUTHORIZED", "FORK"]
    if any(trigger in reason.upper() for trigger in security_triggers):
        _safe_transition(envelope_id, "quarantined")
    else:
        _safe_transition(envelope_id, "failed")
