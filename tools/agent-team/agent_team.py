#!/usr/bin/env python3
"""
Agent Team Orchestrator for Stonedoku.
--------------------------------------
Implements a multi-agent pattern aligned to the existing DESIGN_BRIEF.md.
This scaffold is intentionally conservative: it reads the brief, prepares
deliverable files, and emits instructions for Codex MCP-driven agents.

MCP: Codex CLI as MCP server
    command: npx
    args: ["-y", "codex", "mcp-server"]
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BRIEF = ROOT / "DESIGN_BRIEF.md"
DESIGN_DIR = ROOT / "design"


@dataclass
class Agent:
    name: str
    role: str
    deliverables: List[str]
    notes: str = ""


AGENTS: List[Agent] = [
    Agent(
        name="Project Manager",
        role="Gate, enforce DESIGN_BRIEF.md, orchestrate outputs, ensure reduced-motion and security guardrails.",
        deliverables=["REQUIREMENTS.md", "AGENT_TASKS.md", "TEST_PLAN.md"],
        notes="Inject brief path into every sub-agent prompt.",
    ),
    Agent(
        name="Creative Director",
        role="Interpret the brief into visual direction, palette, and tone.",
        deliverables=["design/creative_direction.md"],
    ),
    Agent(
        name="UI/Motion Designer",
        role="Translate brief into motion and component states with reduced-motion fallbacks.",
        deliverables=["design/motion_spec.md", "design/component_states.md"],
    ),
    Agent(
        name="Frontend Engineer",
        role="Implement UI/motion in existing frontend; remove redundant timer; enforce tool quotas; clear tooltips/ARIA; chat clarity; resign control.",
        deliverables=["index.html", "app.js", "styles.css"],
    ),
    Agent(
        name="Firebase Backend Engineer",
        role="Validate RTDB/Firestore rules, functions, and stats writes. Ensure DM threads/participants rules allow participants only.",
        deliverables=["firebase/firestore.rules", "firebase/database.rules.json", "functions/src/*.ts"],
    ),
    Agent(
        name="QA + Accessibility",
        role="Write/refresh test plan (Playwright smoke + a11y + reduced-motion).",
        deliverables=["TEST_PLAN.md", "tests/playwright/* (optional extensions)"],
    ),
]


def read_brief(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Design brief not found at {path}")
    return path.read_text(encoding="utf-8")


def ensure_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(content.strip() + "\n", encoding="utf-8")


def sync_deliverables(brief_path: Path) -> Dict[str, str]:
    brief = read_brief(brief_path)
    short_brief_note = f"Source brief: {brief_path.name}"

    ensure_file(
        ROOT / "REQUIREMENTS.md",
        f"# REQUIREMENTS — from {brief_path.name}\n\nSee DESIGN_BRIEF.md for authoritative direction.\n\n(Agent will overwrite with current requirements.)",
    )
    ensure_file(
        ROOT / "AGENT_TASKS.md",
        "# AGENT_TASKS — placeholder\n\nPopulated by orchestrator using DESIGN_BRIEF.md.\n",
    )
    ensure_file(
        ROOT / "TEST_PLAN.md",
        "# TEST_PLAN — placeholder\n\nPopulated by orchestrator using DESIGN_BRIEF.md.\n",
    )

    ensure_file(
        DESIGN_DIR / "creative_direction.md",
        f"# Creative Direction\n{short_brief_note}\n\n(Will be refreshed from brief.)",
    )
    ensure_file(
        DESIGN_DIR / "motion_spec.md",
        f"# Motion Spec\n{short_brief_note}\n\n(Will be refreshed from brief.)",
    )
    ensure_file(
        DESIGN_DIR / "component_states.md",
        f"# Component States\n{short_brief_note}\n\n(Will be refreshed from brief.)",
    )

    return {
        "brief_chars": len(brief),
        "design_dir": str(DESIGN_DIR),
        "files_prepared": "REQUIREMENTS.md, AGENT_TASKS.md, TEST_PLAN.md, design/*",
    }


def build_mcp_config() -> Dict:
    return {
        "command": "npx",
        "args": ["-y", "codex", "mcp-server"],
        "env": {},
    }


def run_orchestration(task: str, brief_path: Path = DEFAULT_BRIEF) -> Dict:
    if not brief_path.exists():
        raise FileNotFoundError(f"Brief not found: {brief_path}")

    prep = sync_deliverables(brief_path)
    summary = {
        "task": task,
        "brief": str(brief_path),
        "agents": [agent.name for agent in AGENTS],
        "mcp": build_mcp_config(),
        "prep": prep,
        "next_steps": [
            "Launch MCP Codex server: npx -y codex mcp-server",
            "Run agent workflow to refresh design + requirements based on brief.",
        ],
    }
    print(json.dumps(summary, indent=2))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Stonedoku agent team orchestrator.")
    parser.add_argument("--task", default="Implement the existing design brief in this repo", help="Task description for the agent team.")
    parser.add_argument("--brief", default=str(DEFAULT_BRIEF), help="Path to the design brief.")
    parser.add_argument("--prompt-api-key", action="store_true", help="Prompt for OPENAI_API_KEY if not set in the environment (not saved to disk).")
    args = parser.parse_args()

    if args.prompt_api_key and not os.environ.get("OPENAI_API_KEY"):
        try:
            api_key = getpass.getpass("Enter OPENAI_API_KEY (will not be saved): ").strip()
            if api_key:
                os.environ["OPENAI_API_KEY"] = api_key
        except Exception:
            pass

    run_orchestration(args.task, Path(args.brief))


if __name__ == "__main__":
    main()
