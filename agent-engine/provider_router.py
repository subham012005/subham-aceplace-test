"""
BYO-LLM Router — Phase 2 ACEPLACE Agent Engine

Resolves org-specific LLM configurations from Firestore:
Collection: org_intelligence_providers/{org_id}

Spec:
- No platform keys fallback.
- Raise ValueError if key is missing (triggers Quarantine).
"""

from services.firestore import get_db

def get_llm_config(org_id: str, role: str) -> dict:
    """
    Fetch the provider config and API key for a specific role and org.
    Returns: {
        "provider": "openai" | "anthropic" | "gemini" | "custom",
        "api_key": "...",
        "base_url": "...",
        "model": "..." # resolved based on role/tier
    }
    """
    if not org_id:
        raise ValueError("BYO_LLM_ERROR: Missing org_id in envelope.")

    db = get_db()
    
    print("\n" + "="*80)
    print(f" [BYO-LLM ROUTER] RESOLVING FOR ROLE: {role.upper()}")
    print(f" [BYO-LLM ROUTER] ORG ID: {org_id}")
    print("="*80)

    # Try canonical collection first
    doc_ref = db.collection("org_intelligence_providers").document(org_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        # Fallback to the 'jobs' collection
        doc_id = f"provider_config_{org_id}"
        doc = db.collection("jobs").document(doc_id).get()
    
    if not doc.exists:
        print(f"[ROUTER] Config MISSING for org {org_id}")
        raise ValueError(f"BYO_LLM_ERROR: No intelligence provider config found for org {org_id}.")

    config = doc.to_dict()
    # Redact config for logging
    log_config = {k: v for k, v in config.items() if k != "providers"}
    providers = config.get("providers", {})
    agent_models = config.get("agent_models", {})

    # 1. Resolve which provider is assigned to this role
    provider_key = agent_models.get(role)
    if not provider_key:
        # Fallback to defaults or fail? Phase 2 says fail closed.
        raise ValueError(f"BYO_LLM_ERROR: No provider assigned to role '{role}' for org {org_id}.")

    # 2. Get the specific config for that provider
    p_config = providers.get(provider_key)
    if not p_config or not p_config.get("enabled"):
         raise ValueError(f"BYO_LLM_ERROR: Provider '{provider_key}' is not enabled for org {org_id}.")

    api_key = p_config.get("api_key")
    if not api_key:
        raise ValueError(f"BYO_LLM_ERROR: API key for provider '{provider_key}' is missing for org {org_id}.")

    # 3. Resolve model name (Deterministic mapping based on role)
    # Note: In a more advanced version, this would be in the config doc per role.
    # For now, we use standard Phase 2 model mappings.
    MODEL_MAP = {
        "openai": {
            "coo": "gpt-4o",
            "researcher": "gpt-4o",
            "worker": "gpt-4o",
            "grader": "gpt-4o-mini"
        },
        "anthropic": {
            "coo": "claude-3-5-sonnet-20240620",
            "researcher": "claude-3-5-sonnet-20240620",
            "worker": "claude-3-5-sonnet-20240620",
            "grader": "claude-3-haiku-20240307"
        },
        "gemini": {
            "coo": "gemini-1.5-pro",
            "researcher": "gemini-1.5-pro",
            "worker": "gemini-1.5-flash",
            "grader": "gemini-1.5-flash"
        },
        "custom": {
            "coo": "custom-model",
            "researcher": "custom-model",
            "worker": "custom-model",
            "grader": "custom-model"
        }
    }
    
    # Prefer the explicit model chosen by the user for this provider
    saved_model = p_config.get("model")
    if saved_model and saved_model.strip():
        model = saved_model.strip()
    else:
        model = MODEL_MAP.get(provider_key, {}).get(role, "unknown")

    # [MITIGATION] Force gpt-4o-mini for Tier 1 orgs hitting the 30k TPM limit
    if model == "gpt-4o":
        print(f"[ROUTER] ⚠️ Swapping gpt-4o for gpt-4o-mini to avoid 429 rate limits")
        model = "gpt-4o-mini"

    print(f"[ROUTER] Resolved BYO-LLM: org={org_id} role={role} provider={provider_key} model={model}")
    
    return {
        "provider": provider_key,
        "api_key": api_key,
        "base_url": p_config.get("base_url"),
        "model": model,
        "temperature": 0.0
    }
