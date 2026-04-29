"""
Knowledge Service — Phase 3 ACEPLACE Agent Engine

Responsibilities:
  1. Retrieve knowledge chunks from Firestore (user-specific, strict isolation)
  2. Perform keyword/tag matching for chunk relevance (no embeddings)
  3. Perform free web search via DuckDuckGo (always runs, no API key required)
  4. Log all knowledge usage and web search results to execution_traces

User isolation: all KB reads are scoped to user_id from envelope.user_id.
All web search results are stored in traces and artifact metadata.
"""

import re
import time
import json
from datetime import datetime, timezone
from typing import Optional

from services.firestore import get_db, append_trace

# ── DuckDuckGo Search ────────────────────────────────────────────────────────

def web_search(query: str, max_results: int = 8) -> list[dict]:
    """
    Perform a free DuckDuckGo web search.
    Returns a list of { title, url, snippet } dicts.
    Falls back to empty list on any error — never blocks execution.
    """
    import warnings
    # Suppress the package rename warning from duckduckgo_search
    warnings.filterwarnings("ignore", category=RuntimeWarning, module="duckduckgo_search")
    
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            # text() is the standard method for text search
            search_results = ddgs.text(query, max_results=max_results)
            if not search_results:
                return []
            
            for r in search_results:
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                    "source": "web_search",
                    "query": query,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                })
        return results
    except Exception as e:
        # Silent fail to prevent blocking the agent loop
        return []


def multi_web_search(queries: list[str], max_results_per_query: int = 5) -> dict:
    """
    Run multiple web searches (for deep research).
    Returns { query: [results] } map + flat all_results list.
    """
    results_map = {}
    all_results = []
    for q in queries[:4]:  # cap at 4 queries to avoid rate limits
        results = web_search(q, max_results=max_results_per_query)
        results_map[q] = results
        all_results.extend(results)
        if results:
            time.sleep(0.5)  # polite delay
    return {
        "queries": queries,
        "results_map": results_map,
        "all_results": all_results,
        "total_results": len(all_results),
    }


# ── Keyword Relevance Matching ───────────────────────────────────────────────

def _tokenize(text: str) -> set[str]:
    """Lowercase, split on non-word chars, remove stop words."""
    STOP = {
        "the","a","an","is","in","it","of","to","and","or","for",
        "with","that","this","be","are","was","were","have","has","had",
        "do","does","did","not","on","at","by","from","as","if","but",
    }
    tokens = re.findall(r"\b[a-z0-9]{2,}\b", text.lower())
    return {t for t in tokens if t not in STOP}


def _relevance_score(chunk_text: str, query_tokens: set[str]) -> float:
    """Simple TF-IBI-style overlap score."""
    if not chunk_text or not query_tokens:
        return 0.0
    chunk_tokens = _tokenize(chunk_text)
    overlap = query_tokens & chunk_tokens
    if not overlap:
        return 0.0
    return len(overlap) / len(query_tokens)


def retrieve_knowledge_chunks(
    user_id: str,
    collection_ids: list[str],
    query: str,
    top_k: int = 15,
) -> list[dict]:
    """
    Retrieve chunks from user's selected knowledge collections.
    The user explicitly selected these collections, so ALL chunks are included
    (up to top_k). Relevance score is used only for ordering, not filtering.
    Strict user isolation: only reads chunks owned by user_id.
    Returns list of { chunk_id, collection_id, text, score, metadata }.
    """
    if not user_id or not collection_ids:
        return []

    db = get_db()
    query_tokens = _tokenize(query) if query else set()
    scored_chunks = []

    for collection_id in collection_ids:
        try:
            coll_ref = (
                db.collection("user_knowledge_collections")
                .document(user_id)
                .collection("collections")
                .document(collection_id)
            )
            coll_doc = coll_ref.get()
            if not coll_doc.exists:
                print(f"[KB] Collection {collection_id} not found for user {user_id} — skipping.")
                continue

            chunks_ref = (
                db.collection("user_knowledge_chunks")
                .document(collection_id)
                .collection("chunks")
                .limit(200)
            )
            chunk_docs = list(chunks_ref.stream())

            for chunk_doc in chunk_docs:
                chunk = chunk_doc.to_dict()
                if not chunk:
                    continue
                text = chunk.get("text", "")
                score = _relevance_score(text, query_tokens) if query_tokens else 1.0
                scored_chunks.append({
                    "chunk_id": chunk_doc.id,
                    "collection_id": collection_id,
                    "text": text,
                    "score": max(score, 0.01),
                    "metadata": chunk.get("metadata", {}),
                })
        except Exception as e:
            print(f"[KB] Error reading collection {collection_id}: {e}")
            continue

    scored_chunks.sort(key=lambda c: c["score"], reverse=True)
    return scored_chunks[:top_k]


# ── Instruction Profile Retrieval ────────────────────────────────────────────

def retrieve_instruction_profiles(
    user_id: str,
    profile_ids: list[str],
) -> list[dict]:
    """
    Fetch instruction profiles for the given user.
    Returns list of { profile_id, name, instructions, tags }.
    """
    if not user_id or not profile_ids:
        return []

    db = get_db()
    profiles = []

    for profile_id in profile_ids:
        try:
            doc = (
                db.collection("user_instruction_profiles")
                .document(user_id)
                .collection("profiles")
                .document(profile_id)
                .get()
            )
            if doc.exists:
                data = doc.to_dict()
                profiles.append({
                    "profile_id": profile_id,
                    "name": data.get("name", ""),
                    "instructions": data.get("instructions", ""),
                    "tags": data.get("tags", []),
                })
        except Exception as e:
            print(f"[INSTRUCTIONS] Error reading profile {profile_id}: {e}")
            continue

    return profiles


# ── Context Builder ───────────────────────────────────────────────────────────

def build_knowledge_context_block(chunks: list[dict], direct_text: str = "") -> str:
    """Format retrieved chunks and direct text into an agent-readable block."""
    if not chunks and not direct_text:
        return ""
    
    # ─── Terminal Debug Print ──────────────────────────────────────────────────
    print("\n" + "="*80)
    print(" [KNOWLEDGE] AGENT KNOWLEDGE CONTEXT ARMED")
    print("="*80)
    if direct_text:
        print(f" [KB-0] Direct Input: {direct_text[:100]}...")
    if chunks:
        print(f" [KB-N] {len(chunks)} Chunks Retrieved")
    print("="*80 + "\n")
    # ──────────────────────────────────────────────────────────────────────────

    lines = ["\n\n=== USER KNOWLEDGE BASE (ABSOLUTE GROUND TRUTH) ==="]
    lines.append("STRICT RULE: If information in this block [KB-N] conflicts with web search [WEB-N], the KB data WINS.")
    
    # 🤖 Phase 3: Label direct text as [KB-0] so agents can cite it canonically
    if direct_text:
        lines.append("\n[KB-0] (User Direct Input)")
        lines.append("[USER-PROVIDED KNOWLEDGE]")
        lines.append(direct_text[:20000]) # Increased limit for direct text
        lines.append("[END USER-PROVIDED KNOWLEDGE]")
    
    for i, chunk in enumerate(chunks, 1):
        lines.append(f"\n[KB-{i}] (Collection: {chunk.get('collection_id', 'unknown')})")
        lines.append(chunk.get("text", "")[:800000]) # High space for documents
    
    lines.append("\n=== END KNOWLEDGE BASE ===")
    return "\n".join(lines)


def build_web_search_context_block(web_results: list[dict]) -> str:
    """Format web search results into an agent-readable block."""
    if not web_results:
        return ""
    lines = ["\n\n=== WEB SEARCH RESULTS ==="]
    for i, r in enumerate(web_results[:10], 1):
        lines.append(f"\n[WEB-{i}] {r.get('title', 'Untitled')}")
        lines.append(f"Source: {r.get('url', 'N/A')}")
        lines.append(f"Query: {r.get('query', '')}")
        lines.append(r.get("snippet", "")[:1000])
    lines.append("\n=== END WEB SEARCH RESULTS ===")
    return "\n".join(lines)


def build_instruction_context_block(profiles: list[dict]) -> str:
    """Format instruction profiles into an agent-readable block."""
    if not profiles:
        return ""
    lines = ["\n\n=== INSTRUCTION PROFILES ==="]
    for p in profiles:
        lines.append(f"\n[PROFILE: {p['name']}]")
        lines.append(p["instructions"])
    lines.append("\n=== END INSTRUCTION PROFILES ===")
    return "\n".join(lines)


# ── Envelope Context Extraction ───────────────────────────────────────────────

def extract_phase3_context(envelope: dict, prompt: str) -> dict:
    """
    Extract Phase 3 context from envelope.
    Always performs web search for deep research.
    Caches web results in envelope to avoid redundant DDG calls across agents.
    Returns { knowledge_chunks, web_results, instruction_profiles, blocks }.
    """
    user_id = envelope.get("user_id", envelope.get("org_id", ""))
    envelope_id = envelope.get("envelope_id", "")

    # Knowledge Base
    kb_ctx = envelope.get("knowledge_context", {}) or {}
    collection_ids = kb_ctx.get("collections", []) or []
    kb_enabled = kb_ctx.get("enabled", False)
    direct_text = kb_ctx.get("direct_text", "") or ""

    # Instructions
    instr_ctx = envelope.get("instruction_context", {}) or {}
    profile_ids = instr_ctx.get("profiles", []) or []
    instr_enabled = instr_ctx.get("enabled", False)

    # Web Search — always enabled for deep research
    web_ctx = envelope.get("web_search_context", {}) or {}

    knowledge_chunks = []
    web_results = []
    instruction_profiles = []

    # Retrieve KB chunks
    if kb_enabled and collection_ids and user_id:
        knowledge_chunks = retrieve_knowledge_chunks(
            user_id=user_id,
            collection_ids=collection_ids,
            query=prompt,
            top_k=15,
        )

    # Check if web results are already cached in envelope (from a previous agent step)
    cached_web = envelope.get("_cached_web_results")
    if cached_web and len(cached_web) > 0:
        print(f"[PHASE3] Using {len(cached_web)} cached web results from envelope")
        web_results = cached_web
    else:
        # First agent to run — perform fresh web search
        print(f"[PHASE3] Running web search for deep research (first agent)")
        # Use only the first 200 chars of prompt for search to avoid complex query noise
        web_results = web_search(prompt[:200], max_results=10)
        print(f"[PHASE3] Web search returned {len(web_results)} results")

        # Cache web results into envelope for subsequent agents
        if web_results and envelope_id:
            try:
                db = get_db()
                db.collection("execution_envelopes").document(envelope_id).update({
                    "_cached_web_results": web_results,
                })
            except Exception as e:
                print(f"[PHASE3] Failed to cache web results: {e}")

    # Retrieve instruction profiles
    if instr_enabled and profile_ids and user_id:
        print(f"[PHASE3] Retrieving instruction profiles: {profile_ids}")
        instruction_profiles = retrieve_instruction_profiles(user_id, profile_ids)

    # Also treat kb_enabled as true if direct_text is provided
    has_direct_text = bool(direct_text and direct_text.strip())
    if has_direct_text:
        kb_enabled = True

    # Build text blocks for agent prompts
    kb_block = build_knowledge_context_block(knowledge_chunks, direct_text)
    web_block = build_web_search_context_block(web_results)
    instr_block = build_instruction_context_block(instruction_profiles)

    return {
        "knowledge_chunks": knowledge_chunks,
        "web_results": web_results,
        "instruction_profiles": instruction_profiles,
        "direct_text": direct_text,
        "kb_block": kb_block,
        "web_block": web_block,
        "instr_block": instr_block,
        "has_knowledge": len(knowledge_chunks) > 0 or has_direct_text,
        "has_web": len(web_results) > 0,
        "has_instructions": len(instruction_profiles) > 0,
        "user_id": user_id,
        "collection_ids": collection_ids,
        "profile_ids": profile_ids,
    }


# ── Trace Logging ─────────────────────────────────────────────────────────────

def log_phase3_usage(
    envelope_id: str,
    step_id: str,
    agent_id: str,
    fingerprint: str,
    phase3_ctx: dict,
) -> None:
    """Log knowledge base and web search usage to execution traces."""
    try:
        kb_chunk_ids = [c["chunk_id"] for c in phase3_ctx.get("knowledge_chunks", [])]
        has_direct = bool(phase3_ctx.get("direct_text", "").strip())
        web_sources = [r.get("url") for r in phase3_ctx.get("web_results", []) if r.get("url")]
        web_queries = list({r.get("query", "") for r in phase3_ctx.get("web_results", []) if r.get("query")})
        instr_ids = phase3_ctx.get("profile_ids", [])

        metadata = {
            "knowledge_chunks_used": kb_chunk_ids,
            "has_direct_text": has_direct,
            "knowledge_collection_ids": phase3_ctx.get("collection_ids", []),
            "web_search_enabled": True,
            "web_queries": web_queries,
            "web_sources_used": web_sources[:20],
            "instruction_profile_ids": instr_ids,
            "grounding_type": "kb+web" if (kb_chunk_ids or has_direct) and web_sources else ("web" if web_sources else ("kb" if (kb_chunk_ids or has_direct) else "none")),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        append_trace(
            envelope_id=envelope_id,
            step_id=step_id,
            agent_id=agent_id,
            identity_fingerprint=fingerprint,
            event_type="PHASE3_GROUNDING_USED",
            metadata=metadata,
        )

        # Also update envelope web_search_context with what was actually used
        try:
            db = get_db()
            existing_env = db.collection("execution_envelopes").document(envelope_id).get()
            if existing_env.exists:
                env_data = existing_env.to_dict() or {}
                existing_web_ctx = env_data.get("web_search_context", {}) or {}
                existing_queries = existing_web_ctx.get("queries", []) or []
                existing_sources = existing_web_ctx.get("sources_used", []) or []

                merged_queries = list(set(existing_queries + web_queries))
                merged_sources = list(set(existing_sources + web_sources))

                db.collection("execution_envelopes").document(envelope_id).update({
                    "web_search_context": {
                        "enabled": True,
                        "queries": merged_queries[:20],
                        "sources_used": merged_sources[:30],
                    },
                    "knowledge_context.chunks_used": len(kb_chunk_ids),
                })
        except Exception:
            pass

    except Exception as e:
        print(f"[PHASE3] Trace logging error: {e}")
