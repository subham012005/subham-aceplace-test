"""
COO Agent Node — Phase 2
Step type: "plan"  |  Verb: #us#.task.plan

Receives:  prompt
Produces:  structured JSON execution plan (artifact)
Returns:   artifact content string for persistence
"""

import json
import traceback
from config import AGENT_MODELS, ANTHROPIC_API_KEY
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage


COO_SYSTEM_PROMPT = """You are the COO agent in the NXQ Phase 2 runtime.
Your task is to create a deterministic execution plan for the given prompt.

Return ONLY valid JSON in this exact structure:
{
  "plan_summary": "brief description of the plan",
  "assignments": [
    {
      "assignment_id": "assign_1",
      "agent_role": "researcher",
      "task": "specific research task"
    },
    {
      "assignment_id": "assign_2",
      "agent_role": "worker",
      "task": "specific production task"
    }
  ]
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

    print(f"[COO] Planning for envelope {envelope_id}")

    cfg = AGENT_MODELS["coo"]
    llm = ChatAnthropic(
        model=cfg["model"],
        temperature=cfg["temperature"],
        api_key=ANTHROPIC_API_KEY,
        max_tokens=4096,
        timeout=300,
    )

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

    print(f"[COO] Plan complete — {len(plan.get('assignments', []))} assignments")
    return json.dumps(plan, indent=2)
