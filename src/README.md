# Stonedoku Source Directory Structure

This directory contains all application source code, split into client and server:

## `/src/client/` - Frontend (Browser)

```
client/
├── core/           # Firebase initialization, config
│   ├── firebase.js # Firebase SDK setup and exports
│   └── index.js    # Barrel exports
├── lib/            # Pure utility libraries
│   ├── passwordPolicy.js    # Password validation
│   ├── profanityFilter.js   # Chat content filtering
│   ├── sudokuGenerator.js   # Puzzle generation
│   ├── versionManager.js    # App version/cache management
│   └── index.js
├── managers/       # Stateful services (factory pattern)
│   ├── architecturalStateSystem.js  # Visual state effects
│   ├── audioManager.js       # Sound effects
│   ├── challengeManager.js   # Player challenges (RTDB)
│   ├── challengeSystem.js    # Challenge notifications
│   ├── chatManager.js        # Chat (Firestore + RTDB)
│   ├── friendsManager.js     # Friends list
│   ├── lobbyManager.js       # Game rooms
│   ├── logManager.js         # Client logging to Firestore
│   ├── matchManager.js       # 1v1 match state
│   ├── motionSystem.js       # Animation helpers
│   ├── presenceManager.js    # Online presence
│   ├── profileManager.js     # User profiles
│   └── index.js
├── ui/             # UI components and view controllers
│   ├── boardIntegrity.js     # Sudoku board visual effects
│   ├── gameHelpers.js        # Game utility functions
│   ├── gameUi.js             # Main game UI
│   ├── passwordReset.js      # Password reset flow
│   ├── tourSystem.js         # Onboarding tour
│   ├── uiHelpers.js          # Generic UI utilities
│   ├── viewManager.js        # View/modal transitions
│   └── index.js
├── appState.js     # Central application state object
└── entry.js        # (Future) Main entry point
```

## `/src/server/` - Backend (Firebase Functions)

Symlink to `../functions/src/` for unified structure.

```
server/ -> ../functions/src/
├── api.ts          # HTTP API endpoints
├── firebaseAdmin.ts # Admin SDK setup
├── friends.ts      # Friend request triggers
├── index.ts        # Function exports
├── mail.ts         # Email notifications
├── mailer.ts       # Mailer triggers
├── moderation.ts   # Content moderation
└── vanity.ts       # Vanity URL lookup
```

## Design Principles

1. **Factory Pattern**: Most managers use `createXxxManager({ deps })` for testability
2. **Dependency Injection**: Managers receive Firebase refs, AppState, etc. as parameters
3. **Barrel Exports**: Each subdirectory has `index.js` for clean imports
4. **Separation of Concerns**:
   - `lib/` = Pure functions, no side effects
   - `managers/` = Stateful services with Firebase integration
   - `ui/` = DOM manipulation and view logic
   - `core/` = Firebase initialization and config

## Migration Status

The codebase is being migrated from a monolithic `app.js` to this modular structure.
See `.github/MANAGERS.md` for the complete manager reference.
