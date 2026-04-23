"""
COO Agent Node — Phase 2
Step type: "plan"  |  Verb: #us#.task.plan

Receives:  prompt
Produces:  structured JSON execution plan (artifact)
Returns:   artifact content string for persistence
"""

import json
import time
import traceback
from provider_router import get_llm_config
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from services.firestore import log_agent_action


COO_SYSTEM_PROMPT = """You are the Chief Orchestration Officer (COO) agent in the ACEPLACE Phase 2 runtime.
Your role is to analyze the user's task and construct a detailed, multi-phase strategic execution plan.

You MUST produce a comprehensive plan that includes:
1. A detailed strategic overview of the mission
2. Explicit, actionable task assignments for each agent role (Researcher, Worker, Grader)
3. Success criteria and expected deliverables
4. Any known constraints, risks, or dependencies

Return ONLY valid JSON in this exact structure:
{
  "plan_summary": "One-sentence executive summary of the mission",
  "strategic_objective": "Detailed multi-sentence description of what needs to be accomplished and why",
  "mission_context": "Background context, scope, and any relevant domain knowledge",
  "assignments": [
    {
      "assignment_id": "assign_1",
      "agent_role": "researcher",
      "name": "Intelligence Gathering Phase",
      "task": "Detailed description of exactly what the researcher must investigate and report on",
      "expected_output": "What the researcher should produce — findings, data, sources, analysis",
      "priority": "critical|high|medium",
      "success_criteria": "Specific, measurable outcome that defines task completion"
    },
    {
      "assignment_id": "assign_2",
      "agent_role": "worker",
      "name": "Execution & Production Phase",
      "task": "Detailed description of what the worker must produce based on research findings",
      "expected_output": "What the worker should deliver — document, code, report, analysis",
      "priority": "critical|high|medium",
      "success_criteria": "Specific, measurable outcome that defines task completion"
    }
  ],
  "constraints": ["Any specific constraints or requirements to respect"],
  "dependencies": "Research must complete before production begins",
  "estimated_complexity": "low|medium|high",
  "quality_bar": "Explicit definition of acceptable quality for this mission"
}"""


def _parse_json(text: str) -> dict | None:
    """Extract JSON from model text, handling markdown fences."""
    cleaned = text.strip()
    for fence in ("```json", "```"):
        if cleaned.startswith(fence):
            cleaned = cleaned[len(fence):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        first, last = cleaned.find("{"), cleaned.rfind("}")
        if first != -1 and last > first:
            try:
                return json.loads(cleaned[first:last + 1])
            except json.JSONDecodeError:
                return None
    return None


def execute(ctx: dict) -> str:
    """
    Execute the COO planning step.
    Returns JSON string of the execution plan.
    """
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_coo")
    start_ms = int(time.time() * 1000)

    print(f"[COO] Planning for envelope {envelope_id}")

    # ── Step 5: Resolve Provider Configuration (BYO-LLM) ────────────────────────
    llm_cfg = get_llm_config(ctx.get("org_id"), "coo")
    provider = llm_cfg["provider"]
    model_name = llm_cfg["model"]
    api_key = llm_cfg["api_key"]
    base_url = llm_cfg.get("base_url")

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
                base_url=base_url if base_url else None,
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
            SystemMessage(content=COO_SYSTEM_PROMPT),
            HumanMessage(content=f"User task:\n\n{prompt}\n\nCreate the execution plan."),
        ]

        response = llm.invoke(messages)
        raw_text = response.content if isinstance(response.content, str) else str(response.content)

        plan = _parse_json(raw_text)
        if not plan:
            plan = {
                "plan_summary": "Direct execution of user request",
                "assignments": [
                    {"assignment_id": "assign_1", "agent_role": "researcher",
                     "task": f"Research: {prompt}"},
                    {"assignment_id": "assign_2", "agent_role": "worker",
                     "task": f"Produce deliverable for: {prompt}"},
                ],
            }

        result_json = json.dumps(plan, indent=2)
        duration_ms = int(time.time() * 1000) - start_ms

        # ── Log: COMPLETE ───────────────────────────────────────────────────────
        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="coo",
            agent_id=agent_id,
            event="COMPLETE",
            model=model_name,
            input_summary=f"Planning task: {prompt[:200]}",
            output_summary=plan.get("plan_summary", "Plan created"),
            duration_ms=duration_ms,
        )

        print(f"[COO] Plan complete — {len(plan.get('assignments', []))} assignments")
        return result_json

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        err_str = traceback.format_exc()
        print(f"[COO] ERROR: {e}")

        # ── Log: ERROR ──────────────────────────────────────────────────────────
        log_agent_action(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_role="coo",
            agent_id=agent_id,
            event="ERROR",
            model=model_name,
            error=str(e),
            duration_ms=duration_ms,
        )
        raise
