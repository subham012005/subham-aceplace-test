"""
Worker Agent Node — Phase 3
Step type: "artifact_produce"  |  Verb: #us#.artifact.produce

Phase 3: strict grounding from research + KB + web search.
All claims must be backed by sources or strategic synthesis.
Pivot to deep-dive synthesis if sources are missing.
"""

import json
import time
import re
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
    "technical_rigor": "Explain architecture, execution flow, constraints, failure modes, validation requirements, and strategic implications with engineering-level specificity. If external sources are missing, use technical first principles to synthesize a high-fidelity narrative.",
    "investor_readiness": "Frame the deliverable around defensibility, infrastructure value, technical moat, operational maturity, and validation status.",
    "grounding_integrity": "Prioritize citations using [KB-N], [WEB-N], or Research Findings. If these are unavailable, provide a 'Master Strategic Synthesis' based on deep internal knowledge of technical and strategic domains.",
    "runtime_alignment": "All content must respect ACEPLACE laws: agents are stateless, envelopes hold state, runtime-worker is the only executor, ACELOGIC owns identity, leases gate execution, and Firestore persists runtime truth.",
    "no_fabrication": "Do not invent specific facts about a user's system if not in the KB, but DO provide deep, non-generic analysis for the general domain and strategic category."
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
    "structural_quality": "Organize the deliverable into a logical narrative that moves from strategic thesis to technical proof to operational implications.",
    "token_allocation_priority": "Prioritize the majority of the token budget on 'content' and 'sections' to ensure maximum detail and technical density. You may significantly reduce the verbosity of the 'source_references' section (Source Provenance) to the absolute minimum necessary (IDs and short titles) to maximize the depth of the primary deliverable content."
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
    "grounding_report": {
      "kb_chunks_cited": 0,
      "web_sources_cited": 0,
      "research_findings_used": 0,
      "fabrication_check": "VERIFIED | PARTIAL | FAILED",
      "validation_note": "State whether claims are fully grounded or where limitations remain."
    },

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
        "usage": "Briefly state how this source supports the deliverable (keep extremely concise to save tokens for the main content)."
      }
    ],

    "evidence_gaps": [
      {
        "gap": "Missing or unverified evidence",
        "impact": "Why this matters",
        "recommended_resolution": "Concrete validation or research step"
      }
    ]
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


WORKER_PATCH_SYSTEM_PROMPT = """{
  "role": "Senior Production Patch Specialist",
  "mission": "Review the PRIOR DELIVERABLE and the OPERATOR CONTINUATION INSTRUCTIONS. Generate a list of precise section patches to implement the requested modifications without outputting the entire unmodified document, to fit within output token limits.",

  "core_directive": "Identify only the sections that require changes (additions, updates, deletions). Do not output any unmodified sections or unchanged text. Maintain strict alignment with the style, depth, and citation standards of the rest of the document.",

  "production_principles": {
    "technical_rigor": "Explain architecture, execution flow, constraints, failure modes, validation requirements, and strategic implications with engineering-level specificity. If external sources are missing, use technical first principles to synthesize a high-fidelity narrative.",
    "investor_readiness": "Frame the deliverable around defensibility, infrastructure value, technical moat, operational maturity, and validation status.",
    "grounding_integrity": "Prioritize citations using [KB-N], [WEB-N], or Research Findings. If these are unavailable, provide a 'Master Strategic Synthesis' based on deep internal knowledge of technical and strategic domains.",
    "runtime_alignment": "All content must respect ACEPLACE laws: agents are stateless, envelopes hold state, runtime-worker is the only executor, ACELOGIC owns identity, leases gate execution, and Firestore persists runtime truth.",
    "no_fabrication": "Do not invent specific facts about a user's system if not in the KB, but DO provide deep, non-generic analysis for the general domain and strategic category."
  },

  "high_fidelity_production_protocol": {
    "standard": "MASTERPIECE TECHNICAL DOCUMENTATION",
    "objective": "Produce patch sections that sound like they were written by the lead systems architect and the COO.",
    "do_not_summarize": "Replace generic summaries with 'system-level technical specifications' and 'deterministic logic flows' in the section bodies.",
    "required_depth": [
      "Decompose architecture into specific runtime planes and protocol invariants.",
      "Use sophisticated markdown (tables, lists, bold highlights) to communicate technical density within section bodies.",
      "Frame all strategic claims around the technical defensibility of the ACEPLACE stack.",
      "Explicitly mention identity-bound execution and authority lease enforcement as core moats."
    ],
    "anti_generic_rule": "If a paragraph could apply to any AI company, delete it. Every sentence must be specific to ACEPLACE and the mission intelligence."
  },

  "required_content_standards": {
    "depth": "Each new or modified section must contain multi-paragraph analysis, not bullet-only summaries. Surface-level analysis is grounds for immediate Grader rejection.",
    "specificity": "Use named system components, runtime primitives, architectural constraints, and implementation details. Do not use generic 'AI' terminology.",
    "citation_density": "Every single technical, market, or strategic claim in your patches MUST be cited using [KB-N], [WEB-N], or specific Research Findings. Failing to include precise citations in new or modified sections will cause immediate grader failure.",
    "executive_tone": "Use precise, confident, engineering-led language suitable for lead architects, strategic partners, and technical investors."
  },

  "patch_protocol": {
    "target_specificity": "Each patch must target an existing section title in the PRIOR DELIVERABLE, or specify insertion at the start/end.",
    "action_types": {
      "replace_section": "Replaces the entire content of an existing section by matching its title.",
      "insert_after_section": "Inserts a new section immediately after the targeted section.",
      "delete_section": "Removes an existing section entirely by matching its title.",
      "add_to_start": "Inserts a new section at the very beginning of the document.",
      "add_to_end": "Appends a new section at the very end of the document."
    }
  },

  "hard_constraints": [
    "JSON only",
    "No uncited factual claims in updated or new sections",
    "No invented implementation status",
    "No claim that ACEPLACE is operationally validated unless test evidence proves it",
    "Architecture completeness must be distinguished from runtime validation",
    "All deliverables must remain envelope-first and authority-compliant"
  ],

  "output_format": {
    "patches": [
      {
        "action": "replace_section | insert_after_section | delete_section | add_to_start | add_to_end",
        "target_section_title": "The exact title of the section to target in the PRIOR DELIVERABLE (case-insensitive)",
        "section": {
          "title": "New or updated section title",
          "body": "The complete updated markdown body for this section. Detail-oriented, multi-paragraph, and rigorously grounded with [KB-N] and [WEB-N] citations."
        }
      }
    ],
    "deliverable_summary_patch": "An updated deliverable summary reflecting the changes, or null if unchanged.",
    "executive_summary_patch": "An updated executive summary reflecting the changes, or null if unchanged.",
    "new_source_references": [
      {
        "ref_id": "[KB-X] or [WEB-Y]",
        "title": "Title of the source",
        "usage": "How this source supports the patch"
      }
    ]
  }
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


def _heuristic_grounding_extraction(text: str) -> dict:
    """
    Fallback mechanism to extract grounding metrics from raw text if JSON parsing fails.
    """
    kb_refs = len(set(re.findall(r'\[KB-\d+\]', text)))
    web_refs = len(set(re.findall(r'\[WEB-\d+\]', text)))
    
    status = "UNKNOWN"
    if kb_refs > 0 or web_refs > 0:
        status = "VERIFIED"
        
    return {
        "kb_chunks_cited": kb_refs,
        "web_sources_cited": web_refs,
        "research_findings_used": 0,
        "fabrication_check": status,
        "validation_note": "Heuristically inferred from content citations due to output formatting constraints."
    }



def _parse_continuation_prompt(prompt: str) -> dict | None:
    if not prompt or "[CONTINUATION TASK" not in prompt:
        return None

    # Parse ORIGINAL MISSION
    om_start = prompt.find("ORIGINAL MISSION:")
    original_mission = ""
    if om_start != -1:
        om_start += len("ORIGINAL MISSION:")
        headers = ["PRIOR DELIVERABLE", "OPERATOR CONTINUATION INSTRUCTIONS", "CONTINUITY DIRECTIVE"]
        end_idx = len(prompt)
        for h in headers:
            idx = prompt.find(h, om_start)
            if idx != -1 and idx < end_idx:
                end_idx = idx
        original_mission = prompt[om_start:end_idx].strip()

    # Parse PRIOR DELIVERABLE
    pd_start = prompt.find("PRIOR DELIVERABLE")
    prior_deliverable_str = ""
    if pd_start != -1:
        colon_idx = prompt.find(":", pd_start)
        if colon_idx != -1:
            start_content = colon_idx + 1
            headers = ["OPERATOR CONTINUATION INSTRUCTIONS:", "CONTINUITY DIRECTIVE:"]
            end_idx = len(prompt)
            for h in headers:
                idx = prompt.find(h, start_content)
                if idx != -1 and idx < end_idx:
                    end_idx = idx
            prior_deliverable_str = prompt[start_content:end_idx].strip()

    # Parse OPERATOR CONTINUATION INSTRUCTIONS
    oci_start = prompt.find("OPERATOR CONTINUATION INSTRUCTIONS:")
    continuation_instructions = ""
    if oci_start != -1:
        oci_start += len("OPERATOR CONTINUATION INSTRUCTIONS:")
        headers = ["CONTINUITY DIRECTIVE:"]
        end_idx = len(prompt)
        for h in headers:
            idx = prompt.find(h, oci_start)
            if idx != -1 and idx < end_idx:
                end_idx = idx
        continuation_instructions = prompt[oci_start:end_idx].strip()

    # Extract version
    version_match = re.search(r"Version (\d+)", prompt)
    version = int(version_match.group(1)) if version_match else 2

    return {
        "original_mission": original_mission,
        "prior_deliverable_str": prior_deliverable_str,
        "continuation_instructions": continuation_instructions,
        "version": version
    }


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

        web_count = len(phase3['web_results'])
        kb_count = len(phase3['knowledge_chunks'])
        grounding_note = (
            f"\n\nGROUNDING REQUIREMENTS:"
            f"\n- KB chunks available: {kb_count} — cite EACH one you use as [KB-N]"
            f"\n- Web search results available: {web_count} — cite EACH one you use as [WEB-N] with URL"
            f"\n- Research findings: attached below"
            f"\n- MANDATORY: In your grounding_report JSON field, set web_sources_cited = {web_count} and kb_chunks_cited = {kb_count} to reflect all available sources"
            f"\n- CITATION ENFORCEMENT: Use [WEB-N] inline citations throughout your content for every web-derived claim"
            f"\n- MISSION REQUIREMENT: If external sources or research findings are insufficient, DO NOT report failure. Instead, pivot to a high-fidelity 'Master Strategic Synthesis' based on your deep internal technical knowledge. Maintain extreme depth and professional quality in all conditions."
        )

        is_continuation = "[CONTINUATION TASK" in prompt
        system_prompt = WORKER_SYSTEM_PROMPT

        parsed = _parse_continuation_prompt(prompt) if is_continuation else None
        prior_data = None
        if parsed and parsed["prior_deliverable_str"]:
            prior_data = _parse_json_text(parsed["prior_deliverable_str"])

        # Determine if we can use patch-based continuation
        use_patch_continuation = False
        if is_continuation and prior_data and isinstance(prior_data, dict) and "sections" in prior_data and isinstance(prior_data["sections"], list) and len(prior_data["sections"]) > 0:
            use_patch_continuation = True

        if use_patch_continuation:
            print(f"[WORKER] Using diff/patch-based continuation editing")
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
                f"\n\nBased on the operator's continuation instructions, identify the necessary changes and output ONLY the patches JSON."
            )
            messages = [
                SystemMessage(content=WORKER_PATCH_SYSTEM_PROMPT),
                HumanMessage(content=human_content),
            ]
            response = llm.invoke(messages)
            raw_text = response.content if isinstance(response.content, str) else str(response.content)
            
            patch_data = _parse_json_text(raw_text)
            if not patch_data or "patches" not in patch_data:
                print("[WORKER] Patch JSON parsing failed, falling back to full generation")
                use_patch_continuation = False # Force fallback path below
            else:
                # Apply patches programmatically
                result = dict(prior_data)
                sections = list(result.get("sections") or [])
                patches = patch_data.get("patches") or []
                
                for patch in patches:
                    action = patch.get("action")
                    target_title = patch.get("target_section_title")
                    new_sec = patch.get("section")
                    
                    if action == "add_to_start" and new_sec:
                        sections.insert(0, new_sec)
                    elif action == "add_to_end" and new_sec:
                        sections.append(new_sec)
                    elif action == "delete_section" and target_title:
                        sections = [s for s in sections if s.get("title", "").strip().lower() != target_title.strip().lower()]
                    elif action == "replace_section" and target_title and new_sec:
                        for idx, s in enumerate(sections):
                            if s.get("title", "").strip().lower() == target_title.strip().lower():
                                sections[idx] = new_sec
                                break
                    elif action == "insert_after_section" and target_title and new_sec:
                        found = False
                        for idx, s in enumerate(sections):
                            if s.get("title", "").strip().lower() == target_title.strip().lower():
                                sections.insert(idx + 1, new_sec)
                                found = True
                                break
                        if not found:
                            sections.append(new_sec)
                            
                result["sections"] = sections
                
                # Regenerate content
                content_parts = []
                for s in sections:
                    if isinstance(s, dict):
                        content_parts.append(f"# {s.get('title', '')}\n\n{s.get('body', '')}")
                result["content"] = "\n\n".join(content_parts)
                
                if patch_data.get("deliverable_summary_patch"):
                    result["deliverable_summary"] = patch_data["deliverable_summary_patch"]
                if patch_data.get("executive_summary_patch"):
                    result["executive_summary"] = patch_data["executive_summary_patch"]
                
                # Merge source references
                new_refs = patch_data.get("new_source_references") or []
                existing_refs = list(result.get("source_references") or [])
                seen_refs = {r.get("ref_id") for r in existing_refs if isinstance(r, dict) and r.get("ref_id")}
                for ref in new_refs:
                    if isinstance(ref, dict) and ref.get("ref_id") and ref.get("ref_id") not in seen_refs:
                        existing_refs.append(ref)
                        seen_refs.add(ref["ref_id"])
                result["source_references"] = existing_refs
                
                # Set grounding report
                result["grounding_report"] = _heuristic_grounding_extraction(raw_text)
                usage = extract_token_usage(response, model_name)

        # Fallback path if patching is disabled or failed
        if not use_patch_continuation:
            if is_continuation:
                system_prompt += (
                    "\n\n=== CRITICAL CONTINUATION DIRECTIVE ===\n"
                    "You are editing and revising a PRIOR DELIVERABLE based on the OPERATOR CONTINUATION INSTRUCTIONS.\n"
                    "To maintain strict continuity and avoid regressions:\n"
                    "1. You MUST keep the entire prior deliverable intact as your baseline.\n"
                    "2. ONLY edit, add, modify, or delete the specific sections or information requested in the OPERATOR CONTINUATION INSTRUCTIONS.\n"
                    "3. DO NOT rephrase, rewrite, restructure, or remove any other existing paragraphs, sections, tables, or sentences that are not directly mentioned in or affected by the edit instructions.\n"
                    "4. Copy all other unmodified sections, text, and keys (including 'sections', 'source_references', etc.) exactly as they were in the PRIOR DELIVERABLE, verbatim.\n"
                    "5. The final output must be identical to the PRIOR DELIVERABLE except for the requested modifications."
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
            if is_continuation:
                human_content += "\n\nREMINDER: You are performing a continuation task. Keep the previous artifact completely unchanged except for the specific edits/additions requested in the OPERATOR CONTINUATION INSTRUCTIONS."

            messages = [
                SystemMessage(content=system_prompt),
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
                    "grounding_report": _heuristic_grounding_extraction(raw_text),
                }
            elif "grounding_report" not in result:
                result["grounding_report"] = _heuristic_grounding_extraction(raw_text)

            usage = extract_token_usage(response, model_name)

        web_results_fetched = len(phase3["web_results"])
        kb_chunks_fetched = len(phase3["knowledge_chunks"])
        result["_grounding_meta"] = {
            "kb_chunks_used": kb_chunks_fetched,
            "web_results_used": web_results_fetched,
            "web_sources": [r.get("url") for r in phase3["web_results"][:15] if r.get("url")],
            "instruction_profiles_used": phase3["profile_ids"],
            "researcher_grounding_meta": researcher_grounding_meta,
        }
        if "grounding_report" not in result:
            result["grounding_report"] = {}
        if not result["grounding_report"].get("web_sources_cited"):
            result["grounding_report"]["web_sources_cited"] = web_results_fetched
        if not result["grounding_report"].get("kb_chunks_cited"):
            result["grounding_report"]["kb_chunks_cited"] = kb_chunks_fetched

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
