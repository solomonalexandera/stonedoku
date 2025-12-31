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
- `chatManager.js` – global chat, DMs, and in-match chat helpers (factory: `createChatManager`).
- `challengeManager.js` – challenge notification send/accept/decline flows (factory: `createChallengeManager`).
- `profileManager.js` – user profiles, vanity usernames, badges, avatars, and friend relationships (factory: `createProfileManager`).
