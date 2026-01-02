# Changelog

All notable changes to the Stonedoku project are documented here.

## [Unreleased]

### Added - 2025-01-02
- **Badge Awards Post-Match Display**: Newly earned badges now display on post-match screen
  - "New Awards!" section shows all badges earned in the match
  - Each badge displays icon, name, and description
  - SlideInUp animation for visual impact and celebration
  - Consolidated badge notification system (removed floating reveals)
- **Badge Descriptions**: All 18 badges now include descriptive text
  - Examples: "Completed your first game", "Won 20 matches", "Have 5 friends"
- **Comprehensive test suite**: 190 unit tests covering all source modules (lib, core, managers, ui)
  - Tests for accessibilityManager, appState, audioManager, authFlow, eventSetup, gameHelpersUi
  - Tests for motionUtils, passwordPolicy, profileManager, uiHelpers, versionUtils, viewManager
  - Tests run with Node.js native test runner (`npm test`)
- **Live deployment smoke tests**: 12 Playwright tests for production environment validation
  - Test auth flows, lobby operations, chat functionality, friend features, profile management
  - Configured with `LIVE_BASE_URL` for Firebase hosting endpoint testing
- **Reserved username validation**: Block registration of admin/staff/moderator usernames
  - Client-side validation in profileManager and onboardingManager
  - Server-side enforcement in Firestore security rules
  - Prevents usernames containing: admin, administrator, staff, moderator, support, stonedoku, system

### Fixed - 2025-01-02
- **AdminConsole initialization**: Now receives proper Firebase dependencies (firestore, rtdb, functions)
  - Previously created as singleton with empty constructor, causing undefined references
- **UpdatesCenter initialization**: Fixed same issue as AdminConsole
- **Friends list population**: Fixed getFriends to map friend objects to IDs
  - `renderDmFriends` expects array of user IDs but was receiving friend objects
  - Added `.map(f => f.id || f)` to extract IDs from friend objects
- **Duplicate chat messages**: Implemented message deduplication in storeAppend
  - Checks for existing messages with same text, userId, and timestamp
  - Prevents duplicate messages from appearing in chat UI
- **Post-match buttons not working**: Implemented showPostMatchScreen and set AppState.lastMatch
  - Added complete post-match screen rendering with winner/loser display
  - Set `AppState.lastMatch` before showing screen to enable rematch/return buttons
- **Friend request acceptance permissions**: Changed from setDoc to updateDoc
  - Firestore security rules only allow `update` operation, not `create`
  - Changed both acceptFriendRequest and declineFriendRequest to use updateDoc

### Changed - 2025-01-02
- Version bumped from 20251231A to 20260102D (cache busting for deployments)

## [2024-12-31] - Modular Architecture Refactor

### Added
- Modular source structure under `src/client/` with core, lib, managers, ui directories
- Manager index at `.github/MANAGERS.md` documenting all application managers
- Entry point bootstrap (`src/client/entry.js`) for clean initialization
- Factory pattern for all managers (e.g., `createPresenceManager({ deps })`)
- Comprehensive manager documentation with dependency graphs

### Changed
- Extracted all functionality from monolithic `app.js` into focused modules
- Renamed "System" classes to "Manager" for consistency
- Standardized naming: managers use `createXxxManager`, UI modules end with `Ui`
- Migrated to src/client and src/server structure (server is symlink to functions/src)

### Removed
- Duplicate BoardIntegritySystem, GameHelpers, GameUI from app.js
- Backup files and old monolithic structure

### Fixed
- Shell compatibility issues in functions predeploy hook
- Naming inconsistencies across codebase
- Test infrastructure for new modular structure

## [2024-12] - Earlier Changes

### Added
- Server-side onboarding logic with robust fallbacks
- CommonJS wrapper for delete-all-users script in ESM repo
- Deployment automation via GitHub Actions (`.github/workflows/firebase-deploy.yml`)
- Dev server with environment-aware port binding (Cloud Workstations/IDX support)

### Changed
- Hide chat widget on landing page until user is authenticated
- Use `npx firebase-tools` instead of global firebase CLI
- Improved onboarding flow: disable 'start tutorial' until orientation completed

### Fixed
- General bug fixes and stability improvements
- Documentation updates for MANAGERS.md and AI context files

---

## Contributing

This project follows semantic versioning. When making changes:
1. Add entries under `[Unreleased]` section
2. Use categories: Added, Changed, Deprecated, Removed, Fixed, Security
3. On release, move unreleased changes to a dated version section
