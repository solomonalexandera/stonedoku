// src/client/ui/index.js
// Barrel file for UI modules.
export { BoardIntegrityHelper } from './boardIntegrityUi.js';
export { createGameHelpers } from './gameHelpersUi.js';
export { createGameUi } from './gameUi.js';
export { createUiHelpers } from './uiHelpers.js';
export { createPasswordReset } from './passwordResetUi.js';
export { createCookieConsent, CookieConsent } from './cookieConsentUi.js';
export { createLegalModals, LegalModals } from './legalModalsUi.js';
export { createUpdatesCenter, UpdatesCenter } from './updatesCenterUi.js';
export { createAdminConsole, AdminConsole } from './adminConsoleUi.js';
export {
    createFloatingChat,
    createNotificationCenter,
    normalizeTimestamp,
    normalizeChatMessage
} from './floatingChatUi.js';
export {
    createProfilePage,
    initProfilePage,
    generateShareText,
    shareToSocial,
    handleVanityUrl,
    handleUpdatesUrl,
    handleAdminUrl,
    waitForAuthReady
} from './profilePageUi.js';
