"""
Worker Agent Node — Phase 3
Step type: "artifact_produce"  |  Verb: #us#.artifact.produce

Phase 3: strict grounding from research + KB + web search.
All claims must be backed by sources. No fabrication.
INSUFFICIENT DATA if sources are missing.
"""

import json
import time
from services.firestore import get_artifact, log_agent_action, get_envelope
from services.knowledge_service import extract_phase3_context, log_phase3_usage
from services.token_service import extract_token_usage
from provider_router import get_llm_config
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage


WORKER_SYSTEM_PROMPT = """{
  "role": "Senior Production Specialist",
  "mission": "Transform grounded research intelligence into investor-ready, technically rigorous, long-form deliverables that accurately represent ACEPLACE as a deterministic, identity-bound, authority-controlled execution runtime.",

  "core_directive": "Do not create generic business content. Produce high-fidelity strategic and technical documentation grounded in verified KB findings, validated researcher outputs, and approved web intelligence.",

  "anti_generic_protocol": {
    "ban_generic_content": "Never use 'AI-sounding' filler, sweeping generalizations, or repetitive introductions.",
    "dense_information": "Every paragraph must contain at least 2-3 specific facts, data points, or technical details from the KB or Research.",
    "voice_and_tone": "Write with professional authority. Be direct, technical, and precise.",
    "no_summaries": "Do not summarize findings; synthesize them into a new, complex analysis."
  },

  "production_principles": {
    "technical_rigor": "Explain architecture, execution flow, constraints, failure modes, validation requirements, and strategic implications with engineering-level specificity.",
    "investor_readiness": "Frame the deliverable around defensibility, infrastructure value, technical moat, operational maturity, and validation status.",
    "grounding_integrity": "Every factual claim must be cited using [KB-N], [WEB-N], or validated Research Finding references.",
    "runtime_alignment": "All content must respect ACEPLACE laws: agents are stateless, envelopes hold state, runtime-worker is the only executor, ACELOGIC owns identity, leases gate execution.",
    "no_fabrication": "If evidence is missing, state the limitation clearly instead of inventing details."
  },

  "high_fidelity_production_protocol": {
    "standard": "MASTERPIECE TECHNICAL DOCUMENTATION",
    "objective": "Produce a deliverable that sounds like it was written by the lead systems architect and the COO.",
    "extensive_production": "You MUST write at least 1500-3000+ words. Short responses are a mission failure.",
    "structural_depth": "You must provide at least 8+ detailed sections. Each section body must be 5-8 paragraphs long.",
    "required_depth": [
      "Decompose architecture into specific runtime planes and protocol invariants.",
      "Use sophisticated markdown (tables, lists, bold highlights) to communicate technical density.",
      "Frame all strategic claims around the technical defensibility of the ACEPLACE stack.",
      "Explicitly mention identity-bound execution and authority lease enforcement as core moats."
    ]
  },

  "mission_execution": {
    "follow_the_plan": "You must strictly adhere to the 'final_deliverable_specification' defined in the COO Execution Plan.",
    "section_breakdown": "Use the exact section titles and word count targets specified by the COO.",
    "presentation_style": "Implement all presentation style requirements (tables, diagrams, appendices) as requested."
  },

  "deliverable_requirements": {
    "must_include": [
      "Executive summary",
      "Strategic thesis",
      "Technical architecture analysis",
      "Runtime execution model",
      "Identity and authority model",
      "Persistence, trace, and artifact model",
      "Operational validation status",
      "Risk and gap analysis",
      "Investor-facing positioning",
      "Conclusion and recommended next milestones"
    ]
  },

  "output_format": {
    "deliverable_summary": "Professional executive summary of the artifact. Dense and specific.",
    "content": "Complete long-form markdown deliverable (1500+ words) with polished headings and rigorous analysis.",
    "sections": [
      {
        "title": "Section title",
        "body": "Detailed multi-paragraph analysis with precise citations and clear strategic implications."
      }
    ],
    "source_references": [
      {
        "ref_id": "[KB-1]",
        "title": "Source document or research artifact title",
        "usage": "Explain how this source supports the deliverable."
      }
    ],
    "grounding_report": {
      "kb_chunks_cited": 0,
      "web_sources_cited": 0,
      "research_findings_used": 0,
      "fabrication_check": "VERIFIED | PARTIAL | FAILED"
    }
  },

  "hard_constraints": [
    "JSON only",
    "No speculative claims",
    "No claim that ACEPLACE is operationally validated unless test evidence proves it"
  ]
}"""


def _parse_json_text(text: str) -> dict | None:
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
            except Exception:
                return None
    return None


def execute(ctx: dict) -> dict:
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_worker")
    fingerprint = ctx.get("identity_fingerprint", "")
    input_ref = ctx.get("input_ref")
    start_ms = int(time.time() * 1000)
    model_name = "unknown"

    print(f"[WORKER] Producing grounded artifact for envelope {envelope_id}")

    # Load research and COO plan
    research_context = ""
    plan_context = ""
    work_unit_context = ""
    researcher_grounding_meta = {}

    # 1. Load context from input_ref (usually research)
    if input_ref:
        research_art_id = None
        if isinstance(input_ref, dict):
            research_art_id = input_ref.get("artifact_id")
            wu = input_ref.get("work_unit")
            if wu:
                work_unit_context = f"\n\nTarget Work Unit:\n{json.dumps(wu, indent=2)}"
        elif isinstance(input_ref, str):
            research_art_id = input_ref

        if research_art_id:
            try:
                artifact = get_artifact(research_art_id)
                if artifact:
                    research_content = artifact.get("artifact_content", "")
                    research_context = f"\n\nResearch Findings:\n{research_content}"
                    try:
                        res_data = json.loads(research_content)
                        researcher_grounding_meta = res_data.get("_grounding_meta", {})
                    except Exception:
                        pass
            except Exception:
                pass

    # 2. Re-fetch envelope to find the COO plan artifact
    envelope = get_envelope(envelope_id) or {}
    steps = envelope.get("steps", [])
    for s in steps:
        if s.get("step_type") == "plan" and s.get("status") == "completed":
            plan_art_id = s.get("output_ref")
            if plan_art_id:
                try:
                    plan_art = get_artifact(plan_art_id)
                    if plan_art:
                        plan_context = f"\n\nCOO Execution Plan:\n{plan_art.get('artifact_content', '')}"
                except Exception:
                    pass
            break

    # Phase 3 context
    phase3 = extract_phase3_context(envelope, prompt)
    
    kb_stats = f"KB: {len(phase3['knowledge_chunks'])} chunks"

    log_agent_action(
        envelope_id, step_id, "worker", agent_id, "START", 
        input_summary=f"Producing: {prompt[:200]} | {kb_stats}",
        metadata={"kb_chunks": len(phase3['knowledge_chunks']), "has_direct_text": phase3['has_knowledge']}
    )

    try:
        llm_cfg = get_llm_config(ctx.get("org_id"), "worker")
        provider = llm_cfg["provider"]
        model_name = llm_cfg["model"]
        api_key = llm_cfg["api_key"]
        base_url = llm_cfg.get("base_url")

        if provider == "anthropic":
            llm = ChatAnthropic(model=model_name, temperature=llm_cfg["temperature"],
                                api_key=api_key, base_url=base_url or None, max_tokens=16384, timeout=300)
        elif provider == "openai":
            llm = ChatOpenAI(model=model_name, temperature=llm_cfg["temperature"],
                             api_key=api_key, base_url=base_url or None, max_tokens=16384)
        elif provider == "gemini":
            llm = ChatGoogleGenerativeAI(model=model_name, temperature=llm_cfg["temperature"], google_api_key=api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        # Enumerate web sources for worker reference
        web_source_index = ""
        if phase3["web_results"]:
            lines = ["\n\nWEB SOURCE INDEX (use these refs in your output):"]
            for i, r in enumerate(phase3["web_results"][:15], 1):
                lines.append(f"[WEB-{i}] {r.get('title', '')} — {r.get('url', '')}")
            web_source_index = "\n".join(lines)

        grounding_note = (
            f"\n\nGROUNDING REQUIREMENTS:"
            f"\n- Cite all facts with [KB-N] or [WEB-N] references"
            f"\n- Knowledge base chunks available: {len(phase3['knowledge_chunks'])}"
            f"\n- Web search results available: {len(phase3['web_results'])}"
            f"\n- Research findings: attached below"
            f"\n- Write INSUFFICIENT DATA if a required claim has no source"
            f"\n- This deliverable must be investor-ready and fully sourced"
        )

        combined_prompt = f"Mission: {prompt}{work_unit_context}"
        human_content = (
            f"{combined_prompt}"
            f"{grounding_note}"
            f"{web_source_index}"
            f"{phase3['instr_block']}"
            f"{plan_context}"
            f"{research_context}"
            f"{phase3['kb_block']}"
            f"{phase3['web_block']}"
            f"\n\nProduce the complete, highly detailed, grounded deliverable."
        )

        messages = [
            SystemMessage(content=WORKER_SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]
        response = llm.invoke(messages)
        raw_text = response.content if isinstance(response.content, str) else str(response.content)

        result = _parse_json_text(raw_text)
        if not result:
            result = {
                "deliverable_summary": "Worker output",
                "deliverable_type": "document",
                "content": raw_text,
                "quality_notes": "Raw output — JSON parse failed",
                "grounding_report": {"kb_chunks_cited": 0, "web_sources_cited": 0, "insufficient_data_items": [], "fabrication_check": "UNKNOWN"},
            }

        result["_grounding_meta"] = {
            "kb_chunks_used": len(phase3["knowledge_chunks"]),
            "web_results_used": len(phase3["web_results"]),
            "web_sources": [r.get("url") for r in phase3["web_results"][:15] if r.get("url")],
            "instruction_profiles_used": phase3["profile_ids"],
            "researcher_grounding_meta": researcher_grounding_meta,
        }

        usage = extract_token_usage(response, model_name)
        duration_ms = int(time.time() * 1000) - start_ms

        log_agent_action(envelope_id, step_id, "worker", agent_id, "COMPLETE",
                         model=model_name,
                         output_summary=result.get("deliverable_summary", "")[:500],
                         duration_ms=duration_ms,
                         metadata={"token_usage": usage})

        print(f"[WORKER] Complete | Tokens: {usage.get('total_tokens', 0)} | KB: {len(phase3['knowledge_chunks'])} | Web: {len(phase3['web_results'])}")
        return {
            "content": json.dumps(result, indent=2),
            "token_usage": usage
        }

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        print(f"[WORKER] ERROR: {e}")
        log_agent_action(envelope_id, step_id, "worker", agent_id, "ERROR",
                         model=model_name, error=str(e), duration_ms=duration_ms)
        raise
