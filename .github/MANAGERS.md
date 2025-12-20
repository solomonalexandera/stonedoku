# Stonedoku Manager Index

This document provides an index of the "manager" objects found in `app.js`. These managers encapsulate specific domains of functionality within the application. Before adding new features, consult this list to see if existing managers can be extended. If a new domain of functionality is required, create a new manager and add it to this index.

## Existing Managers

### `AudioManager`
- **Purpose:** Manages all audio-related features.
- **Functionality:** Uses the Web Audio API to play sound effects for various game events like filling a cell, errors, correct moves, victory, and defeat. It can be globally enabled or disabled via `AppState.soundEnabled`.

### `SudokuGenerator`
- **Purpose:** Handles the creation and solving of Sudoku puzzles.
- **Functionality:** Generates complete, valid Sudoku grids and creates puzzles of varying difficulty (easy, medium, hard) by removing cells from a solved grid.

### `ProfanityFilter`
- **Purpose:** Provides basic filtering for user-generated text.
- **Functionality:** A simple, client-side filter that replaces a predefined list of inappropriate words in chat messages with asterisks.

### `ViewManager`
- **Purpose:** Controls the visibility of different UI sections (views).
- **Functionality:** Manages the single-page application (SPA) flow by showing and hiding different views like `auth`, `lobby`, and `game`.

### `PresenceSystem`
- **Purpose:** Manages user online status and activity.
- **Functionality:** Uses Firebase Realtime Database's `.info/connected` feature to track a user's online status. It updates a user's presence in the `presence/` path of the RTDB, indicating their current activity (e.g., "In Lobby").

### `ProfileManager`
- **Purpose:** Manages persistent user data in Firestore.
- **Functionality:** Creates and updates user profiles, tracks statistics (wins/losses), and awards badges based on achievements. All data is stored in the `users` collection in Firestore.

### `LobbyManager`
- **Purpose:** Manages the creation and state of game lobbies.
- **Functionality:** Handles creating unique rooms, joining rooms, setting player ready status, and managing lobby-specific chat. It uses the `lobbies/` path in the RTDB.

### `MatchManager`
- **Purpose:** Manages the state and logic of an active 1v1 Sudoku match.
- **Functionality:** Creates new matches, handles player moves, validates them against the solution, updates scores and mistakes, and determines the win/loss condition. It uses the `matches/` path in the RTDB.

### `ChatManager`
- **Purpose:** Manages global and in-game chat functionality.
- **Functionality:** Sends and receives chat messages for both the global chat and specific game matches, leveraging the RTDB for real-time communication.

### `ChallengeSystem`
- **Purpose:** Handles player-to-player challenge notifications and acceptance flows.
- **Functionality:** Sends challenge notifications via RTDB (`notifications/`), listens for incoming notifications, and accepts/declines challenges by creating rooms or removing notifications.

### `UI` (UI Helpers)
- **Purpose:** Centralized DOM helpers and small UI affordances used across views.
- **Functionality:** Renders player lists and mini-profiles, positions tooltips, formats times, updates badges/stats, and provides utilities like `escapeHtml` and hover handlers.

### `GameHelpers`
- **Purpose:** Small game-related utilities used by the UI.
- **Functionality:** Counts placed numbers, updates remaining counts/progress/mistakes display, highlights conflicts/same numbers, manages move history and undo.

### `GameUI`
- **Purpose:** Render and interact with the Sudoku board and cells.
- **Functionality:** Creates the 9x9 grid, manages ARIA attributes for accessibility, renders puzzles (single-player vs board state), handles cell selection, and processes numeric input (delegating validation to the `MatchManager` in versus mode).

### Notes
- Before implementing new functionality, consult this `MANAGERS.md` to see whether an existing manager covers the domain. If adding or significantly changing a manager, update this file immediately.
