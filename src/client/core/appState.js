/**
 * Application State
 * Central state management for the Stonedoku application
 */

/**
 * Create the initial application state
 * @returns {Object} Application state object
 */
export function createAppState() {
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
        toolLimits: {
            undoMax: 0,
            eraseMax: 0,
            undoLeft: 0,
            eraseLeft: 0,
        },
        currentDifficulty: 'medium',
        widgetChatMode: 'global',
        widgetGameChatContext: null,
        widgetGameChatUnsub: null,
        activeDMs: {},
        dmThreads: {},
        friends: [],
        settings: {
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
        },
        moderation: {
            muted: false,
            blocked: false
        },
        moderationChatNotified: false,
        // Additional state for view management
        viewingProfileId: null,
        lastMatch: null,
        lastOpponentId: null,
        isGameOver: false
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
