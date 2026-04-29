"""
Token Tracking Service — ACEPLACE Agent Engine
Extracts and calculates token usage and costs across different providers.
"""

from typing import Dict, Any, Optional

# Basic pricing (USD per 1M tokens) - rough estimates for gpt-4o, sonnet 3.5, etc.
# In a real system, these would be fetched from a dynamic config.
PRICING = {
    "gpt-4o": {"input": 5.0, "output": 15.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "claude-3-5-sonnet": {"input": 3.0, "output": 15.0},
    "claude-3-opus": {"input": 15.0, "output": 75.0},
    "gemini-1.5-pro": {"input": 3.5, "output": 10.5},
    "default": {"input": 10.0, "output": 30.0}
}

def extract_token_usage(response: Any, model_name: str = "") -> Dict[str, Any]:
    """
    Extract token usage from a LangChain BaseMessage response.
    Returns a dict with {input_tokens, output_tokens, total_tokens, cost}.
    """
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "cost": 0.0
    }
    
    # Try to find usage metadata in various LangChain formats
    meta = getattr(response, "response_metadata", {})
    usage_attr = getattr(response, "usage_metadata", None)
    
    # DEBUG
    print(f"[TOKEN-DEBUG] meta keys: {list(meta.keys()) if isinstance(meta, dict) else 'not-dict'}")
    if usage_attr: print(f"[TOKEN-DEBUG] usage_attr found: {type(usage_attr)}")
    
    # 0. Direct usage_metadata attribute (newer LangChain versions)
    if usage_attr:
        if isinstance(usage_attr, dict):
            usage["input_tokens"] = usage_attr.get("input_tokens") or usage_attr.get("prompt_tokens") or usage_attr.get("prompt_token_count") or 0
            usage["output_tokens"] = usage_attr.get("output_tokens") or usage_attr.get("completion_tokens") or usage_attr.get("candidates_token_count") or 0
            usage["total_tokens"] = usage_attr.get("total_tokens") or usage_attr.get("total_token_count") or (usage["input_tokens"] + usage["output_tokens"])
        else:
            usage["input_tokens"] = getattr(usage_attr, "input_tokens", getattr(usage_attr, "prompt_tokens", getattr(usage_attr, "prompt_token_count", 0)))
            usage["output_tokens"] = getattr(usage_attr, "output_tokens", getattr(usage_attr, "completion_tokens", getattr(usage_attr, "candidates_token_count", 0)))
            usage["total_tokens"] = getattr(usage_attr, "total_tokens", getattr(usage_attr, "total_token_count", usage["input_tokens"] + usage["output_tokens"]))
    
    # 1. OpenAI format in metadata
    elif "token_usage" in meta:
        u = meta["token_usage"]
        usage["input_tokens"] = u.get("prompt_tokens", 0)
        usage["output_tokens"] = u.get("completion_tokens", 0)
        usage["total_tokens"] = u.get("total_tokens", 0)
    
    # 2. Anthropic format in metadata
    elif "usage" in meta:
        u = meta["usage"]
        usage["input_tokens"] = u.get("input_tokens", 0)
        usage["output_tokens"] = u.get("output_tokens", 0)
        usage["total_tokens"] = usage["input_tokens"] + usage["output_tokens"]
        
    # 3. Google/Gemini format in metadata
    elif "usage_metadata" in meta:
        u = meta["usage_metadata"]
        usage["input_tokens"] = u.get("prompt_token_count", 0)
        usage["output_tokens"] = u.get("candidates_token_count", 0)
        usage["total_tokens"] = u.get("total_token_count", 0)
    
    # 4. Amazon Bedrock / other formats
    elif "amazon-bedrock-invocationMetrics" in meta:
        u = meta["amazon-bedrock-invocationMetrics"]
        usage["input_tokens"] = u.get("inputTokenCount", 0)
        usage["output_tokens"] = u.get("outputTokenCount", 0)
        usage["total_tokens"] = usage["input_tokens"] + usage["output_tokens"]

        
    # Calculate cost
    model_key = "default"
    for key in PRICING:
        if key in model_name.lower():
            model_key = key
            break
            
    prices = PRICING.get(model_key, PRICING["default"])
    usage["cost"] = (usage["input_tokens"] / 1_000_000 * prices["input"]) + \
                    (usage["output_tokens"] / 1_000_000 * prices["output"])
    
    return usage

def aggregate_tokens(current_usage: Optional[Dict[str, Any]], new_usage: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Sum two usage dicts safely."""
    curr = current_usage or {}
    new = new_usage or {}
    
    return {
        "input_tokens": int(curr.get("input_tokens", 0) or 0) + int(new.get("input_tokens", 0) or 0),
        "output_tokens": int(curr.get("output_tokens", 0) or 0) + int(new.get("output_tokens", 0) or 0),
        "total_tokens": int(curr.get("total_tokens", 0) or 0) + int(new.get("total_tokens", 0) or 0),
        "cost": float(curr.get("cost", 0.0) or 0.0) + float(new.get("cost", 0.0) or 0.0)
    }

