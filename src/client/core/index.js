// src/client/core/index.js
// Barrel file for core modules (Firebase, config, etc.)
export * from './firebase.js';
export { createGameFlow } from './gameFlow.js';
export { createAuthFlow } from './authFlow.js';
export { createAppState, AppState, setModerationState, applyProfileModeration } from './appState.js';
