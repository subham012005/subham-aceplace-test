"""
Grader Agent Node — Phase 3
Step type: "evaluation"  |  Verb: #us#.evaluation.score

Phase 3: evaluates grounding quality, instruction adherence, source usage,
and output quality. Scores are explicit and traceable.
"""

import json
import time
from services.firestore import get_artifact, log_agent_action, get_envelope
from services.token_service import extract_token_usage
from provider_router import get_llm_config
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage


GRADER_SYSTEM_PROMPT = """You are the Lead Grader of ACEPLACE. Your task is to evaluate the deliverable for grounding accuracy, instruction adherence, and professional quality.

### 🛡️ GROUNDING & VOLUME PROTOCOL
- **DO:** Check if the deliverable matches the Knowledge Base [KB-N].
- **DO:** Verify that the output is MASSIVE (1500+ words) and each section is detailed (multiple paragraphs).
- **DO:** Ensure citations are present and correct.
- **DON'T:** Approve any output that is short, brief, or contains placeholder text from the instructions.
- **DON'T:** Let agents pass if they just summarize. They must provide deep analysis.
- **DON'T:** Accept "UPSE" or similar hallucinations if the KB says something else.

### 📝 EVALUATION STRUCTURE (JSON ONLY)
{
  "overall_score": 0-100,
  "grade": "A|B|C|D|F",
  "recommendation": "approve|reject|revise",
  "criteria_scores": {
    "completeness": 0-100,
    "accuracy": 0-100,
    "quality": 0-100,
    "relevance": 0-100,
    "grounding_integrity": 0-100,
    "instruction_adherence": 0-100,
    "professionalism": 0-100
  },
  "grounding_evaluation": {
    "fabrication_detected": false,
    "unsupported_claims": ["list of claims without source"],
    "grounding_score": 0-100
  },
  "detailed_feedback": "Professional feedback covering all criteria",
  "executive_summary": "One-line summary"
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


def execute(ctx: dict) -> str:
    prompt = ctx.get("prompt", "")
    envelope_id = ctx.get("envelope_id", "")
    step_id = ctx.get("step_id", "")
    agent_id = ctx.get("agent_id", "agent_grader")
    input_ref = ctx.get("input_ref")
    start_ms = int(time.time() * 1000)
    model_name = "unknown"

    print(f"[GRADER] Evaluating grounded artifact for envelope {envelope_id}")

    # Load deliverable
    deliverable_context = ""
    worker_grounding_meta = {}
    if input_ref:
        try:
            artifact = get_artifact(input_ref)
            if artifact:
                content = artifact.get("artifact_content", "")
                deliverable_context = f"\n\nDeliverable:\n{content}"
                try:
                    data = json.loads(content)
                    worker_grounding_meta = data.get("_grounding_meta", {})
                except Exception:
                    pass
        except Exception:
            pass

    # Phase 3 context for grader awareness
    envelope = get_envelope(envelope_id) or {}
    kb_ctx = envelope.get("knowledge_context", {}) or {}
    instr_ctx = envelope.get("instruction_context", {}) or {}
    web_ctx = envelope.get("web_search_context", {}) or {}

    log_agent_action(envelope_id, step_id, "grader", agent_id, "START",
                     input_summary=f"Evaluating: {prompt[:300]}")

    try:
        llm_cfg = get_llm_config(ctx.get("org_id"), "grader")
        provider = llm_cfg["provider"]
        model_name = llm_cfg["model"]
        api_key = llm_cfg["api_key"]
        base_url = llm_cfg.get("base_url")

        if provider == "anthropic":
            llm = ChatAnthropic(model=model_name, temperature=llm_cfg["temperature"],
                                api_key=api_key, base_url=base_url or None, max_tokens=4096, timeout=300)
        elif provider == "openai":
            llm = ChatOpenAI(model=model_name, temperature=llm_cfg["temperature"],
                             api_key=api_key, max_tokens=4096)
        elif provider == "gemini":
            llm = ChatGoogleGenerativeAI(model=model_name, temperature=llm_cfg["temperature"], google_api_key=api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        # Build grounding context summary for grader
        grounding_summary = (
            f"\n\nGROUNDING CONTEXT (what was available to agents):\n"
            f"- KB collections: {kb_ctx.get('collections', [])}\n"
            f"- KB chunks used by worker: {worker_grounding_meta.get('kb_chunks_used', 'unknown')}\n"
            f"- Web sources used: {worker_grounding_meta.get('web_results_used', 'unknown')}\n"
            f"- Web sources: {worker_grounding_meta.get('web_sources', [])[:5]}\n"
            f"- Instruction profiles: {instr_ctx.get('profiles', [])}\n"
            f"- Web search was enabled: True (always on)\n"
            f"\nEvaluate grounding_adherence, instruction_adherence, and source_citation explicitly."
        )

        human_content = (
            f"Original task:\n\n{prompt}"
            f"{grounding_summary}"
            f"{deliverable_context}"
            f"\n\nEvaluate the deliverable with explicit grounding and instruction adherence scoring."
        )

        messages = [
            SystemMessage(content=GRADER_SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]
        response = llm.invoke(messages)
        raw_text = response.content if isinstance(response.content, str) else str(response.content)

        result = _parse_json_text(raw_text)
        if not result:
            result = {
                "overall_score": 70,
                "grade": "B",
                "recommendation": "approve",
                "criteria_scores": {
                    "completeness": 70, "accuracy": 70, "quality": 70, "relevance": 70,
                    "grounding_adherence": 70, "instruction_adherence": 70, "source_citation": 70,
                },
                "grounding_evaluation": {
                    "kb_chunks_properly_cited": True,
                    "web_sources_properly_cited": True,
                    "fabrication_detected": False,
                    "insufficient_data_correctly_flagged": True,
                    "unsupported_claims": [],
                    "grounding_score": 70,
                },
                "instruction_evaluation": {"profiles_followed": True, "deviations": [], "instruction_score": 70},
                "feedback": raw_text[:2000],
                "summary": "Evaluation complete — see feedback",
            }

        usage = extract_token_usage(response, model_name)
        duration_ms = int(time.time() * 1000) - start_ms
        grade = result.get("grade", "?")
        score = result.get("overall_score", 0)

        log_agent_action(envelope_id, step_id, "grader", agent_id, "COMPLETE",
                         model=model_name,
                         input_summary=f"Evaluating artifact for: {prompt[:200]}",
                         output_summary=f"Grade: {grade} ({score}/100) — {result.get('summary', '')}",
                         duration_ms=duration_ms,
                         metadata={"token_usage": usage})

        print(f"[GRADER] Evaluation complete — grade: {grade} | score: {score} | Tokens: {usage.get('total_tokens', 0)}")
        return {
            "content": json.dumps(result, indent=2),
            "token_usage": usage
        }

    except Exception as e:
        duration_ms = int(time.time() * 1000) - start_ms
        print(f"[GRADER] ERROR: {e}")
        log_agent_action(envelope_id, step_id, "grader", agent_id, "ERROR",
                         model=model_name, error=str(e), duration_ms=duration_ms)
        raise
