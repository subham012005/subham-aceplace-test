"""
Agent Tools — Phase 3 ACEPLACE Agent Engine

Defines LangChain tools for agents to use for web search and knowledge retrieval.
"""

from typing import List, Dict, Optional
from langchain_core.tools import tool
from services.knowledge_service import web_search, retrieve_knowledge_chunks, build_knowledge_context_block, build_web_search_context_block

@tool
def search_the_web(query: str) -> str:
    """
    Perform a live web search to find current information, statistics, and sources.
    Use this when the provided knowledge base doesn't have enough information.
    """
    results = web_search(query, max_results=8)
    if not results:
        return "No results found for this query."
    
    return build_web_search_context_block(results)

@tool
def query_knowledge_base(user_id: str, collection_ids: List[str], query: str) -> str:
    """
    Query the internal user knowledge base for specific information.
    Requires user_id and collection_ids (provided in agent context).
    """
    chunks = retrieve_knowledge_chunks(user_id, collection_ids, query, top_k=15)
    if not chunks:
        return "No relevant knowledge found in the specified collections."
    
    return build_knowledge_context_block(chunks)

def get_research_tools():
    """Returns a list of tools for the Researcher agent."""
    return [search_the_web, query_knowledge_base]
