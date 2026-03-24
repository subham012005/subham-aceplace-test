"""
Worker Agent Node — Phase 2
Step type: "artifact_produce"  |  Verb: #us#.artifact.produce

Receives:  prompt + research from input_ref
Produces:  structured deliverable (artifact)
Returns:   artifact content string for persistence
"""

import json
from services.firestore import get_artifact
from config import AGENT_MODELS, ANTHROPIC_API_KEY
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage


WORKER_SYSTEM_PROMPT = """You are the Worker agent in the NXQ Phase 2 runtime.
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
    input_ref = ctx.get("input_ref")

    print(f"[WORKER] Producing artifact for envelope {envelope_id}")

    # Load research from previous step artifact
    research_context = ""
    if input_ref:
        try:
            artifact = get_artifact(input_ref)
            if artifact:
                research_context = f"\n\nResearch Findings:\n{artifact.get('artifact_content', '')}"
        except Exception:
            pass

    cfg = AGENT_MODELS.get("worker", AGENT_MODELS["coo"])
    llm = ChatAnthropic(
        model=cfg["model"],
        temperature=cfg["temperature"],
        api_key=ANTHROPIC_API_KEY,
        max_tokens=8192,
        timeout=300,
    )

    messages = [
        SystemMessage(content=WORKER_SYSTEM_PROMPT),
        HumanMessage(content=f"Task:\n\n{prompt}{research_context}\n\nProduce the deliverable."),
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
            "deliverable_summary": "Worker output",
            "deliverable_type": "document",
            "content": raw_text,
            "quality_notes": "Raw output — JSON parse failed",
        }

    print(f"[WORKER] Artifact produced for envelope {envelope_id}")
    return json.dumps(result, indent=2)
