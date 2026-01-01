# /src/client/managers

Stateful service modules that manage application data, state, and coordinate operations across the app. Each manager encapsulates a domain of functionality.

## Conventions
- One manager per file
- File names are lowerCamelCase (e.g., `chatManager.js`)
- Factory pattern: `createXxxManager(deps)` returns instance
- Singleton pattern: `XxxManager` object (for stateless services with init)
- Managers may import from `/lib` and `/ui`
- Avoid circular dependencies between managers

## Inventory
| File | Export | Description |
|------|--------|-------------|
| `audioManager.js` | `AudioManager` | Web Audio API sound effects |
| `presenceManager.js` | `createPresenceManager` | Online presence tracking via RTDB |
| `profileManager.js` | `createProfileManager` | User profiles, friends, badges |
| `friendsManager.js` | `createFriendsManager` | Friends list UI and actions |
| `chatManager.js` | `createChatManager` | Global chat, DMs, game chat |
| `lobbyManager.js` | `createLobbyManager` | Game room creation/joining |
| `matchManager.js` | `createMatchManager` | Active match state management |
| `challengeSystemManager.js` | `createChallengeSystemManager` | Challenge invites and notifications |
| `viewManager.js` | `createViewManager` | SPA view navigation |
| `tourManager.js` | `createTourManager` | New user onboarding tour |
| `onboardingManager.js` | `createOnboardingManager` | Account registration wizard |
| `creativeFeatures.js` | `createCreativeFeatures` | Streak, confetti, cell animations |
| `architecturalStateManager.js` | `createArchitecturalStateManager` | Board fracture/repair effects |
| `accessibilityManager.js` | `createAccessibilityManager` | Keyboard nav, ARIA, screen readers |
| `logManager.js` | `createLogManager` | Client-side logging to Firestore |
| `index.js` | - | Barrel exports |
