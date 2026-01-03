/**
 * Application State
 * Central state management for the Stonedoku application
 */

/**
 * Load settings from localStorage
 * @returns {Object} Saved settings or defaults
 */
function loadSavedSettings() {
    try {
        const saved = localStorage.getItem('stonedoku_game_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                highlightConflicts: parsed.highlightConflicts !== undefined ? parsed.highlightConflicts : true,
                highlightSameNumbers: parsed.highlightSameNumbers !== undefined ? parsed.highlightSameNumbers : true,
                autoCheck: parsed.autoCheck !== undefined ? parsed.autoCheck : true,
                notifications: parsed.notifications || {
                    global: true,
                    game: true,
                    dms: true,
                    sound: true,
                    badges: true
                }
            };
        }
    } catch (e) {
        console.warn('Failed to load saved settings:', e);
    }
    
    // Return defaults if no saved settings
    return {
        highlightConflicts: true,
        highlightSameNumbers: true,
        autoCheck: true,
        notifications: {
            global: true,
            game: true,
            dms: true,
            sound: true,
            badges: true
        }
    };
}

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings object to save
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem('stonedoku_game_settings', JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save settings:', e);
    }
}

/**
 * Create the initial application state
 * @returns {Object} Application state object
 */
export function createAppState() {
    const savedSettings = loadSavedSettings();
    
    return {
        currentUser: null,
        currentView: 'auth',
        gameMode: null, // 'single' or 'versus'
        currentMatch: null,
        currentRoom: null,
        selectedCell: null,
        puzzle: null,
        solution: null,
        originalPuzzle: null,
        playerScore: 0,
        opponentScore: 0,
        gameTimer: null,
        gameSeconds: 0,
        timeLimitSeconds: 0,
        soundEnabled: true,
        listeners: [],
        onlinePlayers: {},
        currentOpponent: null,
        pendingChallenge: null,
        pendingUsername: null,
        authReady: false,
        onboarding: {
            active: false,
            step: 1,
            data: {
                username: '',
                email: '',
                password: '',
                avatarFile: null,
                avatarUrl: null
            }
        },
        passwordReset: {
            active: false,
            oobCode: null,
            email: null
        },
        profile: null,
        tour: {
            active: false,
            step: 0
        },
        mistakes: 0,
        maxMistakes: 3,
        notesMode: false,
        notes: {},
        moveHistory: [],
        currentDifficulty: 'medium',
        widgetChatMode: 'global',
        widgetGameChatContext: null,
        widgetGameChatUnsub: null,
        activeDMs: {},
        dmThreads: {},
        friends: [],
        settings: savedSettings,
        moderation: {
            muted: false,
            blocked: false
        },
        moderationChatNotified: false,
        // Additional state for view management
        viewingProfileId: null,
        lastMatch: null,
        lastOpponentId: null,
        isGameOver: false,
        newBadgesPostMatch: [] // Badges earned in the last match, displayed post-match
    };
}

/**
 * Set moderation state with optional notification
 * @param {Object} AppState - Application state
 * @param {Object} partial - Partial moderation state
 * @param {Object} options - Options
 * @param {boolean} options.notify - Whether to show notification
 * @param {Function} showToast - Toast notification function
 */
export function setModerationState(AppState, partial = {}, { notify = true } = {}, showToast = null) {
    const prevMuted = !!AppState.moderation.muted;
    const prevBlocked = !!AppState.moderation.blocked;
    const nextMuted = partial.muted !== undefined ? !!partial.muted : prevMuted;
    const nextBlocked = partial.blocked !== undefined ? !!partial.blocked : prevBlocked;
    AppState.moderation.muted = nextMuted;
    AppState.moderation.blocked = nextBlocked;
    if (notify && showToast) {
        if (!prevMuted && nextMuted) showToast('You are muted by an administrator.', 'warn');
        if (!prevBlocked && nextBlocked) showToast('You are blocked from messaging.', 'warn');
    }
}

/**
 * Apply moderation from profile data
 * @param {Object} AppState - Application state
 * @param {Object} data - Profile data
 */
export function applyProfileModeration(AppState, data) {
    const mod = data?.moderation || {};
    setModerationState(AppState, {
        muted: !!mod.muted || !!AppState.moderation.muted,
        blocked: !!mod.blocked || !!AppState.moderation.blocked
    }, { notify: false });
}

// Default singleton export
export const AppState = createAppState();
