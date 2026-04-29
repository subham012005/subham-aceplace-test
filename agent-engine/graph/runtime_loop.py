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
    sync_job_with_envelope,
)
from services.token_service import aggregate_tokens
from provider_router import get_llm_config

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
    # Track grader output across iterations so it can be included in the final sync
    _grader_score_cache: dict = {}

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
                        final_extra: dict = {
                            "active_stage": "GOVERNANCE" if not any_failed else "FAILED",
                            "checkpoint_at": __import__("datetime").datetime.now(
                                __import__("datetime").timezone.utc
                            ).isoformat(),
                            "token_usage": envelope.get("token_usage", {}),
                            "cost": envelope.get("token_usage", {}).get("cost", 0.0)
                        }
                        # Always carry grader score forward into the final sync
                        if _grader_score_cache:
                            final_extra.update(_grader_score_cache)

                        sync_job_with_envelope(
                            job_id=job_id,
                            status="awaiting_approval" if not any_failed else "failed",
                            envelope_id=envelope_id,
                            extra=final_extra,
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
            ROLE_MAP = {
                "plan": "coo",
                "assign": "researcher",
                "artifact_produce": "worker",
                "evaluation": "grader"
            }
            role = ROLE_MAP.get(step_type, "worker")
            
            # Resolve LLM info for dashboard transparency
            llm_info = {"model": "unknown", "provider": "unknown"}
            try:
                llm_cfg = get_llm_config(envelope.get("org_id", "default"), role)
                llm_info["model"] = llm_cfg.get("model", "unknown")
                llm_info["provider"] = llm_cfg.get("provider", "unknown")
            except Exception as e:
                print(f"[RUNTIME] Could not resolve LLM info for sync: {e}")

            STATUS_MAP = {
                "plan": "coo_planning",
                "assign": "research_execution",
                "artifact_produce": "worker_execution",
                "evaluation": "grading"
            }
            mapped_status = STATUS_MAP.get(step_type, f"{step_type}_execution")
            sync_job_with_envelope(
                job_id=job_id,
                status=mapped_status,
                envelope_id=envelope_id,
                extra={
                    "active_stage": step_type, 
                    "current_step": step_id,
                    "model_used": llm_info["model"],
                    "model_provider": llm_info["provider"]
                },
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

        # Handle dict return from updated agents
        token_usage = {}
        actual_output = output_content
        if isinstance(output_content, dict) and "content" in output_content:
            token_usage = output_content.get("token_usage", {})
            actual_output = output_content["content"]

        # ── Step 7: Persist Artifact ───────────────────────────────────────────
        artifact_id = create_artifact(
            envelope_id=envelope_id,
            agent_id=agent_id,
            identity_fingerprint=fingerprint,
            artifact_type=step_type,
            content=actual_output if isinstance(actual_output, str)
                    else str(actual_output),
        )

        # Update artifact_refs and total_token_usage in envelope
        envelope = get_envelope(envelope_id) or envelope
        existing_refs = envelope.get("artifact_refs", []) or []
        
        current_total_usage = envelope.get("token_usage", {
            "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost": 0.0
        })
        new_total_usage = aggregate_tokens(current_total_usage, token_usage)
        
        print(f"[{step_type.upper()}] 📊 Token Usage: {token_usage.get('total_tokens', 0)} (In: {token_usage.get('input_tokens', 0)}, Out: {token_usage.get('output_tokens', 0)})")
        print(f"[{step_type.upper()}] 💰 Running Total: {new_total_usage.get('total_tokens', 0)} tokens | Est. Cost: ${new_total_usage.get('cost', 0.0):.4f}")

        update_envelope(envelope_id, {
            "artifact_refs": existing_refs + [artifact_id],
            "token_usage": new_total_usage
        })

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
            extra = {
                "active_stage": step_type, 
                "last_completed_step": step_id,
                "token_usage": new_total_usage,  # Sync total tokens to job
                "cost": new_total_usage.get("cost", 0.0)
            }
            
            if actual_output:
                try:
                    import json
                    output_str = actual_output if isinstance(actual_output, str) else json.dumps(actual_output)
                    if step_type == "plan":
                        extra["runtime_context.plan"] = output_str
                    elif step_type == "assign":
                        extra["runtime_context.research_result"] = output_str
                    elif step_type == "artifact_produce":
                        extra["runtime_context.worker_result"] = output_str
                        extra["runtime_context.final_result"] = output_str
                    elif step_type == "evaluation":
                        parsed_out = json.loads(output_str) if isinstance(actual_output, str) else actual_output
                        if isinstance(parsed_out, dict):
                            grade_score_val = parsed_out.get("overall_score")
                            if grade_score_val is None:
                                grade_score_val = parsed_out.get("score")
                            if grade_score_val is None:
                                grade_score_val = parsed_out.get("value")
                            if grade_score_val is not None:
                                extra["grade_score"] = grade_score_val
                                extra["grading_result"] = parsed_out
                                extra["runtime_context.grading_result"] = parsed_out
                                _grader_score_cache["grade_score"] = grade_score_val
                                _grader_score_cache["grading_result"] = parsed_out
                                _grader_score_cache["grade_label"] = parsed_out.get("grade", "")
                                _grader_score_cache["grade_recommendation"] = parsed_out.get("recommendation", "")
                                _grader_score_cache["graded_at"] = __import__("datetime").datetime.now(
                                    __import__("datetime").timezone.utc
                                ).isoformat()
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
        "created":        {"leased", "executing", "failed"},
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
