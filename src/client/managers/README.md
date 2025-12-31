# /src/client/managers

This directory contains high-level "manager" modules that encapsulate major domains of application functionality. Each manager should be a self-contained ES module that exports its public API.

## Conventions
- One manager per file.
- File names use lowerCamelCase that matches the exported manager (e.g., `audioManager.js` exports `AudioManager`).
- Manager exports are PascalCase singletons or factory creators (e.g., `AudioManager`, `createLobbyManager`).
- Prefer human-readable names; avoid abbreviations unless they are standard (e.g., `RTDB`).
- Managers can import from `/src/client/lib` and `/src/client/ui`.
- Avoid circular dependencies between managers.
- Add an export for new managers to `index.js`.

## Inventory
- `audioManager.js` – shared audio cues.
- `logManager.js` – console override and Firestore logging helper (factory: `createLogManager`).
- `profileManager.js` – user profiles, vanity usernames, badges, avatars, and friend relationships (factory: `createProfileManager`).
- `friendsManager.js` – lobby friends UI rendering backed by ProfileManager (factory: `createFriendsManager`).
- `lobbyManager.js` – lobby creation/join/leave, readiness, and chat helpers (factory: `createLobbyManager`).
- `matchManager.js` – 1v1 match lifecycle and RTDB board state (factory: `createMatchManager`).
