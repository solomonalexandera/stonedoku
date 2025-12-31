# Stonedoku AI Default Context

This file is intended as a compact default context for AI agents working on the Stonedoku repository. It bundles the current `MANAGERS.md` summary and the `copilot-instructions.md` guidance so agents have immediate access to the project's conventions, architecture, and manager responsibilities.

## Use
- Read this file at onboarding for context about the project and where managers live.
- If edits are made to `.github/MANAGERS.md` or `.github/copilot-instructions.md`, update this file or reference the source files.

---

## Managers (excerpted from `.github/MANAGERS.md`)

(Refer to `.github/MANAGERS.md` for the canonical and full manager index.)

- `ViewManager`: Controls SPA view routing and lifecycle.
- `AppState`: Global state container for the client app.
- `LogManager`: Console override and optional Firestore persistence for client logs.
- `ProfileManager`: CRUD and helper functions for profiles in Firestore.
- `FriendsManager`: UI manager for friends list and incoming requests.
- `PresenceManager`: RTDB presence tracking.
- `LobbyManager`: RTDB lobby management.
- `MatchManager`: RTDB match lifecycle and game rules.
- `ChatManager`: Global/in-match chat via RTDB.
- `ChallengeSystem` / Notification handlers: Send/process direct notifications.
- `OnboardingSystem`: Signup/onboarding helpers.
- `UI`: Shared DOM helpers and small UI affordances.
- `AudioManager`, `SudokuGenerator`, `ProfanityFilter`, `GameHelpers`, `GameUI`, `CreativeFeatures`.

---

## Copilot / Agent Instructions (excerpt)

The canonical agent instructions are in `.github/copilot-instructions.md`. Key points for agents:

- The app is a Firebase-backed SPA; prefer using existing managers for new features.
- Use `AppState` for application-wide state and avoid ad-hoc global mutations.
- Tests and E2E live in `tests/playwright/` and use `tests/playwright/e2e-runner.html` helpers for Firestore/RTDB interactions.
- When modifying managers, update `.github/MANAGERS.md` and this `AI_DEFAULT_CONTEXT.md` to keep agent context current.

---

Files to consult:
- `.github/MANAGERS.md`
- `.github/copilot-instructions.md`
- `app.js` (single-file SPA containing most managers)
- `tests/playwright/e2e-runner.html` (E2E helper API)


