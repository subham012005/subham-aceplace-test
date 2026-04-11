"""
Configuration for the ACEPLACE Agent Engine.
Loads environment variables and defines agent model settings.
"""

import os
from dotenv import load_dotenv

load_dotenv(override=True)

# ─── LLM API Keys ───────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# ─── Firebase Admin SDK ─────────────────────────────────
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL", "")
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "")

# ─── Server Config ──────────────────────────────────────
AGENT_ENGINE_PORT = int(os.getenv("AGENT_ENGINE_PORT", "8001"))
AGENT_ENGINE_HOST = os.getenv("AGENT_ENGINE_HOST", "0.0.0.0")

# ─── Agent Model Configuration ──────────────────────────
AGENT_MODELS = {
    "coo": {
        "provider": "anthropic",
        "model": "claude-sonnet-4-6",
        "temperature": 0.2,
    },
    "researcher": {
        "provider": "anthropic",
        "model": "claude-sonnet-4-6",
        "temperature": 0.3,
    },
    "worker": {
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.4,
    },
    "grader": {
        "provider": "anthropic",
        "model": "claude-haiku-4-5",
        "temperature": 0.1,
    },
}
