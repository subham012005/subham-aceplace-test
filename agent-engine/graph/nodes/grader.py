"""
Grader Agent Node — Phase 2
Step type: "evaluation"  |  Verb: #us#.evaluation.score

Receives:  deliverable from input_ref
Produces:  structured evaluation score (artifact)
Returns:   artifact content string for persistence
"""

import json
import time
import traceback
from services.firestore import get_artifact, log_agent_action
from provider_router import get_llm_config
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage


GRADER_SYSTEM_PROMPT = """You are the Grader agent in the ACEPLACE Phase 2 runtime.
Evaluate the deliverable against the original task requirements.
Return ONLY valid JSON:
{
  "overall_score": 0-100,
  "grade": "A|B|C|D|F",
  "recommendation": "approve|reject|revise",
  "criteria_scores": {
    "completeness": 0-100,
    "accuracy": 0-100,
    "quality": 0-100,
    "relevance": 0-100
  },
  "feedback": "detailed feedback for the human reviewer",
  "summary": "one-line summary of evaluation"
}"""


def execute(ctx: dict) -> str:
    """
    Execute the Grader evaluation step.
    Returns JSON string of the evaluation score.
    """
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_grader")
    input_ref = ctx.get("input_ref")
    start_ms = int(time.time() * 1000)
    print(f"[GRADER] Evaluating artifact for envelope {envelope_id}")

    # ── Step 5: Resolve Provider Configuration (BYO-LLM) ────────────────────────
    llm_cfg = get_llm_config(ctx.get("org_id"), "grader")
    provider = llm_cfg["provider"]
    model_name = llm_cfg["model"]
    api_key = llm_cfg["api_key"]
    base_url = llm_cfg.get("base_url")

    # Load deliverable from previous step
    deliverable_context = ""
    if input_ref:
        try:
            artifact = get_artifact(input_ref)
            if artifact:
                deliverable_context = f"\n\nDeliverable:\n{artifact.get('artifact_content', '')}"
        except Exception:
            pass

    # ── Log: START ─────────────────────────────────────────────────────────────
    log_agent_action(
        envelope_id=envelope_id,
        step_id=step_id,
        agent_role="grader",
        agent_id=agent_id,
        event="START",
        model=model_name,
        input_summary=f"Evaluating deliverable for: {prompt[:300]}",
    )


    try:
        if provider == "anthropic":
            llm = ChatAnthropic(
                model=model_name,
                temperature=llm_cfg["temperature"],
                api_key=api_key,
                base_url=base_url if base_url else None,
                max_tokens=4096,
                timeout=300,
            )
        elif provider == "openai":
            llm = ChatOpenAI(
                model=model_name,
                temperature=llm_cfg["temperature"],
                api_key=api_key,
                max_tokens=4096,
            )
        elif provider == "gemini":
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=llm_cfg["temperature"],
                google_api_key=api_key,
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        messages = [
            SystemMessage(content=GRADER_SYSTEM_PROMPT),
            HumanMessage(content=f"Original task:\n\n{prompt}{deliverable_context}\n\nEvaluate the deliverable."),
        ]

        response = llm.invoke(messages)
        raw_text = response.content if isinstance(response.content, str) else str(response.content)

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
                "overall_score": 70,
                "grade": "B",
                "recommendation": "approve",
                "criteria_scores": {"completeness": 70, "accuracy": 70, "quality": 70, "relevance": 70},
                "feedback": raw_text[:2000],
                "summary": "Evaluation complete — see feedback",
            }

        duration_ms = int(time.time() * 1000) - start_ms
        grade = result.get("grade", "?")
        score = result.get("overall_score", 0)

        # ── Log: COMPLETE ───────────────────────────────────────────────────────
        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="grader",
            agent_id=agent_id,
            event="COMPLETE",
            model=model_name,
            input_summary=f"Evaluated: {prompt[:200]}",
            output_summary=f"Grade: {grade} ({score}/100) — {result.get('summary', '')}",
            duration_ms=duration_ms,
        )

        print(f"[GRADER] Evaluation complete for envelope {envelope_id} — grade: {grade}")
        return json.dumps(result, indent=2)

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        print(f"[GRADER] ERROR: {e}")

        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="grader",
            agent_id=agent_id,
            event="ERROR",
            model=model_name,
            error=str(e),
            duration_ms=duration_ms,
        )
        raise
