"""
Firestore Service — Phase 2 ACEPLACE Agent Engine

All execution state lives in execution_envelopes/{envelope_id}.
Steps are EMBEDDED in envelope.steps[].
Lease is EMBEDDED in envelope.authority_lease.

NO writes to: jobs (for execution), execution_steps, leases.
"""

import time
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore
from config import FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

_db = None

COLLECTION_ENVELOPES  = "execution_envelopes"
COLLECTION_ARTIFACTS  = "artifacts"
COLLECTION_TRACES     = "execution_traces"
COLLECTION_MESSAGES   = "execution_messages"
COLLECTION_AGENT_LOGS = "agent_logs"
COLLECTION_JOBS       = "jobs"

# Five allowed #us# verbs — all others are rejected
ALLOWED_VERBS = {
    "#us#.task.plan",
    "#us#.task.assign",
    "#us#.artifact.produce",
    "#us#.evaluation.score",
    "#us#.execution.complete",
}


# ─── Init ──────────────────────────────────────────────────────────────────────

def _init_firestore():
    global _db
    if _db is not None:
        return _db
    if not FIREBASE_CLIENT_EMAIL or not FIREBASE_PRIVATE_KEY:
        raise RuntimeError("Firebase credentials missing in .env")
    private_key = FIREBASE_PRIVATE_KEY
    if private_key:
        private_key = private_key.strip('"\'').replace("\\n", "\n")
    if not firebase_admin._apps:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": FIREBASE_PROJECT_ID,
            "private_key": private_key,
            "client_email": FIREBASE_CLIENT_EMAIL,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
    _db = firestore.client()
    return _db


def get_db():
    return _init_firestore()


# ─── Envelope Operations ────────────────────────────────────────────────────────

def get_envelope(envelope_id: str) -> Optional[dict]:
    """Fetch envelope document from execution_envelopes."""
    db = get_db()
    doc = db.collection(COLLECTION_ENVELOPES).document(envelope_id).get()
    return doc.to_dict() if doc.exists else None


def update_envelope(envelope_id: str, updates: dict):
    """Update envelope fields."""
    db = get_db()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    db.collection(COLLECTION_ENVELOPES).document(envelope_id).update(updates)


def quarantine_envelope(envelope_id: str, reason: str):
    """Set envelope status to quarantined and log trace."""
    now = datetime.now(timezone.utc).isoformat()
    update_envelope(envelope_id, {"status": "quarantined"})
    append_trace(
        envelope_id=envelope_id,
        step_id="",
        agent_id="system",
        identity_fingerprint="",
        event_type="ENVELOPE_QUARANTINED",
        metadata={"reason": reason},
    )
    print(f"[QUARANTINE] Envelope {envelope_id} quarantined: {reason}")


# ─── Embedded Step Operations ──────────────────────────────────────────────────

def update_envelope_step(envelope_id: str, step_id: str, updates: dict):
    """
    Update a specific step inside envelope.steps[] by step_id.
    Uses Firestore transaction to prevent concurrent modification.
    """
    db = get_db()
    ref = db.collection(COLLECTION_ENVELOPES).document(envelope_id)
    now = datetime.now(timezone.utc).isoformat()

    @firestore.transactional
    def _txn(transaction):
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            raise ValueError(f"Envelope {envelope_id} not found")
        envelope = snap.to_dict()
        steps = envelope.get("steps", [])
        updated = [
            {**step, **updates} if step.get("step_id") == step_id else step
            for step in steps
        ]
        transaction.update(ref, {"steps": updated, "updated_at": now})

    transaction = db.transaction()
    _txn(transaction)


def get_next_ready_step(envelope: dict) -> Optional[dict]:
    """Return the first step with status == 'ready', or None."""
    for step in envelope.get("steps", []):
        if step.get("status") == "ready":
            return step
    return None


def advance_next_pending_step(
    envelope_id: str,
    completed_step_id: str,
    artifact_id: str = "",
):
    """
    After a step completes, mark the next 'pending' step as 'ready'.
    CRITICAL: sets input_ref = artifact_id so the next agent can read the
    previous step's output (COO plan → Researcher, research → Worker, etc.)
    """
    envelope = get_envelope(envelope_id)
    if not envelope:
        return
    steps = envelope.get("steps", [])
    completed_idx = next(
        (i for i, s in enumerate(steps) if s.get("step_id") == completed_step_id), -1
    )
    if completed_idx < 0:
        return
    for i in range(completed_idx + 1, len(steps)):
        if steps[i].get("status") == "pending":
            update_data = {"status": "ready"}
            if artifact_id:
                update_data["input_ref"] = artifact_id
            update_envelope_step(envelope_id, steps[i]["step_id"], update_data)
            print(f"[FIRESTORE] Advanced step {steps[i]['step_id']} → ready (input_ref: {artifact_id})")
            break


# ─── Lease Operations (embedded in envelope) ──────────────────────────────────

def acquire_envelope_lease(
    envelope_id: str,
    instance_id: str,
    agent_id: str,
    duration_seconds: int = 300,
) -> bool:
    """
    Acquire authority lease embedded in envelope.authority_leases[agent_id].
    Returns True if acquired, False if fork detected (envelope quarantined).
    Uses Firestore transaction.
    """
    db = get_db()
    ref = db.collection(COLLECTION_ENVELOPES).document(envelope_id)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=min(duration_seconds, 1800))).isoformat()

    @firestore.transactional
    def _txn(transaction):
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            raise ValueError(f"Envelope {envelope_id} not found")
        env = snap.to_dict()
        authority_leases = env.get("authority_leases", {})
        existing = authority_leases.get(agent_id)

        if existing:
            exp = datetime.fromisoformat(existing["lease_expires_at"])
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now:
                if existing["current_instance_id"] != instance_id:
                    # FORK DETECTED
                    transaction.update(ref, {
                        "status": "quarantined",
                        "updated_at": now.isoformat(),
                    })
                    return "fork"
                # Same instance — already holds lease
                return "already_held"

        # Issue new lease
        lease_id = f"lease_{agent_id}_{int(now.timestamp() * 1000)}"
        new_lease = {
            "lease_id": lease_id,
            "agent_id": agent_id,
            "current_instance_id": instance_id,
            "acquired_at": now.isoformat(),
            "last_renewed_at": now.isoformat(),
            "lease_expires_at": expires_at,
            "status": "active"
        }
        authority_leases[agent_id] = new_lease
        transaction.update(ref, {
            "authority_leases": authority_leases,
            "status": "leased",
            "updated_at": now.isoformat(),
        })
        return "ok"

    transaction = db.transaction()
    result = _txn(transaction)

    if result == "fork":
        append_trace(envelope_id, "", instance_id, "", "LEASE_FORK_DETECTED")
        return False

    append_trace(envelope_id, "", instance_id, "", "LEASE_ACQUIRED",
                 {"expires_at": expires_at})
    return True


def has_valid_lease(envelope: dict, instance_id: str, agent_id: str) -> bool:
    """Check if envelope has a valid non-expired lease for instance_id and agent_id."""
    authority_leases = envelope.get("authority_leases", {})
    lease = authority_leases.get(agent_id)
    if not lease:
        return False
    if lease.get("current_instance_id") != instance_id:
        return False
    exp = datetime.fromisoformat(lease["lease_expires_at"])
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp > datetime.now(timezone.utc)


# ─── Identity Verification ────────────────────────────────────────────────────

def verify_identity(envelope: dict, agent_id: str) -> dict:
    """
    Verify agent identity dynamically:
    1. Check envelope.identity_contexts[agent_id]
    2. Load agent from agents/{agent_id}
    3. Recompute SHA-256 from canonical_identity_json
    4. Compare to identity context fingerprint
    On mismatch -> quarantine envelope and raise exception.
    Returns the verified identity_fingerprint.
    """
    db = get_db()
    envelope_id = envelope.get("envelope_id", "")
    identity_contexts = envelope.get("identity_contexts", {})
    identity_ctx = identity_contexts.get(agent_id, {})
    expected_fp = identity_ctx.get("identity_fingerprint", "")
    if not expected_fp:
        quarantine_envelope(envelope_id, f"IDENTITY_CONTEXT_MISSING_FOR_{agent_id}")
        return ""

    # Allow dev bypass
    if expected_fp in ("pending_verification", ""):
        print(f"[IDENTITY] Dev bypass for envelope {envelope_id} agent {agent_id}")
        return expected_fp

    agent_doc = db.collection("agents").document(agent_id).get()
    if not agent_doc.exists:
        quarantine_envelope(envelope_id, "AGENT_NOT_FOUND")
        return ""

    agent = agent_doc.to_dict()
    canonical_json = agent.get("canonical_identity_json", "")
    recomputed = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    if recomputed != expected_fp:
        quarantine_envelope(envelope_id, "IDENTITY_FINGERPRINT_MISMATCH")
        return ""

    # Update last_verified_at
    db.collection("agents").document(agent_id).update({
        "last_verified_at": datetime.now(timezone.utc).isoformat()
    })
    append_trace(envelope_id, "", agent_id, recomputed, "IDENTITY_VERIFIED")
    return recomputed


# ─── Artifact Pipeline ────────────────────────────────────────────────────────

def create_artifact(
    envelope_id: str,
    agent_id: str,
    identity_fingerprint: str,
    artifact_type: str,
    content: str,
) -> str:
    """Store artifact in artifacts/{artifact_id}. Returns artifact_id."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    artifact_id = f"art_{int(time.time() * 1000)}"

    db.collection(COLLECTION_ARTIFACTS).document(artifact_id).set({
        "artifact_id": artifact_id,
        "execution_id": envelope_id,
        "identity_fingerprint": identity_fingerprint,
        "produced_by_agent": agent_id,
        "artifact_type": artifact_type,
        "artifact_content": content,
        "created_at": now,
    })
    return artifact_id


def get_artifact(artifact_id: str) -> Optional[dict]:
    """Load artifact from artifacts/{artifact_id}. Returns None if missing."""
    if not artifact_id:
        return None
    db = get_db()
    doc = db.collection(COLLECTION_ARTIFACTS).document(str(artifact_id)).get()
    return doc.to_dict() if doc.exists else None


# ─── Agent Action Logging ─────────────────────────────────────────────────────

def log_agent_action(
    envelope_id: str,
    step_id: str,
    agent_role: str,           # "coo" | "researcher" | "worker" | "grader"
    agent_id: str,
    event: str,                # "START" | "COMPLETE" | "ERROR"
    model: str = "",
    input_summary: str = "",
    output_summary: str = "",
    artifact_id: str = "",
    error: str = "",
    duration_ms: int = 0,
    metadata: Optional[dict] = None,
) -> str:
    """
    Write a structured agent log entry to agent_logs/{log_id}.
    This powers the real-time Agent Activity panel in the UI.
    """
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    log_id = f"log_{agent_role}_{event.lower()}_{int(time.time() * 1_000_000)}"

    log_doc = {
        "log_id": log_id,
        "envelope_id": envelope_id,
        "step_id": step_id,
        "agent_role": agent_role,
        "agent_id": agent_id,
        "event": event,         # START | COMPLETE | ERROR
        "model": model,
        "input_summary": input_summary[:500] if input_summary else "",
        "output_summary": output_summary[:1000] if output_summary else "",
        "artifact_id": artifact_id,
        "error": error[:500] if error else "",
        "duration_ms": duration_ms,
        "timestamp": now,
        "metadata": metadata or {},
    }

    db.collection(COLLECTION_AGENT_LOGS).document(log_id).set(log_doc)
    return log_id


def sync_job_with_envelope(
    job_id: str,
    status: str,
    envelope_id: str = "",
    extra: Optional[dict] = None,
) -> None:
    """
    Sync a jobs/{job_id} document with current envelope execution state.
    Called by the runtime loop after each step transition.
    Automatically sinks the steps from the envelope if exists.
    """
    if not job_id:
        return
    db = get_db()
    payload = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if envelope_id:
        payload["envelope_id"] = envelope_id
        payload["execution_id"] = envelope_id

        # Sync steps from envelope directly to jobs
        envelope = get_envelope(envelope_id)
        if not envelope:
            # If the envelope is gone, it means the job was purged from the UI.
            # Abort sync to prevent re-creating the 'jobs' pointer.
            print(f"[FIRESTORE] Sync aborted for {job_id}: Envelope {envelope_id} deleted.")
            return

        if "steps" in envelope:
            payload["steps"] = envelope["steps"]
            if "execution_context" in envelope:
                payload["execution_context"] = envelope["execution_context"]
            if "token_usage" in envelope:
                payload["token_usage"] = envelope["token_usage"]

    # Split extra into regular keys and dot-notation keys (nested field paths).
    # set(merge=True) treats dots as literal field names; update() treats them
    # as nested paths — so dot-keys go through a separate update() call.
    dotpath_fields = {}
    if extra:
        for k, v in list(extra.items()):
            if "." in k:
                dotpath_fields[k] = v
            else:
                payload[k] = v
    db.collection(COLLECTION_JOBS).document(job_id).set(payload, merge=True)
    if dotpath_fields:
        dotpath_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        db.collection(COLLECTION_JOBS).document(job_id).update(dotpath_fields)


# ─── Trace Logging ────────────────────────────────────────────────────────────

def append_trace(
    envelope_id: str,
    step_id: str,
    agent_id: str,
    identity_fingerprint: str,
    event_type: str,
    metadata: Optional[dict] = None,
):
    """Append an execution trace. Every step MUST log here."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    trace_id = f"trace_{event_type.lower()}_{int(time.time() * 1_000_000)}"

    db.collection(COLLECTION_TRACES).document(trace_id).set({
        "trace_id": trace_id,
        "envelope_id": envelope_id,
        "step_id": step_id,
        "agent_id": agent_id,
        "identity_fingerprint": identity_fingerprint,
        "event_type": event_type,
        "timestamp": now,
        "metadata": metadata or {},
    })


# ─── #us# Protocol Messages ───────────────────────────────────────────────────

def send_protocol_message(
    envelope_id: str,
    step_id: str,
    verb: str,
    sender_agent_id: str,
    identity_fingerprint: str,
    lease_holder: str,
    payload: dict,
    metadata: Optional[dict] = None,
) -> str:
    """
    Send a strictly validated #us# protocol message.
    Rejects any verb not in ALLOWED_VERBS.
    """
    if verb not in ALLOWED_VERBS:
        raise ValueError(
            f"[#us#] Rejected: '{verb}' is not an allowed protocol verb. "
            f"Allowed: {sorted(ALLOWED_VERBS)}"
        )

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    safe_verb = verb.replace("#", "").replace(".", "_")
    message_id = f"msg_{safe_verb}_{int(time.time() * 1000)}"

    message_data = {
        "message_id": message_id,
        "protocol": "#us#",
        "version": "1.0",
        "message_type": verb,
        "execution": {
            "envelope_id": envelope_id,
            "step_id": step_id,
        },
        "identity": {
            "agent_id": sender_agent_id,
            "identity_fingerprint": identity_fingerprint,
        },
        "authority": {
            "lease_holder": lease_holder,
        },
        "payload": payload,
        "metadata": metadata or {},
        "timestamp": now,
    }

    db.collection(COLLECTION_MESSAGES).document(message_id).set(message_data)
    print(f"[#us#] {sender_agent_id} → {verb} (envelope: {envelope_id[:16]}...)")
    return message_id
