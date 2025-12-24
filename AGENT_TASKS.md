# AGENT_TASKS — Agent Team Playbook
Source brief: DESIGN_BRIEF.md

## Roles & Order
1) **Project Manager (PM)**
   - Enforces brief + guardrails.
   - Injects design brief path (DESIGN_BRIEF.md) into every agent prompt.
   - Coordinates handoffs, assembles final summary.
2) **Creative Director**
   - Derives visual + thematic interpretation strictly from DESIGN_BRIEF.md.
   - Updates /design/creative_direction.md.
3) **UI/Motion Designer**
   - Produces /design/motion_spec.md and /design/component_states.md from the brief.
   - Ensures reduced-motion variants and state coverage.
4) **Frontend Engineer**
   - Implements UI/motion in existing frontend (index.html, app.js, styles.css).
   - Removes redundant timer, enforces undo/erase quotas, removes hint, fixes notes.
   - Adds tooltips/ARIA, chat clarity, orientation trigger in profile, resign button.
5) **Firebase Backend Engineer**
   - Validates rules (DM participants/threads, matches), functions, live stats writes.
   - Ensures stats update for SP/MP, resign handling, onboarding flags.
6) **QA + Accessibility**
   - Writes TEST_PLAN.md; runs/updates Playwright smoke where feasible.
   - Verifies contrast, reduced-motion, keyboard/focus, and tooltips presence.

## Guardrails
- Brief is truth; no new brief. Path: DESIGN_BRIEF.md.
- Reduced-motion path required; no bright/glossy effects.
- No secrets; use env/Secret Manager.
- If unclear, write QUESTION.md with explicit asks.
- Keep diffs small and within existing stack.

## Outputs
- /design/creative_direction.md
- /design/motion_spec.md
- /design/component_states.md
- REQUIREMENTS.md (this file’s sibling)
- TEST_PLAN.md
- Implementation changes in existing frontend/backend per tasks above.
