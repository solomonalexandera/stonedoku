# Agent Team Orchestrator — Stonedoku

Implements a multi-agent pattern (OpenAI + Codex MCP) that consumes the existing design brief (`DESIGN_BRIEF.md`) to drive creative direction, motion, component states, and implementation guidance.

## Files
- `agent_team.py` — main orchestrator scaffold (reads brief, preps deliverables).
- `STACK.md` — stack summary + brief path.
- `requirements.txt` — pinned Python deps.
- `.env.example` — sample env vars (no secrets).
- `app.py` — FastAPI wrapper for Cloud Run.
- `Dockerfile` — Cloud Run image including Node for MCP Codex server.
- `cloudrun.md` — deploy instructions.

## One-command local run
```bash
cd tools/agent-team
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python agent_team.py --task "Implement the existing design brief in this repo" --prompt-api-key
```

This will:
- Read `DESIGN_BRIEF.md`
- Prepare deliverable placeholders (REQUIREMENTS.md, AGENT_TASKS.md, TEST_PLAN.md, design/*)
- Print an execution summary and MCP server command.

If you see an idle “blue brackets” prompt, the MCP server is waiting. Ensure the command is exactly `npx -y codex mcp-server` and that `OPENAI_API_KEY` is available (export it or use `--prompt-api-key`).

## MCP (Codex server)
- Command: `npx -y codex mcp-server`
- The orchestrator passes this config to the agent runtime; keep Node available in the environment.

## Cloud Run entrypoint
1. Build locally:
   ```bash
   cd tools/agent-team
   docker build -t stonedoku-agent .
   ```
2. Deploy (see `cloudrun.md` for full steps):
   - Requires `OPENAI_API_KEY` as a secret/env var.
   - HTTP POST `/run` with JSON: `{"task": "...", "branch": "optional"}`.

## Security
- Never commit real keys. Use `OPENAI_API_KEY` via env or Secret Manager.
- Restrict Cloud Run with IAM (and optionally Firebase Auth token verification).

## Notes
- The existing design brief is the single source of truth: `DESIGN_BRIEF.md`.
- Frontend/backend live in repo root (vanilla HTML/CSS/JS + Firebase Hosting/Firestore/RTDB/Functions).
- Playwright tests live in `tests/playwright`.
