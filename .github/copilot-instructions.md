# Stonedoku AI Coding Agent Instructions

This document provides guidance for AI coding agents to effectively contribute to the Stonedoku project.

## Big Picture Architecture

Stonedoku is a web-based Sudoku game built with HTML5, CSS3, and JavaScript, and hosted on Firebase. It leverages several Firebase services:

- **Firebase Hosting:** Serves the static web application (`index.html`, `styles.css`, `app.js`).
- **Firebase Realtime Database (RTDB):** Manages real-time application state, including user presence, game lobbies, and in-progress match data. This is the primary data store for live gameplay.
- **Firestore:** Stores user profiles, stats, and other persistent data that doesn't require real-time updates.
- **Firebase Authentication:** Handles user authentication, primarily through anonymous sign-in.
- **Firebase Functions:** Provides backend logic, though the current implementation in `functions/src/index.ts` is minimal.

The application is structured as a single-page application (SPA) where the `ViewManager` in `app.js` controls which view is displayed to the user (`auth`, `lobby`, `game`, etc.).

### Key Files and Directories

- `index.html`: The main entry point for the application.
- `app.js`: Contains the majority of the client-side logic, including Firebase initialization, application state management, UI manipulation, and game logic.
- `styles.css`: Defines the application's visual style.
- `firebase.json`: Configures Firebase services, including hosting, Firestore, and Functions.
- `functions/`: Contains the source code for Firebase Functions (TypeScript).

## Critical Developer Workflows

### Local Development

To run the application locally, use the Firebase emulator suite:

```bash
firebase serve
```

This will serve the application at `http://localhost:5000`.

To work on Firebase Functions, you'll need to build the TypeScript source and run the emulators:

```bash
cd functions
npm install
npm run build:watch
```

In a separate terminal, from the root directory:
```bash
firebase emulators:start --only functions
```

### Deployment

To deploy the application to Firebase Hosting:

```bash
firebase deploy
```

To deploy only the Firebase Functions:
```bash
firebase deploy --only functions
```

## Project-Specific Conventions and Patterns

- **Application State:** A global `AppState` object in `app.js` holds the current state of the application. Avoid modifying this object directly from outside the core functions in `app.js`.
- **Managers:** The code in `app.js` is organized into "manager" objects (e.g., `ViewManager`, `PresenceManager`, `LobbyManager`, `MatchManager`). When adding new functionality, try to fit it within one of these existing managers or create a new one if necessary.
- **Manager Index:** Before writing any new functionality, consult the `.github/MANAGERS.md` file to see a list of existing managers and their responsibilities. If you create a new manager or significantly change the functionality of an existing one, update the `MANAGERS.md` file to reflect these changes.
 - **Manager Index:** Before writing any new functionality, consult the `.github/MANAGERS.md` file to see a list of existing managers and their responsibilities. Also review the AI prompts at `.github/prompts/AI_PROMPTS.prompt.md` for agent-specific guidance. If you create a new manager or significantly change the functionality of an existing one, update the `MANAGERS.md` file to reflect these changes.
 - **Testing for Managers:** Whenever you add a new manager, include an automated test that verifies its core behavior. Place UI/integration tests under `tests/playwright/` (use `tests/playwright/e2e-runner.html` helpers when appropriate) and place small unit-style tests under `tests/` or `tests/unit/`. Tests should be runnable via the project's existing Playwright harness or a simple node-based test runner and should be added alongside the code change in the same commit.
- **Firebase Modules:** The application uses the modular Firebase SDK (v9+), importing functions directly from the Firebase modules (e.g., `import { initializeApp } from 'firebase/app'`).
- **Realtime Database Structure:**
    - `presence/`: Stores the online status of users.
    - `lobbies/`: Contains information about game rooms.
    - `matches/`: Holds the state of active 1v1 games.

## Integration Points and External Dependencies

- **Firebase:** The primary and most critical dependency. The application is tightly coupled with Firebase services.
- **No other significant external dependencies** are used on the client-side, as seen in the root `package.json`. The client-side code uses ES module imports directly from the Firebase CDN.
- The Firebase Functions have dependencies on `firebase-admin`, `firebase-functions`, and TypeScript, as defined in `functions/package.json`.
## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase Hosting