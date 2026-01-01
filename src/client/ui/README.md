# /src/client/ui

UI components and DOM manipulation modules. These handle rendering, user interaction, and visual presentation.

## Conventions
- File names are lowerCamelCase with `Ui` suffix (e.g., `adminConsoleUi.js`)
- Factory pattern: `createXxx(deps)` for components with complex dependencies
- Singleton pattern: `Xxx` for simple helpers
- Focus on presentation; business logic belongs in managers

## Inventory
| File | Export | Description |
|------|--------|-------------|
| `gameUi.js` | `createGameUi` | Sudoku board rendering and cell interactions |
| `gameHelpersUi.js` | `createGameHelpers` | Tool limits, progress, highlights |
| `boardIntegrityUi.js` | `BoardIntegrityHelper` | Grid fracture/repair visual effects |
| `uiHelpers.js` | `createUiHelpers` | Toasts, profiles, mini-profiles, badges |
| `floatingChatUi.js` | `createFloatingChat` | Chat widget UI |
| `profilePageUi.js` | `createProfilePage` | Profile view and editing |
| `passwordResetUi.js` | `createPasswordReset` | Password reset UI flow |
| `cookieConsentUi.js` | `createCookieConsent` | Cookie consent banner |
| `legalModalsUi.js` | `createLegalModals` | Terms/privacy modals |
| `updatesCenterUi.js` | `createUpdatesCenter` | News/updates feed |
| `adminConsoleUi.js` | `createAdminConsole` | Admin moderation panel |
| `index.js` | - | Barrel exports |
