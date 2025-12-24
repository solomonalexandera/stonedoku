from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent_team import run_orchestration, DEFAULT_BRIEF


class RunRequest(BaseModel):
    task: str
    branch: str | None = None
    brief: str | None = None


app = FastAPI(title="Stonedoku Agent Team", version="1.0.0")


@app.get("/healthz")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/run")
def run(req: RunRequest) -> Dict[str, Any]:
    brief_path = Path(req.brief) if req.brief else DEFAULT_BRIEF
    try:
        summary = run_orchestration(req.task, brief_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "ok", "summary": summary}
