# Stonedoku AI Coding Agent Instructions

This document provides guidance for AI coding agents to effectively contribute to the Stonedoku project.

## Big Picture Architecture

Stonedoku is a web-based Sudoku game built with HTML5, CSS3, and JavaScript, and hosted on Firebase. It leverages several Firebase services:

- **Firebase Hosting:** Serves the static web application.
- **Firebase Realtime Database (RTDB):** Manages real-time application state, including user presence, game lobbies, and in-progress match data. This is the primary data store for live gameplay.
- **Firestore:** Stores user profiles, stats, and other persistent data that doesn't require real-time updates.
- **Firebase Authentication:** Handles user authentication, including anonymous sign-in and email/password accounts.
- **Firebase Functions:** Provides backend logic for friend requests, moderation, and other server-side features.

The application is structured as a single-page application (SPA) with modular source code under `src/client/`.

### Key Files and Directories

- `index.html`: The main entry point for the application.
- `src/client/entry.js`: Main application bootstrap that initializes Firebase and all managers.
- `src/client/core/`: Core modules (AppState, Firebase, AuthFlow, GameFlow, EventSetup).
- `src/client/managers/`: Stateful service managers (ViewManager, PresenceManager, etc.).
- `src/client/ui/`: UI components and view controllers.
- `src/client/lib/`: Pure utility libraries (SudokuGenerator, ProfanityFilter, etc.).
- `styles.css`: Defines the application's visual style.
- `firebase.json`: Configures Firebase services, including hosting, Firestore, and Functions.
- `functions/`: Contains the source code for Firebase Functions (TypeScript).
- `src/server/`: Symlink to `functions/src/` for unified project structure.

## Critical Developer Workflows

### Local Development

To run the application locally:

```bash
npm run dev
```

The dev server binds to the correct port for your environment. Open the URL shown in the terminal.

To work on Firebase Functions:
```bash
cd functions
npm install
npm run build:watch
```

In a separate terminal:
```bash
firebase emulators:start --only functions
```

### Deployment

Local deploy (builds the bundle automatically via `firebase.json` predeploy):

```bash
npm run deploy
```

Deploy only specific parts:
```bash
npm run deploy:hosting
npm run deploy:functions
npm run deploy:rules
```

## Project-Specific Conventions and Patterns

- **Application State:** A global `AppState` object in `src/client/core/appState.js` holds the current state. Access via imports, avoid direct mutation from outside core modules.
- **Managers:** Code is organized into "manager" objects in `src/client/managers/`. These use a factory pattern (e.g., `createPresenceManager({ deps })`).
- **Manager Index:** Before writing new functionality, consult `.github/MANAGERS.md` for existing managers. Update this file when adding or changing managers.
- **Testing for Managers:** Include automated tests for new managers. Place UI/integration tests under `tests/playwright/` and unit tests under `tests/` or `tests/unit/`.
- **Firebase Modules:** The application uses the modular Firebase SDK (v9+), importing functions directly from the Firebase CDN modules.
- **Realtime Database Structure:**
    - `presence/`: Stores the online status of users.
    - `lobbies/`: Contains information about game rooms.
    - `matches/`: Holds the state of active 1v1 games.

## Integration Points and External Dependencies

- **Firebase:** The primary and most critical dependency. The application is tightly coupled with Firebase services.
- **No other significant external dependencies** are used on the client-side. The client-side code uses ES module imports directly from the Firebase CDN.
- The Firebase Functions have dependencies on `firebase-admin`, `firebase-functions`, and TypeScript.

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase Hosting