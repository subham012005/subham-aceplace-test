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


RESEARCHER_SYSTEM_PROMPT = """You are the Intelligence Researcher agent in the ACEPLACE Phase 2 runtime.
Your mission is to deeply research the given task using your full knowledge base and provide a comprehensive, sourced intelligence report.

You MUST produce:
1. A thorough research summary with substantive insights (not just a brief overview)
2. Detailed key findings - each one fully explained with context and evidence
3. Specific data points, statistics, or facts that support the findings
4. Resources and references consulted (real-world references, frameworks, standards, or sources)
5. A clear, actionable recommended approach for the Worker agent to follow

Return ONLY valid JSON in this exact structure:
{
  "research_summary": "Comprehensive 3-5 sentence summary of what was found and its significance",
  "key_findings": [
    {
      "title": "Finding title",
      "detail": "Full paragraph explaining this finding with evidence and context",
      "significance": "Why this matters for the task"
    }
  ],
  "data_points": {
    "category_name": ["specific fact or statistic 1", "specific fact or statistic 2"],
    "metrics": ["quantitative data if applicable"],
    "best_practices": ["industry standard or best practice 1", "standard 2"]
  },
  "resources": [
    {
      "title": "Resource or reference name",
      "type": "framework|standard|documentation|study|tool",
      "relevance": "How this resource applies to the task"
    }
  ],
  "recommended_approach": "Detailed, step-by-step recommendation for the Worker agent — what to create, how to structure it, what to include, and in what order",
  "risk_factors": ["Potential challenge 1", "Potential challenge 2"],
  "confidence_level": "high|medium|low"
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
