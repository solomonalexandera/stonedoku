# Stonedoku Manager Index

This document indexes the primary "manager" objects and domain modules implemented in the codebase. It is intended as a quick reference for contributors and AI agents working on the codebase. Keep this file up to date when adding or significantly changing a manager.

## Core Modules (`src/client/core/`)

### `AppState` (global state container)
- **Purpose:** Holds application state used across managers (currentUser, currentView, friends, listeners, settings, etc.).
- **Location:** `src/client/core/appState.js`

### `firebase.js`
- **Purpose:** Firebase SDK initialization and exports.
- **Key responsibilities:** Initialize Firebase app, auth, RTDB, Firestore, Storage, and Functions.
- **Location:** `src/client/core/firebase.js`

### `gameFlow.js`
- **Purpose:** Game initialization, room management, and match flow coordination.
- **Key responsibilities:** Start single/versus games, handle room updates, navigation helpers.
- **Location:** `src/client/core/gameFlow.js`

### `authFlow.js`
- **Purpose:** Authentication state management and persistence configuration.
- **Key responsibilities:** Configure auth persistence, display name helpers, auth state utilities.
- **Location:** `src/client/core/authFlow.js`

### `eventSetup.js`
- **Purpose:** Set up all DOM event listeners for the application.
- **Key responsibilities:** Theme, sound, auth, game, and keyboard event listeners.
- **Location:** `src/client/core/eventSetup.js`

## Managers (`src/client/managers/`)

### `ViewManager`
- **Purpose:** Controls which SPA view is visible (`auth`, `lobby`, `game`, etc.).
- **Key responsibilities:** Show/hide views, route-like navigation, and coordinate view-level lifecycle (mount/unmount) handlers.
- **Location:** `src/client/ui/viewManager.js`

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
- **Location:** `src/client/managers/presenceManager.js`

### `LobbyManager`
- **Purpose:** Manage lobby creation and state in the RTDB (`lobbies/`).
- **Key responsibilities:** Create/join lobbies, maintain player lists and ready status, and coordinate match start.
- **Location:** `src/client/managers/lobbyManager.js`

### `MatchManager`
- **Purpose:** Manage active match lifecycle and game rules for 1v1 matches.
- **Key responsibilities:** Create matches in RTDB (`matches/`), apply moves, scorekeeping, mistake limits, and determining match end.
- **Location:** `src/client/managers/matchManager.js`

### `ChatManager`
- **Purpose:** Global, game, and direct message chat via RTDB.
- **Key responsibilities:** Post/read chat messages, moderate message display, and plug into UI chat widgets.
- **Location:** `src/client/managers/chatManager.js`

### `ChallengeManager`
- **Purpose:** Send and process challenge invites using RTDB `notifications/`.
- **Key responsibilities:** Post challenges, listen for them via `onChildAdded`, and handle accept/decline flows.
- **Location:** `src/client/managers/challengeManager.js`

### `AudioManager`
- **Purpose:** Play audio cues for game events.
- **Location:** `src/client/managers/audioManager.js`

### `CreativeFeatures`
- **Purpose:** Visual effects - streaks, confetti, cell animations, group completion.
- **Location:** `src/client/managers/creativeFeatures.js`

### `AccessibilityManager`
- **Purpose:** Keyboard navigation, ARIA labels, screen reader announcements.
- **Location:** `src/client/managers/accessibilityManager.js`

## UI Modules (`src/client/ui/`)

### `GameHelpers` & `GameUI`
- **Purpose:** Helpers and UI rendering for the Sudoku board.
- **Key responsibilities:** Render grid, handle cell selection/input, maintain move history, update remaining counts, and highlight conflicts.
- **Location:** `src/client/ui/gameHelpers.js`, `src/client/ui/gameUi.js`

### `UICore`
- **Purpose:** Core UI utilities.
- **Key responsibilities:** Player lists, profiles, chat messages, stats, badges, toasts.
- **Location:** `src/client/ui/uiCore.js`

### `CookieConsent`
- **Purpose:** GDPR/PECR compliant cookie consent management.
- **Location:** `src/client/ui/cookieConsent.js`

### `LegalModals`
- **Purpose:** Privacy policy, terms of service, cookies, and accessibility modals.
- **Location:** `src/client/ui/legalModals.js`

### `UpdatesCenter`
- **Purpose:** Community updates feed and banner system (Firestore-driven).
- **Location:** `src/client/ui/updatesCenter.js`

### `AdminConsole`
- **Purpose:** Admin panel for managing updates, moderation, allowlists.
- **Location:** `src/client/ui/adminConsole.js`

### `FloatingChat`
- **Purpose:** Chat widget UI, direct messages, notifications, and channel management.
- **Location:** `src/client/ui/floatingChat.js`

### `ProfilePage`
- **Purpose:** Profile page initialization, editing, social sharing, and URL routing.
- **Location:** `src/client/ui/profilePage.js`

### `TourSystem`
- **Purpose:** Onboarding tour for new users.
- **Location:** `src/client/ui/tourSystem.js`

### `PasswordReset`
- **Purpose:** Password reset flow UI.
- **Location:** `src/client/ui/passwordReset.js`

## Libraries (`src/client/lib/`)

### `SudokuGenerator`
- **Purpose:** Create and solve Sudoku puzzles for different difficulties.
- **Location:** `src/client/lib/sudokuGenerator.js`

### `ProfanityFilter`
- **Purpose:** Client-side filtering for user-generated text (basic replacement).
- **Location:** `src/client/lib/profanityFilter.js`

### `PasswordPolicy`
- **Purpose:** Password validation matching Firebase enforcement.
- **Location:** `src/client/lib/passwordPolicy.js`

### `VersionManager`
- **Purpose:** App version and cache management.
- **Location:** `src/client/lib/versionManager.js`

## Notes and contributor guidance
- This file should reflect the managers and modules in the `src/client/` directory. If you add or rename a module, update this document.
- Prefer adding new domain logic as a manager object to keep code organized. Keep each manager focused and well-documented.
- Managers are also exposed at `window.Stonedoku.Managers` to support incremental refactoring and modular imports.
- AI agents and contributors: before modifying managers, read this MANAGERS.md and the `.github/prompts/AI_PROMPTS.prompt.md` guidance (if present) so changes align with project conventions.

## Naming Conventions

### Factory Functions
- Use `createXxx` pattern (camelCase): `createPresenceManager`, `createUiCore`, `createGameUi`
- Avoid uppercase acronyms: prefer `createUiHelpers` over `createUIHelpers`

### Module Files
- File names in camelCase: `presenceManager.js`, `uiCore.js`, `gameUi.js`

### Singleton Exports
- PascalCase for singleton objects: `AudioManager`, `MotionSystem`, `SudokuGenerator`
- These are pre-instantiated objects, not factories

### Barrel Exports
- Each directory has an `index.js` that re-exports all public APIs
- Keep barrel exports in sync with individual module exports

### Global Exports
- Legacy globals attached to `window` for debugging: `window.AppState`, `window.ViewManager`
- Organized exports at `window.Stonedoku.Managers` and `window.Stonedoku.Utils`
