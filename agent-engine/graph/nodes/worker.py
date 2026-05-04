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

  "production_principles": {
    "technical_rigor": "Explain architecture, execution flow, constraints, failure modes, validation requirements, and strategic implications with engineering-level specificity.",
    "investor_readiness": "Frame the deliverable around defensibility, infrastructure value, technical moat, operational maturity, and validation status.",
    "grounding_integrity": "Every factual claim must be cited using [KB-N], [WEB-N], or validated Research Finding references.",
    "runtime_alignment": "All content must respect ACEPLACE laws: agents are stateless, envelopes hold state, runtime-worker is the only executor, ACELOGIC owns identity, leases gate execution, and Firestore persists runtime truth.",
    "no_fabrication": "If evidence is missing, state the limitation clearly instead of inventing details."
  },

  "high_fidelity_production_protocol": {
    "standard": "MASTERPIECE TECHNICAL DOCUMENTATION",
    "objective": "Produce a deliverable that sounds like it was written by the lead systems architect and the COO.",
    "do_not_summarize": "Replace generic summaries with 'system-level technical specifications' and 'deterministic logic flows'.",
    "required_depth": [
      "Decompose architecture into specific runtime planes and protocol invariants.",
      "Use sophisticated markdown (tables, lists, bold highlights) to communicate technical density.",
      "Frame all strategic claims around the technical defensibility of the ACEPLACE stack.",
      "Explicitly mention identity-bound execution and authority lease enforcement as core moats."
    ],
    "anti_generic_rule": "If a paragraph could apply to any AI company, delete it. Every sentence must be specific to ACEPLACE and the mission intelligence."
  },

  "required_content_standards": {
    "massive_volume_requirement": "For strategic/technical jobs, produce 3000-5000+ words of dense, multi-layer analysis. Bullet points are only allowed for organization; every point MUST be followed by multi-paragraph technical justification.",
    "depth": "Each major section must contain multi-paragraph analysis, not bullet-only summaries. Surface-level analysis is grounds for immediate Grader rejection.",
    "specificity": "Use named system components, runtime primitives, architectural constraints, and implementation details. Do not use generic 'AI' terminology.",
    "citation_density": "Every single technical, market, or strategic claim MUST be cited using [KB-N], [WEB-N], or specific Research Findings.",
    "executive_tone": "Use precise, confident, engineering-led language suitable for lead architects, strategic partners, and technical investors.",
    "structural_quality": "Organize the deliverable into a logical narrative that moves from strategic thesis to technical proof to operational implications."
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
    ],
    "must_not_include": [
      "Unverified runtime validation claims",
      "Agent-to-agent orchestration assumptions",
      "Generic AI buzzwords without technical explanation",
      "Unsupported market claims",
      "Placeholder citations",
      "Speculative implementation details"
    ]
  },

  "output_format": {
    "deliverable_summary": "Executive summary of the deliverable's key conclusions, technical thesis, and strategic importance.",

    "content": "Complete long-form markdown deliverable with polished headings, rigorous analysis, and citation-backed claims.",

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

    "evidence_gaps": [
      {
        "gap": "Missing or unverified evidence",
        "impact": "Why this matters",
        "recommended_resolution": "Concrete validation or research step"
      }
    ],

    "grounding_report": {
      "kb_chunks_cited": 0,
      "web_sources_cited": 0,
      "research_findings_used": 0,
      "fabrication_check": "VERIFIED | PARTIAL | FAILED",
      "validation_note": "State whether claims are fully grounded or where limitations remain."
    }
  },

  "hard_constraints": [
    "JSON only",
    "No uncited factual claims",
    "No invented implementation status",
    "No claim that ACEPLACE is operationally validated unless test evidence proves it",
    "Architecture completeness must be distinguished from runtime validation",
    "All deliverables must remain envelope-first and authority-compliant"
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

    # Load research from previous step
    research_context = ""
    work_unit_context = ""
    researcher_grounding_meta = {}

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

    # Phase 3 context — re-fetch for worker
    envelope = get_envelope(envelope_id) or {}
    phase3 = extract_phase3_context(envelope, prompt)

    kb_stats = f"KB: {len(phase3['knowledge_chunks'])} chunks"
    if phase3['has_knowledge']:
        kb_stats += " + Direct Text"

    log_agent_action(
        envelope_id, step_id, "worker", agent_id, "START", 
        input_summary=f"Producing: {prompt[:200]} | {kb_stats}",
        metadata={"kb_chunks": len(phase3['knowledge_chunks']), "has_direct_text": phase3['has_knowledge']}
    )

    log_phase3_usage(envelope_id, step_id, agent_id, fingerprint, phase3)

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

        kb_source_index = ""
        if phase3["knowledge_chunks"]:
            lines = ["\n\nKB SOURCE INDEX:"]
            for i, c in enumerate(phase3["knowledge_chunks"][:8], 1):
                lines.append(f"[KB-{i}] Collection: {c['collection_id']} (relevance: {c['score']:.2f})")
            kb_source_index = "\n".join(lines)

        grounding_note = (
            f"\n\nGROUNDING REQUIREMENTS:"
            f"\n- Cite all facts with [WEB-N] or [KB-N] references"
            f"\n- KB chunks available: {len(phase3['knowledge_chunks'])}"
            f"\n- Web search results available: {len(phase3['web_results'])}"
            f"\n- Research findings: attached below"
            f"\n- Write INSUFFICIENT DATA if a required claim has no source"
            f"\n- This deliverable must be investor-ready and fully sourced"
        )

        combined_prompt = f"Mission: {prompt}{work_unit_context}"
        human_content = (
            f"{combined_prompt}"
            f"{grounding_note}"
            f"{kb_source_index}"
            f"{web_source_index}"
            f"{phase3['instr_block']}"
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
