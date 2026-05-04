"""
Researcher Agent Node — Phase 3
Step type: "assign"  |  Verb: #us#.task.assign

Phase 3: deep research via web search + KB chunks + instruction profiles.
Outputs INSUFFICIENT DATA when sources don't cover a topic.
"""

import json
import time
from services.firestore import get_artifact, log_agent_action, get_envelope
from services.token_service import extract_token_usage, aggregate_tokens
from services.knowledge_service import (
    extract_phase3_context, 
    log_phase3_usage, 
    web_search, 
    retrieve_knowledge_chunks, 
    build_knowledge_context_block, 
    build_web_search_context_block
)
from provider_router import get_llm_config
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage


RESEARCHER_SYSTEM_PROMPT = """You are the Senior Intelligence Researcher. Your objective is to perform exhaustive technical and strategic intelligence gathering from the Knowledge Base (KB) and real-time Web Search.

{
  "role": "Senior Intelligence Researcher",
  "mission": "Perform exhaustive technical and strategic intelligence gathering from the Knowledge Base and real-time Web Intelligence. Produce a citation-dense research dossier that becomes the factual foundation for downstream Worker artifacts.",

  "operating_principles": {
    "depth": "Do not summarize prematurely. Extract technical mechanisms, architecture decisions, constraints, historical context, implementation details, risks, and strategic implications.",
    "grounding": "Every factual claim must be traceable to a KB citation or Web citation.",
    "accuracy": "Do not invent missing information. Mark unknowns as research gaps.",
    "cross_correlation": "Compare KB claims against current web evidence where external validation is relevant.",
    "runtime_alignment": "Research must respect ACEPLACE laws: agents are stateless, envelopes hold state, runtime-worker executes, identity comes from ACELOGIC, leases gate execution, and artifacts/traces persist."
  },

  "intelligence_extraction_protocol": {
    "priority": "HIGH-FIDELITY TECHNICAL DISCOVERY",
    "massive_extraction_requirement": "Mandatory extraction of 15-20+ discrete technical or strategic findings per research unit. Each finding must be a dense 2-3 sentence 'Intelligence Artifact' detailing specific mechanisms, architecture rules, or strategic data points. Bullet-point summaries are a mission failure.",
    "do_not_summarize": "Surface-level summaries are strictly forbidden. You are an extraction engine, not a summarizer.",
    "look_for": [
      "Non-public architecture patterns and system invariants",
      "State machine transition rules and authority lease logic",
      "Deterministic execution boundaries and identity verification flows",
      "Evidence of infrastructure defensibility and technical moats",
      "Failure modes and quarantine trigger conditions documented in the KB",
      "Exact schema definitions, protocol names, and system-specific primitives"
    ],
    "anti_fluff_rule": "Avoid generic 'AI industry' talk. Focus on the specific system described in the Knowledge Base."
  },

  "source_protocol": {
    "knowledge_base": {
      "required": true,
      "citation_format": "[KB-N]",
      "use_for": [
        "ACEPLACE architecture",
        "runtime invariants",
        "execution envelope model",
        "authority lease rules",
        "identity model",
        "Firestore persistence",
        "#us# protocol",
        "task graph execution"
      ]
    },
    "web_search": {
      "required": true,
      "citation_format": "[WEB-N]",
      "use_for": [
        "current market context",
        "competitor intelligence",
        "technical ecosystem validation",
        "industry standards",
        "recent infrastructure trends",
        "investor-facing external context"
      ]
    }
  },

  "research_tasks": [
    {
      "area": "Technical Architecture Intelligence",
      "objective": "Extract all relevant system architecture details, including kernels, runtime planes, envelope structure, authority leases, identity verification, task graphs, persistence, artifact rules, and trace requirements.",
      "output": "Dense technical findings suitable for direct use in a whitepaper or investor report."
    },
    {
      "area": "Operational Constraint Mapping",
      "objective": "Identify non-negotiable runtime laws, failure conditions, quarantine triggers, validation requirements, and execution boundaries.",
      "output": "Constraint matrix with implications for implementation and investor claims."
    },
    {
      "area": "Strategic Market Context",
      "objective": "Use web intelligence to compare ACEPLACE against relevant categories such as agent runtimes, workflow engines, orchestration systems, deterministic execution systems, and AI infrastructure platforms.",
      "output": "Externally grounded positioning analysis."
    },
    {
      "area": "Risk and Evidence Gaps",
      "objective": "Identify missing proof points, unvalidated assumptions, incomplete implementation evidence, and areas requiring operator testing.",
      "output": "Research gap log with severity and recommended validation path."
    }
  ],

  "output_format": {
    "research_summary": "Executive synthesis of the complete intelligence picture.",
    "key_findings": [
      {
        "title": "Specific technical or strategic finding",
        "detail": "Context-rich explanation with technical evidence, operational nuance, and strategic implication.",
        "sources": ["[KB-1]", "[WEB-1]"],
        "confidence": "high | medium | low"
      }
    ],
    "technical_inventory": {
      "runtime_components": [],
      "identity_components": [],
      "authority_components": [],
      "persistence_components": [],
      "protocol_components": [],
      "artifact_components": []
    },
    "risk_register": [
      {
        "risk": "Specific risk or uncertainty",
        "impact": "Strategic or technical impact",
        "evidence_status": "confirmed | partially confirmed | missing",
        "recommended_validation": "Concrete next validation step"
      }
    ],
    "recommended_approach_for_worker": "Clear guidance for how the Production Worker should synthesize the final deliverable.",
    "grounding_sources": {
      "kb_chunks_used": 0,
      "web_sources_used": 0
    }
  },

  "hard_constraints": [
    "JSON only",
    "No speculative claims",
    "No uncited factual assertions",
    "No agent-to-agent orchestration assumptions",
    "No claims of runtime validation unless logs or test evidence prove it",
    "Research must distinguish architecture completeness from operational proof"
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


from services.agent_tools import get_research_tools
from langchain_core.utils.function_calling import convert_to_openai_tool

def execute(ctx: dict) -> dict:
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_researcher")
    fingerprint = ctx.get("identity_fingerprint", "")
    start_ms = int(time.time() * 1000)
    model_name = "unknown"
    input_ref = ctx.get("input_ref")

    print(f"[RESEARCHER] Deep research for envelope {envelope_id}")

    # Load COO plan
    plan_context = ""
    recommended_queries = []
    if input_ref:
        try:
            artifact = get_artifact(input_ref)
            if artifact:
                plan_content = artifact.get("artifact_content", "")
                plan_context = f"\n\nCOO Execution Plan:\n{plan_content}"
                try:
                    plan_data = json.loads(plan_content)
                    recommended_queries = plan_data.get("web_search_queries_recommended", [])
                except Exception:
                    pass
        except Exception:
            pass

    # Phase 3 context
    envelope = get_envelope(envelope_id) or {}
    phase3 = extract_phase3_context(envelope, prompt)

    kb_stats = f"KB: {len(phase3['knowledge_chunks'])} chunks"
    if phase3['has_knowledge']:
        kb_stats += " + Direct Text"

    log_agent_action(
        envelope_id, step_id, "researcher", agent_id, "START", 
        input_summary=f"Researching: {prompt[:200]} | {kb_stats}",
        metadata={"kb_chunks": len(phase3['knowledge_chunks']), "has_direct_text": phase3['has_knowledge']}
    )
    
    log_phase3_usage(envelope_id, step_id, agent_id, fingerprint, phase3)

    try:
        llm_cfg = get_llm_config(ctx.get("org_id"), "researcher")
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

        # Tools integration
        tools = get_research_tools()
        # Bind tools to LLM
        if provider in ["openai", "anthropic"]:
             llm_with_tools = llm.bind_tools(tools)
        else:
             llm_with_tools = llm # Gemini tool binding via LangChain can be tricky, stick to prompt for now

        grounding_note = (
            f"\n\nGROUNDING SOURCES (ALREADY PRE-FETCHED):\n"
            f"- KB chunks: {len(phase3['knowledge_chunks'])} loaded — cite as [KB-N]\n"
            f"- Web results: {len(phase3['web_results'])} loaded — cite as [WEB-N] with URL\n"
            f"If these sources are insufficient, you can use your SEARCH_THE_WEB or QUERY_KNOWLEDGE_BASE tools."
        )

        human_content = (
            f"Research Task:\n\n{prompt}"
            f"{grounding_note}"
            f"{phase3['instr_block']}"
            f"{plan_context}"
            f"{phase3['kb_block']}"
            f"{phase3['web_block']}"
            f"\n\nProvide comprehensive research findings with full source citations. Return ONLY valid JSON."
        )

        # Simple tool loop (1 iteration for now to keep it deterministic)
        # Inject tool context into system prompt
        tool_context = f"\n\nYOUR CONTEXT (for research tools):\n- user_id: {envelope.get('user_id', 'default')}\n- collection_ids: {phase3.get('collection_ids', [])}"
        
        messages = [SystemMessage(content=RESEARCHER_SYSTEM_PROMPT + tool_context), HumanMessage(content=human_content)]
        # Track total usage across potential multi-calls
        total_usage = {
            "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost": 0.0
        }

        response = llm_with_tools.invoke(messages)
        total_usage = aggregate_tokens(total_usage, extract_token_usage(response, model_name))
        
        # Handle tool calls if any
        if hasattr(response, "tool_calls") and response.tool_calls:
            from langchain_core.messages import ToolMessage
            messages.append(response)
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                # Execute tool
                if tool_name == "search_the_web":
                    tool_result = web_search(tool_args["query"])
                    messages.append(ToolMessage(tool_call_id=tool_call["id"], content=build_web_search_context_block(tool_result)))
                elif tool_name == "query_knowledge_base":
                    tool_result = retrieve_knowledge_chunks(phase3["user_id"], phase3["collection_ids"], tool_args["query"])
                    messages.append(ToolMessage(tool_call_id=tool_call["id"], content=build_knowledge_context_block(tool_result)))
            
            # Get final response after tools
            response = llm.invoke(messages)
            total_usage = aggregate_tokens(total_usage, extract_token_usage(response, model_name))

        raw_text = response.content if isinstance(response.content, str) else str(response.content)
        result = _parse_json_text(raw_text)
        
        if not result:
            result = {
                "research_summary": raw_text[:3000],
                "key_findings": [{"title": "Research Output", "detail": raw_text[:2000], "sources": [], "confidence": "medium"}],
                "data_points": {},
                "recommended_approach": "See research_summary",
                "grounding_sources": {
                    "kb_chunks_used": len(phase3["knowledge_chunks"]),
                    "web_sources_used": len(phase3["web_results"]),
                    "web_urls": [r.get("url") for r in phase3["web_results"][:10] if r.get("url")],
                    "insufficient_data_fields": [],
                },
                "confidence_level": "medium",
            }

        result["_grounding_meta"] = {
            "kb_chunks_used": len(phase3["knowledge_chunks"]),
            "web_results_used": len(phase3["web_results"]),
            "web_sources": [r.get("url") for r in phase3["web_results"][:15] if r.get("url")],
            "web_queries": list({r.get("query", "") for r in phase3["web_results"] if r.get("query")}),
            "instruction_profiles_used": phase3["profile_ids"],
            "collection_ids": phase3["collection_ids"],
        }

        usage = total_usage
        duration_ms = int(time.time() * 1000) - start_ms

        log_agent_action(envelope_id, step_id, "researcher", agent_id, "COMPLETE",
                         model=model_name,
                         output_summary=result.get("research_summary", "")[:500],
                         duration_ms=duration_ms,
                         metadata={"token_usage": usage})

        print(f"[RESEARCHER] Complete | Tokens: {usage.get('total_tokens', 0)} | KB: {len(phase3['knowledge_chunks'])} | Web: {len(phase3['web_results'])}")
        return {
            "content": json.dumps(result, indent=2),
            "token_usage": usage
        }

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        print(f"[RESEARCHER] ERROR: {e}")
        log_agent_action(envelope_id, step_id, "researcher", agent_id, "ERROR",
                         model=model_name, error=str(e), duration_ms=duration_ms)
        raise

