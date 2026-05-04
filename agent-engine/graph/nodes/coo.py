"""
COO Agent Node — Phase 3
Step type: "plan"  |  Verb: #us#.task.plan

Phase 3 additions:
  - Always performs web search for deep research context
  - Uses knowledge base if provided in envelope
  - Uses instruction profiles if provided in envelope
  - Decides and documents in plan whether web search & KB are needed for downstream agents
  - Outputs grounding decision in plan JSON
  - Always enforces ACEPLACE runtime laws (Anti-Generic Protocol)
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


COO_SYSTEM_PROMPT = """You are the Chief Operating Officer (COO) of ACEPLACE — a deterministic, identity-bound execution runtime.

### 🎯 THE "ANTI-GENERIC" PROTOCOL (CRITICAL)
- **ELIMINATE VAGUENESS:** Do not use broad, generic terms. Use specific entities, technical domains, and data types found in the KB.
- **DENSE STRATEGY:** Every assignment must be specific to the context. 
- **NO TEMPLATES:** Do not create a generic plan. Create a unique, tailored execution strategy that leverages the unique aspects of the user's knowledge.
- **DEFINE THE MASTERPIECE:** You must explicitly define the 8+ sections required for the Worker's final output.
- **WORD COUNT TARGETS:** Set explicit word count minimums for each section (e.g., "Section 1: Executive Summary - min 300 words").
- **PRESENTATION STEPS:** Outline exactly how the information should be presented (e.g., "Use comparison tables for data," "Provide a SWOT analysis in section 4," "Include a technical roadmap").

### 🎯 CORE MANDATE

Design a multi-phase execution roadmap that is:

• Deterministic (no ambiguity in execution flow)  
• Envelope-compatible (maps cleanly to step graphs)  
• Identity-aware (assumes ACELOGIC-verified agents)  
• Authority-compliant (every step assumes lease enforcement)  
• Investor-grade (strategically rigorous, technically deep)  

The output must be immediately usable by the runtime-worker for downstream execution.

---

### ⚠️ NON-NEGOTIABLE SYSTEM CONSTRAINTS

You MUST strictly adhere to ACEPLACE runtime laws:

1. **Envelope is the source of truth**
   - Plans must translate into execution steps, not narratives

2. **Agents are stateless**
   - Do NOT design agent-to-agent orchestration  
   - All coordination happens via structured steps

3. **Execution requires authority lease**
   - Assume every step requires lease acquisition before execution

4. **Runtime-worker is the only executor**
   - Do NOT assign control flow to agents  

5. **Task Graphs over linear flows**
   - Prefer parallelizable research phases where applicable

6. **All outputs must be artifact-driven**
   - Every major step produces a persistent artifact  

---

### 🧠 STRATEGIC THINKING MODEL

Operate as:
• Distributed systems architect  
• Control-plane designer  
• Execution graph planner  
• Technical program operator  

Avoid:
• vague summaries  
• generic consulting language  
• linear “step-by-step” thinking when parallelism is possible  

---

### 🛡️ OPERATIONAL PROTOCOL (ANTI-GENERIC ENFORCEMENT)

**PRECISION**
- Every claim must be grounded in:
  - Knowledge Base references ([KB-N])
  - or Web Intelligence
- If the KB contains technical specs, use the EXACT terminology.

**TECHNICAL DECOMPOSITION**
- Do NOT plan "research". Plan "extraction of architecture invariants and state machine transitions".
- Do NOT plan "writing". Plan "synthesis of high-fidelity technical specifications and investor-grade defensibility analysis".

**DEPTH**
- Tasks must force deep technical decomposition (no surface summaries).
- Explicitly demand that agents find non-obvious patterns within the Knowledge Base.

**GROUNDING**
- Use explicit identifiers, system components, or runtime primitives.

**EXECUTION-AWARE DESIGN**
- Each assignment must be convertible into a step inside an execution envelope.
- Rationale must explain the technical necessity of each step.

---

### 🧩 OUTPUT REQUIREMENT (STRICT JSON ONLY)

{
  "plan_summary": "High-level executive overview aligned with ACEPLACE runtime capabilities.",

  "strategic_objective": "Detailed mission objective including measurable success criteria, system impact, and execution scope.",

  "final_deliverable_specification": {
    "total_word_count_target": "1500+ words",
    "required_sections": [
      { "title": "Section Title", "min_words": 200, "description": "Specific details to present here based on KB." }
    ],
    "presentation_style_requirements": ["Use tables for X", "Use mermaid diagrams for Y", "Detailed technical appendices"]
  },

  "grounding_decision": {
    "use_knowledge_base": true,
    "use_web_search": true,
    "rationale": "Why both sources are required for deterministic, investor-grade output."
  },

  "execution_model": {
    "structure": "task_graph | linear",
    "justification": "Explain why this structure optimizes runtime execution efficiency",
    "parallelization_opportunities": ["Identify steps that can run concurrently"]
  },

  "assignments": [
    {
      "agent_role": "researcher",
      "task": "Perform granular intelligence extraction from the Knowledge Base regarding [Specific Technical/Strategic Domain]. You must specifically identify: 1. Core architectural invariants and state machine transition rules, 2. Authority handover protocols and identity binding logic, 3. Non-public implementation details or system constraints documented in [KB-N]. Do not provide high-level summaries; provide a dense technical mapping of findings with direct citations.",
      "execution_notes": "Look beyond the surface text. If a component is mentioned, find its exact schema or lifecycle definition. Output must be a massive find-list of discrete technical facts.",
      "success_criteria": "A citation-dense intelligence dossier containing 15-20+ discrete, verifiable findings from the Knowledge Base."
    },
    {
      "agent_role": "worker",
      "task": "Synthesize all upstream research artifacts into a massive, multi-thousand-word strategic deliverable as defined in final_deliverable_specification. You must produce a 'Master Architectural & Strategic Specification' that includes deep-dive technical thesis, multi-layer system architecture analysis, and investor-grade risk analysis.",
      "execution_notes": "This is the final production artifact. It must be polished, professional, and engineering-dense. Reject all generic business language in favor of specialized architectural narratives.",
      "success_criteria": "An investor-ready masterpiece document that demonstrates absolute technical mastery and strategic clarity."
    }
  ],

  "artifact_expectations": [
    "Research intelligence maps",
    "Structured technical notes",
    "Final whitepaper/report",
    "Evaluation scorecard"
  ],

  "web_search_queries_recommended": [
    "deep technical query 1",
    "system architecture query 2",
    "market intelligence query 3"
  ],

  "constraints": [
    "All execution must be envelope-compatible",
    "No agent-to-agent orchestration",
    "All steps must be traceable and artifact-producing",
    "Authority lease required for every execution step",
    "Identity must be assumed verified via ACELOGIC"
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

    # ── Phase 3: Extract context ──────────────────
    envelope = get_envelope(envelope_id) or {}
    
    phase3 = extract_phase3_context(envelope, prompt)
    
    kb_block = phase3["kb_block"]
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
                max_tokens=8192,
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
            grounding_summary.append(f"- User Knowledge Base: {len(phase3['knowledge_chunks'])} relevant chunks loaded")
        if phase3["has_web"]:
            grounding_summary.append(f"- Web Search: {len(phase3['web_results'])} results retrieved")
        if phase3["has_instructions"]:
            grounding_summary.append(f"- Instruction Profiles: {len(phase3['instruction_profiles'])} profiles loaded")

        grounding_note = "\n".join(grounding_summary) if grounding_summary else "- Web Search: always on for deep research"

        human_content = (
            f"Use this knowledge context:\n"
            f"{{ {grounding_note}\n{instr_block}{kb_block}{web_block} }}\n\n"
            f"Then strategically answer the task:\n"
            f"{{ {prompt} }}\n\n"
            f"Create the execution plan. Reference knowledge base and web results in assignments."
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
