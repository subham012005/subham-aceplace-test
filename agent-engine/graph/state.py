"""
Step Context — Phase 2 ACEPLACE Agent Engine

Replaces PipelineState (LangGraph-specific).
Each agent node receives a simple context dict.
All state lives in Firestore (execution_envelopes).
"""

from typing import TypedDict, Optional


class StepContext(TypedDict):
    """Context passed to each agent node's execute() function."""
    envelope_id: str
    step_id: str
    step_type: str
    agent_id: str
    identity_fingerprint: str
    prompt: str
    input_ref: Optional[str]   # artifact_id of previous step output, if any
