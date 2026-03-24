"""
NXQ Agent Engine — Phase 2 FastAPI Entry Point

Envelope-driven runtime. No hardcoded pipeline.
No jobs collection dependency for execution.

API:
  POST /execute-step   ← Execute a single step from an envelope
  GET  /health         ← Health check
"""

import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import AGENT_ENGINE_PORT, AGENT_ENGINE_HOST
from graph.runtime_loop import run_envelope
from services.firestore import append_trace, update_envelope_step


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
    message_id: str | None = None


# ─── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("╔══════════════════════════════════════════════╗")
    print("║   NXQ Agent Engine — Phase 2 Runtime         ║")
    print("║   Envelope-Driven • No hardcoded pipeline    ║")
    print(f"║   Running on port {AGENT_ENGINE_PORT}                        ║")
    print("╚══════════════════════════════════════════════╝")
    yield
    print("[AGENT-ENGINE] Shutting down...")


# ─── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="NXQ Agent Engine",
    description="Phase 2 Envelope-Driven Runtime",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

    try:
        # Import the handler for this step type
        from graph.runtime_loop import STEP_HANDLERS
        handler_info = STEP_HANDLERS.get(request.step_type)

        if handler_info is None:
            return {"success": False, "error": f"Unknown step_type: {request.step_type}"}

        handler_fn, _verb = handler_info

        output_content = handler_fn({
            "envelope_id": request.envelope_id,
            "step_id": request.step_id,
            "step_type": request.step_type,
            "agent_id": request.agent_id,
            "identity_fingerprint": "",
            "prompt": request.prompt,
            "input_ref": request.input_ref,
        })

        artifact_id = create_artifact(
            envelope_id=request.envelope_id,
            agent_id=request.agent_id,
            identity_fingerprint="",
            artifact_type=request.step_type,
            content=output_content if isinstance(output_content, str) else str(output_content),
        )

        return {"success": True, "artifact_id": artifact_id}

    except Exception as e:
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "NXQ Agent Engine",
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
    uvicorn.run(
        "main:app",
        host=AGENT_ENGINE_HOST,
        port=AGENT_ENGINE_PORT,
        reload=True,
    )
