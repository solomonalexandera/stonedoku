# Changelog

All notable changes to the Stonedoku project are documented here.

## [Unreleased]

### Fixed - 2025-01-03
- **Display name consistency**: Fixed inconsistent username/displayName usage across the application
  - Chat messages now use `getCurrentDisplayName()` helper for consistent display names
  - Added username fallback to `getCurrentDisplayName()` function
  - Profile displays now properly fall back to username when displayName is missing
  - Fixed mini profile tooltips to show correct names for all user types
- **Social feature access**: Improved detection of email-authenticated users for social features
  - Mini profile engagement options now properly unlock for registered users
  - Better error handling for targetIsGuest detection in profile tooltips
  - Consistent `isRegisteredUser()` checks across all social interactions

### Changed - 2025-01-03
- **Code consolidation**: Removed duplicate utility functions for better maintainability
  - Removed duplicate `getCurrentDisplayName()` and `isRegisteredUser()` from authFlow.js
  - Consolidated `escapeHtml()` function (gameFlow now uses UI.escapeHtml)
  - Single source of truth for all helper utilities in entry.js
- **Performance improvements**: Implemented event delegation pattern
  - Friends list now uses event delegation instead of per-item listeners
  - DM conversations list uses event delegation for better performance
  - Player list hover events use delegation to prevent memory leaks
  - Badge list click handlers use delegation pattern

### Added - 2025-01-02
- **Comprehensive Audio Manager Enhancement**: Professional sound design overhaul
  - Master gain control for volume management
  - Duplicate prevention system with cooldown tracking
  - New sound effects: clearCell, note, tie, countdown, opponentMove, friendRequest, badgeEarned, soundToggle
  - Enhanced victory/defeat sounds with extended durations and depth
  - Detailed JSDoc documentation for all audio methods
  - Staggered badge earned sounds for post-match celebration
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
- **Badge awards post-match modal race condition**: Fixed timing issue preventing badge display on versus game completion
  - Made `endVersusGame()` async and awaited `profileManager.updateStats()` calls
  - Made `handleMatchUpdate()` async to await badge checking before showing post-match modal
  - Ensures `appState.newBadgesPostMatch` is populated before post-match screen renders
- **Badge awards single player support**: Extended badge awards system to single player games
  - Made `endSinglePlayerGame()` async and awaited `profileManager.updateStats()` calls
  - Made `checkSinglePlayerComplete()` async to await badge checking before modal display
  - Added "New Awards!" section to game-over-modal with same styling as post-match awards
  - Single player games now show earned badges with staggered celebratory sounds

### Changed - 2025-01-02
- **Sound Effects**: Enhanced audio feedback for better game feel
  - Clear cell now uses distinct playback instead of fill sound
  - Tie game results have unique sound signature
  - Badge earned displays staggered celebratory sounds
  - Victory/defeat sounds extended with better depth and presence
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
