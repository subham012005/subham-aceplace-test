"""
ACEPLACE Agent Engine — Phase 2 FastAPI Entry Point

Envelope-driven runtime. No hardcoded pipeline.
No jobs collection dependency for execution.

API:
  POST /execute-step   ← Execute a single step from an envelope
  GET  /health         ← Health check
"""

import os
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import AGENT_ENGINE_PORT, AGENT_ENGINE_HOST
from graph.runtime_loop import run_envelope
from services.firestore import append_trace, update_envelope_step

# ─── Internal Service Token ────────────────────────────────────────────────────
# Set INTERNAL_SERVICE_TOKEN in agent-engine/.env to enforce service-to-service auth.
# Leave empty to disable (development mode only).
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")

# ─── Allowed CORS Origins ──────────────────────────────────────────────────────
# AUDIT FIX P1#6: Restrict to specific origins, not wildcard.
ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
    if origin.strip()
]


# ─── Request Models ────────────────────────────────────────────────────────────

class ExecuteEnvelopeRequest(BaseModel):
    """Trigger the full runtime loop for an envelope."""
    envelope_id: str
    instance_id: str


class ExecuteStepRequest(BaseModel):
    """Execute a single step (called by TypeScript runtime-loop.ts)."""
    envelope_id: str
    step_id: str
    step_type: str
    agent_id: str
    prompt: str
    input_ref: str | None = None
    org_id: str | None = "default"
    message_id: str | None = None


# ─── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- ACEPLACE Agent Engine Runtime ---")
    print("--- Envelope-Driven Runtime ---")
    print(f"--- Running on port {AGENT_ENGINE_PORT} ---")
    yield
    print("[AGENT-ENGINE] Shutting down...")


# ─── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="ACEPLACE Agent Engine",
    description="Phase 2 Envelope-Driven Runtime",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # AUDIT FIX P1#6: no wildcard origins — restrict to workstation web + runtime worker
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Internal Token Middleware ──────────────────────────────────────────────────
# AUDIT FIX P1#6: Require X-Internal-Token for all non-public routes.

@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    """Enforce internal service token on all non-health routes."""
    public_paths = ("/health", "/docs", "/openapi.json", "/redoc")
    if request.url.path in public_paths:
        return await call_next(request)
    if INTERNAL_SERVICE_TOKEN:
        from fastapi.responses import JSONResponse
        token = request.headers.get("X-Internal-Token", "")
        if token != INTERNAL_SERVICE_TOKEN:
            return JSONResponse(status_code=403, content={"detail": "Unauthorized: invalid internal service token"})
    return await call_next(request)


# ─── Background Runner ─────────────────────────────────────────────────────────

def _run_envelope_bg(envelope_id: str, instance_id: str):
    """Run envelope loop in background. Catches and logs all exceptions."""
    try:
        run_envelope(envelope_id, instance_id)
    except Exception as e:
        err = f"Runtime loop crashed: {e}\n{traceback.format_exc()}"
        print(f"[ENGINE] CRASH for envelope {envelope_id}: {err}")
        try:
            append_trace(
                envelope_id=envelope_id,
                step_id="",
                agent_id="system",
                identity_fingerprint="",
                event_type="RUNTIME_CRASHED",
                metadata={"error": err},
            )
        except Exception:
            pass


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/execute")
async def execute_envelope(request: ExecuteEnvelopeRequest, background_tasks: BackgroundTasks):
    """
    Trigger the full deterministic runtime loop for an envelope.
    Runs asynchronously in background.
    """
    background_tasks.add_task(
        _run_envelope_bg,
        request.envelope_id,
        request.instance_id,
    )
    return {
        "success": True,
        "message": "Runtime loop triggered",
        "envelope_id": request.envelope_id,
        "instance_id": request.instance_id,
    }


@app.post("/execute-step")
async def execute_step(request: ExecuteStepRequest):
    """
    Execute a single step synchronously (called by TypeScript runtime-loop.ts).
    Returns artifact_id of produced output.
    """
    from services.firestore import create_artifact
    print("\n" + "="*40)
    print(f"[ENGINE] EXECUTING STEP: {request.step_id} ({request.step_type})")
    print("="*40 + "\n")

    try:
        # Import the handler for this step type
        from graph.runtime_loop import STEP_HANDLERS
        handler_info = STEP_HANDLERS.get(request.step_type)

        if handler_info is None:
            return {"success": False, "error": f"Unknown step_type: {request.step_type}"}

        handler_fn, _verb = handler_info

        output_data = handler_fn({
            "envelope_id": request.envelope_id,
            "step_id": request.step_id,
            "step_type": request.step_type,
            "agent_id": request.agent_id,
            "org_id": request.org_id or "default",
            "identity_fingerprint": "",
            "prompt": request.prompt,
            "input_ref": request.input_ref,
        })

        # Handle dict return from updated agents
        actual_content = output_data
        if isinstance(output_data, dict) and "content" in output_data:
            actual_content = output_data["content"]

        artifact_id = create_artifact(
            envelope_id=request.envelope_id,
            agent_id=request.agent_id,
            identity_fingerprint="",
            artifact_type=request.step_type,
            content=actual_content if isinstance(actual_content, str) else str(actual_content),
        )

        return {"success": True, "artifact_id": artifact_id, "token_usage": output_data.get("token_usage", {})}

    except Exception as e:
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ACEPLACE Agent Engine",
        "runtime": "envelope-driven",
        "version": "2.0.0",
    }


@app.get("/config")
async def get_config():
    from config import AGENT_MODELS
    return {
        "agents": {
            name: {"model": cfg["model"], "temperature": cfg["temperature"], "provider": cfg["provider"]}
            for name, cfg in AGENT_MODELS.items()
        }
    }


# ─── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    # 🧪 Hardened for Python 3.14+ (Disabling reload=True to avoid asyncio signal conflicts)
    uvicorn.run(
        "main:app",
        host=AGENT_ENGINE_HOST,
        port=AGENT_ENGINE_PORT,
        reload=False,
        workers=1,
        loop="asyncio",
    )
