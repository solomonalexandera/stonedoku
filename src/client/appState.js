// src/client/appState.js

export const AppState = {
    currentUser: null,
    currentView: 'auth',
    gameMode: null, 
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
    pendingJoinCode: null,
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
        hintMax: 0,
        fillMax: 0
    },
    toolsUsed: {
        undo: 0,
        erase: 0,
        hint: 0,
        fill: 0
    },
    settings: {
        theme: 'stone',
        sound: true,
        notifications: {
            challenges: true,
            dms: true,
            game: true,
            badges: true
        }
    },
    friends: [], 
    moderation: {
        muted: false,
        blocked: false
    }
};
