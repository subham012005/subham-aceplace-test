"""
Worker Agent Node — Phase 2
Step type: "artifact_produce"  |  Verb: #us#.artifact.produce

Receives:  prompt + research from input_ref
Produces:  structured deliverable (artifact)
Returns:   artifact content string for persistence
"""

import json
import time
import traceback
from services.firestore import get_artifact, log_agent_action
from config import AGENT_MODELS, ANTHROPIC_API_KEY, OPENAI_API_KEY


WORKER_SYSTEM_PROMPT = """You are the Worker agent in the ACEPLACE Phase 2 runtime.
Produce the required deliverable based on research findings and the original task.
Return ONLY valid JSON:
{
  "deliverable_summary": "brief description of what you produced",
  "deliverable_type": "report|code|analysis|document|other",
  "content": "the full deliverable content here",
  "quality_notes": "any notes about the output quality or limitations"
}"""


def execute(ctx: dict) -> str:
    """
    Execute the Worker artifact production step.
    Returns JSON string of the produced deliverable.
    """
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_worker")
    input_ref = ctx.get("input_ref")

    print(f"[WORKER] Producing artifact for envelope {envelope_id}")

    cfg = AGENT_MODELS.get("worker", AGENT_MODELS["coo"])
    model_name = cfg["model"]
    provider = cfg.get("provider", "anthropic")

    # Load research from previous step artifact
    research_context = ""
    if input_ref:
        try:
            artifact = get_artifact(input_ref)
            if artifact:
                research_context = f"\n\nResearch Findings:\n{artifact.get('artifact_content', '')}"
        except Exception:
            pass

    # ── Log: START ─────────────────────────────────────────────────────────────
    log_agent_action(
        envelope_id=envelope_id,
        step_id=step_id,
        agent_role="worker",
        agent_id=agent_id,
        event="START",
        model=model_name,
        input_summary=f"Produce deliverable for: {prompt[:300]}",
    )

    start_ms = int(time.time() * 1000)

    try:
        raw_text = _call_llm(provider, model_name, cfg, prompt, research_context)

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
                "deliverable_summary": "Worker output",
                "deliverable_type": "document",
                "content": raw_text,
                "quality_notes": "Raw output — JSON parse failed",
            }

        duration_ms = int(time.time() * 1000) - start_ms

        # ── Log: COMPLETE ───────────────────────────────────────────────────────
        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="worker",
            agent_id=agent_id,
            event="COMPLETE",
            model=model_name,
            input_summary=f"Task: {prompt[:200]}",
            output_summary=result.get("deliverable_summary", "Artifact produced")[:500],
            duration_ms=duration_ms,
        )

        print(f"[WORKER] Artifact produced for envelope {envelope_id}")
        return json.dumps(result, indent=2)

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        print(f"[WORKER] ERROR: {e}")

        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="worker",
            agent_id=agent_id,
            event="ERROR",
            model=model_name,
            error=str(e),
            duration_ms=duration_ms,
        )
        raise


def _call_llm(provider: str, model_name: str, cfg: dict, prompt: str, research_context: str) -> str:
    """Call the appropriate LLM provider and return raw text."""
    if provider == "openai":
        try:
            from langchain_openai import ChatOpenAI
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = ChatOpenAI(
                model=model_name,
                temperature=cfg["temperature"],
                api_key=OPENAI_API_KEY,
                max_tokens=8192,
                timeout=300,
            )
            messages = [
                SystemMessage(content=WORKER_SYSTEM_PROMPT),
                HumanMessage(content=f"Task:\n\n{prompt}{research_context}\n\nProduce the deliverable."),
            ]
            response = llm.invoke(messages)
            return response.content if isinstance(response.content, str) else str(response.content)
        except Exception as e:
            print(f"[WORKER] OpenAI failed ({e}), falling back to Anthropic")
            provider = "anthropic"

    # Anthropic (default and fallback)
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import SystemMessage, HumanMessage
    from config import ANTHROPIC_API_KEY as ANTHRO_KEY
    llm = ChatAnthropic(
        model="claude-sonnet-4-6",
        temperature=cfg["temperature"],
        api_key=ANTHRO_KEY,
        max_tokens=8192,
        timeout=300,
    )
    messages = [
        SystemMessage(content=WORKER_SYSTEM_PROMPT),
        HumanMessage(content=f"Task:\n\n{prompt}{research_context}\n\nProduce the deliverable."),
    ]
    response = llm.invoke(messages)
    return response.content if isinstance(response.content, str) else str(response.content)
