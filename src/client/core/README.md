# /src/client/core

Core application modules for bootstrap, configuration, and coordination.

## Conventions
- These modules are initialized early in application startup
- They provide fundamental services used by managers and UI
- Avoid heavy dependencies to prevent circular imports

## Inventory
| File | Export | Description |
|------|--------|-------------|
| `firebase.js` | Firebase services | Firebase SDK initialization and exports |
| `appState.js` | `AppState` | Global application state container |
| `authFlow.js` | `createAuthFlow` | Auth persistence and state helpers |
| `gameFlow.js` | `createGameFlow` | Game initialization and match coordination |
| `eventSetup.js` | `createEventSetup` | DOM event listener setup |
| `index.js` | - | Barrel exports |
