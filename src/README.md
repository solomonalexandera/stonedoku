# Stonedoku Source Directory Structure

This directory contains all application source code, organized by responsibility.

## Directory Structure

```
src/client/
├── core/           # Application bootstrap and configuration
│   ├── appState.js         # Central state container
│   ├── authFlow.js         # Auth persistence helpers
│   ├── eventSetup.js       # DOM event listeners
│   ├── firebase.js         # Firebase SDK initialization
│   ├── gameFlow.js         # Game initialization & coordination
│   └── index.js
│
├── lib/            # Pure utility libraries (no state, no side effects)
│   ├── motionUtils.js      # Animation with reduced-motion support
│   ├── passwordPolicy.js   # Password validation
│   ├── profanityFilter.js  # Chat content filtering
│   ├── sudokuGenerator.js  # Puzzle generation
│   ├── versionUtils.js     # Version/cache management
│   └── index.js
│
├── managers/       # Stateful services (factory pattern: createXxxManager)
│   ├── accessibilityManager.js   # ARIA labels, screen reader
│   ├── architecturalStateManager.js # Board fracture effects
│   ├── audioManager.js           # Sound effects
│   ├── challengeSystemManager.js # Player challenges
│   ├── chatManager.js            # Global/DM/game chat
│   ├── creativeFeaturesManager.js # Streaks, confetti
│   ├── friendsManager.js         # Friends list UI
│   ├── lobbyManager.js           # Game rooms
│   ├── logManager.js             # Client logging
│   ├── matchManager.js           # 1v1 match state
│   ├── onboardingManager.js      # Registration wizard
│   ├── presenceManager.js        # Online presence
│   ├── profileManager.js         # User profiles
│   ├── tourManager.js            # Onboarding tour
│   ├── viewManager.js            # View navigation
│   └── index.js
│
├── ui/             # UI components and DOM manipulation (suffix: Ui)
│   ├── adminConsoleUi.js     # Admin panel
│   ├── boardIntegrityUi.js   # Board visual effects
│   ├── cookieConsentUi.js    # GDPR consent
│   ├── floatingChatUi.js     # Chat widget
│   ├── gameHelpersUi.js      # Game UI utilities
│   ├── gameUi.js             # Sudoku board UI
│   ├── legalModalsUi.js      # Terms/privacy modals
│   ├── passwordResetUi.js    # Password reset UI
│   ├── profilePageUi.js      # Profile view
│   ├── uiHelpers.js          # Toasts, profiles, badges
│   ├── updatesCenterUi.js    # News feed
│   └── index.js
│
└── entry.js        # Main application entry point
```

## Design Principles

| Principle | Description |
|-----------|-------------|
| **Factory Pattern** | `createXxxManager({ deps })` for testability |
| **Dependency Injection** | Firebase, AppState passed as parameters |
| **Barrel Exports** | Each directory has `index.js` |
| **Separation of Concerns** | lib=pure, managers=state, ui=DOM, core=bootstrap |

## Module Categories

- **lib/** - Pure functions, no side effects, no state (suffix: `Utils`)
- **managers/** - Stateful services with Firebase integration (suffix: `Manager`)
- **ui/** - DOM manipulation and view logic (suffix: `Ui`)
- **core/** - Firebase init and app configuration

## Entry Point

`src/client/entry.js` is the main entry point:
1. Initializes Firebase services
2. Creates all manager instances  
3. Sets up auth state listener
4. Bootstraps the application

The legacy `app.js` in root is deprecated.

See `.github/MANAGERS.md` for complete manager documentation.
