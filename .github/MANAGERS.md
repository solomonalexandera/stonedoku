# Stonedoku Manager Index

This document indexes the primary "manager" objects and domain modules implemented in `app.js`. It is intended as a quick reference for contributors and AI agents working on the codebase. Keep this file up to date when adding or significantly changing a manager.

## Managers (current)

### `ViewManager`
- **Purpose:** Controls which SPA view is visible (`auth`, `lobby`, `game`, etc.).
- **Key responsibilities:** Show/hide views, route-like navigation, and coordinate view-level lifecycle (mount/unmount) handlers.

### `AppState` (global state container)
- **Purpose:** Holds application state used across managers (currentUser, currentView, friends, listeners, settings, etc.).

### `LogManager`
- **Purpose:** Centralized client-side logging and diagnostics.
- **Key responsibilities:** Override console methods, capture logs into `window._capturedConsole`, and persist logs to Firestore `clientLogs` when permitted.
- **Location:** `src/client/managers/logManager.js`

### `ProfileManager`
- **Purpose:** CRUD and helper operations for user profiles stored in Firestore (`users` collection).
- **Key responsibilities:** Create/update profiles, check username availability, manage friendships (send/accept/decline), and load friend/profile data.
- **Location:** `src/client/managers/profileManager.js`

### `FriendsManager` (Friends UI)
- **Purpose:** UI manager for displaying friends, incoming requests, and friend actions.
- **Key responsibilities:** Render friend list, handle accept/decline actions, and refresh friend state.
- **Location:** `src/client/managers/friendsManager.js`

### `PresenceManager`
- **Purpose:** Track online presence and current activity via the RTDB `presence/` path.
- **Key responsibilities:** Manage `.info/connected` listeners, write presence status, and clear presence on disconnect.
- **Location:** `src/client/managers/presenceManager.js` (factory `createPresenceManager`, instance created in `app.js`).

### `LobbyManager`
- **Purpose:** Manage lobby creation and state in the RTDB (`lobbies/`).
- **Key responsibilities:** Create/join lobbies, maintain player lists and ready status, and coordinate match start.
- **Location:** `src/client/managers/lobbyManager.js` (factory `createLobbyManager`, instance created in `app.js`).

### `MatchManager`
- **Purpose:** Manage active match lifecycle and game rules for 1v1 matches.
- **Key responsibilities:** Create matches in RTDB (`matches/`), apply moves, scorekeeping, mistake limits, and determining match end.
- **Location:** `src/client/managers/matchManager.js`

### `ChatManager`
- **Purpose:** Global and in-match chat messaging via RTDB.
- **Key responsibilities:** Post/read chat messages, moderate message display, and plug into UI chat widgets.

### `ChallengeSystem` / `Notification` handlers
- **Purpose:** Send and process direct notifications (challenge invites, friend notifications) using RTDB `notifications/`.
- **Key responsibilities:** Post notifications, listen for them via `onChildAdded`, and handle accept/decline flows including creating rooms and cleaning up notifications.

### `OnboardingSystem`
- **Purpose:** Multi-step signup and onboarding helper.
- **Key responsibilities:** Validate username, collect email/password and profile data, and create the corresponding Firestore records.

### `UI` (helpers)
- **Purpose:** Reusable DOM utilities and small UI affordances used across views.
- **Key responsibilities:** `showToast`, `escapeHtml`, small render helpers, and common formatting utilities.

### `AudioManager`
- **Purpose:** Play audio cues for game events.
- **Location:** `src/client/managers/audioManager.js`

### `SudokuGenerator`
- **Purpose:** Create and solve Sudoku puzzles for different difficulties.

### `ProfanityFilter`
- **Purpose:** Client-side filtering for user-generated text (basic replacement).

### `GameHelpers` & `GameUI`
- **Purpose:** Helpers and UI rendering for the Sudoku board.
- **Key responsibilities:** Render grid, handle cell selection/input, maintain move history, update remaining counts, and highlight conflicts.
- **Location:** `src/client/ui/gameHelpers.js`, `src/client/ui/gameUi.js`

### `CreativeFeatures`
- **Purpose:** Cosmetic UI features (confetti, streaks, micro-animations).

## Notes and contributor guidance
- This file should reflect the managers implemented in `app.js`. If you add or rename a manager, update this document.
- Prefer adding new domain logic as a manager object to keep `app.js` organized. Keep each manager focused and well-documented.
- Naming: use descriptive, human-readable names. Exported managers are PascalCase (e.g., `ProfileManager`), factories use `createX`, and file names mirror the export in lowerCamelCase (e.g., `profileManager.js`).

- Managers are also exposed at `window.Stonedoku.Managers` to support incremental refactoring and modular imports.
- AI agents and contributors: before modifying managers, read this MANAGERS.md and the `.github/prompts/AI_PROMPTS.prompt.md` guidance (if present) so changes align with project conventions.
