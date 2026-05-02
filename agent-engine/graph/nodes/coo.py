"""
COO Agent Node — Phase 3
Step type: "plan"  |  Verb: #us#.task.plan

Phase 3 additions:
  - Always performs web search for deep research context
  - Uses knowledge base if provided in envelope
  - Uses instruction profiles if provided in envelope
  - Decides and documents in plan whether web search & KB are needed for downstream agents
  - Outputs grounding decision in plan JSON
"""

import json
import time
import traceback
from provider_router import get_llm_config
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from services.firestore import get_envelope, log_agent_action
from services.knowledge_service import extract_phase3_context, log_phase3_usage
from services.token_service import extract_token_usage


COO_SYSTEM_PROMPT = """You are the COO of ACEPLACE. Your goal is to plan a MASSIVE-SCALE mission based on the Knowledge Base (KB) and Web Search.

### 🎯 MISSION OBJECTIVE
Create a comprehensive, high-detail plan that forces agents to produce a massive (1500+ word) masterpiece.

### 🛡️ GROUNDING & DETAIL PROTOCOL
- **DO:** Demand TOTAL EXTRACTION from the Researcher (10-12+ key findings).
- **DO:** Explicitly state that "Brevity in research is a mission failure."
- **DO:** Prioritize [KB-N] for every historical, technical, or procedural detail.
- **DON'T:** Create a simple plan. Create a roadmap for deep, professional analysis.

### 📝 PLAN STRUCTURE (JSON ONLY)
{
  "plan_summary": "Strategic overview",
  "strategic_objective": "Extensive goal description",
  "grounding_decision": { "use_knowledge_base": true, "use_web_search": true, "rationale": "Detailed reason" },
  "assignments": [
    {
      "agent_role": "researcher",
      "task": "Perform TOTAL EXTRACTION on [topic]. Extract 10-12+ granular findings from the KB. No summaries. Provide enough raw data for 1500+ words.",
      "success_criteria": "Total intelligence extraction"
    },
    {
      "agent_role": "worker",
      "task": "Produce a MASSIVE (1500+ word), 8+ section masterpiece deliverable. Expand on research with deep multi-paragraph analysis. Cite all sources.",
      "success_criteria": "Large-scale, professional output"
    }
  ],
  "web_search_queries_recommended": ["specific query 1", "specific query 2"],
  "constraints": ["KB-derived constraints"]
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
    Execute the COO planning step with Phase 3 grounding.
    Returns JSON string of the execution plan.
    """
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_coo")
    fingerprint = ctx.get("identity_fingerprint", "")
    start_ms = int(time.time() * 1000)
    model_name = "unknown"

    # ── Phase 3: Extract web search context (Skip KB for COO) ──────────────────
    envelope = get_envelope(envelope_id) or {}
    
    # We explicitly disable KB for COO to save tokens
    phase3 = extract_phase3_context(envelope, prompt)
    
    # Override KB content to be empty for COO
    phase3["knowledge_chunks"] = []
    phase3["kb_block"] = ""
    phase3["has_knowledge"] = False

    web_block  = phase3["web_block"]
    instr_block = phase3["instr_block"]

    try:
        # ── Resolve Provider Configuration (BYO-LLM) ─────────────────────────────
        llm_cfg = get_llm_config(ctx.get("org_id"), "coo")
        provider = llm_cfg["provider"]
        model_name = llm_cfg["model"]
        api_key = llm_cfg["api_key"]
        base_url = llm_cfg.get("base_url")

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

        # Build grounding-aware human message
        grounding_summary = []
        if phase3["has_knowledge"]:
            grounding_summary.append(f"- User Knowledge Base: {len(phase3['knowledge_chunks'])} relevant chunks from collections {phase3['collection_ids']}")
        if phase3["has_web"]:
            grounding_summary.append(f"- Web Search: {len(phase3['web_results'])} results retrieved")
        if phase3["has_instructions"]:
            grounding_summary.append(f"- Instruction Profiles: {len(phase3['instruction_profiles'])} profiles loaded")

        grounding_note = "\n".join(grounding_summary) if grounding_summary else "- Web Search: always on for deep research"

        human_content = (
            f"Use this knowledge base:\n"
            f"{{ {grounding_note}\n{instr_block}{web_block} }}\n\n"
            f"Then strategically answer the task:\n"
            f"{{ {prompt} }}\n\n"
            f"Create the execution plan. Reference web search results in assignments."
        )
        messages = [
            SystemMessage(content=COO_SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = llm.invoke(messages)
        raw_text = response.content if isinstance(response.content, str) else str(response.content)
        
        plan = _parse_json(raw_text)
        if not plan:
            plan = {
                "plan_summary": "Direct execution of user request",
                "grounding_decision": {
                    "use_knowledge_base": phase3["has_knowledge"],
                    "use_web_search": True,
                    "kb_collections": phase3["collection_ids"],
                    "rationale": "Default grounding: web search always on",
                },
                "assignments": [
                    {
                        "assignment_id": "assign_1",
                        "agent_role": "researcher",
                        "task": f"Research using web search and KB: {prompt}",
                        "grounding_required": True,
                    },
                    {
                        "assignment_id": "assign_2",
                        "agent_role": "worker",
                        "task": f"Produce deliverable for: {prompt}",
                        "grounding_required": True,
                    },
                ],
            }

        # Embed phase3 metadata into plan
        plan["_phase3"] = {
            "kb_chunks_used": len(phase3["knowledge_chunks"]),
            "web_results_used": len(phase3["web_results"]),
            "instruction_profiles": phase3["profile_ids"],
            "web_sources": [r.get("url") for r in phase3["web_results"][:5]],
        }

        result_json = json.dumps(plan, indent=2)
        usage = extract_token_usage(response, model_name)
        
        duration_ms = int(time.time() * 1000) - start_ms

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
            metadata={"token_usage": usage}
        )

        print(f"[COO] Complete | Tokens: {usage.get('total_tokens', 0)}")

        return {
            "content": result_json,
            "token_usage": usage
        }

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        print(f"[COO] ERROR: {e}")
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
