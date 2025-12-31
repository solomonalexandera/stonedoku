# Stonedoku AI Default Context

This file is intended as a compact default context for AI agents working on the Stonedoku repository. It bundles the current `MANAGERS.md` summary and the `copilot-instructions.md` guidance so agents have immediate access to the project's conventions, architecture, and manager responsibilities.

## Use
- Read this file at onboarding for context about the project and where managers live.
- If edits are made to `.github/MANAGERS.md` or `.github/copilot-instructions.md`, update this file or reference the source files.

---

## Project Structure

The application source is organized under `src/client/`:
- `src/client/entry.js` - Main application bootstrap
- `src/client/core/` - Firebase initialization, AppState, AuthFlow, GameFlow, EventSetup
- `src/client/managers/` - Stateful service managers (factory pattern)
- `src/client/ui/` - UI components and view controllers
- `src/client/lib/` - Pure utility libraries

The legacy `app.js` in the root is deprecated.

## Managers (excerpted from `.github/MANAGERS.md`)

(Refer to `.github/MANAGERS.md` for the canonical and full manager index.)

- `ViewManager`: Controls SPA view routing and lifecycle. (`src/client/managers/viewManager.js`)
- `AppState`: Global state container. (`src/client/core/appState.js`)
- `LogManager`: Console override and optional Firestore persistence.
- `ProfileManager`: CRUD and helper functions for profiles in Firestore.
- `FriendsManager`: UI manager for friends list and incoming requests.
- `PresenceManager`: RTDB presence tracking.
- `LobbyManager`: RTDB lobby management.
- `MatchManager`: RTDB match lifecycle and game rules.
- `ChatManager`: Global/in-match chat via RTDB.
- `ChallengeManager` / `ChallengeSystemManager`: Send/process direct notifications.
- `OnboardingManager`: Signup/onboarding helpers.
- `AudioManager`, `SudokuGenerator`, `ProfanityFilter`, `GameHelpers`, `GameUi`, `CreativeFeatures`.

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
- `src/client/entry.js` (main application entry point)
- `src/README.md` (source directory documentation)
- `tests/playwright/e2e-runner.html` (E2E helper API)


