"""
Researcher Agent Node — Phase 2
Step type: "assign"  |  Verb: #us#.task.assign

Receives:  prompt + optional plan from input_ref
Produces:  structured JSON research result (artifact)
Returns:   artifact content string for persistence
"""

import json
import time
import traceback
from services.firestore import get_artifact, log_agent_action
from config import AGENT_MODELS, ANTHROPIC_API_KEY
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage


RESEARCHER_SYSTEM_PROMPT = """You are the Researcher agent in the NXQ Phase 2 runtime.
Gather information, analysis, and data relevant to the task.
Return ONLY valid JSON:
{
  "research_summary": "summary of findings",
  "key_findings": ["finding 1", "finding 2"],
  "data_points": {},
  "recommended_approach": "brief recommendation for the worker"
}"""


def execute(ctx: dict) -> str:
    """
    Execute the Researcher assignment step.
    Returns JSON string of research results.
    """
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_researcher")
    input_ref = ctx.get("input_ref")

    print(f"[RESEARCHER] Researching for envelope {envelope_id}")

    cfg = AGENT_MODELS.get("researcher", AGENT_MODELS["coo"])
    model_name = cfg["model"]

    # Load plan from previous step artifact if available
    plan_context = ""
    if input_ref:
        try:
            artifact = get_artifact(input_ref)
            if artifact:
                plan_context = f"\n\nExecution Plan:\n{artifact.get('artifact_content', '')}"
        except Exception:
            pass

    # ── Log: START ─────────────────────────────────────────────────────────────
    log_agent_action(
        envelope_id=envelope_id,
        step_id=step_id,
        agent_role="researcher",
        agent_id=agent_id,
        event="START",
        model=model_name,
        input_summary=f"Research task: {prompt[:300]}",
    )

    start_ms = int(time.time() * 1000)

    try:
        llm = ChatAnthropic(
            model=model_name,
            temperature=cfg["temperature"],
            api_key=ANTHROPIC_API_KEY,
            max_tokens=8192,
            timeout=300,
        )

        messages = [
            SystemMessage(content=RESEARCHER_SYSTEM_PROMPT),
            HumanMessage(content=f"Task:\n\n{prompt}{plan_context}\n\nProvide research findings."),
        ]

        response = llm.invoke(messages)
        raw_text = response.content if isinstance(response.content, str) else str(response.content)

        # Try to extract JSON
        cleaned = raw_text.strip()
        for fence in ("```json", "```"):
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            result = {
                "research_summary": raw_text[:2000],
                "key_findings": ["See research_summary for details"],
                "data_points": {},
                "recommended_approach": "See research_summary",
            }

        duration_ms = int(time.time() * 1000) - start_ms

        # ── Log: COMPLETE ───────────────────────────────────────────────────────
        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="researcher",
            agent_id=agent_id,
            event="COMPLETE",
            model=model_name,
            input_summary=f"Research: {prompt[:200]}",
            output_summary=result.get("research_summary", "Research complete")[:500],
            duration_ms=duration_ms,
        )

        print(f"[RESEARCHER] Research complete for envelope {envelope_id}")
        return json.dumps(result, indent=2)

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        err_str = traceback.format_exc()
        print(f"[RESEARCHER] ERROR: {e}")

        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="researcher",
            agent_id=agent_id,
            event="ERROR",
            model=model_name,
            error=str(e),
            duration_ms=duration_ms,
        )
        raise
