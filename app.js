// ===========================================
// Firebase Imports
// ===========================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
	import { 
	    getAuth, 
	    signInAnonymously, 
	    signInWithEmailAndPassword,
	    createUserWithEmailAndPassword,
	    updateProfile,
	    deleteUser,
	    signOut,
	    onAuthStateChanged,
	    setPersistence,
	    browserLocalPersistence,
	    browserSessionPersistence,
	    inMemoryPersistence,
	    verifyPasswordResetCode,
    confirmPasswordReset,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFunctions,
    httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { 
    getDatabase, 
    ref, 
    set, 
    get,
    push,
    update,
    remove,
    onValue,
    off,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onDisconnect,
    serverTimestamp,
    runTransaction,
    goOffline,
    goOnline
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
	import {
	    getFirestore,
	    initializeFirestore,
	    doc,
	    getDoc,
	    setDoc,
	    updateDoc,
	    deleteDoc,
	    collection,
	    query,
	    where,
	    getDocs,
	    orderBy,
	    onSnapshot,
	    limit,
	    documentId,
	    arrayUnion,
	    arrayRemove,
	    runTransaction as runFsTransaction,
	    Timestamp,
	    serverTimestamp as fsServerTimestamp,
	    enableNetwork,
	    disableNetwork
	} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import {
    createFriendsManager,
    createLobbyManager,
    createMatchManager,
    createPresenceManager,
    createProfileManager
} from './src/client/managers/index.js';
import { createLogManager } from './src/client/managers/logManager.js';
import { BoardIntegritySystem, createGameHelpers, createGameUI, createUIHelpers } from './src/client/ui/index.js';

// ===========================================
// Firebase Configuration
// ===========================================
// NOTE: Replace these placeholder values with your actual Firebase project config
// For production, consider using environment variables or a separate config file
const firebaseConfig = {
    apiKey: "AIzaSyCp7BkBGFmgjSL_28iexOAO7X4RoY_7tQ4",
    authDomain: "stonedoku-c0898.firebaseapp.com",
    projectId: "stonedoku-c0898",
    storageBucket: "stonedoku-c0898.firebasestorage.app",
    messagingSenderId: "755062989426",
    appId: "1:755062989426:web:446a5be32bf4d6b66198eb",
    databaseURL: "https://stonedoku-c0898-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const rtdb = getDatabase(firebaseApp);
// Force long-polling to avoid QUIC/WebChannel transport errors in constrained networks.
const firestore = initializeFirestore(firebaseApp, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
});
const functions = getFunctions(firebaseApp);
const storage = getStorage(firebaseApp);

// ===========================================
// Password Policy (matches Firebase enforcement)
// ===========================================
const PasswordPolicy = {
    minLength: 6,
    maxLength: 4096,
    requireUppercase: true,
    requireLowercase: true,
    requireSpecial: true,

    validate(password) {
        const value = String(password || '');
        const issues = [];

        if (value.length < this.minLength) issues.push(`at least ${this.minLength} characters`);
        if (value.length > this.maxLength) issues.push(`no more than ${this.maxLength} characters`);
        if (this.requireUppercase && !/[A-Z]/.test(value)) issues.push('an uppercase letter');
        if (this.requireLowercase && !/[a-z]/.test(value)) issues.push('a lowercase letter');
        if (this.requireSpecial && !/[^A-Za-z0-9]/.test(value)) issues.push('a special character');

        return { ok: issues.length === 0, issues };
    },

    message(password) {
        const result = this.validate(password);
        if (result.ok) return '';
        const parts = result.issues;
        const list = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
        return `Password must include ${list}.`;
    }
};

// ==========================
// App version + cache management
// Fetches ` /version.txt ` at startup. If it differs from the stored
// `stonedoku_app_version`, clear caches, cookies, indexedDB and service
// workers to ensure clients pick up new assets after a deploy.
// To activate, update `version.txt` during your deploys.
// ==========================
async function clearAllCachesAndServiceWorkers() {
    try {
        // Clear the CacheStorage entries
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }

        // Unregister service workers
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
    } catch (e) {
        console.error('Cache clearing failed', e);
    }
}

function clearAllCookies() {
    try {
        const cookies = document.cookie ? document.cookie.split(';') : [];
        for (const cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            // Expire cookie for root path
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
            // Also try without path
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
    } catch (e) {
        console.error('Cookie clearing failed', e);
    }
}

async function ensureAppVersionFresh() {
    try {
        const res = await fetch('/version.txt', { cache: 'no-store' });
        if (!res.ok) return; // no version file
        const remote = (await res.text()).trim();
        if (!remote) return;
        const local = localStorage.getItem('stonedoku_app_version');
        if (!local) {
            // First run: record version without clearing persistence/auth data
            localStorage.setItem('stonedoku_app_version', remote);
            return;
        }
        if (local === remote) return; // same version

        // New version detected — clear caches/cookies and reload once
        console.info('New app version detected', { from: local, to: remote });
        await clearAllCachesAndServiceWorkers();
        clearAllCookies();
        localStorage.setItem('stonedoku_app_version', remote);
        // Use setTimeout so any in-flight operations can complete
        setTimeout(() => location.reload(true), 200);
    } catch (e) {
        console.error('ensureAppVersionFresh failed', e);
    }
}

// Kick off version check early
ensureAppVersionFresh();

// ==========================
// Client-side Log Manager
// Writes debug/info/error logs to Firestore `clientLogs` collection.
// Overrides console methods so logs are persisted and removed from console output.
// ==========================
const LogManager = createLogManager(firestore, () => window.AppState);

// ===========================================
// Application State
// ===========================================
const AppState = {
    currentUser: null,
    currentView: 'auth',
    gameMode: null, // 'single' or 'versus'
    currentMatch: null,
    currentRoom: null,
    selectedCell: null,
    puzzle: null,
    solution: null,
    originalPuzzle: null, // Store original puzzle to track user-filled cells
    playerScore: 0,
    opponentScore: 0,
    gameTimer: null,
    gameSeconds: 0,
    timeLimitSeconds: 0, // 0 = none (used in Custom Sudoku)
    soundEnabled: true,
    listeners: [],
    onlinePlayers: {},
    currentOpponent: null, // opponent ID in 1v1 mode
    pendingChallenge: null, // { fromUserId, fromName } for incoming challenge modal
    pendingUsername: null, // Username pending for new signups
    authReady: false, // Flag for auth state ready
    // Onboarding state
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
    // Tour state
    tour: {
        active: false,
        step: 0
    },
    // New QOL features
    mistakes: 0,
    maxMistakes: 3,
    notesMode: false,
    notes: {}, // cellIndex -> Set of numbers
    moveHistory: [], // for undo
    toolLimits: {
        undoMax: 0,
        eraseMax: 0,
        undoLeft: 0,
        eraseLeft: 0,
    },
    currentDifficulty: 'medium',
    widgetChatMode: 'global', // 'global', 'game', or 'dm_[userId]'
    widgetGameChatContext: null, // 'lobby:<code>' | 'match:<id>'
    widgetGameChatUnsub: null, // function to stop current game-channel listener
    activeDMs: {}, // userId -> { messages: [], unread: 0 }
    dmThreads: {}, // otherUserId -> { otherDisplayName, lastText, lastTimestamp, unread }
    friends: [], // Array of friend user IDs
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
    moderationChatNotified: false
};

// Instantiate modular game helpers using shared AppState and BoardIntegritySystem.
const GameHelpers = createGameHelpers({ AppState, BoardIntegritySystem });
window.GameHelpers = GameHelpers;

function setModerationState(partial = {}, { notify = true } = {}) {
    const prevMuted = !!AppState.moderation.muted;
    const prevBlocked = !!AppState.moderation.blocked;
    const nextMuted = partial.muted !== undefined ? !!partial.muted : prevMuted;
    const nextBlocked = partial.blocked !== undefined ? !!partial.blocked : prevBlocked;
    AppState.moderation.muted = nextMuted;
    AppState.moderation.blocked = nextBlocked;
    if (notify) {
        if (!prevMuted && nextMuted) UI.showToast('You are muted by an administrator.', 'warn');
        if (!prevBlocked && nextBlocked) UI.showToast('You are blocked from messaging.', 'warn');
    }
}

function applyProfileModeration(data) {
    const mod = data?.moderation || {};
    setModerationState({
        muted: !!mod.muted || !!AppState.moderation.muted,
        blocked: !!mod.blocked || !!AppState.moderation.blocked
    }, { notify: false });
}

	function isRegisteredUser(user = AppState.currentUser, profile = AppState.profile) {
	    if (!user) return false;
	    if (user.isAnonymous) return false;
	    // Align with security rules that require an email-bearing account.
	    const email = user.email || profile?.email || (user.providerData || []).map(p => p?.email).find(Boolean);
	    return !!email;
	}

const AudioManager = {
    context: null,
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            // Resume on first user gesture (required by most browsers).
            const resume = () => {
                if (!this.context) return;
                if (this.context.state === 'suspended') this.context.resume().catch(() => {});
                window.removeEventListener('pointerdown', resume);
                window.removeEventListener('keydown', resume);
            };
            window.addEventListener('pointerdown', resume, { once: true });
            window.addEventListener('keydown', resume, { once: true });
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },
    
    playTone(frequency, duration, type = 'sine') {
        if (!this.context || !AppState.soundEnabled) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },

    createNoiseBuffer(durationSeconds = 0.12) {
        if (!this.context) return null;
        const sr = this.context.sampleRate;
        const length = Math.max(1, Math.floor(sr * durationSeconds));
        const buffer = this.context.createBuffer(1, length, sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.9;
        }
        return buffer;
    },

    playNoiseBurst({ duration = 0.12, filterType = 'bandpass', frequency = 1100, q = 0.9, gain = 0.12 } = {}) {
        if (!this.context || !AppState.soundEnabled) return;
        const buffer = this.createNoiseBuffer(duration);
        if (!buffer) return;

        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const filter = this.context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = frequency;
        filter.Q.value = q;

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0.0001, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(gain, this.context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.context.destination);

        source.start(this.context.currentTime);
        source.stop(this.context.currentTime + duration);
    },
    
    playCellFill() {
        // "Stone tap": a short bandpassed noise + a muted low tone.
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.08 });
        this.playTone(240, 0.07, 'triangle');
    },
    
    playError() {
        // "Grave" error: low thud + descending tone.
        this.playNoiseBurst({ duration: 0.14, filterType: 'lowpass', frequency: 260, q: 0.7, gain: 0.12 });
        this.playTone(180, 0.18, 'sawtooth');
        setTimeout(() => this.playTone(130, 0.18, 'sawtooth'), 90);
    },
    
    playCorrect() {
        // Subtle "bell" acknowledgement.
        this.playTone(520, 0.16, 'sine');
        setTimeout(() => this.playTone(660, 0.18, 'sine'), 90);
    },
    
    playVictory() {
        // Restrained ceremonial cadence.
        [392, 523, 659, 784].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.24, 'sine'), i * 180);
        });
    },
    
    playDefeat() {
        [220, 196, 174, 155].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.28, 'sawtooth'), i * 220);
        });
    },

    playChatPing() {
        // Quiet, non-whimsical notification.
        this.playNoiseBurst({ duration: 0.07, filterType: 'bandpass', frequency: 900, q: 1.4, gain: 0.055 });
        this.playTone(330, 0.08, 'sine');
    },

    playDmPing() {
        // Slightly warmer ping for DMs.
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 760, q: 1.2, gain: 0.06 });
        this.playTone(294, 0.09, 'sine');
    }
};

// ===========================================
// Sudoku Generator
// ===========================================
const SudokuGenerator = {
    // Check if placing num at (row, col) is valid
    isValid(grid, row, col, num) {
        // Check row
        for (let x = 0; x < 9; x++) {
            if (grid[row][x] === num) return false;
        }
        
        // Check column
        for (let x = 0; x < 9; x++) {
            if (grid[x][col] === num) return false;
        }
        
        // Check 3x3 box
        const startRow = row - (row % 3);
        const startCol = col - (col % 3);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[startRow + i][startCol + j] === num) return false;
            }
        }
        
        return true;
    },
    
    // Solve the grid using backtracking
    solve(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const nums = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (this.isValid(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (this.solve(grid)) return true;
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    },
    
    // Shuffle array (Fisher-Yates)
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
    // Generate a complete valid Sudoku grid
    generateComplete() {
        const grid = Array(9).fill(null).map(() => Array(9).fill(0));
        this.solve(grid);
        return grid;
    },
    
    // Create puzzle by removing cells based on difficulty
    createPuzzle(difficulty = 'medium') {
        const solution = this.generateComplete();
        const puzzle = solution.map(row => [...row]);
        
        const cellsToRemove = {
            easy: 35,
            medium: 45,
            hard: 55
        };
        
        const removeCount = cellsToRemove[difficulty] || 45;
        let removed = 0;
        const positions = [];
        
        // Create list of all positions
        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }
        
        // Shuffle positions
        const shuffledPositions = this.shuffleArray(positions);
        
        for (const pos of shuffledPositions) {
            if (removed >= removeCount) break;
            
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            
            if (puzzle[row][col] !== 0) {
                puzzle[row][col] = 0;
                removed++;
            }
        }
        
        return { puzzle, solution };
    }
};

const isAutomationEnv = () => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    return navigator.webdriver ||
        navigator.userAgent.toLowerCase().includes('headless') ||
        window.location.hostname === '127.0.0.1';
};

const automationMode = isAutomationEnv();

// ===========================================
// Profanity Filter (Basic)
// ===========================================
const ProfanityFilter = {
    // Basic list of common inappropriate words
    // In production, consider using a more comprehensive third-party service
    badWords: [
        'spam', 'scam', 'hack', 'cheat', 'exploit',
        // Common mild profanity that should be filtered in a game context
        'stupid', 'idiot', 'loser', 'noob'
    ],
    
    filter(text) {
        let filtered = text;
        for (const word of this.badWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        }
        return filtered;
    }
};

// ===========================================
// View Manager
// ===========================================
const MotionSystem = {
    prefersReducedMotion() {
        try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
    },
    animateIn(el, type = 'view') {
        if (!el || this.prefersReducedMotion() || !el.animate) return;
        const keyframesByType = {
            view: [
                { opacity: 0, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ],
            modal: [
                { opacity: 0, transform: 'translateY(10px) scale(0.98)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
            ]
        };
        const frames = keyframesByType[type] || keyframesByType.view;
        const duration = type === 'modal' ? 420 : 360;
        el.animate(frames, { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' });
    },
    animateOut(el, type = 'view') {
        if (!el || this.prefersReducedMotion() || !el.animate) return Promise.resolve();
        const keyframesByType = {
            view: [
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(6px)' }
            ],
            modal: [
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: 'translateY(10px) scale(0.98)' }
            ]
        };
        const frames = keyframesByType[type] || keyframesByType.view;
        const duration = type === 'modal' ? 320 : 260;
        const anim = el.animate(frames, { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' });
        return anim.finished.catch(() => {});
    }
};

// ===========================================
// Architectural State System (Clash of Worlds)
// ===========================================
const ArchitecturalStateSystem = {
    _state: 'calm',
    _mistakeChain: 0,
    _timers: new Set(),
    _idleTimer: null,
    _idleInit: false,
    _lastInteraction: Date.now(),
    prefersReducedMotion() {
        return typeof MotionSystem?.prefersReducedMotion === 'function' && MotionSystem.prefersReducedMotion();
    },
    _clearTimers() {
        for (const t of this._timers) clearTimeout(t);
        this._timers.clear();
    },
    _apply(state) {
        this._state = state;
        const targets = [document.body, document.getElementById('app')].filter(Boolean);
        const all = ['state--calm', 'state--strain', 'state--collapse', 'state--restore'];
        targets.forEach((el) => {
            all.forEach((c) => el.classList.remove(c));
            el.classList.add(`state--${state}`);
        });
    },
    reset() {
        this._mistakeChain = 0;
        this._clearTimers();
        if (this._idleTimer) clearTimeout(this._idleTimer);
        this._idleTimer = null;
        this._apply('calm');
    },
    startIdleWatch() {
        if (this._idleInit) {
            this._scheduleIdle();
            return;
        }
        this._idleInit = true;

        const bump = () => {
            this._lastInteraction = Date.now();
            this._scheduleIdle();
        };

        ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
            document.addEventListener(evt, bump, { passive: true });
        });

        bump();
    },
    _scheduleIdle() {
        if (this._idleTimer) clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(() => {
            const shouldRun = AppState?.currentView === 'game' && !this.prefersReducedMotion() && this._state === 'calm';
            if (shouldRun) this.pulseStrain(900);
            this._scheduleIdle();
        }, 150000);
    },
    noteCorrect() {
        this._mistakeChain = 0;
        // Let existing sequences finish; otherwise ensure we return to calm quickly.
        if (this._state === 'strain') {
            this._clearTimers();
            const t = setTimeout(() => this._apply('calm'), 550);
            this._timers.add(t);
        }
    },
    pulseStrain(durationMs = 1100) {
        if (this.prefersReducedMotion()) return;
        this._clearTimers();
        this._apply('strain');
        const t = setTimeout(() => this._apply('calm'), durationMs);
        this._timers.add(t);
    },
    collapseSequence() {
        if (this.prefersReducedMotion()) return;
        this._clearTimers();
        this._apply('collapse');
        const t1 = setTimeout(() => this._apply('restore'), 2800);
        const t2 = setTimeout(() => this._apply('calm'), 4600);
        this._timers.add(t1);
        this._timers.add(t2);
    },
    noteMistake() {
        this._mistakeChain += 1;
        if (this._mistakeChain >= 2) {
            this.pulseStrain(1600);
        } else {
            this.pulseStrain(950);
        }
    },
    onVictory({ perfect = false } = {}) {
        this._mistakeChain = 0;
        if (perfect) {
            this.collapseSequence();
            return;
        }
        if (this.prefersReducedMotion()) return;
        this._clearTimers();
        this._apply('restore');
        const t = setTimeout(() => this._apply('calm'), 1200);
        this._timers.add(t);
    }
};

	const ViewManager = {
	    views: ['auth', 'onboarding', 'reset', 'lobby', 'waiting', 'pregame-lobby', 'game', 'postmatch', 'profile', 'updates', 'admin'],
	    
	    show(viewName) {
	        const prev = AppState.currentView;
	        if (prev === viewName) return;

        // Keep architectural effects scoped to gameplay.
        if (viewName !== 'game') {
            ArchitecturalStateSystem.reset();
        }

	        const nextEl = document.getElementById(`${viewName}-view`);
	        const prevEl = prev ? document.getElementById(`${prev}-view`) : null;

	        const setInert = (el, inert) => {
	            if (!el) return;
	            try {
	                if (inert) el.setAttribute('inert', '');
	                else el.removeAttribute('inert');
	            } catch { /* ignore */ }
	        };

	        const isActiveWithin = (container) => {
	            const active = document.activeElement;
	            return !!(container && active && container.contains(active));
	        };

	        const focusFirstIn = (container) => {
	            if (!container) return false;
	            const focusableSelector = [
	                'a[href]',
	                'button:not([disabled])',
	                'input:not([disabled])',
	                'select:not([disabled])',
	                'textarea:not([disabled])',
	                '[tabindex]:not([tabindex="-1"])',
	                '[contenteditable="true"]'
	            ].join(',');
	            const candidate = container.querySelector(focusableSelector);
	            try {
	                if (candidate && typeof candidate.focus === 'function') {
	                    candidate.focus({ preventScroll: true });
	                    return true;
	                }
	            } catch { /* ignore */ }
	            try {
	                // Make the container itself focusable as a fallback.
	                if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
	                container.focus({ preventScroll: true });
	                return true;
	            } catch {
	                return false;
	            }
	        };

	        // Show next immediately so state stays synchronous
	        if (nextEl) {
	            nextEl.style.display = 'block';
	            nextEl.setAttribute('aria-hidden', 'false');
	            setInert(nextEl, false);
	            MotionSystem.animateIn(nextEl, 'view');
	        }

	        // If focus is currently in the previous view, move it into the next view before hiding.
	        if (prevEl && prevEl !== nextEl && isActiveWithin(prevEl)) {
	            // Delay a tick so the target view is painted.
	            setTimeout(() => {
	                if (!focusFirstIn(nextEl)) {
	                    try { document.body?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
	                }
	            }, 0);
	        }

	        // Animate out previous, then hide it
	        if (prevEl && prevEl !== nextEl) {
	            MotionSystem.animateOut(prevEl, 'view').then(() => {
	                // If the previous view still contains focus, blur it before hiding for a11y.
	                if (isActiveWithin(prevEl)) {
	                    try { document.activeElement?.blur?.(); } catch { /* ignore */ }
	                }
	                prevEl.style.display = 'none';
	                prevEl.setAttribute('aria-hidden', 'true');
	                setInert(prevEl, true);
	            });
	        }

        // Hide all other non-target views
	        this.views.forEach((view) => {
	            if (view === viewName) return;
	            if (prev && view === prev) return;
	            const el = document.getElementById(`${view}-view`);
	            if (el) {
	                if (isActiveWithin(el)) {
	                    try { document.activeElement?.blur?.(); } catch { /* ignore */ }
	                }
	                el.style.display = 'none';
	                el.setAttribute('aria-hidden', 'true');
	                setInert(el, true);
	            }
	        });

        AppState.currentView = viewName;
    },
    
	    showModal(modalId) {
	        const modal = document.getElementById(modalId);
	        if (!modal) return;
	        modal.style.display = 'flex';
	        modal.setAttribute('aria-hidden', 'false');
	        try { modal.removeAttribute('inert'); } catch { /* ignore */ }
	        MotionSystem.animateIn(modal, 'modal');
	    },
	    
	    hideModal(modalId) {
	        const modal = document.getElementById(modalId);
	        if (!modal) return;
	        MotionSystem.animateOut(modal, 'modal').then(() => {
	            try {
	                if (modal.contains(document.activeElement)) document.activeElement?.blur?.();
	            } catch { /* ignore */ }
	            modal.style.display = 'none';
	            modal.setAttribute('aria-hidden', 'true');
	            try { modal.setAttribute('inert', ''); } catch { /* ignore */ }
	        });
	    }
	};

// ===========================================
// Presence Manager
// ===========================================
const PresenceManager = createPresenceManager({ rtdb, appState: AppState });

// ===========================================
// User Profile Manager (modular)
// ===========================================
const ProfileManager = createProfileManager({
    firestore,
    rtdb,
    storage,
    appState: AppState,
    isRegisteredUser,
    getUI: () => UI,
    getBadgeInfo: () => UI?.badgeInfo
});

// ===========================================
// Friends Manager (modular)
// ===========================================
const FriendsManager = createFriendsManager({
    firestore,
    profileManager: ProfileManager,
    appState: AppState,
    isRegisteredUser,
    getUI: () => UI,
    getChatWidget: () => window.ChatWidget
});

// ===========================================
// Lobby Manager (modular)
// ===========================================
const LobbyManager = createLobbyManager({
    rtdb,
    appState: AppState
});

// ===========================================
// Match Manager (modular)
// ===========================================
const MatchManager = createMatchManager({
    rtdb,
    appState: AppState
});

// Global cleanup after a match (hoisted so other modules can call it)
async function cleanupAfterMatch() {
    // Clean up rematch listener
    try {
        if (rematchListener && AppState.lastMatch?.id) {
            off(ref(rtdb, `matches/${AppState.lastMatch.id}/rematch`));
            rematchListener = null;
        }
    } catch (e) {
        console.warn('Error cleaning rematch listener:', e);
    }

    // Leave room if still in one
    try {
        if (AppState.currentRoom) {
            await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser?.uid);
            AppState.currentRoom = null;
        }
    } catch (e) {
        console.warn('Error leaving room during cleanup:', e);
    }

    // Reset states
    AppState.currentMatch = null;
    AppState.lastMatch = null;
    AppState.lastOpponentId = null;
    AppState.currentOpponent = null;
    AppState.gameMode = 'lobby';

    // Stop widget Game-channel listener (match/lobby) and hide the Game tab.
    try {
        if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
    } catch { /* ignore */ }
    AppState.widgetGameChatUnsub = null;
    AppState.widgetGameChatContext = null;
    window.ChatWidget?.clearChannel?.('game');
    window.ChatNotifications?.markRead?.('game');
    const widgetGameTab = document.getElementById('widget-game-tab');
    if (widgetGameTab) widgetGameTab.style.display = 'none';

    // Remove versus-mode class
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) gameContainer.classList.remove('versus-mode');

    // Clear any pending opponent disconnect timers
    if (AppState.opponentDisconnectTimers) {
        Object.values(AppState.opponentDisconnectTimers).forEach(t => clearTimeout(t));
        AppState.opponentDisconnectTimers = {};
    }
}

// ===========================================
// Onboarding System
// ===========================================
	const OnboardingSystem = {
    // Initialize the onboarding flow
    start() {
        AppState.onboarding.active = true;
        AppState.onboarding.step = 1;
        AppState.onboarding.data = {
            username: '',
            email: '',
            password: '',
            avatarFile: null,
            avatarUrl: null
        };
        ViewManager.show('onboarding');
        this.updateProgress();
        this.setupListeners();
        
        // Focus the first input
        setTimeout(() => {
            document.getElementById('onboard-username')?.focus();
        }, 300);
    },
    
    // Setup all onboarding event listeners
    setupListeners() {
        // Step 1: Username
        const usernameInput = document.getElementById('onboard-username');
        const nextBtn1 = document.getElementById('onboard-next-1');
        const backBtn1 = document.getElementById('onboard-back-1');
        
        usernameInput?.addEventListener('input', async (e) => {
            const value = e.target.value.trim();
            const errorEl = document.getElementById('username-error');
            const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(value);
            
            if (value.length < 3) {
                errorEl.textContent = value.length > 0 ? 'Username must be at least 3 characters' : '';
                nextBtn1.disabled = true;
            } else if (!isValid) {
                errorEl.textContent = 'Only letters, numbers, and underscore allowed';
                nextBtn1.disabled = true;
            } else {
                // Check availability
                errorEl.textContent = 'Checking availability...';
                const available = await ProfileManager.checkUsernameAvailable(value);
                if (available) {
                    errorEl.textContent = '';
                    errorEl.style.color = '';
                    nextBtn1.disabled = false;
                    AppState.onboarding.data.username = value;
                } else {
                    errorEl.textContent = 'Username already taken';
                    errorEl.style.color = 'var(--color-danger)';
                    nextBtn1.disabled = true;
                }
            }
        });
        
        backBtn1?.addEventListener('click', () => {
            AppState.onboarding.active = false;
            ViewManager.show('auth');
        });
        
        nextBtn1?.addEventListener('click', () => {
            if (!nextBtn1.disabled) {
                this.goToStep(2);
            }
        });
        
        // Step 2: Email & Password
        const emailInput = document.getElementById('onboard-email');
        const passwordInput = document.getElementById('onboard-password');
        const confirmInput = document.getElementById('onboard-confirm');
        const nextBtn2 = document.getElementById('onboard-next-2');
        const backBtn2 = document.getElementById('onboard-back-2');
        
        const validateStep2 = () => {
            const email = emailInput?.value.trim();
            const password = passwordInput?.value;
            const confirm = confirmInput?.value;
            
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            const passwordResult = PasswordPolicy.validate(password);
            const passwordValid = passwordResult.ok;
            const confirmValid = password === confirm;
            
            // Update error messages
            document.getElementById('email-error').textContent = 
                handleGameCellClick(row, col) {
                    // This function is still used by multiplayer code
                    console.log('handleGameCellClick called', row, col);
                    const cell = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
                    if (!cell) return;

                    const isGiven = cell.classList.contains('given');
                    if (isGiven) return;

                    const num = AppState.puzzle?.[row]?.[col] || 0;

                    GameUI.selectCell(row, col);

                    GameHelpers.highlightSameNumbers(num);
                    GameUI.showNumberPad(row, col, isGiven, num);
                },

                handleNumberInput(num) {
                    console.log('handleNumberInput called with', num);

                    if (!AppState.selectedCell) return;
                    const { row, col } = AppState.selectedCell;

                    const cell = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
                    if (!cell) return;

                    // Don't allow input if the cell is a given in single player mode
                    const isGiven = cell.classList.contains('given');
                    if (isGiven && AppState.gameMode === 'single') return;

                    // In single player mode, cannot overwrite a given
                    if (AppState.gameMode === 'single' && AppState.originalPuzzle?.[row]?.[col] !== 0) {
                        return;
                    }

                    // In versus mode, validate based on board state
                    if (AppState.gameMode === 'versus') {
                        const board = AppState.versusBoard;
                        const cellData = board?.[`${row}_${col}`];
                        if (!cellData) return;
                        if (cellData.given) return;
                        if (cellData.filledBy && cellData.filledBy !== AppState.currentUser?.uid) return;
                    }

                    if (AppState.notesMode) {
                        GameUI.addNote(row, col, num);
                        return;
                    }

                    const oldValue = AppState.puzzle[row][col];
                    const valueEl = cell.querySelector('.cell-value');

                    // In 1v1: just place the number, RTDB validator handles correctness
                    if (AppState.gameMode === 'versus') {
                        this.placeVersusNumber(row, col, num);
                        return;
                    }

                    if (num === 0) {
                        // Clear the cell
                        GameHelpers.addToHistory(row, col, oldValue, 0);
                        AppState.puzzle[row][col] = 0;
                        if (valueEl) valueEl.textContent = '';
                        else cell.textContent = '';
                        cell.classList.remove('error', 'correct');
                        GameHelpers.updateRemainingCounts();
                        GameHelpers.updateProgress();
                        GameHelpers.consumeEraseIfNeeded(oldValue !== 0);
                        return;
                    }

                    const isCorrect = AppState.solution[row][col] === num;

                    GameHelpers.addToHistory(row, col, oldValue, num);
                    AppState.puzzle[row][col] = num;

                    if (valueEl) valueEl.textContent = num;
                    else cell.textContent = num;

                    if (isCorrect) {
                        cell.classList.add('correct');
                        cell.classList.remove('error');
                    } else {
                        cell.classList.add('error');
                        cell.classList.remove('correct');
                        AppState.mistakes++;
                        GameHelpers.updateMistakesDisplay();
                        if (AppState.mistakes >= AppState.maxMistakes) {
                            GameUI.endGame(false);
                            return;
                        }
                    }

                    GameHelpers.highlightConflicts(row, col, num);
                    GameHelpers.highlightSameNumbers(num);
                    GameHelpers.updateRemainingCounts();
                    GameHelpers.updateProgress();
                    BoardIntegritySystem.updateFromSingleState();
                    GameUI.checkWinCondition();
                },

                placeVersusNumber(row, col, num) {
                    const user = AppState.currentUser;
                    if (!user || !AppState.currentLobbyId) return;
                    const lobbyId = AppState.currentLobbyId;
                    const gameId = AppState.activeGameId;
                    if (!gameId) return;

                    const matchStateRef = ref(db, `matches/${gameId}/state`);
                    update(matchStateRef, {
                        [`board/${row}_${col}`]: {
                            value: num,
                            given: false,
                            filledBy: user.uid,
                            filledAt: Date.now()
                        }
                    }).catch(error => {
                        console.error('Error placing number:', error);
                        showToast('Failed to place number');
                    });
                },

                showNumberPad(row, col, isGiven, currentValue) {
                    const pad = document.getElementById('number-pad');
                    if (!pad) return;

                    AppState.selectedCell = { row, col };

                    pad.dataset.row = row;
                    pad.dataset.col = col;

                    // Position the pad near the cell
                    const cell = document.querySelector(
                        `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
                    );
                    if (!cell) return;
                    const rect = cell.getBoundingClientRect();
                    pad.style.top = `${rect.bottom + window.scrollY + 8}px`;
                    pad.style.left = `${rect.left + window.scrollX}px`;

                    pad.style.display = 'grid';
                    if (isGiven) {
                        pad.style.display = 'none';
                        return;
                    }

                    // Highlight currently selected number in the pad
                    pad.querySelectorAll('.num-btn').forEach(btn => {
                        const num = parseInt(btn.dataset.num || '0', 10);
                        btn.classList.toggle('selected', num === currentValue);
                    });
                },

                addNote(row, col, num) {
                    const key = `${row}_${col}`;
                    if (!AppState.notes[key]) {
                        AppState.notes[key] = new Set();
                    }
                    const notesSet = AppState.notes[key];

                    if (notesSet.has(num)) {
                        notesSet.delete(num);
                    } else {
                        notesSet.add(num);
                    }

                    const cell = document.querySelector(
                        `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
                    );
                    if (!cell) return;

                    const notesEl = cell.querySelector('.cell-notes');
                    GameHelpers.renderNotesForCell(notesEl, notesSet);
                },

                updateTimerDisplay() {
                    const timeElement = document.getElementById('game-timer');
                    if (timeElement) {
                        const seconds = Math.floor(AppState.gameTime / 1000);
                        const minutes = Math.floor(seconds / 60);
                        const remainingSeconds = seconds % 60;
                        timeElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                    }
                },

                updateVersusTimerDisplay() {
                    const timeElement = document.getElementById('versus-timer');
                    if (timeElement) {
                        const totalSeconds = Math.floor(AppState.gameTime / 1000);
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = totalSeconds % 60;
                        timeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }
                },

                startTimer() {
                    if (AppState.gameMode === 'versus') {
                        this.startVersusTimer();
                        return;
                    }
                    GameUI.stopTimer();
                    AppState.gameTime = 0;
                    AppState.gameStartTime = Date.now();
                    GameUI.updateTimerDisplay();
                    AppState.timer = setInterval(() => {
                        if (AppState.gameOver) return;
                        AppState.gameTime = Date.now() - AppState.gameStartTime;
                        GameUI.updateTimerDisplay();
                    }, 1000);
                },

                stopTimer() {
                    if (AppState.timer) {
                        clearInterval(AppState.timer);
                        AppState.timer = null;
                    }
                    if (AppState.versusTimer) {
                        clearInterval(AppState.versusTimer);
                        AppState.versusTimer = null;
                    }
                },

                startVersusTimer() {
                    GameUI.stopTimer();
                    AppState.gameTime = 0;
                    AppState.gameStartTime = Date.now();
                    GameUI.updateVersusTimerDisplay();
                    AppState.versusTimer = setInterval(() => {
                        if (AppState.gameOver) return;
                        AppState.gameTime = Date.now() - AppState.gameStartTime;
                        GameUI.updateVersusTimerDisplay();
                    }, 1000);
                },

                renderVersusBoard(boardState) {
                    const grid = document.getElementById('sudoku-grid');
                    if (!grid) return;

                    // Update status overlay
                    const statusEl = document.getElementById('versus-status');
                    if (statusEl) {
                        statusEl.textContent = AppState.gameOver ? 'Game Over' : '1v1 Match In Progress';
                    }

                    AppState.versusBoard = boardState;
                    this.renderPuzzle(boardState?.puzzle || AppState.puzzle, boardState?.board || {});
                },

                checkWinCondition() {
                    if (!AppState.puzzle || !AppState.solution) return;

                    for (let row = 0; row < 9; row++) {
                        for (let col = 0; col < 9; col++) {
                            if (AppState.puzzle[row][col] !== AppState.solution[row][col]) {
                                return;
                            }
                        }
                    }

                    GameUI.endGame(true);
                },

                endGame(won) {
                    console.log('Game ended, won:', won);

                    AppState.gameOver = true;
                    GameUI.stopTimer();

                    if (won) {
                        GameUI.showWinDialog();
                    } else {
                        GameUI.showLossDialog();
                    }
                },

                showWinDialog() {
                    const dialog = document.getElementById('win-dialog');
                    if (dialog) {
                        dialog.style.display = 'block';
                        dialog.setAttribute('aria-hidden', 'false');
                        // Focus the first button for accessibility
                        const firstBtn = dialog.querySelector('button');
                        if (firstBtn) firstBtn.focus();
                    }
                },

                showLossDialog() {
                    const dialog = document.getElementById('loss-dialog');
                    if (dialog) {
                        dialog.style.display = 'block';
                        dialog.setAttribute('aria-hidden', 'false');
                        const firstBtn = dialog.querySelector('button');
                        if (firstBtn) firstBtn.focus();
                    }
                }
            };
            // ===========================================
            // Event Handlers
            // ===========================================
            }
            alert(message);
        }
    },
    
    // Show confetti animation
    showConfetti() {
        const container = document.getElementById('onboarding-confetti');
        if (!container) return;

        // Respect reduced motion — onboarding should stay calm and dignified.
        if (typeof MotionSystem?.prefersReducedMotion === 'function' && MotionSystem.prefersReducedMotion()) return;

        const colors = ['#d8d1c5', '#c6c1b6', '#9c7b45', '#3f5543', '#0e0f12'];

        for (let i = 0; i < 28; i++) {
            const chip = document.createElement('div');
            const w = 3 + Math.random() * 5;
            const h = 3 + Math.random() * 10;
            const drift = (Math.random() - 0.5) * 80;

            chip.style.cssText = `
                position: absolute;
                width: ${w.toFixed(1)}px;
                height: ${h.toFixed(1)}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -16px;
                opacity: ${0.25 + Math.random() * 0.35};
                transform: translateX(0);
                animation: onboardingDustFall ${3.2 + Math.random() * 2.4}s cubic-bezier(0.2, 0, 0, 1) forwards;
                animation-delay: ${Math.random() * 0.6}s;
            `;
            chip.style.setProperty('--dust-drift', `${drift.toFixed(1)}px`);
            container.appendChild(chip);
        }

        if (!document.getElementById('onboarding-dust-style')) {
            const style = document.createElement('style');
            style.id = 'onboarding-dust-style';
            style.textContent = `
                @keyframes onboardingDustFall {
                    to {
                        transform: translateY(520px) translateX(var(--dust-drift, 0px));
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            container.innerHTML = '';
        }, 5200);
    },
    
    // Complete onboarding and properly initialize the user session
	    async complete() {
	        AppState.onboarding.active = false;
	        
	        const user = AppState.currentUser;
	        if (!user) {
	            ViewManager.show('auth');
	            return;
	        }
	        
	        try {
	            // Get the user's profile from Firestore
	            const profileRef = doc(firestore, 'users', user.uid);
	            const profileSnap = await getDoc(profileRef);
	            const profileData = profileSnap.exists() ? profileSnap.data() : null;
	            AppState.profile = profileData || null;
	            
	            // Use username as display name
            const displayName = profileData?.username || profileData?.displayName || getFallbackDisplayName(user, profileData);
            const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
	            
	            // Update UI
	            document.getElementById('user-info').style.display = 'flex';
	            document.getElementById('user-name').textContent = truncatedName;
	            document.getElementById('welcome-name').textContent = displayName;
	            AdminConsole.refreshAdminState().catch(() => {});
	            
	            // Store friends in state
	            AppState.friends = profileData?.friends || [];
	            FriendsManager.render().catch(() => {});
	            
	            // Update stats
	            UI.updateStats(profileData?.stats || { wins: 0, losses: 0 });
	            UI.updateBadges(profileData?.badges || []);

	            const allowDirectMessages = isRegisteredUser(user, profileData);
	            window.ChatWidget?.setDmEnabled?.(allowDirectMessages);
	            
	            // Initialize presence
	            PresenceManager.init(user.uid, displayName).catch((e) => console.warn('Presence init failed', e));
	            
	            // Listen to online players
	            PresenceManager.listenToOnlinePlayers((players) => {
	                AppState.onlinePlayers = players;
	                UI.updatePlayersList(players);
	            });
	            
	            // Listen to global chat
	            ChatManager.listenToGlobalChat((message) => {
	                window.ChatWidget?.ingestMessage?.('global', message);
	            });

	            if (allowDirectMessages) {
	                ChatManager.listenToDmThreads(user.uid, (threads) => {
	                    window.ChatWidget?.setDmThreads?.(threads);
	                });
	            } else {
	                window.ChatWidget?.setDmThreads?.([]);
	            }
	            
	            // Listen for challenges
	            ChallengeSystem.listenToNotifications(user.uid, (challengerId, notification) => {
	                handleChallengeNotification(challengerId, notification);
	            });
            
            // Show chat widget
            const chatWidget = document.getElementById('chat-widget');
            const chatFab = document.getElementById('chat-fab');
            if (chatWidget) chatWidget.style.display = 'flex';
            if (chatFab) chatFab.style.display = 'flex';
            
            ViewManager.show('lobby');
            PresenceManager.updateActivity('In Lobby');
            if (AppState.pendingJoinCode) {
                setTimeout(() => joinRoomHandler(AppState.pendingJoinCode), 50);
            }
            
        } catch (error) {
            console.error('Error completing onboarding:', error);
            ViewManager.show('lobby');
        }
    }
};

// ===========================================
// Password Reset Flow
// ===========================================
const PasswordReset = {
    state: { oobCode: null, email: null },

    togglePanels(mode = 'request') {
        const request = document.getElementById('reset-request-panel');
        const confirm = document.getElementById('reset-confirm-panel');
        const success = document.getElementById('reset-success-panel');
        if (request) request.style.display = mode === 'request' ? 'block' : 'none';
        if (confirm) confirm.style.display = mode === 'confirm' ? 'block' : 'none';
        if (success) success.style.display = mode === 'success' ? 'block' : 'none';
    },

    setStatus(id, message, isError = true) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = message || '';
        el.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
    },

    clearUrlParams() {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    },

    showRequest(prefillEmail = '') {
        AppState.passwordReset.active = true;
        this.state = { oobCode: null, email: prefillEmail || null };
        ViewManager.show('reset');
        this.togglePanels('request');
        this.setStatus('reset-request-status', '');
        this.setStatus('reset-confirm-status', '');
        const input = document.getElementById('reset-request-email');
        if (input) {
            input.value = prefillEmail || input.value || '';
            input.focus();
        }
    },

    extractFromHash() {
        const hash = window.location.hash || '';
        if (!hash.startsWith('#/reset')) return null;
        const queryIndex = hash.indexOf('?');
        const query = queryIndex !== -1 ? hash.substring(queryIndex + 1) : '';
        const params = new URLSearchParams(query);
        return {
            mode: params.get('mode'),
            oobCode: params.get('oobCode'),
            apiKey: params.get('apiKey')
        };
    },

    extractFromSearch() {
        const params = new URLSearchParams(window.location.search || '');
        const mode = params.get('mode');
        if (mode !== 'resetPassword') return null;
        return {
            mode,
            oobCode: params.get('oobCode'),
            apiKey: params.get('apiKey')
        };
    },

    async hydrateFromUrl() {
        try {
            const params = this.extractFromHash() || this.extractFromSearch();
            if (params && params.mode === 'resetPassword' && params.oobCode) {
                await this.loadCode(params.oobCode);
            }
        } catch (e) {
            console.error('Failed to hydrate reset link', e);
        }
    },

    async loadCode(oobCode) {
        try {
            const email = await verifyPasswordResetCode(auth, oobCode);
            this.state = { oobCode, email };
            AppState.passwordReset.active = true;
            ViewManager.show('reset');
            this.togglePanels('confirm');
            this.setStatus('reset-request-status', '');
            this.setStatus('reset-confirm-status', '');
            const display = document.getElementById('reset-email-display');
            if (display) display.textContent = email;
            const newPass = document.getElementById('reset-new-password');
            if (newPass) newPass.focus();
            this.clearUrlParams();
        } catch (error) {
            console.error('Reset code invalid or expired:', error);
            this.showRequest();
            this.setStatus('reset-request-status', 'Reset link is invalid or expired. Please request a new one.', true);
        }
    },

    async sendResetRequest(email) {
        const btn = document.querySelector('#reset-request-form button[type=\"submit\"]');
        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Sending...';
            }
            this.setStatus('reset-request-status', '');
            const continueUrl = `${window.location.origin}${window.location.pathname}#/reset`;
            const actionCodeSettings = {
                url: continueUrl,
                handleCodeInApp: true
            };

            try {
                await sendPasswordResetEmail(auth, email, actionCodeSettings);
            } catch (err) {
                const code = err?.code || '';
                // Avoid leaking whether an email exists.
                if (code === 'auth/user-not-found') {
                    this.setStatus('reset-request-status', 'If that email exists, a reset link is on its way.', false);
                    return;
                }
                // If client-side email sending is blocked/misconfigured, fall back to the server helper.
                try {
                    const resp = await fetch('/api/auth/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    const payload = await resp.json().catch(() => ({}));
                    if (!resp.ok) throw new Error(payload.error || 'Unable to send reset email.');
                } catch (fallbackErr) {
                    // Prefer a helpful message when the email is invalid.
                    if (code === 'auth/invalid-email') throw new Error('Please enter a valid email address.');
                    throw err;
                }
            }

            this.setStatus('reset-request-status', 'If that email exists, a reset link is on its way.', false);
        } catch (e) {
            console.error('Reset request failed', e);
            this.setStatus('reset-request-status', e.message || 'Failed to send reset email.', true);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Send reset link';
            }
        }
    },

    async submitNewPassword(password, confirm) {
        if (!this.state.oobCode) {
            this.setStatus('reset-confirm-status', 'Missing reset code. Please request a new link.', true);
            this.togglePanels('request');
            return;
        }
        const policy = PasswordPolicy.validate(password);
        if (!password || !policy.ok) {
            this.setStatus('reset-confirm-status', PasswordPolicy.message(password) || 'Password does not meet requirements.', true);
            return;
        }
        if (password !== confirm) {
            this.setStatus('reset-confirm-status', 'Passwords do not match.', true);
            return;
        }

        const btn = document.querySelector('#reset-confirm-form button[type=\"submit\"]');
        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Updating...';
            }
            await confirmPasswordReset(auth, this.state.oobCode, password);
            this.togglePanels('success');
            this.setStatus('reset-confirm-status', '');
            this.state = { oobCode: null, email: this.state.email };
            const newPass = document.getElementById('reset-new-password');
            const confirmPass = document.getElementById('reset-confirm-password');
            if (newPass) newPass.value = '';
            if (confirmPass) confirmPass.value = '';
            const emailInput = document.getElementById('signin-email');
            if (emailInput && this.state.email) {
                emailInput.value = this.state.email;
            }
        } catch (error) {
            console.error('Failed to complete password reset', error);
            this.setStatus('reset-confirm-status', '');
            this.setStatus('reset-request-status', 'Unable to update password. Please request a new link.', true);
            this.togglePanels('request');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Update password';
            }
            this.clearUrlParams();
        }
    }
};

// ===========================================
// Tour System
// ===========================================
const TourSystem = {
    steps: [
        {
            target: '.sudoku-grid',
            title: 'Guard the Grid',
            description: 'Tap any empty cell to select it. The grid is your cathedral floor—every placement must support the structure.',
            position: 'left'
        },
        {
            target: '#number-pad',
            title: 'Place Numbers',
            description: 'Use the number pad to carve digits into the stone. The remaining counter shows how many of each number are left.',
            position: 'left'
        },
        {
            target: '#notes-btn',
            title: 'Sketch Notes',
            description: 'Toggle Notes to mark possibilities in a cell. Notes keep the cathedral stable while you reason through options.',
            position: 'left'
        },
        {
            target: '#mistakes-display',
            title: 'Mind the Integrity',
            description: 'Each mistake weakens the structure. Watch your mistake pips here—three cracks and the board collapses.',
            position: 'left'
        },
        {
            target: '#chat-fab',
            title: 'Share & Duel',
            description: 'Open chat to coordinate, whisper, or DM. Share your room code or QR to invite an opponent, then defend your grid.',
            position: 'top'
        }
    ],
    
    start(force = false) {
        if (!force && typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
            try {
                if (localStorage.getItem('stonedoku_tour_done') === '1') {
                    UI.showToast('Orientation already completed. Run it again from your profile.', 'info');
                    return;
                }
            } catch { /* ignore */ }
        }
        // Make sure we're in the lobby first (tour targets live there).
        if (AppState.currentView !== 'lobby') {
            try { ViewManager.show('lobby'); } catch { /* ignore */ }
        }
        
        // Small delay to let lobby render
        setTimeout(() => {
            AppState.tour.active = true;
            AppState.tour.step = 0;
            
            const overlay = document.getElementById('tour-overlay');
            if (overlay) {
                overlay.style.display = 'block';
                overlay.classList.add('active');
            }
            
            document.getElementById('tour-total').textContent = this.steps.length;
            this.showStep(0);
            this.setupListeners();
        }, 300);
    },
    
    setupListeners() {
        document.getElementById('tour-next')?.addEventListener('click', () => {
            if (AppState.tour.step < this.steps.length - 1) {
                this.showStep(AppState.tour.step + 1);
            } else {
                this.end(true);
            }
        });
        
        document.getElementById('tour-skip')?.addEventListener('click', () => {
            this.end(false);
        });
    },

    showStep(stepIndex) {
        const step = this.steps[stepIndex];
        if (!step) return;
        
        AppState.tour.step = stepIndex;
        
        const target = document.querySelector(step.target);
        const spotlight = document.getElementById('tour-spotlight');
        const tooltip = document.getElementById('tour-tooltip');
        
        if (!target || !spotlight || !tooltip) return;

        // Ensure the target is actually visible (mobile + smaller screens).
        try {
            target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
        } catch { /* ignore */ }
        
        // Update spotlight
        const rect = target.getBoundingClientRect();
        const padding = 10;

        // Mobile-friendly fallback: if viewport is narrow, place tooltip full-width
        const isMobile = window.innerWidth <= 640;
        if (isMobile) {
            // center spotlight on target but limit size to viewport
            const w = Math.min(rect.width + padding * 2, window.innerWidth - 40);
            const h = Math.min(rect.height + padding * 2, window.innerHeight - 160);
            const left = Math.max(20, rect.left + rect.width / 2 - w / 2);
            const top = Math.max(80, rect.top + rect.height / 2 - h / 2);
            spotlight.style.left = `${left}px`;
            spotlight.style.top = `${top}px`;
            spotlight.style.width = `${w}px`;
            spotlight.style.height = `${h}px`;
            // Force tooltip to bottom for readability
            tooltip.className = 'tour-tooltip position-bottom mobile';
        } else {
            spotlight.style.left = `${rect.left - padding}px`;
            spotlight.style.top = `${rect.top - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;
        }
        
        // Update tooltip content
        document.getElementById('tour-title').textContent = step.title;
        document.getElementById('tour-description').textContent = step.description;
        document.getElementById('tour-current').textContent = stepIndex + 1;
        
        // Update next button text
        const nextBtn = document.getElementById('tour-next');
        if (nextBtn) {
            nextBtn.textContent = stepIndex === this.steps.length - 1 ? 'Finish' : 'Next →';
        }
        
        // Position tooltip
        tooltip.className = 'tour-tooltip position-' + step.position;
        
        const tooltipRect = tooltip.getBoundingClientRect();
        let tooltipX, tooltipY;
        
        switch (step.position) {
            case 'bottom':
                tooltipX = rect.left + rect.width / 2 - tooltipRect.width / 2;
                tooltipY = rect.bottom + 20;
                break;
            case 'top':
                tooltipX = rect.left + rect.width / 2 - tooltipRect.width / 2;
                tooltipY = rect.top - tooltipRect.height - 20;
                break;
            case 'left':
                tooltipX = rect.left - tooltipRect.width - 20;
                tooltipY = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
            case 'right':
                tooltipX = rect.right + 20;
                tooltipY = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
        }
        
        // Keep tooltip in viewport
        tooltipX = Math.max(10, Math.min(tooltipX, window.innerWidth - tooltipRect.width - 10));
        tooltipY = Math.max(10, Math.min(tooltipY, window.innerHeight - tooltipRect.height - 10));
        
        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
    },
    
    end(completed = false) {
        AppState.tour.active = false;
        
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
        }

        if (completed) {
            UI.showToast('Orientation complete.', 'success');
            try {
                const uid = AppState.currentUser?.uid;
                if (uid) {
                    updateDoc(doc(firestore, 'users', uid), { tourCompletedAt: serverTimestamp() }).catch(() => {});
                }
            } catch { /* ignore */ }
            if (typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
                try { localStorage.setItem('stonedoku_tour_done', '1'); } catch { /* ignore */ }
            }
        }
    },
};

// ===========================================
// Chat Manager
// ===========================================
// Global startup error capture and visible banner for tests
window.__startupErrors = window.__startupErrors || [];
window.addEventListener('error', (e) => {
    try {
        const msg = e && e.message ? e.message : String(e.error || e.reason || e);
        window.__startupErrors.push(msg);
        console.error('Startup error captured:', msg);
        UI && UI.showStartupError && UI.showStartupError(msg);
    } catch (_) {}
});
window.addEventListener('unhandledrejection', (ev) => {
    try {
        const msg = ev && ev.reason ? (ev.reason.message || String(ev.reason)) : 'Unhandled rejection';
        window.__startupErrors.push(msg);
        console.error('Unhandled rejection captured:', msg);
        UI && UI.showStartupError && UI.showStartupError(msg);
    } catch (_) {}
});

// Simple UI helper to show startup errors prominently so tests can see them
if (typeof UI === 'undefined') window.UI = {};
UI.showStartupError = UI.showStartupError || function(msg) {
    try {
        let el = document.getElementById('startup-error-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'startup-error-banner';
            el.style.position = 'fixed';
            el.style.left = '0';
            el.style.right = '0';
            el.style.top = '0';
            el.style.zIndex = '99999';
            el.style.background = 'rgba(200,50,50,0.95)';
            el.style.color = 'white';
            el.style.padding = '8px 12px';
            el.style.fontFamily = 'monospace';
            el.style.fontSize = '13px';
            el.style.maxHeight = '120px';
            el.style.overflow = 'auto';
            document.body && document.body.appendChild(el);
        }
        el.textContent = 'Startup error: ' + msg;
    } catch (_) {}
};
// Wire onboarding tutorial button (outside TourSystem to avoid syntax errors)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('start-tutorial');
    if (btn) {
        btn.addEventListener('click', () => {
            try { TutorialGame.start(); } catch (e) { console.warn('Failed to start tutorial', e); }
        });
    }
});
const ChatManager = {
    participantsEnsured: new Set(),

    dmIdFor(userA, userB) {
        return [userA, userB].sort().join('_');
    },

    async ensureDmParticipants(dmId, userA, userB) {
        try {
            if (!dmId || !userA || !userB) return;
            if (this.participantsEnsured.has(dmId)) return;
            const [a, b] = [userA, userB].sort();
            const participantsRef = ref(rtdb, `dmParticipants/${dmId}`);
            // Don't attempt to read first; rules may block reads until the node exists.
            // Create is allowed when absent; if it already exists, ignore the failure.
            try {
                await set(participantsRef, { a, b });
            } catch { /* ignore */ }
            // Mirror participants to Firestore for security rules lookup
            try {
                await setDoc(doc(firestore, 'dmParticipants', dmId), { participants: [a, b] });
            } catch (e) {
                console.warn('Failed to write dmParticipants to Firestore', e);
            }
            this.participantsEnsured.add(dmId);
        } catch (e) {
            console.warn('ensureDmParticipants failed', e);
        }
    },

    async updateDmThreads({ fromUserId, fromDisplayName, toUserId, toDisplayName, text }) {
        if (!fromUserId || !toUserId) return;

        const preview = String(text || '').slice(0, 240);
        const now = Date.now();

        const senderThreadRef = ref(rtdb, `dmThreads/${fromUserId}/${toUserId}`);
        const recipientThreadRef = ref(rtdb, `dmThreads/${toUserId}/${fromUserId}`);

        const safeToName = toDisplayName || AppState.dmThreads?.[toUserId]?.otherDisplayName || `Player_${toUserId.substring(0, 6)}`;
        const safeFromName = fromDisplayName || `Player_${fromUserId.substring(0, 6)}`;

        // Sender: last message, unread cleared.
        await update(senderThreadRef, {
            otherDisplayName: safeToName,
            lastText: preview,
            lastTimestamp: now,
            lastFrom: fromUserId,
            unread: 0
        });

        // Recipient: increment unread and update preview.
        await runTransaction(recipientThreadRef, (current) => {
            const cur = current || {};
            const unread = Math.max(0, Number(cur.unread) || 0);
            return {
                ...cur,
                otherDisplayName: cur.otherDisplayName || safeFromName,
                lastText: preview,
                lastTimestamp: now,
                lastFrom: fromUserId,
                unread: unread + 1
            };
        });
    },

    async sendGlobalMessage(userId, displayName, text) {
        // Normal global message
        
        // ProfanityFilter is now imported from its own module
        const filteredText = ProfanityFilter.filter(text);
        const chatRef = ref(rtdb, 'globalChat');

        // Push to RTDB (legacy)
        let pushRef = null;
        try {
            pushRef = await push(chatRef, {
                userId: userId,
                displayName: displayName,
                text: filteredText,
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.warn('RTDB push for global chat failed', e);
        }

        // Also write to Firestore for migration / long-term storage
        try {
            await addDoc(collection(firestore, 'globalChat'), {
                userId: userId,
                displayName: displayName,
                text: filteredText,
                rtdbKey: pushRef?.key || null,
                timestamp: fsServerTimestamp()
            });
        } catch (e) {
            console.warn('Failed to write global chat message to Firestore', e);
        }

        return { type: 'global' };
    },
    
    // Whisper feature removed. Use direct messages / DM panel instead.
    
    async sendDirectMessage(fromUserId, fromDisplayName, toUserId, text, toDisplayName = null) {
        try {
            const filteredText = ProfanityFilter.filter(text);
            const dmId = this.dmIdFor(fromUserId, toUserId);
            const dmRef = ref(rtdb, `directMessages/${dmId}`);

            await this.ensureDmParticipants(dmId, fromUserId, toUserId);

            let pushRef = null;
            try {
                pushRef = await push(dmRef, {
                    from: fromUserId,
                    fromDisplayName: fromDisplayName,
                    to: toUserId,
                    text: filteredText,
                    timestamp: serverTimestamp(),
                    read: false
                });
            } catch (e) {
                console.warn('RTDB push for DM failed', e);
            }

            // Mirror to Firestore
            try {
                await addDoc(collection(firestore, 'directMessages', dmId, 'messages'), {
                    from: fromUserId,
                    fromDisplayName: fromDisplayName,
                    to: toUserId,
                    text: filteredText,
                    rtdbKey: pushRef?.key || null,
                    timestamp: fsServerTimestamp(),
                    read: false
                });
            } catch (e) {
                console.warn('Failed to write DM to Firestore', e);
            }

            await this.updateDmThreads({
                fromUserId,
                fromDisplayName,
                toUserId,
                toDisplayName,
                text: filteredText
            });

            return dmId;
        } catch (e) {
            console.error('sendDirectMessage failed', { fromUserId, toUserId, error: e });
            throw e;
        }
    },
    
    listenToDirectMessages(dmId, callback) {
        const dmRef = ref(rtdb, `directMessages/${dmId}`);
        const listener = onChildAdded(dmRef, (snapshot) => {
            callback(snapshot.val());
        });
        AppState.listeners.push({ ref: dmRef, callback: listener });
        return listener;
    },
    
    listenToGlobalChat(callback) {
        const chatRef = ref(rtdb, 'globalChat');
        // Load initial messages and build a seen-keys set to avoid duplicates
        const seenKeys = new Set();
        get(query(chatRef, limitToLast(50))).then((snapshot) => {
            const initialMessages = [];
            snapshot.forEach((child) => {
                seenKeys.add(child.key);
                initialMessages.push(child.val());
            });
            initialMessages.forEach(callback);
        }).catch(e => console.warn('Failed to load initial global chat messages', e));

        // Listen for new messages and skip ones we've already seen
        const listener = onChildAdded(chatRef, (snapshot) => {
            if (seenKeys.has(snapshot.key)) return;
            seenKeys.add(snapshot.key);
            callback(snapshot.val());
        });

        AppState.listeners.push({ ref: chatRef, callback: listener });
        return listener;
    },

    listenToDmThreads(userId, callback) {
        const threadsRef = ref(rtdb, `dmThreads/${userId}`);
        const listener = onValue(threadsRef, (snapshot) => {
            const threads = [];
            snapshot.forEach((child) => {
                threads.push({ otherUserId: child.key, ...(child.val() || {}) });
            });
            callback(threads);
        });
        AppState.listeners.push({ ref: threadsRef, callback: listener });
        return listener;
    },
    
    async sendGameMessage(matchId, userId, displayName, text) {
        // ProfanityFilter is now imported from its own module
        const filteredText = ProfanityFilter.filter(text);
        const chatRef = ref(rtdb, `matches/${matchId}/chat`);
        
        await push(chatRef, {
            userId: userId,
            displayName: displayName,
            text: filteredText,
            timestamp: serverTimestamp()
        });
    },
    
    listenToGameChat(matchId, callback) {
        const chatRef = ref(rtdb, `matches/${matchId}/chat`);
        const listener = onChildAdded(chatRef, (snapshot) => {
            callback(snapshot.val());
        });
        AppState.listeners.push({ ref: chatRef, callback: listener });
        return listener;
    }
};

// ===========================================
// Orientation Manager - encourage portrait on small devices
// ===========================================
const OrientationManager = {
    init() {
        try {
            const dismissed = (() => {
                try { return localStorage.getItem('stonedoku_orientation_dismissed') === '1'; } catch { return false; }
            })();
            this.dismissed = dismissed;
        } catch { this.dismissed = false; }
        this.checkAndShow();
        window.addEventListener('resize', () => this.checkAndShow());
        window.addEventListener('orientationchange', () => setTimeout(() => this.checkAndShow(), 250));
    },
    checkAndShow() {
        if (this.dismissed) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const smallScreen = w <= 640;
        const landscapeOnSmall = smallScreen && w > h;
        const onboardingActive = !!AppState.onboarding.active;
        // If onboarding or tour is active we should nudge users to rotate when in landscape on small screens
        if (landscapeOnSmall) {
            this.showOverlay(onboardingActive);
        } else {
            this.hideOverlay();
        }
    },
    showOverlay(isOnboarding) {
        let el = document.getElementById('orientation-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'orientation-overlay';
            el.className = 'orientation-overlay';
            el.innerHTML = `
                <div class="orientation-card">
                    <h3>Rotate your device</h3>
                    <p>For the best experience, rotate your phone to portrait while completing onboarding and the tour.</p>
                    <div class="orientation-actions">
                        <button class="btn btn-primary" id="orientation-dismiss">Continue anyway</button>
                        <button class="btn btn-ghost" id="orientation-never">Don't show again</button>
                    </div>
                </div>`;
            document.body.appendChild(el);
            document.getElementById('orientation-dismiss')?.addEventListener('click', () => { this.hideOverlay(); });
            document.getElementById('orientation-never')?.addEventListener('click', () => { this.dismissed = true; try { localStorage.setItem('stonedoku_orientation_dismissed','1'); } catch{}; this.hideOverlay(); });
        }
        el.style.display = 'flex';
    },
    hideOverlay() {
        const el = document.getElementById('orientation-overlay');
        if (el) el.style.display = 'none';
    }
};

// ===========================================
// Tutorial Game - lightweight step-through tutorial
// ===========================================
const TutorialGame = {
    steps: [
        { title: 'Select a Cell', desc: 'Tap any empty cell to select it.' },
        { title: 'Choose a Number', desc: 'Use the number pad to place a number in the selected cell.' },
        { title: 'Use Notes', desc: 'Toggle notes to mark possibilities before committing.' },
        { title: 'Finish', desc: 'Well done — you completed the quick tutorial.' }
    ],
    start() {
        // Ensure player is registered into a lightweight tutorial mode
        try {
            ViewManager.show('game');
        } catch { /* ignore */ }
        AppState.tutorialActive = true;
        AppState.tutorialStep = 0;
        this.showOverlayStep(0);
        // If running in automation or with explicit flag, auto-complete the tutorial for testing.
        try {
            const params = new URLSearchParams(window.location.search || '');
            if (automationMode || params.get('autotutorial') === '1') {
                setTimeout(() => { try { this.autoComplete(); } catch (e) { console.warn('autoComplete failed', e); } }, 400);
            }
        } catch (e) {}
    },
    showOverlayStep(idx) {
        const step = this.steps[idx];
        if (!step) return this.end();
        let el = document.getElementById('tutorial-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tutorial-overlay';
            el.className = 'tutorial-overlay';
            el.innerHTML = `
                <div class="tutorial-card">
                    <h3 id="tutorial-title"></h3>
                    <p id="tutorial-desc"></p>
                    <div class="tutorial-actions">
                        <button class="btn btn-ghost" id="tutorial-skip">Skip</button>
                        <button class="btn btn-primary" id="tutorial-next">Next</button>
                    </div>
                </div>`;
            document.body.appendChild(el);
            document.getElementById('tutorial-next')?.addEventListener('click', () => { this.next(); });
            document.getElementById('tutorial-skip')?.addEventListener('click', () => { this.end(); });
        }
        document.getElementById('tutorial-title').textContent = step.title;
        document.getElementById('tutorial-desc').textContent = step.desc;
        el.style.display = 'flex';
        // Highlight target UI when possible
        try {
            const target = this.steps[idx]?.target;
            if (target) {
                const tEl = document.querySelector(target);
                if (tEl) {
                    tEl.classList.add('tutorial-highlight');
                    setTimeout(() => { try { tEl.classList.remove('tutorial-highlight'); } catch(e){} }, 2200);
                }
            }
        } catch (e) {}
        AppState.tutorialStep = idx;
    },
    next() {
        const nextIdx = (AppState.tutorialStep || 0) + 1;
        if (nextIdx >= this.steps.length) return this.end();
        this.showOverlayStep(nextIdx);
    },
    async end() {
        AppState.tutorialActive = false;
        const el = document.getElementById('tutorial-overlay');
        if (el) el.style.display = 'none';
        UI.showToast('Tutorial finished.', 'success');

        // Award tutorial badge for signed-in users
        try {
            const uid = AppState.currentUser?.uid;
            if (uid) {
                // Add badge to profile in Firestore (idempotent via arrayUnion in checkBadges path)
                const profileRef = doc(firestore, 'users', uid);
                try {
                    await updateDoc(profileRef, { badges: arrayUnion('tutorial') });
                } catch (e) {
                    // If update fails (no profile), ignore
                    console.debug('Failed to write tutorial badge', e);
                }
                // Record award
                try {
                    await addDoc(collection(firestore, 'badgeAwards'), {
                        userId: uid,
                        badge: 'tutorial',
                        createdAt: Timestamp.now()
                    });
                } catch (e) {
                    console.debug('Failed to record tutorial badge award', e);
                }
            }
        } catch (e) {
            console.warn('Error awarding tutorial badge', e);
        }

        // Return user to lobby
        try { ViewManager.show('lobby'); } catch {}
    },

    // Automated completion for testing environments. Uses existing GameUI helpers.
    async autoComplete() {
        if (!AppState.puzzle || !AppState.solution) {
            // Try to generate a lightweight puzzle for tutorial if missing
            try {
                const { puzzle, solution } = SudokuGenerator.createPuzzle('easy');
                AppState.puzzle = puzzle;
                AppState.solution = solution;
                try { GameUI.renderPuzzle(puzzle); } catch (e) {}
            } catch (e) { /* ignore */ }
        }

        // Step 0: select first editable cell
        try {
            outer: for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    const cell = document.querySelector(`.sudoku-cell[data-row="${r}"][data-col="${c}"]`);
                    if (!cell) continue;
                    if (cell.classList.contains('given')) continue;
                    GameUI.selectCell(r, c);
                    break outer;
                }
            }
        } catch (e) { console.warn('autoComplete select failed', e); }

        // Wait then input the correct number for selected cell
        await new Promise(r => setTimeout(r, 300));
        try {
            const sel = AppState.selectedCell;
            if (sel) {
                const num = AppState.solution?.[sel.row]?.[sel.col] || 1;
                GameUI.inputNumber(num);
            }
        } catch (e) { console.warn('autoComplete input failed', e); }

        // Wait then toggle notes (step 2)
        await new Promise(r => setTimeout(r, 420));
        try {
            GameHelpers.toggleNotesMode();
            await new Promise(r => setTimeout(r, 220));
            GameHelpers.toggleNotesMode();
        } catch (e) { console.warn('autoComplete notes toggle failed', e); }

        // Wait and then finish tutorial
        await new Promise(r => setTimeout(r, 420));
        try { this.end(); } catch (e) { console.warn('autoComplete end failed', e); }
    }
};

// ===========================================
// Challenge System
// ===========================================
const ChallengeSystem = {
    async sendChallenge(fromUserId, fromName, toUserId) {
        const notificationRef = ref(rtdb, `notifications/${toUserId}/${fromUserId}`);
        
        await set(notificationRef, {
            type: 'challenge',
            from: fromUserId,
            fromName: fromName,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
    },
    
    listenToNotifications(userId, callback) {
        const notificationsRef = ref(rtdb, `notifications/${userId}`);
        const listener = onChildAdded(notificationsRef, async (snapshot) => {
            try {
                await callback(snapshot.key, snapshot.val());
            } catch (e) {
                console.warn('Notification callback failed', e);
            } finally {
                try { await remove(snapshot.ref); } catch (err) { console.warn('Failed to clear notification', err); }
            }
        });
        AppState.listeners.push({ ref: notificationsRef, callback: listener });
        return listener;
    },
    
    async acceptChallenge(acceptingUserId, acceptingName, challengerId) {
        // Create a room owned by the accepting user, then notify the challenger to join.
        const code = await LobbyManager.createRoom(acceptingUserId, acceptingName);

        const acceptedPayload = {
            type: 'challenge',
            from: acceptingUserId,
            fromName: acceptingName,
            timestamp: serverTimestamp(),
            status: 'accepted',
            roomCode: code
        };

        // Notify challenger of acceptance + room code
        await set(ref(rtdb, `notifications/${challengerId}/${acceptingUserId}`), acceptedPayload);
        // Keep a copy for the acceptor too (useful for debugging / multi-device)
        await update(ref(rtdb, `notifications/${acceptingUserId}/${challengerId}`), {
            status: 'accepted',
            roomCode: code
        });

        return code;
    },
    
    async declineChallenge(acceptingUserId, acceptingName, challengerId) {
        await remove(ref(rtdb, `notifications/${acceptingUserId}/${challengerId}`));
        await set(ref(rtdb, `notifications/${challengerId}/${acceptingUserId}`), {
            type: 'challenge',
            from: acceptingUserId,
            fromName: acceptingName,
            timestamp: serverTimestamp(),
            status: 'declined'
        });
    }
};

function getCurrentDisplayName() {
    const profile = AppState.profile;
    const base = profile?.username || profile?.displayName || AppState.currentUser?.displayName;
    if (base) return base;
    const uid = AppState.currentUser?.uid || '';
    if (!uid) return AppState.currentUser?.isAnonymous ? 'guest' : 'Player';
    return AppState.currentUser?.isAnonymous ? `guest_${uid.substring(0, 6)}` : `Player_${uid.substring(0, 6)}`;
}

async function handleChallengeNotification(otherUserId, notification) {
    try {
        if (!notification || notification.type !== 'challenge') return;
        const status = notification.status;

        if (status === 'pending') {
            AppState.pendingChallenge = { fromUserId: otherUserId, fromName: notification.fromName || 'Player' };
            const nameEl = document.getElementById('challenger-name');
            if (nameEl) nameEl.textContent = notification.fromName || 'Player';
            ViewManager.showModal('challenge-modal');
            try { if (AppState.currentUser) await remove(ref(rtdb, `notifications/${AppState.currentUser.uid}/${otherUserId}`)); } catch { /* ignore */ }
            return;
        }

        if (status === 'accepted' && notification.roomCode) {
            // Only auto-join if we are not already engaged in a room/match.
            if (AppState.currentRoom || AppState.currentMatch) return;
            if (AppState.currentView !== 'lobby' && AppState.currentView !== 'auth') return;

            const code = String(notification.roomCode).trim();
            if (!/^\d{4}$/.test(code)) return;

            if (!AppState.currentUser) return;
            const displayName = getCurrentDisplayName();
            await LobbyManager.joinRoom(code, AppState.currentUser.uid, displayName);
            AppState.currentRoom = code;
            const codeEl = document.getElementById('display-room-code');
            if (codeEl) codeEl.textContent = code;
            ViewManager.show('waiting');
            PresenceManager.updateActivity('Joining match');
            LobbyManager.listenToRoom(code, handleRoomUpdate);

            // Cleanup notifications
            try { await remove(ref(rtdb, `notifications/${AppState.currentUser.uid}/${otherUserId}`)); } catch { /* ignore */ }
            return;
        }

        if (status === 'declined') {
            // Challenger sees decline. Keep it subtle; no modal.
            if (AppState.currentView === 'lobby') {
                UI.showToast?.(`${notification.fromName || 'Player'} declined your challenge`, 'info');
            }
            try { if (AppState.currentUser) await remove(ref(rtdb, `notifications/${AppState.currentUser.uid}/${otherUserId}`)); } catch { /* ignore */ }
        }
    } catch (e) {
        console.warn('handleChallengeNotification failed', e);
    }
}

async function handleNotification(otherUserId, notification) {
    if (!notification) return;
    if (notification.type === 'challenge') {
        await handleChallengeNotification(otherUserId, notification);
        return;
    }

    try {
        if (notification.type === 'friend_request') {
            FriendsManager.refresh().catch(() => {});
            UI.showToast('New friend request received.', 'info');
        } else if (notification.type === 'friend_accept') {
            FriendsManager.refresh().catch(() => {});
            UI.showToast('Friend request accepted.', 'success');
        } else if (notification.type === 'friend_decline') {
            UI.showToast('Friend request declined.', 'info');
        }
    } catch (e) {
        console.warn('handleNotification failed', e);
    } finally {
        const currentUid = AppState.currentUser?.uid;
        if (!currentUid) return;
        const key = notification.type && notification.type.startsWith('friend_')
            ? (String(otherUserId).startsWith('friend_') ? otherUserId : `friend_${otherUserId}`)
            : otherUserId;
        try {
            await remove(ref(rtdb, `notifications/${currentUid}/${key}`));
        } catch { /* ignore */ }
    }
}

// ===========================================
// UI Helpers (modular)
// ===========================================
const UI = createUIHelpers({
    AppState,
    ViewManager,
    ProfileManager,
    FriendsManager,
    ChallengeSystem: () => ChallengeSystem,
    isRegisteredUser,
    getCurrentDisplayName,
    rtdb,
    ref,
    get
});
window.UI = UI;

// BoardIntegritySystem extracted to src/client/ui/boardIntegrity.js

    async inputNumber(num) {
        console.log('inputNumber called:', num, 'gameMode:', AppState.gameMode, 'currentMatch:', AppState.currentMatch);
        
        if (!AppState.selectedCell) {
            console.log('No cell selected');
            return;
        }
        
        const { row, col } = AppState.selectedCell;
        console.log('Selected cell:', row, col);
        
        const cell = document.querySelector(
            `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
        );
        
        if (!cell) {
            console.log('Cell not found in DOM');
            return;
        }
        
        // Check if cell is a given (pre-filled) number
        if (cell.classList.contains('given')) {
            console.log('Cell is a given number, cannot modify');
            return;
        }

        // Notes mode (single player only): toggles pencil marks instead of setting the cell.
        if (AppState.gameMode === 'single') {
            const currentValue = AppState.puzzle?.[row]?.[col] || 0;
            const key = `${row}_${col}`;
            const notesEl = cell.querySelector('.cell-notes');

            if (AppState.notesMode && num >= 1 && num <= 9 && currentValue === 0) {
                const existing = AppState.notes[key] instanceof Set ? AppState.notes[key] : new Set(Array.isArray(AppState.notes[key]) ? AppState.notes[key] : []);
                if (existing.has(num)) existing.delete(num);
                else existing.add(num);
                AppState.notes[key] = existing;
                if (notesEl) this.renderNotesForCell(notesEl, existing);
                AudioManager.playCellFill();
                return;
            }

            if (num === 0 && AppState.notesMode) {
                delete AppState.notes[key];
                if (notesEl) notesEl.innerHTML = '';
                AudioManager.playCellFill();
                return;
            }
        }
        
        // In versus mode, check if cell is already filled by checking classes AND content
        if (AppState.gameMode === 'versus') {
            const hasPlayerFill = cell.classList.contains('player-fill');
            const hasOpponentFill = cell.classList.contains('opponent-fill');
            const valueEl = cell.querySelector('.cell-value');
            const hasContent = (valueEl ? valueEl.textContent : cell.textContent).trim() !== '';
            
            console.log('Cell state check:', { hasPlayerFill, hasOpponentFill, hasContent, content: (valueEl ? valueEl.textContent : cell.textContent) });
            
            // Only block if marked as filled by a player
            if (hasPlayerFill || hasOpponentFill) {
                console.log('Cell already filled in versus mode (by class)');
                return;
            }
            
            // Also check the AppState.puzzle if available
            if (AppState.puzzle && AppState.puzzle[row] && AppState.puzzle[row][col] !== 0) {
                // Cell has a value - check if it's a given or filled
                if (cell.classList.contains('given')) {
                    console.log('Cell is a given number');
                    return;
                }
                // If it has a value but no fill class, it might be stale - allow the move
                // The server will reject if already filled
            }
        }
        
        // Resume audio context on user interaction
        if (AudioManager.context?.state === 'suspended') {
            AudioManager.context.resume();
        }
        
        if (AppState.gameMode === 'versus' && AppState.currentMatch) {
            // 1v1 mode - validate and only persist correct guesses
            try {
                const result = await MatchManager.makeMove(
                    AppState.currentMatch,
                    AppState.currentUser.uid,
                    row, col, num
                );
                
                if (result && result.success) {
                    if (result.correct) {
                        // Correct guess - will be synced via listener
                        AudioManager.playCorrect();
                        cell.classList.add('correct');
                        cell.classList.add('player-fill');
                        {
                            const valueEl = cell.querySelector('.cell-value');
                            if (valueEl) valueEl.textContent = String(num);
                            else cell.textContent = String(num);
                        }
                        
                        setTimeout(() => {
                            cell.classList.remove('correct');
                        }, 500);
                    } else {
                        // Wrong guess - show error animation but don't persist
                        AudioManager.playError();
                        cell.classList.add('error');
                        {
                            const valueEl = cell.querySelector('.cell-value');
                            if (valueEl) valueEl.textContent = String(num);
                            else cell.textContent = String(num);
                        }
                        
                        // Clear the wrong number after animation (local only - not saved to DB)
                        setTimeout(() => {
                            cell.classList.remove('error');
                            const valueEl = cell.querySelector('.cell-value');
                            if (valueEl) valueEl.textContent = '';
                            else cell.textContent = '';
                        }, 500);
                    }
                } else {
                    // Cell was already filled by opponent
                    AudioManager.playError();
                }
            } catch (error) {
                console.error('Move failed:', error);
            }
        } else {
            // Single player mode
            const oldValue = AppState.puzzle[row][col];
            
            if (num === 0) {
                // Erase
                if (AppState.toolLimits.eraseLeft <= 0) return;
                const valueEl = cell.querySelector('.cell-value');
                if (valueEl) valueEl.textContent = '';
                else cell.textContent = '';
                AppState.puzzle[row][col] = 0;
                GameHelpers.addToHistory(row, col, oldValue, 0);
                delete AppState.notes[`${row}_${col}`];
                const notesEl = cell.querySelector('.cell-notes');
                if (notesEl) notesEl.innerHTML = '';
                GameHelpers.consumeEraseIfNeeded(oldValue !== 0);
            } else {
                const valueEl = cell.querySelector('.cell-value');
                if (valueEl) valueEl.textContent = String(num);
                else cell.textContent = String(num);
                AppState.puzzle[row][col] = num;
                GameHelpers.addToHistory(row, col, oldValue, num);
                delete AppState.notes[`${row}_${col}`];
                const notesEl = cell.querySelector('.cell-notes');
                if (notesEl) notesEl.innerHTML = '';
                
                // Check if correct (if auto-check is enabled)
                const isCorrect = num === AppState.solution[row][col];
                
                if (AppState.settings.autoCheck) {
                    if (isCorrect) {
                        AudioManager.playCorrect();
                        cell.classList.add('correct');
                        cell.classList.add('player-fill');
                        AppState.playerScore++;
                        
                        // Creative features: streak & cell animation
                        CreativeFeatures.incrementStreak();
                        CreativeFeatures.animateCellComplete(row, col);
                        CreativeFeatures.checkGroupCompletion(AppState.puzzle, row, col);
                        ArchitecturalStateSystem.noteCorrect();
                    } else {
                        AudioManager.playError();
                        cell.classList.add('error');
                        
                        // Reset streak on wrong answer
                        CreativeFeatures.resetStreak();
                        ArchitecturalStateSystem.noteMistake();
                        
                        // Increment mistakes
                        AppState.mistakes++;
                        GameHelpers.updateMistakesDisplay();
                        
                        // Remove wrong number after animation
                        setTimeout(() => {
                            const valueEl = cell.querySelector('.cell-value');
                            if (valueEl) valueEl.textContent = '';
                            else cell.textContent = '';
                            AppState.puzzle[row][col] = 0;
                            cell.classList.remove('error');
                            GameHelpers.updateRemainingCounts();
                        }, 400);
                        
                        // Check for game over (3 mistakes)
                        if (AppState.mistakes >= AppState.maxMistakes) {
                            setTimeout(() => {
                                this.endSinglePlayerGame(false);
                            }, 600);
                            return;
                        }
                        return; // Exit early since we handle cleanup above
                    }
                } else {
                    // Even when auto-check is disabled, track mistakes so
                    // the player can lose after exceeding max mistakes.
                    cell.classList.add('player-fill');

                    if (!isCorrect) {
                        ArchitecturalStateSystem.noteMistake();
                        AppState.mistakes++;
                        GameHelpers.updateMistakesDisplay();

                        if (AppState.mistakes >= AppState.maxMistakes) {
                            setTimeout(() => {
                                this.endSinglePlayerGame(false);
                            }, 600);
                            return;
                        }
                    }
                }
                
                setTimeout(() => {
                    cell.classList.remove('correct', 'error');
                }, 500);
                
                // Highlight same numbers
                GameHelpers.highlightSameNumbers(num);
                
                // Check if puzzle is complete
                this.checkSinglePlayerComplete();
            }
            
            // Update UI elements
            GameHelpers.updateRemainingCounts();
            GameHelpers.updateProgress();
        }
        
        AudioManager.playCellFill();
        // If tutorial is active and the user just placed a number for the number-step, advance.
        try {
            if (AppState.tutorialActive && (AppState.tutorialStep || 0) === 1) {
                setTimeout(() => { try { TutorialGame.next(); } catch (e) { console.warn('Tutorial next failed', e); } }, 260);
            }
        } catch (e) {}
    },
    
    checkSinglePlayerComplete() {
        if (!AppState.puzzle || !AppState.solution) return;
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (AppState.puzzle[row][col] !== AppState.solution[row][col]) {
                    return;
                }
            }
        }
        
        // Puzzle complete!
        this.endSinglePlayerGame(true);
    },
    
    startTimer() {
        AppState.gameSeconds = 0;
        const timerEl = document.getElementById('game-timer');
        const versusTimerEl = document.getElementById('game-timer-versus');
        
        AppState.gameTimer = setInterval(() => {
            AppState.gameSeconds++;
            const formatted = UI.formatTime(AppState.gameSeconds);
            if (timerEl) timerEl.textContent = formatted;
            if (versusTimerEl) versusTimerEl.textContent = formatted;

            if (AppState.gameMode === 'single' && AppState.timeLimitSeconds > 0 && AppState.gameSeconds >= AppState.timeLimitSeconds) {
                this.endSinglePlayerGame(false, 'Time limit reached');
            }
        }, 1000);
    },
    
    stopTimer() {
        if (AppState.gameTimer) {
            clearInterval(AppState.gameTimer);
            AppState.gameTimer = null;
        }
    },
    
    endSinglePlayerGame(won, reason = null) {
        this.stopTimer();
        
        document.getElementById('game-over-title').textContent = won ? 'Congratulations!' : 'Game Over';
        const resultIcon = document.getElementById('result-icon');
        if (resultIcon) {
            resultIcon.innerHTML = won
                ? '<svg class="ui-icon ui-icon-xl" aria-hidden="true"><use href="#i-trophy"></use></svg>'
                : '<svg class="ui-icon ui-icon-xl" aria-hidden="true"><use href="#i-x"></use></svg>';
        }
        document.getElementById('result-message').textContent = won ? 'You solved the puzzle!' : (reason || 'Better luck next time!');
        document.getElementById('final-score').textContent = AppState.playerScore;
        document.getElementById('final-time').textContent = UI.formatTime(AppState.gameSeconds);
        const oppRow = document.getElementById('opponent-score-row');
        if (oppRow) {
            oppRow.style.display = 'none';
        }
        
        if (won) {
            AudioManager.playVictory();
            CreativeFeatures.showConfetti();
            ArchitecturalStateSystem.onVictory({ perfect: AppState.mistakes === 0 });
        } else {
            AudioManager.playDefeat();
            ArchitecturalStateSystem.pulseStrain(1400);
        }

        ViewManager.showModal('game-over-modal');
        AppState.gameMode = 'lobby';

        // Track single-player results for signed-in users.
        const uid = AppState.currentUser?.uid;
        if (uid) {
            ProfileManager.updateStats(uid, !!won).catch(() => {});
        }
    },
    
    endVersusGame(match) {
        if (AppState.isGameOver) return;
        AppState.isGameOver = true;

        this.stopTimer();

        const userId = AppState.currentUser?.uid;
        let isWinner = match.winner === userId;
        const isTie = match.winner === 'tie';
        const isDisconnect = match.winReason === 'opponent_disconnect';
        const isMistakesLoss = match.winReason === 'opponent_mistakes';

        // If the game ended because the board is complete, determine the winner by score
        if (match.winReason === 'board_complete') {
            const scores = match.scores;
            const playerIds = Object.keys(match.players);
            const opponentId = playerIds.find(id => id !== userId);
            if (scores[userId] > scores[opponentId]) {
                isWinner = true;
            } else if (scores[userId] < scores[opponentId]) {
                isWinner = false;
            } else {
                isWinner = null; // Tie
            }
        }

        const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds;
        const opponentId = playerIds?.find(id => id !== userId);

        if (isTie) {
            ProfileManager.updateStats(userId, null);
        } else if (isWinner) {
            AudioManager.playVictory();
            CreativeFeatures.showConfetti();
            ArchitecturalStateSystem.onVictory({ perfect: false });
            ProfileManager.updateStats(userId, true);
        } else if (isWinner === false) {
            AudioManager.playDefeat();
            ArchitecturalStateSystem.pulseStrain(1400);
            ProfileManager.updateStats(userId, false);
        }

        showPostMatchScreen(match, userId, opponentId, isWinner, isTie, isDisconnect, isMistakesLoss);
    },
    
    updateScores(scores, playerIds) {
        const userId = AppState.currentUser?.uid;
        // playerIds is stored as an object {id: true}, convert to array
        const playerIdArray = typeof playerIds === 'object' ? Object.keys(playerIds) : playerIds;
        const opponentId = playerIdArray?.find(id => id !== userId);
        
        const playerScoreEl = document.getElementById('player-score');
        const opponentScoreEl = document.getElementById('opponent-score');
        
        if (playerScoreEl) playerScoreEl.textContent = scores?.[userId] || 0;
        if (opponentScoreEl && opponentId) opponentScoreEl.textContent = scores?.[opponentId] || 0;
    },
    
    updateLives(mistakes, playerIds, maxMistakes = 3) {
        const userId = AppState.currentUser?.uid;
        const playerIdArray = typeof playerIds === 'object' ? Object.keys(playerIds) : playerIds;
        const opponentId = playerIdArray?.find(id => id !== userId);
        
        const playerLivesEl = document.getElementById('player-lives');
        const opponentLivesEl = document.getElementById('opponent-lives');
        
        const playerMistakes = mistakes?.[userId] || 0;
        const opponentMistakes = mistakes?.[opponentId] || 0;
        
        // Update player lives display
        if (playerLivesEl) {
            const hearts = playerLivesEl.querySelectorAll('.life-heart');
            hearts.forEach((heart, index) => {
                const isLost = index < playerMistakes;
                heart.classList.toggle('lost', isLost);
            });
        }
        
        // Update opponent lives display
        if (opponentLivesEl) {
            const hearts = opponentLivesEl.querySelectorAll('.life-heart');
            hearts.forEach((heart, index) => {
                const isLost = index < opponentMistakes;
                heart.classList.toggle('lost', isLost);
            });
        }
    },
    
    resetLivesDisplay() {
        ['player-lives', 'opponent-lives'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const hearts = el.querySelectorAll('.life-heart');
                hearts.forEach(heart => heart.classList.remove('lost', 'losing'));
            }
        });
    }
};

// ===========================================
// Event Handlers
// ===========================================
function setupEventListeners() {
    function applyTheme(mode) {
        const body = document.body;
        body.classList.toggle('light-theme', mode === 'light');
        body.classList.toggle('dark-theme', mode !== 'light');
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.setAttribute('aria-pressed', mode !== 'light' ? 'true' : 'false');
            themeBtn.setAttribute('data-tooltip', mode === 'light' ? 'Theme: Light' : 'Theme: Dark');
        }
        if (typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
            try { localStorage.setItem('stonedoku_theme', mode); } catch { /* ignore */ }
        }
    }

    function initTheme() {
        let saved = null;
        if (typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
            try { saved = localStorage.getItem('stonedoku_theme'); } catch { /* ignore */ }
        }
        applyTheme(saved === 'dark' ? 'dark' : 'light');
    }

    function syncSoundToggleUi() {
        const btn = document.getElementById('sound-toggle');
        if (!btn) return;
        btn.classList.toggle('is-muted', !AppState.soundEnabled);
        btn.setAttribute('aria-pressed', AppState.soundEnabled ? 'true' : 'false');
        btn.setAttribute('data-tooltip', AppState.soundEnabled ? 'Sound: On' : 'Sound: Off');
    }

    initTheme();
    syncSoundToggleUi();

    // Header menu (mobile)
    const headerMenuToggle = document.getElementById('header-menu-toggle');
    const headerMenu = document.getElementById('header-menu');
    const headerCompactMql = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
    const closeHeaderMenu = () => {
        if (!headerMenu || !headerMenuToggle) return;
        headerMenu.classList.remove('is-open');
        headerMenuToggle.setAttribute('aria-expanded', 'false');
    };
    const toggleHeaderMenu = (ev) => {
        if (!headerMenu || !headerMenuToggle) return;
        if (headerCompactMql && !headerCompactMql.matches) return;
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        const next = !headerMenu.classList.contains('is-open');
        headerMenu.classList.toggle('is-open', next);
        headerMenuToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    };
    const syncHeaderCompactMode = () => {
        const compact = !!(headerCompactMql && headerCompactMql.matches);
        document.body.classList.toggle('header-compact', compact);
        if (!compact) closeHeaderMenu();
    };
    headerMenuToggle?.addEventListener('click', toggleHeaderMenu);
    document.addEventListener('click', (e) => {
        if (!headerMenu || !headerMenuToggle) return;
        const target = e.target;
        const clickedInside = headerMenu.contains(target) || headerMenuToggle.contains(target);
        if (!clickedInside) closeHeaderMenu();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeHeaderMenu();
    });
    window.addEventListener('resize', closeHeaderMenu, { passive: true });
    syncHeaderCompactMode();
    if (headerCompactMql) {
        try {
            headerCompactMql.addEventListener('change', syncHeaderCompactMode);
        } catch {
            headerCompactMql.addListener(syncHeaderCompactMode);
        }
    }
    document.getElementById('updates-nav-btn')?.addEventListener('click', closeHeaderMenu);
    document.getElementById('admin-nav-btn')?.addEventListener('click', closeHeaderMenu);
    document.getElementById('logout-btn')?.addEventListener('click', closeHeaderMenu);
    document.getElementById('my-profile-btn')?.addEventListener('click', closeHeaderMenu);

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const body = document.body;
        const isLight = body.classList.contains('light-theme');
        applyTheme(isLight ? 'dark' : 'light');
    });
    
    // Sound toggle
    document.getElementById('sound-toggle')?.addEventListener('click', () => {
        AppState.soundEnabled = !AppState.soundEnabled;
        syncSoundToggleUi();
    });

    // Resign / leave match (versus)
    document.getElementById('resign-btn')?.addEventListener('click', async () => {
        if (AppState.gameMode !== 'versus') return;
        if (!AppState.currentMatch || !AppState.currentUser?.uid) return;
        if (!confirm('Leave this match? This counts as a resignation.')) return;
        try {
            await MatchManager.resignMatch(AppState.currentMatch, AppState.currentUser.uid);
        } catch (e) {
            console.warn('Resign failed', e);
            UI.showToast('Failed to leave match.', 'error');
        }
    });
    
    // Auth - Anonymous login
    document.getElementById('anonymous-login')?.addEventListener('click', async () => {
        const btn = document.getElementById('anonymous-login');
        try {
            btn.disabled = true;
            btn.textContent = 'Connecting...';
            const result = await signInAnonymously(auth);
            console.log('Anonymous login successful:', result.user.uid);
        } catch (error) {
            console.error('Anonymous login failed:', error);
            if (error.code === 'auth/operation-not-allowed') {
                alert('Guest login is not enabled. Please contact the administrator or use email login.');
            } else if (error.code === 'auth/network-request-failed') {
                alert('Network error. Please check your connection and try again.');
            } else {
                alert('Login failed: ' + error.message);
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Play as Guest';
        }
    });
    
    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show/hide panels
            const mode = tab.dataset.mode;
            document.getElementById('signin-panel').style.display = mode === 'signin' ? 'block' : 'none';
            document.getElementById('signup-panel').style.display = mode === 'signup' ? 'block' : 'none';
        });
    });
    
    // Start Onboarding (from signup panel)
    document.getElementById('start-onboarding')?.addEventListener('click', () => {
        OnboardingSystem.start();
    });
    
    // Tutorial game event removed (orientation is accessed via profile/settings).
    
	    // Sign In form
	    document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
	        e.preventDefault();
	        const email = (document.getElementById('signin-email').value || '').trim();
	        const password = document.getElementById('signin-password').value;
	        const btn = e.target.querySelector('button[type="submit"]');
	        
	        try {
	            btn.disabled = true;
	            btn.textContent = 'Signing in...';
	            await signInWithEmailAndPassword(auth, email, password);
	        } catch (error) {
	            console.error('Sign in failed:', error);
	            if (error.code === 'auth/user-not-found') {
	                alert('No account found with this email. Please sign up first.');
	            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
	                alert('Incorrect password. Please try again.');
	            } else if (error.code === 'auth/invalid-email') {
	                alert('Please enter a valid email address.');
	            } else if (error.code === 'auth/too-many-requests') {
	                alert('Too many attempts. Please wait a moment and try again.');
	            } else {
	                alert('Sign in failed: ' + error.message);
	            }
	        } finally {
	            btn.disabled = false;
	            btn.textContent = 'Sign In';
        }
    });

    // Forgot password flow
    document.getElementById('forgot-password')?.addEventListener('click', () => {
        const emailPrefill = document.getElementById('signin-email')?.value || '';
        PasswordReset.showRequest(emailPrefill);
    });

    document.getElementById('reset-request-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-request-email')?.value.trim();
        if (!email) {
            PasswordReset.setStatus('reset-request-status', 'Please enter your email address.', true);
            return;
        }
        await PasswordReset.sendResetRequest(email);
    });

    document.getElementById('reset-confirm-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('reset-new-password')?.value || '';
        const confirm = document.getElementById('reset-confirm-password')?.value || '';
        await PasswordReset.submitNewPassword(password, confirm);
    });

    document.getElementById('reset-back-to-login')?.addEventListener('click', () => {
        PasswordReset.togglePanels('request');
        PasswordReset.setStatus('reset-request-status', '');
        PasswordReset.setStatus('reset-confirm-status', '');
        AppState.passwordReset.active = false;
        ViewManager.show('auth');
    });

    document.getElementById('reset-return-login')?.addEventListener('click', () => {
        PasswordReset.togglePanels('request');
        PasswordReset.setStatus('reset-request-status', '');
        PasswordReset.setStatus('reset-confirm-status', '');
        AppState.passwordReset.active = false;
        ViewManager.show('auth');
    });
    
    // Sign Up form
    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameRaw = document.getElementById('signup-username').value.trim();
        const username = usernameRaw.toLowerCase();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const btn = e.target.querySelector('button[type="submit"]');
        
        // Validate username
        if (!usernameRaw || usernameRaw.length < 3 || usernameRaw.length > 20) {
            alert('Username must be between 3 and 20 characters.');
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(usernameRaw)) {
            alert('Username can only contain letters, numbers, and underscores.');
            return;
        }
        
        if (password !== confirm) {
            alert('Passwords do not match. Please try again.');
            return;
        }

        const policy = PasswordPolicy.validate(password);
        if (!policy.ok) {
            alert(PasswordPolicy.message(password) || 'Password does not meet requirements.');
            return;
        }
        
        try {
            btn.disabled = true;
            btn.textContent = 'Checking username...';
            
            // Check if username is already taken
            const usernameAvailable = await ProfileManager.checkUsernameAvailable(username);
            if (!usernameAvailable) {
                alert('This username is already taken. Please choose another.');
                btn.disabled = false;
                btn.textContent = 'Create Account';
                return;
            }
            
            // Set pending username BEFORE creating user to avoid race with onAuthStateChanged
            AppState.pendingUsername = usernameRaw;

            btn.textContent = 'Creating account...';
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Update the user's display name in Firebase Auth
            await updateProfile(userCredential.user, { displayName: usernameRaw });

            // Create the profile immediately to ensure Firestore is populated with the chosen username
            await ProfileManager.createOrUpdateProfile(userCredential.user.uid, {
                username: usernameRaw,
                displayName: usernameRaw,
                email
            });
            
        } catch (error) {
            console.error('Sign up failed:', error);
            AppState.pendingUsername = null;
            if (error.code === 'auth/email-already-in-use') {
                alert('An account with this email already exists. Please sign in instead.');
            } else if (error.code === 'auth/weak-password') {
                alert(PasswordPolicy.message(password) || 'Password does not meet requirements.');
            } else if (error.message === 'username_taken') {
                alert('This username was just taken. Please choose another.');
            } else {
                alert('Sign up failed: ' + error.message);
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
    
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        console.log('Logout button clicked');
        try {
            console.log('Starting logout process...');
            const user = auth.currentUser;
            await PresenceManager.cleanup();
            console.log('Presence cleaned up');

            if (user?.isAnonymous) {
                console.log('Anonymous user detected; deleting guest account');
                try {
                    await deleteDoc(doc(firestore, 'users', user.uid));
                } catch (e) {
                    console.warn('Failed to delete anonymous user profile doc', e);
                }
                try {
                    await deleteUser(user);
                } catch (e) {
                    console.warn('Failed to delete anonymous auth user', e);
                    await signOut(auth);
                }
            } else {
                console.log('Signing out...');
                await signOut(auth);
            }

            console.log('Signed out successfully');
            AppState.currentUser = null;
            ViewManager.show('auth');
        } catch (error) {
            console.error('Logout failed:', error);
            // Force logout anyway
            AppState.currentUser = null;
            ViewManager.show('auth');
        }
    });
    
    // Logo click to return home
    document.getElementById('logo-home')?.addEventListener('click', () => {
        if (AppState.currentUser) {
            // If in a game, confirm before leaving
            if (AppState.currentView === 'game') {
                if (confirm('Are you sure you want to leave the game?')) {
                    quitGame();
                    ViewManager.show('lobby');
                }
            } else {
                ViewManager.show('lobby');
            }
        } else {
            ViewManager.show('auth');
        }
    });
    
    // Single player start - old button (for backwards compatibility)
    document.getElementById('start-single')?.addEventListener('click', () => {
        const difficulty = document.getElementById('difficulty-select')?.value || 'medium';
        startSinglePlayerGame(difficulty);
    });
    
    // New lobby difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            if (difficulty) {
                startSinglePlayerGame(difficulty);
            }
        });
    });
    
    // Chat toggle functionality
    document.getElementById('chat-toggle')?.addEventListener('click', () => {
        const chatSection = document.querySelector('.chat-section');
        chatSection?.classList.toggle('open');
    });
    
    // Create room
    document.getElementById('create-room')?.addEventListener('click', async () => {
        console.log('Create room button clicked');
        try {
            const displayName = getCurrentDisplayName();
            console.log('Creating room for:', displayName);
            const code = await LobbyManager.createRoom(AppState.currentUser.uid, displayName);
            console.log('Room created with code:', code);
            
            AppState.currentRoom = code;
            document.getElementById('display-room-code').textContent = code;
            
            ViewManager.show('waiting');
            PresenceManager.updateActivity('Waiting for opponent');
            
            // Listen for player joins
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room: ' + error.message);
        }
    });
    
    // Join room
    const joinRoomHandler = async (overrideCode = null) => {
        const codeInput = document.getElementById('room-code-input');
        const code = (overrideCode || codeInput?.value || '').trim();
        
        console.log('Attempting to join room with code:', code);
        
        if (!code || code.length !== 4) {
            alert('Please enter a valid 4-digit room code');
            return;
        }
        if (!AppState.currentUser) {
            alert('Sign in to join a room.');
            ViewManager.show('auth');
            AppState.pendingJoinCode = code;
            return;
        }
        
        try {
            const displayName = getCurrentDisplayName();
            console.log('User:', AppState.currentUser?.uid, 'Display:', displayName);
            
            await LobbyManager.joinRoom(code, AppState.currentUser.uid, displayName);
            console.log('Successfully joined room');
            
            AppState.currentRoom = code;
            AppState.pendingJoinCode = null;
            try { window.history.replaceState({}, document.title, window.location.pathname + window.location.search); } catch { /* ignore */ }
            ViewManager.show('waiting');
            document.getElementById('display-room-code').textContent = code;
            
            // Listen for game start
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to join room:', error);
            alert(error.message || 'Failed to join room');
        }
    };
    
    document.getElementById('join-room')?.addEventListener('click', joinRoomHandler);
    
    // Also allow pressing Enter in the room code input
    document.getElementById('room-code-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            joinRoomHandler();
        }
    });
    
    // Cancel waiting
    document.getElementById('cancel-waiting')?.addEventListener('click', async () => {
        if (AppState.currentRoom) {
            await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
            AppState.currentRoom = null;
        }
        try {
            if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
        } catch { /* ignore */ }
        AppState.widgetGameChatUnsub = null;
        AppState.widgetGameChatContext = null;
        window.ChatWidget?.clearChannel?.('game');
        window.ChatNotifications?.markRead?.('game');
        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'none';
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });
    
    // Copy room code
    document.getElementById('copy-code')?.addEventListener('click', () => {
        const code = document.getElementById('display-room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert('Code copied to clipboard!');
        });
    });

    // Share room code (if supported)
    document.getElementById('share-code')?.addEventListener('click', async () => {
        const code = document.getElementById('display-room-code').textContent;
        const joinUrl = `${window.location.origin}/#/join/${encodeURIComponent(code)}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Join my Stonedoku room', text: `Room code: ${code}`, url: joinUrl });
            } catch { /* ignore */ }
        } else {
            try { await navigator.clipboard.writeText(joinUrl); } catch { /* ignore */ }
            alert('Share link copied: ' + joinUrl);
        }
    });

    // QR code for joining
    document.getElementById('qr-code')?.addEventListener('click', () => {
        const code = document.getElementById('display-room-code').textContent;
        if (!code || code.includes('-')) return;
        const joinUrl = `${window.location.origin}/#/join/${encodeURIComponent(code)}`;
        const img = document.getElementById('room-qr-img');
        const qrWrap = document.getElementById('room-qr');
        if (img && qrWrap) {
            img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl)}`;
            img.alt = `QR code for room ${code}`;
            qrWrap.style.display = 'block';
        }
    });
    
    // ===========================================
    // Pre-Game Lobby Event Listeners
    // ===========================================
    
    // Ready up button
    document.getElementById('ready-btn')?.addEventListener('click', async () => {
        if (!AppState.currentRoom || !AppState.currentUser) return;
        
        const roomRef = ref(rtdb, `lobbies/${AppState.currentRoom}`);
        const snapshot = await get(roomRef);
        const room = snapshot.val();
        const currentReady = room?.players?.[AppState.currentUser.uid]?.ready || false;
        
        // Toggle ready state
        await LobbyManager.setReady(AppState.currentRoom, AppState.currentUser.uid, !currentReady);
    });
    
    // Leave pre-game lobby
    document.getElementById('leave-pregame')?.addEventListener('click', async () => {
        if (AppState.currentRoom) {
            await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
            AppState.currentRoom = null;
        }
        try {
            if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
        } catch { /* ignore */ }
        AppState.widgetGameChatUnsub = null;
        AppState.widgetGameChatContext = null;
        window.ChatWidget?.clearChannel?.('game');
        window.ChatNotifications?.markRead?.('game');
        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'none';
        // Reset countdown if running
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });
    
    // Pre-game chat
    document.getElementById('pregame-chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('pregame-chat-input');
        const text = input.value.trim();
        
        if (text && AppState.currentRoom && AppState.currentUser) {
            const displayName = AppState.currentUser.displayName || 
                              `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            await LobbyManager.sendLobbyChat(AppState.currentRoom, AppState.currentUser.uid, displayName, text);
            input.value = '';
        }
    });
    
    // ===========================================
    // Post-Match Event Listeners
    // ===========================================
    
    // Rematch - Yes
    document.getElementById('rematch-yes')?.addEventListener('click', async () => {
        const matchId = AppState.lastMatch?.id;
        const userId = AppState.currentUser?.uid;
        
        if (!matchId || !userId) return;
        
        await update(ref(rtdb, `matches/${matchId}/rematch`), {
            [userId]: true
        });
        
        // Update UI
        document.getElementById('rematch-actions').style.display = 'none';
        document.getElementById('rematch-waiting').style.display = 'block';
    });
    
    // Rematch - No
    document.getElementById('rematch-no')?.addEventListener('click', async () => {
        const matchId = AppState.lastMatch?.id;
        const userId = AppState.currentUser?.uid;
        
        if (!matchId || !userId) return;
        
        await update(ref(rtdb, `matches/${matchId}/rematch`), {
            [userId]: false
        });
        
        // Clean up and go to lobby
        cleanupAfterMatch();
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });
    
    // Back to lobby from post-match
    document.getElementById('postmatch-back-lobby')?.addEventListener('click', () => {
        cleanupAfterMatch();
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });
    

    // Number pad
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.dataset.num);
            GameUI.inputNumber(num);
        });
    });
    
    // Keyboard input
    document.addEventListener('keydown', (e) => {
        if (AppState.currentView !== 'game') return;
        
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            GameUI.inputNumber(num);
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            GameUI.inputNumber(0);
        }
    });
    
    // Hint button
    // Hint feature removed.
    
    // Quit game
    document.getElementById('quit-game')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to quit?')) {
            GameUI.stopTimer();
            
            if (AppState.currentMatch) {
                await MatchManager.endMatch(AppState.currentMatch);
                AppState.currentMatch = null;
            }
            
            if (AppState.currentRoom) {
                await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
                AppState.currentRoom = null;
            }
            
            ViewManager.show('lobby');
            PresenceManager.updateActivity('In Lobby');
        }
    });
    
    // Game over modal buttons
    document.getElementById('play-again')?.addEventListener('click', () => {
        ViewManager.hideModal('game-over-modal');
        
        if (AppState.gameMode === 'single') {
            const difficulty = document.getElementById('difficulty-select').value;
            startSinglePlayerGame(difficulty);
        } else {
            ViewManager.show('lobby');
        }
    });
    
    document.getElementById('back-to-lobby')?.addEventListener('click', () => {
        ViewManager.hideModal('game-over-modal');
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });
    
    // Global chat (legacy - keeping for any remaining forms)
    document.getElementById('global-chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('global-chat-input');
        const text = input.value.trim();
        
        if (text && AppState.currentUser) {
            const displayName = AppState.currentUser.displayName || 
                              `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            await ChatManager.sendGlobalMessage(AppState.currentUser.uid, displayName, text);
            input.value = '';
        }
    });
    
    // Challenge modal
    document.getElementById('accept-challenge')?.addEventListener('click', async () => {
        try {
            const current = AppState.pendingChallenge;
            if (!current || !AppState.currentUser) {
                ViewManager.hideModal('challenge-modal');
                return;
            }
            const displayName = getCurrentDisplayName();
            const code = await ChallengeSystem.acceptChallenge(AppState.currentUser.uid, displayName, current.fromUserId);
            AppState.currentRoom = code;
            const codeEl = document.getElementById('display-room-code');
            if (codeEl) codeEl.textContent = code;
            ViewManager.hideModal('challenge-modal');
            ViewManager.show('waiting');
            PresenceManager.updateActivity('Waiting for opponent');
            LobbyManager.listenToRoom(code, handleRoomUpdate);
            AppState.pendingChallenge = null;
        } catch (e) {
            console.warn('Accept challenge failed', e);
            alert('Failed to accept challenge. Please try again.');
        }
    });

    // Custom Sudoku
    const customModal = document.getElementById('custom-sudoku-modal');
    document.getElementById('open-custom-sudoku')?.addEventListener('click', () => {
        if (!customModal) return;
        ViewManager.showModal('custom-sudoku-modal');
        // Sync default state with current settings
        const auto = document.getElementById('custom-auto-check');
        if (auto) auto.checked = !!AppState.settings.autoCheck;
    });
    document.getElementById('custom-sudoku-cancel')?.addEventListener('click', () => {
        ViewManager.hideModal('custom-sudoku-modal');
    });
    document.getElementById('custom-sudoku-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const difficulty = document.getElementById('custom-difficulty')?.value || 'medium';
        const timeLimitSeconds = Number(document.getElementById('custom-time-limit')?.value || 0) || 0;
        const maxMistakes = Number(document.getElementById('custom-mistakes')?.value || 3) || 3;
        const autoCheck = !!document.getElementById('custom-auto-check')?.checked;
        ViewManager.hideModal('custom-sudoku-modal');
        startSinglePlayerGame(difficulty, { timeLimitSeconds, maxMistakes, autoCheck });
    });

    document.getElementById('decline-challenge')?.addEventListener('click', () => {
        (async () => {
            try {
                const current = AppState.pendingChallenge;
                if (current && AppState.currentUser) {
                    const displayName = getCurrentDisplayName();
                    await ChallengeSystem.declineChallenge(AppState.currentUser.uid, displayName, current.fromUserId);
                }
            } catch (e) {
                console.warn('Decline challenge failed', e);
            } finally {
                AppState.pendingChallenge = null;
                ViewManager.hideModal('challenge-modal');
            }
        })();
    });
    
    // Profile modal close
    document.getElementById('close-profile')?.addEventListener('click', () => {
        ViewManager.hideModal('profile-modal');
    });
    
    // ============== NEW QOL FEATURES ==============
    
    // Difficulty buttons in game view
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            if (difficulty) {
                startSinglePlayerGame(difficulty);
            }
        });
    });
    
    // Restart button
    document.getElementById('restart-btn')?.addEventListener('click', () => {
        if (confirm('Restart this puzzle?')) {
            startSinglePlayerGame(AppState.currentDifficulty);
        }
    });
    
    // Undo button
    document.getElementById('undo-btn')?.addEventListener('click', () => {
        GameHelpers.tryUndo();
        AudioManager.playCellFill();
    });
    
    // Erase button
    document.getElementById('erase-btn')?.addEventListener('click', () => {
        if (AppState.selectedCell) {
            GameUI.inputNumber(0);
        }
    });
    
    // Notes button
    document.getElementById('notes-btn')?.addEventListener('click', () => {
        GameHelpers.toggleNotesMode();
    });
    
    // Settings toggles
    document.getElementById('highlight-conflicts')?.addEventListener('change', (e) => {
        AppState.settings.highlightConflicts = e.target.checked;
    });
    
    document.getElementById('highlight-same')?.addEventListener('change', (e) => {
        AppState.settings.highlightSameNumbers = e.target.checked;
    });
    
    document.getElementById('auto-check')?.addEventListener('change', (e) => {
        AppState.settings.autoCheck = e.target.checked;
    });
    
    // ============== FLOATING CHAT WIDGET ==============
    initFloatingChat();
    
    // Keyboard shortcuts for undo, notes, etc.
    document.addEventListener('keydown', (e) => {
        if (AppState.currentView !== 'game') return;
        
        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            GameHelpers.tryUndo();
        }
        
        // N for notes mode toggle
        if (e.key === 'n' || e.key === 'N') {
            GameHelpers.toggleNotesMode();
        }
        
        // Arrow keys for cell navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            navigateCell(e.key);
        }
    });
    
    // Show keyboard hints on game view
    document.addEventListener('keydown', (e) => {
        if (e.key === '?' && AppState.currentView === 'game') {
            const hint = document.querySelector('.keyboard-hint');
            if (hint) hint.classList.toggle('visible');
        }
    });
    
    // ===========================================
    // Profile Page Event Listeners
    // ===========================================
    initProfilePage();
    
    // ===========================================
    // Check for profile vanity URL on load
    // ===========================================
    handleVanityUrl();
    handleUpdatesUrl();
    handleAdminUrl();
    handleJoinUrl();

    window.addEventListener('hashchange', () => {
        handleUpdatesUrl();
        handleAdminUrl();
        handleVanityUrl();
        handleJoinUrl();
    });
}

// NOTE: Responsive scaling is handled by CSS (fluid layout & clamp-based typography).
// The previous JS-based `adjustScale()` caused layout flashes and competing behavior; removed.
// If a future need arises to apply JS-based adjustments, consider a non-invasive resize observer that
// only tweaks micro-layouts (not the global scale), and ensure it runs *after* the initial render.


// ===========================================
// Profile Page Initialization
// ===========================================
function initProfilePage() {
    // Back button
    document.getElementById('profile-back-btn')?.addEventListener('click', () => {
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });
    
    // Edit profile button
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
        const profileData = AppState.profile || {};
        const bioDisplay = document.getElementById('profile-page-bio');
        const bioInput = document.getElementById('profile-bio-input');
        const editFields = document.getElementById('profile-edit-fields');
        if (bioDisplay) bioDisplay.style.display = 'none';
        if (bioInput) {
            bioInput.style.display = 'block';
            bioInput.value = profileData.bio || '';
        }
        if (editFields) editFields.style.display = 'block';
        const twitterInput = document.getElementById('profile-twitter');
        const discordInput = document.getElementById('profile-discord');
        if (twitterInput) twitterInput.value = profileData.socialLinks?.twitter || '';
        if (discordInput) discordInput.value = profileData.socialLinks?.discord || '';
        document.getElementById('save-profile-btn').style.display = 'inline-block';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';
        document.getElementById('edit-profile-btn').style.display = 'none';
    });

    // Run orientation tour again (from profile) — offer choice: Tour or Tutorial
    document.getElementById('run-tour-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        // Position menu near button
        try {
            // Remove existing menu
            const existing = document.getElementById('profile-orientation-menu');
            if (existing) existing.remove();

            const rect = btn.getBoundingClientRect();
            const menu = document.createElement('div');
            menu.id = 'profile-orientation-menu';
            menu.className = 'profile-orientation-menu';
            menu.style.position = 'absolute';
            menu.style.left = `${Math.max(8, rect.left)}px`;
            menu.style.top = `${rect.bottom + 8}px`;
            menu.style.zIndex = 10050;
            menu.innerHTML = `
                <button class="btn btn-sm btn-primary" id="profile-run-tour">Run Tour</button>
                <button class="btn btn-sm btn-ghost" id="profile-run-tutorial">Try Tutorial Game</button>
                <button class="btn btn-sm btn-outline" id="profile-run-close">Close</button>
            `;
            document.body.appendChild(menu);

            document.getElementById('profile-run-tour')?.addEventListener('click', () => {
                try { ViewManager.show('lobby'); PresenceManager.updateActivity('In Lobby'); setTimeout(() => TourSystem.start(true), 250); } catch (e) { console.warn('Failed to start tour', e); }
                menu.remove();
            });
            document.getElementById('profile-run-tutorial')?.addEventListener('click', () => {
                try { TutorialGame.start(); } catch (e) { console.warn('Failed to start tutorial', e); }
                menu.remove();
            });
            document.getElementById('profile-run-close')?.addEventListener('click', () => menu.remove());

            // Auto-remove when clicking outside
            const onDocClick = (evt) => {
                if (!menu.contains(evt.target) && evt.target !== btn) {
                    menu.remove();
                    document.removeEventListener('click', onDocClick);
                }
            };
            setTimeout(() => document.addEventListener('click', onDocClick), 50);
        } catch (e) {
            console.warn('Orientation menu failed', e);
        }
    });
    
    // Save profile changes
    document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
        const bio = document.getElementById('profile-bio-input')?.value || '';
        const twitter = document.getElementById('profile-twitter')?.value || '';
        const discord = document.getElementById('profile-discord')?.value || '';
        
        try {
            await ProfileManager.updateProfile(AppState.currentUser.uid, {
                bio: bio.substring(0, 200),
                socialLinks: { twitter, discord }
            });
            
            // Update display
            const bioDisplay = document.getElementById('profile-page-bio');
            if (bioDisplay) bioDisplay.textContent = bio || 'No bio yet...';
            AppState.profile = Object.assign({}, AppState.profile || {}, {
                bio: bio,
                socialLinks: { twitter, discord }
            });
            
            // Switch back to view mode
            const bioDisplayEl = document.getElementById('profile-page-bio');
            const bioInputEl = document.getElementById('profile-bio-input');
            const editFields = document.getElementById('profile-edit-fields');
            if (bioDisplayEl) bioDisplayEl.style.display = 'block';
            if (bioInputEl) bioInputEl.style.display = 'none';
            if (editFields) editFields.style.display = 'none';
            document.getElementById('save-profile-btn').style.display = 'none';
            document.getElementById('cancel-edit-btn').style.display = 'none';
            document.getElementById('edit-profile-btn').style.display = 'inline-block';
            
            UI.showToast('Profile updated.', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            UI.showToast('Failed to update profile.', 'error');
        }
    });
    
    // Cancel edit
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
        const bioDisplay = document.getElementById('profile-page-bio');
        const bioInput = document.getElementById('profile-bio-input');
        const editFields = document.getElementById('profile-edit-fields');
        if (bioDisplay) bioDisplay.style.display = 'block';
        if (bioInput) bioInput.style.display = 'none';
        if (editFields) editFields.style.display = 'none';
        document.getElementById('save-profile-btn').style.display = 'none';
        document.getElementById('cancel-edit-btn').style.display = 'none';
        document.getElementById('edit-profile-btn').style.display = 'inline-block';
    });
    
    // Profile picture upload
    document.getElementById('profile-picture-input')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file || !AppState.currentUser) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB');
            return;
        }
        
        try {
            const progressIndicator = document.createElement('div');
            progressIndicator.className = 'upload-progress';
            progressIndicator.textContent = 'Uploading...';
            document.querySelector('.profile-picture-wrapper')?.appendChild(progressIndicator);
            
            const url = await ProfileManager.uploadProfilePicture(AppState.currentUser.uid, file);
            
            // Update display
            const img = document.getElementById('profile-page-picture');
            const placeholder = document.getElementById('profile-picture-placeholder');
            if (img) {
                img.src = url;
                img.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            
            progressIndicator.remove();
            UI.showToast('Profile picture updated.', 'success');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            UI.showToast('Failed to upload profile picture.', 'error');
        }
    });
    
    // Copy profile URL
    document.getElementById('copy-profile-url')?.addEventListener('click', async () => {
        const linkEl = document.getElementById('profile-vanity-link');
        const url = linkEl?.href || linkEl?.textContent || '';
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            UI.showToast('Profile URL copied.', 'success');
        } catch (e) {
            console.warn('Clipboard write failed', e);
            try {
                window.prompt('Copy profile URL:', url);
            } catch { /* ignore */ }
            UI.showToast('Copy failed. URL shown for manual copy.', 'error');
        }
    });
    
    // Social sharing
    document.getElementById('share-twitter')?.addEventListener('click', () => {
        shareToSocial('twitter');
    });
    
    document.getElementById('share-facebook')?.addEventListener('click', () => {
        shareToSocial('facebook');
    });
    
    document.getElementById('share-copy')?.addEventListener('click', () => {
        const shareText = generateShareText();
        navigator.clipboard.writeText(shareText).then(() => {
            UI.showToast('Stats copied.', 'success');
        }).catch(() => {
            UI.showToast('Copy failed.', 'error');
        });
    });
    
    // Challenge from profile
    document.getElementById('profile-challenge-btn')?.addEventListener('click', async () => {
        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
        if (!profileUserId || !AppState.currentUser) return;
        
        // Create a room and send invite
        const roomId = await LobbyManager.createRoom(AppState.currentUser.uid);
        
        // Send challenge notification (simplified - would use push notifications in production)
        alert(`Room created! Share code: ${roomId} with this player.`);
    });
    
	    // Friend button
	    document.getElementById('profile-friend-btn')?.addEventListener('click', async () => {
	        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
	        if (!profileUserId || !AppState.currentUser) return;
	        if (!isRegisteredUser()) {
	            alert('Sign in with an email account to add friends.');
	            return;
	        }
	        
	        const btn = document.getElementById('profile-friend-btn');
	        const currentText = btn?.textContent || '';
        const labelEl = btn?.querySelector('.btn-label');
        
        try {
            if (currentText.includes('Add Friend')) {
                const result = await ProfileManager.sendFriendRequest(AppState.currentUser.uid, profileUserId);
                const accepted = result === 'accepted_existing';
                if (labelEl) labelEl.textContent = accepted ? 'Friends' : 'Request Sent';
                else if (btn) btn.textContent = accepted ? 'Friends' : 'Request Sent';
                alert(accepted ? 'Friend request accepted.' : 'Friend request sent!');
                if (accepted) await FriendsManager.refresh();
            } else if (currentText.includes('Remove Friend')) {
                await ProfileManager.removeFriend(AppState.currentUser.uid, profileUserId);
                if (labelEl) labelEl.textContent = 'Add Friend';
                else if (btn) btn.textContent = 'Add Friend';
                alert('Friend removed');
            } else if (currentText.includes('Accept Request')) {
                await ProfileManager.acceptFriendRequest(AppState.currentUser.uid, profileUserId);
                if (labelEl) labelEl.textContent = 'Friends';
                else if (btn) btn.textContent = 'Friends';
            }
	        } catch (error) {
	            console.error('Friend action error:', error);
	            const msg = error?.message || 'Failed to complete action';
	            alert(msg.includes('registered') ? msg : 'Failed to complete action: ' + msg);
	        }
	    });
    
	    // DM from profile
	    document.getElementById('profile-dm-btn')?.addEventListener('click', async () => {
	        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
	        if (!profileUserId) return;
	        if (!isRegisteredUser()) {
	            alert('Sign in with an email account to send direct messages.');
	            return;
	        }

	        try {
	            await window.ChatWidget?.openDm?.(profileUserId);
	        } catch (e) {
	            console.warn('Failed to open DM conversation:', e);
        }
    });
    
    // My Profile button in header
    document.getElementById('my-profile-btn')?.addEventListener('click', () => {
        if (AppState.currentUser) {
            UI.showProfilePage(AppState.currentUser.uid);
        }
    });
}

// ===========================================
// Social Sharing Functions
// ===========================================
function generateShareText() {
    const profile = AppState.profile || {};
    const wins = profile.stats?.wins || profile.wins || 0;
    const losses = profile.stats?.losses || profile.losses || 0;
    const badges = Array.isArray(profile.badges) ? profile.badges.length : 0;
    
    return `Stonedoku — Player Record\n` +
           `Wins: ${wins}\n` +
           `Win Rate: ${wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%\n` +
           `Badges: ${badges}\n` +
           `Play: https://stone-doku.web.app`;
}

function shareToSocial(platform) {
    const text = generateShareText();
    const url = 'https://stone-doku.web.app';
    
    let shareUrl;
    
    switch (platform) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
            break;
        default:
            return;
    }
    
        window.open(shareUrl, '_blank', 'width=600,height=400');
}

function isProfileDeepLink(hash = window.location.hash || '', path = window.location.pathname || '') {
    return /^#\/?(?:profile|user|u)\/.+/i.test(hash) || /^\/(?:profile|user|u)\/.+/i.test(path);
}

function clearProfileDeepLink() {
    try {
        if (!isProfileDeepLink()) return;
        const search = window.location.search || '';
        const target = search ? `/${search}` : '/';
        window.history.replaceState({}, document.title, target);
    } catch (e) {
        console.warn('Failed to clear profile URL', e);
    }
}

function isUpdatesDeepLink(hash = window.location.hash || '') {
    return /^#\/updates/i.test(hash);
}

function clearUpdatesDeepLink() {
    try {
        if (!isUpdatesDeepLink()) return;
        const path = window.location.pathname || '/';
        const search = window.location.search || '';
        window.history.replaceState({}, document.title, `${path}${search}`);
    } catch (e) {
        console.warn('Failed to clear updates URL', e);
    }
}

function isAdminDeepLink(hash = window.location.hash || '') {
    return /^#\/admin/i.test(hash);
}

function clearAdminDeepLink() {
    try {
        if (!isAdminDeepLink()) return;
        const path = window.location.pathname || '/';
        const search = window.location.search || '';
        window.history.replaceState({}, document.title, `${path}${search}`);
    } catch (e) {
        console.warn('Failed to clear admin URL', e);
    }
}

// ===========================================
// Vanity URL Handler
// ===========================================
async function handleVanityUrl() {
    // Support hash-based and pathname-based vanity URLs.
    try {
        // Hash-based: #/profile/username or #profile/username
        const hash = window.location.hash;
        const hashMatch = hash.match(/^#\/?(?:profile|user|u)\/(.+)$/i);
        if (hashMatch && hashMatch[1]) {
            const username = decodeURIComponent(hashMatch[1]);
            if (username) {
                const profile = await ProfileManager.getProfileByUsername(username);
                if (profile) {
                    const checkAuth = () => {
                        if (AppState.authReady) {
                            UI.showProfilePage(profile.id);
                        } else {
                            setTimeout(checkAuth, 100);
                        }
                    };
                    checkAuth();
                    return;
                }
            }
        }

        // Pathname-based: /profile/username, /user/username, or /u/username
        const pathname = window.location.pathname || '';
        const pathMatch = pathname.match(/^\/(?:profile|user|u)\/(.+)$/i);
        if (pathMatch && pathMatch[1]) {
            const username = decodeURIComponent(pathMatch[1]);
            const profile = await ProfileManager.getProfileByUsername(username);
            if (profile) {
                const checkAuth2 = () => {
                    if (AppState.authReady) {
                        UI.showProfilePage(profile.id);
                    } else {
                        setTimeout(checkAuth2, 100);
                    }
                };
                checkAuth2();
                return;
            }
        }
    } catch (error) {
        console.error('Error loading profile from URL:', error);
    }
}

// ===========================================
// Updates Deep Links (#/updates or #/updates/<docId>)
// ===========================================
function handleUpdatesUrl() {
    try {
        const hash = window.location.hash || '';
        if (!hash.startsWith('#/updates')) return false;
        const match = hash.match(/^#\/updates(?:\/([^?]+))?(?:\?(.*))?$/i);
        if (!match) return false;

        let focusId = match[1] ? decodeURIComponent(match[1]) : null;
        if (!focusId && match[2]) {
            const params = new URLSearchParams(match[2]);
            focusId = params.get('id');
        }

        // Ensure the feed is visible; UpdatesCenter handles missing DOM gracefully.
        UpdatesCenter.openFeed(focusId || null);
        return true;
    } catch (e) {
        console.warn('Failed to handle updates URL', e);
        return false;
    }
}

// ===========================================
// Admin Deep Links (#/admin)
// ===========================================
function handleAdminUrl() {
    try {
        const hash = window.location.hash || '';
        if (hash.startsWith('#/admin')) {
            if (typeof AdminConsole?.openFromHash === 'function') {
                // If auth not ready yet, retry shortly to avoid false negatives.
                if (!AppState.authReady) {
                    setTimeout(() => AdminConsole.openFromHash().catch((e) => console.warn('Admin open failed (retry)', e)), 300);
                } else {
                    AdminConsole.openFromHash().catch((e) => console.warn('Admin open failed', e));
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        console.warn('Failed to handle admin URL', e);
        return false;
    }
}

// ===========================================
// Join Room Deep Link (#/join/<code>)
// ===========================================
function handleJoinUrl() {
    try {
        const hash = window.location.hash || '';
        const match = hash.match(/^#\/join\/(\d{4})$/i);
        if (!match) return false;
        const code = match[1];
        AppState.pendingJoinCode = code;
        if (AppState.authReady && AppState.currentUser) {
            joinRoomHandler(code);
        }
        return true;
    } catch (e) {
        console.warn('Failed to handle join URL', e);
        return false;
    }
}

function waitForAuthReady(maxMs = 8000) {
    if (AppState.authReady) return Promise.resolve(true);
    return new Promise((resolve) => {
        const start = Date.now();
        const timer = setInterval(() => {
            if (AppState.authReady) {
                clearInterval(timer);
                resolve(true);
            } else if (Date.now() - start > maxMs) {
                clearInterval(timer);
                resolve(false);
            }
        }, 100);
    });
}

// Listen for hash changes
window.addEventListener('hashchange', handleVanityUrl);
window.addEventListener('hashchange', () => PasswordReset.hydrateFromUrl());

// ===========================================
// Floating Chat Widget
// ===========================================
function initFloatingChat() {
    const widget = document.getElementById('chat-widget');
    const fab = document.getElementById('chat-fab');
    const header = document.getElementById('chat-widget-header');
    const minimizeBtn = document.getElementById('chat-minimize');
    const maximizeBtn = null;
    const form = document.getElementById('chat-widget-form');
    const input = document.getElementById('chat-widget-input');
    const showChatModerationNotice = (() => {
        let shown = false;
        return () => {
            if (shown) return;
            if (AppState.moderation.muted || AppState.moderation.blocked) {
                const msg = AppState.moderation.muted && AppState.moderation.blocked
                    ? 'Messaging restricted: muted and blocked by an administrator.'
                    : AppState.moderation.muted
                        ? 'Messaging restricted: you are muted by an administrator.'
                        : 'Messaging restricted: you are blocked from messaging.';
                UI.showToast(msg, 'warn');
                shown = true;
            }
        };
    })();
    (function initViewportOffset() {
        const applyOffset = () => {
            if (!window.visualViewport) {
                document.documentElement.style.setProperty('--chat-vv-offset', '0px');
                return;
            }
            const offset = Math.max(0, window.innerHeight - window.visualViewport.height);
            document.documentElement.style.setProperty('--chat-vv-offset', `${offset}px`);
        };
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', applyOffset);
            window.visualViewport.addEventListener('scroll', applyOffset);
            applyOffset();
        }
        input?.addEventListener('focus', applyOffset);
        input?.addEventListener('blur', () => setTimeout(applyOffset, 150));
    })();

    if (!widget || !fab) return;

    // Suggestion popup for whisper username autocomplete
    const suggestionBox = document.createElement('div');
    suggestionBox.id = 'chat-suggestion-box';
    suggestionBox.style.position = 'fixed';
    suggestionBox.style.zIndex = '9999';
    suggestionBox.style.background = 'var(--color-card-bg-solid)';
    suggestionBox.style.border = '1px solid var(--color-grid-border)';
    suggestionBox.style.boxShadow = 'var(--shadow-md)';
    suggestionBox.style.display = 'none';
    suggestionBox.style.minWidth = '180px';
    suggestionBox.style.maxHeight = '240px';
    suggestionBox.style.overflow = 'auto';
    suggestionBox.style.borderRadius = '0';
    suggestionBox.style.padding = '6px 0';
    suggestionBox.style.fontSize = '14px';
    document.body.appendChild(suggestionBox);

    let suggestions = [];
    let selectedIndex = -1;

    async function fetchUsernameSuggestions(prefix) {
        if (!dmEnabled) return [];
        if (!prefix) return [];
        const p = prefix.toLowerCase();
        const selfUsername = (AppState.profile?.usernameLower || AppState.profile?.username || '').toLowerCase();
        const seed = (selfUsername && selfUsername.startsWith(p)) ? [selfUsername] : [];
        try {
            // Fetch matching username documents (usernameLower -> { userId })
            const q = query(collection(firestore, 'usernames'), where(documentId(), '>=', p), where(documentId(), '<=', p + '\\uf8ff'), limit(32));
            const snap = await getDocs(q);
            const candidates = snap.docs.map(d => ({ username: d.id, userId: d.data().userId }));

            // Try to read presence snapshot and prefer online users
            try {
                const presRef = ref(rtdb, 'presence');
                const presSnap = await get(presRef);
                const onlineSet = new Set();
                presSnap.forEach(child => {
                    const val = child.val() || {};
                    const last = val.last_changed || 0;
                    const now = Date.now();
                    const recent = typeof last === 'number' ? (now - last) < 45000 : true;
                    if (val.status === 'online' && recent) onlineSet.add(child.key);
                });

                // Split candidates into online first, then offline
                const online = [];
                const offline = [];
                for (const c of candidates) {
                    if (onlineSet.has(c.userId)) online.push(c.username);
                    else offline.push(c.username);
                }
                const merged = seed.concat(online, offline).slice(0, 8);
                if (merged.length > 0) return merged;
            } catch (e) {
                // If presence read fails, fall back to username list
                console.warn('Presence read failed for suggestions, falling back:', e);
            }

            if (candidates.length > 0) {
                return seed.concat(candidates.slice(0, 8).map(c => c.username));
            }

            // Fallback: query users collection by usernameLower prefix
            const usersQ = query(
                collection(firestore, 'users'),
                orderBy('usernameLower'),
                where('usernameLower', '>=', p),
                where('usernameLower', '<=', p + '\uf8ff'),
                limit(8)
            );
            const userSnap = await getDocs(usersQ);
            const fromUsers = userSnap.docs.map(d => d.data()?.usernameLower || d.data()?.username).filter(Boolean);
            const deduped = Array.from(new Set(seed.concat(fromUsers))).slice(0, 8);
            return deduped;
        } catch (e) {
            console.error('Username suggestion fetch failed', e);
            // Final fallback: read a small slice of users and filter locally
            try {
                const slice = await getDocs(query(collection(firestore, 'users'), limit(32)));
                const local = [];
                slice.forEach((d) => {
                    const data = d.data() || {};
                    const uname = (data.usernameLower || data.username || '').toLowerCase();
                    if (uname && uname.startsWith(p)) local.push(uname);
                });
                return Array.from(new Set(seed.concat(local))).slice(0, 8);
            } catch (_e) {
                return seed;
            }
        }
    }

    function positionSuggestionBox() {
        if (!input) return;
        if (widget.classList.contains('minimized')) {
            suggestionBox.style.display = 'none';
            return;
        }
        const rect = input.getBoundingClientRect();
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const viewportH = window.innerHeight || document.documentElement.clientHeight;
        const safeBottom = 10 + (window.visualViewport?.offsetTop || 0);

        const boxMaxH = 240;
        const desiredW = rect.width;
        const desiredLeft = rect.left;
        const belowTop = rect.bottom + 6;
        const aboveTop = rect.top - 6 - boxMaxH;

        let left = Math.max(10, Math.min(desiredLeft, viewportW - desiredW - 10));
        let top = belowTop;
        // If we would overflow below, place above.
        if (belowTop + boxMaxH > viewportH - safeBottom) {
            top = Math.max(10, aboveTop);
        }

        suggestionBox.style.left = `${Math.round(left)}px`;
        suggestionBox.style.top = `${Math.round(top)}px`;
        suggestionBox.style.width = `${Math.round(desiredW)}px`;
    }

    function renderSuggestions(list) {
        suggestions = list || [];
        selectedIndex = -1;
        if (suggestionHideTimer) {
            clearTimeout(suggestionHideTimer);
            suggestionHideTimer = null;
        }
        suggestionBox.innerHTML = '';
        if (!suggestions || suggestions.length === 0) {
            suggestionBox.style.display = 'none';
            return;
        }
        suggestionBox.style.display = 'block';
        suggestions.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'chat-suggestion-item';
            item.style.padding = '6px 10px';
            item.style.cursor = 'pointer';
            item.style.whiteSpace = 'nowrap';
            item.textContent = s;
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                applySuggestion(s);
            });
            suggestionBox.appendChild(item);
        });
        positionSuggestionBox();
    }

    function applySuggestion(username) {
        if (!input) return;
        const value = input.value || '';
        const m = value.match(/^(@w(?:hisper)?\s+)([A-Za-z0-9_\-]*)(.*)$/i);
        if (!m) return;
        const prefix = m[1];
        const rest = m[3] || '';
        const needsSpace = rest.length > 0 && !rest.startsWith(' ');
        input.value = `${prefix}${username}${needsSpace ? ' ' : ''}${rest}`.replace(/\s{2,}/g, ' ');
        input.focus();
        suggestionBox.style.display = 'none';
    }

    // Handle keyboard navigation
    input?.addEventListener('keydown', (e) => {
        if (suggestionBox.style.display === 'none') return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(suggestions.length - 1, selectedIndex + 1);
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(0, selectedIndex - 1);
            updateSelection();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                e.preventDefault();
                applySuggestion(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            suggestionBox.style.display = 'none';
        }
    });

    function updateSelection() {
        const items = suggestionBox.querySelectorAll('.chat-suggestion-item');
        items.forEach((it, idx) => {
            it.style.background = idx === selectedIndex ? 'rgba(0,0,0,0.06)' : 'transparent';
        });
        if (selectedIndex >= 0 && items[selectedIndex]) {
            const el = items[selectedIndex];
            el.scrollIntoView({ block: 'nearest' });
        }
    }

    let suggestionHideTimer = null;
    input?.addEventListener('input', async (e) => {
        if (!dmEnabled) {
            suggestionBox.style.display = 'none';
            return;
        }
        const val = e.target.value || '';
        const m = val.match(/^(@w(?:hisper)?\s+)([A-Za-z0-9_\-]{0,})(.*)$/i);
        if (!m) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 200);
            return;
        }

        const prefix = m[1] || '';
        const fragment = m[2] || '';
        const rest = m[3] || '';
        const cursor = typeof input.selectionStart === 'number' ? input.selectionStart : val.length;
        const usernameStart = prefix.length;
        const usernameEnd = usernameStart + fragment.length;

        // Only show suggestions while the caret is within the username token.
        if (cursor < usernameStart || cursor > usernameEnd) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
            return;
        }

        // If they've already started typing the message, avoid popping suggestions.
        if (rest.length > 0 && !rest.startsWith(' ')) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
            return;
        }

        if (fragment.length < 1) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
            return;
        }
        const list = await fetchUsernameSuggestions(fragment);
        renderSuggestions(list);
    });

    input?.addEventListener('blur', () => {
        // Delay hide to allow click handler to run
        suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
    });
    const emojiToggle = document.getElementById('widget-emoji-toggle');
    const emojiPicker = document.getElementById('emoji-picker-widget');
    const notificationBtn = document.getElementById('chat-notify-btn');
    const notificationPanel = document.getElementById('chat-notify-panel');
    const notifToggles = {
        global: document.getElementById('notify-global'),
        game: document.getElementById('notify-game'),
        dms: document.getElementById('notify-dms'),
        sound: document.getElementById('notify-sound'),
        badges: document.getElementById('notify-badge')
    };

    function getActiveChannel() {
        const activeTab = document.querySelector('.widget-tab.active');
        const tabMode = activeTab?.dataset.chat || 'global';
        const stateMode = AppState.widgetChatMode || tabMode;

        // When in a DM conversation, widgetChatMode is dm_<userId> while tab can still be "dms".
        if (stateMode && stateMode.startsWith && stateMode.startsWith('dm_')) return stateMode;
        if (stateMode === 'global' || stateMode === 'game' || stateMode === 'dms' || stateMode === 'friends') return stateMode;
        return tabMode;
    }

    const NotificationCenter = (() => {
        const defaults = { global: true, game: true, dms: true, sound: true, badges: true };
        const counts = { global: 0, game: 0, dm: new Map() };
        const LAST_SEEN_KEY = 'stonedoku_chat_seen_v1';
        let lastSeen = { global: Date.now(), game: Date.now(), dm: {} };

        const loadPrefs = () => {
            try {
                const raw = localStorage.getItem('stonedoku_notif_prefs');
                if (raw) return JSON.parse(raw);
            } catch { /* ignore */ }
            return {};
        };

        const prefs = Object.assign({}, defaults, AppState.settings.notifications || {}, loadPrefs());
        AppState.settings.notifications = prefs;

        const loadLastSeen = () => {
            try {
                const raw = localStorage.getItem(LAST_SEEN_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        lastSeen = Object.assign(lastSeen, parsed);
                        if (!lastSeen.dm) lastSeen.dm = {};
                    }
                }
            } catch { /* ignore */ }
        };

        const persistLastSeen = () => {
            try { localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(lastSeen)); } catch { /* ignore */ }
        };

        loadLastSeen();

        const persist = () => {
            AppState.settings.notifications = Object.assign({}, prefs);
            try { localStorage.setItem('stonedoku_notif_prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
        };

        const syncToggles = () => {
            Object.entries(notifToggles).forEach(([key, el]) => {
                if (el) el.checked = !!prefs[key];
            });
        };
        syncToggles();

        const isChannelActive = (channel) => {
            const active = getActiveChannel();
            const minimized = widget.classList.contains('minimized');
            return !minimized && active === channel;
        };

        const shouldCount = (channel) => {
            if (channel === 'global') return !!prefs.global;
            if (channel === 'game') return !!prefs.game;
            if (channel && channel.startsWith && channel.startsWith('dm_')) return !!prefs.dms;
            return true;
        };

        const getTotal = () => {
            let dmTotal = 0;
            counts.dm.forEach((v) => { dmTotal += v; });
            return counts.global + counts.game + dmTotal;
        };

        const updateBadgeUi = () => {
            const fabUnread = document.getElementById('fab-unread');
            const widgetUnread = document.getElementById('unread-badge');
            const total = getTotal();

            if (!prefs.badges) {
                if (fabUnread) fabUnread.style.display = 'none';
                if (widgetUnread) widgetUnread.style.display = 'none';
                return;
            }

            if (total > 0) {
                if (fabUnread) {
                    fabUnread.textContent = total > 99 ? '99+' : total;
                    fabUnread.style.display = 'block';
                }
                if (widgetUnread) {
                    widgetUnread.textContent = total > 99 ? '99+' : total;
                    widgetUnread.style.display = 'inline-block';
                }
            } else {
                if (fabUnread) fabUnread.style.display = 'none';
                if (widgetUnread) widgetUnread.style.display = 'none';
            }
        };

        const markRead = (channel) => {
            if (!channel) return;
            if (channel === 'dms') {
                // Clear all DM unread counts locally and in RTDB.
                counts.dm.clear();
                const uid = AppState.currentUser?.uid;
                const threads = AppState.dmThreads || {};
                if (uid && threads && Object.keys(threads).length > 0) {
                    const updates = {};
                    Object.keys(threads).forEach((otherId) => {
                        updates[`${otherId}/unread`] = 0;
                        lastSeen.dm[otherId] = Date.now();
                    });
                    update(ref(rtdb, `dmThreads/${uid}`), updates).catch(() => {});
                }
                persistLastSeen();
                updateBadgeUi();
                return;
            }
            if (channel === 'global') {
                counts.global = 0;
                lastSeen.global = Date.now();
                persistLastSeen();
            }
            else if (channel === 'game') {
                counts.game = 0;
                lastSeen.game = Date.now();
                persistLastSeen();
            }
            else if (channel.startsWith && channel.startsWith('dm_')) {
                const id = channel.replace('dm_', '');
                counts.dm.delete(id);
                const uid = AppState.currentUser?.uid;
                if (uid && id) {
                    update(ref(rtdb, `dmThreads/${uid}/${id}`), { unread: 0 }).catch(() => {});
                }
                lastSeen.dm[id] = Date.now();
                persistLastSeen();
            }
            updateBadgeUi();
        };

        const markActiveChannel = () => {
            const active = getActiveChannel();
            if (active) markRead(active);
        };

        const markIncoming = (channel, senderId = null, dmId = null, timestamp = null) => {
            if (senderId && AppState.currentUser && senderId === AppState.currentUser.uid) return;
            if (!shouldCount(channel)) return;
            if (isChannelActive(channel)) return;

            const ts = typeof timestamp === 'number' ? timestamp : null;
            if (channel === 'global' && ts && ts <= (lastSeen.global || 0)) return;
            if (channel === 'game' && ts && ts <= (lastSeen.game || 0)) return;
            if (channel && channel.startsWith && channel.startsWith('dm_') && ts) {
                const id = dmId || channel.replace('dm_', '');
                if (lastSeen.dm?.[id] && ts <= lastSeen.dm[id]) return;
            }

            if (channel === 'global') counts.global += 1;
            else if (channel === 'game') counts.game += 1;
            else if (channel.startsWith && channel.startsWith('dm_')) {
                const id = dmId || channel.replace('dm_', '');
                const next = (counts.dm.get(id) || 0) + 1;
                counts.dm.set(id, next);
            }

            updateBadgeUi();

            const allowSound = prefs.sound && shouldCount(channel);
            if (allowSound) {
                if (channel.startsWith && channel.startsWith('dm_')) AudioManager.playDmPing();
                else AudioManager.playChatPing();
            }
        };

        const syncDmThreads = (threadsMap) => {
            counts.dm.clear();
            if (threadsMap) {
                Object.entries(threadsMap).forEach(([uid, thread]) => {
                    const unread = Math.max(0, Number(thread?.unread) || 0);
                    if (unread > 0) counts.dm.set(uid, unread);
                });
            }
            updateBadgeUi();
        };

        const reset = () => {
            counts.global = 0;
            counts.game = 0;
            counts.dm.clear();
            updateBadgeUi();
        };

        const setPref = (key, value) => {
            if (Object.prototype.hasOwnProperty.call(prefs, key)) {
                prefs[key] = !!value;
                persist();
                syncToggles();
                updateBadgeUi();
            }
        };

        return {
            markIncoming,
            markRead,
            markActiveChannel,
            syncDmThreads,
            reset,
            prefs,
            setPref,
            updateBadgeUi
        };
    })();

    Object.entries(notifToggles).forEach(([key, el]) => {
        el?.addEventListener('change', (e) => {
            NotificationCenter.setPref(key, e.target.checked);
        });
    });

    NotificationCenter.updateBadgeUi();

    notificationBtn?.addEventListener('click', () => {
        if (!notificationPanel) return;
        const visible = notificationPanel.style.display !== 'none';
        notificationPanel.style.display = visible ? 'none' : 'block';
    });

    function clearActiveUnread() {
        NotificationCenter.markActiveChannel();
    }

    const dmListEl = document.getElementById('dm-list');
    const dmConversationsEl = document.getElementById('dm-conversations');
    const chatHintEl = document.getElementById('chat-hint');
    const messagesEl = document.getElementById('chat-widget-messages');
    const newDmBtn = document.getElementById('new-dm-btn');
    const dmTabBtn = document.getElementById('widget-dms-tab');

	    const dmStartModal = document.getElementById('dm-start-modal');
	    const dmStartInput = document.getElementById('dm-start-username');
	    const dmStartResults = document.getElementById('dm-start-results');
	    const dmStartCancel = document.getElementById('dm-start-cancel');
	    const dmQuickInput = document.getElementById('dm-quick-handle');
    const dmQuickStatus = document.getElementById('dm-quick-status');
    const dmQuickOpenBtn = document.getElementById('dm-quick-open');
    const dmQuickAddBtn = document.getElementById('dm-quick-add');
    const friendHandleInput = document.getElementById('friend-handle-input');
    const friendAddBtn = document.getElementById('friend-add-btn');
    const friendsTabBtn = document.getElementById('widget-friends-tab');
    const dmQuickSection = document.getElementById('dm-quick');
    const dmFriendsSection = document.getElementById('dm-friends');
    const dmFriendsListEl = document.getElementById('dm-friends-list');
    const dmConversationsSection = document.getElementById('dm-list');

    const MAX_MESSAGES_PER_CHANNEL = 200;
    const messageStore = new Map(); // channel -> Array<{ userId, displayName, text, timestamp }>
    let activeDmUnsub = null;
    let activeDmUserId = null;
    let activeDmSeenKeys = new Set();
    let dmUnreadCache = new Map(); // otherUserId -> unread count (for sound + diffing)
    let dmEnabled = false;

    const getDmDisplayName = (otherUserId) => {
        if (!otherUserId) return 'Player';
        const thread = AppState.dmThreads?.[otherUserId];
        if (thread?.otherDisplayName) return thread.otherDisplayName;
        return `Player_${String(otherUserId).substring(0, 6)}`;
    };

    const ensureDmDisplayMeta = async (otherUserId) => {
        if (!otherUserId) return null;
        if (!AppState.dmThreads) AppState.dmThreads = {};
        const existing = AppState.dmThreads[otherUserId] || {};
        if (existing.otherDisplayName && existing.otherPhotoUrl) return existing;
        try {
            const snap = await ProfileManager.getProfile(otherUserId);
            if (snap.exists()) {
                const data = snap.data() || {};
                const updated = {
                    ...existing,
                    otherDisplayName: data.username || data.displayName || existing.otherDisplayName || `Player_${String(otherUserId).substring(0, 6)}`,
                    otherPhotoUrl: data.profilePicture || existing.otherPhotoUrl || null
                };
                AppState.dmThreads[otherUserId] = updated;
                return updated;
            }
        } catch (e) {
            console.warn('ensureDmDisplayMeta failed', e);
        }
        return existing;
    };

    function updateDmHeader(otherUserId = null) {
        const titleEl = document.getElementById('dm-view-title');
        if (titleEl) {
            titleEl.textContent = otherUserId ? getDmDisplayName(otherUserId) : 'Direct messages';
        }
    }
    const markThreadRead = async (otherUserId) => {
        if (!otherUserId || !AppState.currentUser) return;
        try {
            await update(ref(rtdb, `dmThreads/${AppState.currentUser.uid}/${otherUserId}`), { unread: 0 });
        } catch { /* ignore */ }
        const channel = `dm_${otherUserId}`;
        NotificationCenter.markRead(channel);
    };

    function setChatHint(message) {
        if (!chatHintEl) return;
        const textEl = chatHintEl.querySelector('#chat-hint-text');
        if (textEl) textEl.textContent = message;
    }

    function setDmEnabled(next) {
        dmEnabled = !!next;
        if (dmTabBtn) dmTabBtn.style.display = dmEnabled ? '' : 'none';
        if (friendsTabBtn) friendsTabBtn.style.display = dmEnabled ? '' : 'none';
        if (newDmBtn) newDmBtn.style.display = dmEnabled ? '' : 'none';

	        if (!dmEnabled) {
	            if (AppState.widgetChatMode === 'dms' || AppState.widgetChatMode === 'friends' || (AppState.widgetChatMode && AppState.widgetChatMode.startsWith && AppState.widgetChatMode.startsWith('dm_'))) {
	                AppState.widgetChatMode = 'global';
	                document.querySelectorAll('.widget-tab').forEach((t) => t.classList.toggle('active', t.dataset.chat === 'global'));
	                if (dmListEl) dmListEl.style.display = 'none';
	                if (dmFriendsSection) dmFriendsSection.style.display = 'none';
	                if (messagesEl) messagesEl.style.display = 'flex';
	                if (chatHintEl) chatHintEl.style.display = 'none';
	                renderChannel('global');
	            }
	            setChatHint('Sign in to start direct messages.');
        } else {
            setChatHint('Tip: Use the DM tab or Friends panel to start private conversations');
        }
    }

    function syncChatModeUi(mode) {
        const isDmConversation = mode && mode.startsWith && mode.startsWith('dm_');
        const isDmList = mode === 'dms';
        const isFriends = mode === 'friends';
        const isDmArea = isDmConversation || isDmList;

        if (dmQuickSection) dmQuickSection.style.display = dmEnabled && isDmList ? 'block' : 'none';

        if (!isDmArea && !isFriends) {
            if (dmConversationsSection) dmConversationsSection.style.display = 'none';
            if (dmFriendsSection) dmFriendsSection.style.display = 'none';
            if (messagesEl) messagesEl.style.display = 'flex';
            if (chatHintEl) chatHintEl.style.display = 'none';
            return;
        }

        const showMessages = isDmConversation || !(isDmArea || isFriends);
        if (messagesEl) messagesEl.style.display = showMessages ? 'flex' : 'none';
        if (dmConversationsSection) dmConversationsSection.style.display = isDmList ? 'block' : 'none';
        if (dmFriendsSection) dmFriendsSection.style.display = isFriends ? 'block' : 'none';
        if (chatHintEl) chatHintEl.style.display = (isDmArea || isFriends) ? 'none' : 'block';
    }

	    async function renderDmFriends() {
	        const requestsList = document.getElementById('dm-friend-requests-list');
	        const friendsList = document.getElementById('dm-friends-list');
	        if (!requestsList || !friendsList) return;

	        if (!isRegisteredUser()) {
	            requestsList.innerHTML = '<div class="dm-empty">Friend features are for registered users.</div>';
	            friendsList.innerHTML = '';
	            return;
	        }

	        // --- Fetch and render friend requests ---
	        let incomingRequests = [];
	        try {
	            const reqQ = query(
	                collection(firestore, 'friendRequests'),
	                where('toUid', '==', AppState.currentUser.uid),
	                where('status', '==', 'pending'),
	                limit(30)
	            );
	            const snap = await getDocs(reqQ);
	            incomingRequests = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
	        } catch (e) {
	            console.warn('Failed to load incoming friend requests for chat widget', e);
	        }

	        const loadProfiles = async (ids) => {
	            const unique = Array.from(new Set(ids.filter(Boolean)));
	            if (unique.length === 0) return [];
	            const results = await Promise.all(unique.map(async (id) => {
	                try {
	                    const snap = await ProfileManager.getProfile(id);
	                    if (!snap.exists()) return { id, data: null };
	                    return { id, data: snap.data() || null };
	                } catch {
	                    return { id, data: null };
	                }
	            }));
	            return results;
	        };

	        const requestIds = incomingRequests.map((r) => r?.fromUid).filter(Boolean);
	        const requestProfiles = await loadProfiles(requestIds);
	        requestsList.innerHTML = '';
	        if (requestProfiles.length === 0) {
	            requestsList.innerHTML = '<div class="friend-empty">No incoming requests.</div>';
	        } else {
	            for (const r of requestProfiles) {
	                const name = r.data?.username || r.data?.displayName || `Player_${String(r.id).substring(0, 6)}`;
	                const row = document.createElement('div');
	                row.className = 'friend-item';
	                row.innerHTML = `
	                    <div class="friend-name">${UI.escapeHtml(name)}</div>
	                    <div class="friend-actions">
	                        <button class="btn btn-icon btn-sm" type="button" title="Accept"><svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg></button>
	                        <button class="btn btn-icon btn-sm" type="button" title="Decline"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
	                    </div>
	                `;
	                const [acceptBtn, declineBtn] = row.querySelectorAll('button');
	                acceptBtn?.addEventListener('click', async () => {
	                    try {
	                        await ProfileManager.acceptFriendRequest(AppState.currentUser.uid, r.id);
	                        await renderDmFriends(); // Re-render this tab
	                        await FriendsManager.refresh(); // Also refresh lobby panel if open
	                    } catch (e) {
	                        console.error('Failed to accept friend request', e);
	                        UI.showToast('Failed to accept request.', 'error');
	                    }
	                });
	                declineBtn?.addEventListener('click', async () => {
	                    try {
	                        await ProfileManager.declineFriendRequest(AppState.currentUser.uid, r.id);
	                        await renderDmFriends(); // Re-render this tab
	                        await FriendsManager.refresh(); // Also refresh lobby panel if open
	                    } catch (e) {
	                        console.error('Failed to decline friend request', e);
	                        UI.showToast('Failed to decline request.', 'error');
	                    }
	                });
	                requestsList.appendChild(row);
	            }
	        }

	        // --- Fetch and render friends ---
	        const friendIds = Array.isArray(AppState.friends) ? AppState.friends : [];
	        const friendProfiles = await loadProfiles(friendIds);
	        friendsList.innerHTML = '';
	        if (friendProfiles.length === 0) {
	            friendsList.innerHTML = '<div class="dm-empty">No friends yet.</div>';
	            return;
	        }

	        for (const f of friendProfiles) {
	            const name = f.data?.username || f.data?.displayName || `Player_${String(f.id).substring(0, 6)}`;
	            const isOnline = AppState.onlinePlayers[f.id]?.status === 'online';
	            const row = document.createElement('div');
	            row.className = 'friend-item';
	            row.dataset.userId = f.id;
	            row.innerHTML = `
	                <div class="friend-status-dot ${isOnline ? 'online' : ''}" title="${isOnline ? 'Online' : 'Offline'}"></div>
	                <div class="friend-name">${UI.escapeHtml(name)}</div>
	                <div class="friend-actions">
	                    <button class="btn btn-icon btn-sm" type="button" title="Profile"><svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg></button>
	                    <button class="btn btn-icon btn-sm" type="button" title="Message"><svg class="ui-icon" aria-hidden="true"><use href="#i-chat"></use></svg></button>
	                </div>
	            `;
	            const [profileBtn, messageBtn] = row.querySelectorAll('button');
	            profileBtn?.addEventListener('click', () => UI.showProfilePage(f.id));
	            messageBtn?.addEventListener('click', () => openDmConversation(f.id));
	            friendsList.appendChild(row);
	        }
	    }

    function normalizeTimestamp(ts) {
        if (typeof ts === 'number') return ts;
        if (typeof ts === 'string' && ts) {
            const n = Number(ts);
            if (Number.isFinite(n)) return n;
        }
        if (ts && typeof ts === 'object') {
            // Handle RTDB serverTimestamp placeholders and other oddities.
            const n = Number(ts);
            if (Number.isFinite(n)) return n;
        }
        return Date.now();
    }

    function normalizeChatMessage(raw) {
        const userId = raw?.userId ?? raw?.from ?? null;
        const displayName = raw?.displayName ?? raw?.fromDisplayName ?? raw?.sender ?? (userId ? `Player_${String(userId).substring(0, 6)}` : 'Player');
        const text = String(raw?.text ?? '').trim();
        const timestamp = normalizeTimestamp(raw?.timestamp);
        return { userId, displayName, text, timestamp };
    }

    function storeAppend(channel, raw) {
        if (!channel) return;
        const msg = normalizeChatMessage(raw);
        if (!msg.text) return;

        const list = messageStore.get(channel) || [];
        list.push(msg);
        if (list.length > MAX_MESSAGES_PER_CHANNEL) list.splice(0, list.length - MAX_MESSAGES_PER_CHANNEL);
        messageStore.set(channel, list);

        const active = getActiveChannel();
        const isActive = active === channel;
        const messagesVisible = messagesEl && messagesEl.style.display !== 'none';
        if (isActive && messagesVisible && !widget.classList.contains('minimized')) {
            UI.addChatMessage('chat-widget-messages', msg.displayName, msg.text, msg.timestamp, msg.userId);
            requestAnimationFrame(() => {
                if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
            });
        }
    }

    function renderChannel(channel) {
        if (!messagesEl) return;
        messagesEl.innerHTML = '';

        if (channel && channel.startsWith && channel.startsWith('dm_')) {
            const otherId = channel.replace('dm_', '');
            const name = getDmDisplayName(otherId);
            const headerMsg = document.createElement('div');
            headerMsg.className = 'chat-system-msg';
            headerMsg.textContent = `Direct messages with ${name}`;
            messagesEl.appendChild(headerMsg);
            updateDmHeader(otherId);
        } else {
            updateDmHeader(null);
        }

        const list = messageStore.get(channel) || [];
        for (const msg of list) {
            UI.addChatMessage('chat-widget-messages', msg.displayName, msg.text, msg.timestamp, msg.userId);
        }

        // Always keep most recent in view
        requestAnimationFrame(() => {
            if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        });

        clearActiveUnread();
    }

    function renderDmList() {
        if (!dmConversationsEl) return;

        const threads = Object.entries(AppState.dmThreads || {})
            .map(([otherUserId, data]) => ({ otherUserId, ...(data || {}) }))
            .sort((a, b) => (Number(b.lastTimestamp) || 0) - (Number(a.lastTimestamp) || 0));

        if (threads.length === 0) {
            dmConversationsEl.innerHTML = '<div class="dm-empty">No conversations yet. Start one from a profile or the + button.</div>';
            return;
        }

        dmConversationsEl.innerHTML = '';
        for (const t of threads) {
            const item = document.createElement('div');
            item.className = 'dm-conversation-item';
            item.dataset.userId = t.otherUserId;

            if (AppState.widgetChatMode === `dm_${t.otherUserId}`) item.classList.add('active');

            const avatar = document.createElement('div');
            avatar.className = 'dm-avatar';
            if (t.otherPhotoUrl) {
                avatar.innerHTML = `<img src="${UI.escapeHtml(t.otherPhotoUrl)}" alt="">`;
            } else {
                avatar.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>';
            }

            const info = document.createElement('div');
            info.className = 'dm-info';

            const name = document.createElement('div');
            name.className = 'dm-name';
            name.textContent = getDmDisplayName(t.otherUserId);

            const preview = document.createElement('div');
            preview.className = 'dm-preview';
            preview.textContent = t.lastText || '';

            info.appendChild(name);
            info.appendChild(preview);

            item.appendChild(avatar);
            item.appendChild(info);

            const unread = Math.max(0, Number(t.unread) || 0);
            if (unread > 0) {
                const badge = document.createElement('div');
                badge.className = 'dm-unread';
                badge.textContent = unread > 99 ? '99+' : String(unread);
                item.appendChild(badge);
            }

            item.addEventListener('click', () => {
                openDmConversation(t.otherUserId);
            });

            dmConversationsEl.appendChild(item);
        }
    }

    function syncDmUnreadCounts() {
        const dmCounts = {};
        for (const [otherUserId, thread] of Object.entries(AppState.dmThreads || {})) {
            const unread = Math.max(0, Number(thread?.unread) || 0);
            dmCounts[otherUserId] = thread;
            const prevUnread = Math.max(0, Number(dmUnreadCache.get(otherUserId)) || 0);
            if (unread > prevUnread && NotificationCenter.prefs.sound && NotificationCenter.prefs.dms) {
                AudioManager.playDmPing();
            }
            dmUnreadCache.set(otherUserId, unread);
        }

        // Drop cache entries that no longer exist
        for (const key of Array.from(dmUnreadCache.keys())) {
            if (!AppState.dmThreads || !Object.prototype.hasOwnProperty.call(AppState.dmThreads, key)) {
                dmUnreadCache.delete(key);
            }
        }

        NotificationCenter.syncDmThreads(dmCounts);
        renderDmList();
    }

    async function openDmConversation(otherUserId) {
        if (!otherUserId || !AppState.currentUser) return;
        if (otherUserId === AppState.currentUser.uid) return;

        // Open widget
        widget.classList.remove('minimized');
        fab.classList.add('hidden');
        suggestionBox.style.display = 'none';

        // Activate DMs tab
        document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.widget-tab[data-chat="dms"]')?.classList.add('active');

        AppState.widgetChatMode = `dm_${otherUserId}`;
        syncChatModeUi(AppState.widgetChatMode);
        if (dmListEl) dmListEl.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'flex';
        if (chatHintEl) chatHintEl.style.display = 'none';

        NotificationCenter.markRead(AppState.widgetChatMode);
        renderDmList();

        // Mark read in RTDB (best effort)
        try {
            await update(ref(rtdb, `dmThreads/${AppState.currentUser.uid}/${otherUserId}`), { unread: 0 });
        } catch { /* ignore */ }

        // Stop previous DM listener
        if (typeof activeDmUnsub === 'function') activeDmUnsub();
        activeDmUnsub = null;
        activeDmUserId = otherUserId;
        activeDmSeenKeys = new Set();

        const dmId = ChatManager.dmIdFor(AppState.currentUser.uid, otherUserId);
        const dmRef = ref(rtdb, `directMessages/${dmId}`);
        await ChatManager.ensureDmParticipants(dmId, AppState.currentUser.uid, otherUserId);
        await ensureDmDisplayMeta(otherUserId);

        // Load history once (keyed) so we can dedupe the live listener
        try {
            const snap = await get(dmRef);
            const history = [];
            if (snap.exists()) {
                snap.forEach((child) => {
                    activeDmSeenKeys.add(child.key);
                    history.push(child.val());
                });
            }
            history.sort((a, b) => normalizeTimestamp(a?.timestamp) - normalizeTimestamp(b?.timestamp));
            messageStore.set(`dm_${otherUserId}`, history.map(normalizeChatMessage));
        } catch (e) {
            console.warn('Failed to load DM history', e);
            messageStore.set(`dm_${otherUserId}`, []);
        }

        renderChannel(`dm_${otherUserId}`);
        renderDmList();
        markThreadRead(otherUserId);

        // Live listener for new messages
        activeDmUnsub = onChildAdded(dmRef, (snapshot) => {
            if (activeDmUserId !== otherUserId) return;
            if (activeDmSeenKeys.has(snapshot.key)) return;
            activeDmSeenKeys.add(snapshot.key);

            const msg = snapshot.val();
            storeAppend(`dm_${otherUserId}`, msg);

            // If this DM is open and visible, immediately mark as read.
            if (!widget.classList.contains('minimized') && getActiveChannel() === `dm_${otherUserId}` && msg?.from && msg.from !== AppState.currentUser.uid) {
                update(ref(rtdb, `dmThreads/${AppState.currentUser.uid}/${otherUserId}`), { unread: 0 }).catch(() => {});
            }
            if (msg?.from && msg.from !== AppState.currentUser?.uid) {
                NotificationCenter.markIncoming(`dm_${otherUserId}`, msg.from, otherUserId, normalizeTimestamp(msg.timestamp));
            }
        });
    }

    // Expose a small API for other modules/listeners to push messages and threads.
    window.ChatWidget = {
        ingestMessage(channel, raw) {
            const msg = normalizeChatMessage(raw);
            storeAppend(channel, raw);
            if (channel === 'game' || channel === 'global') {
                NotificationCenter.markIncoming(channel, msg.userId, null, msg.timestamp);
            }
        },
        setDmThreads(threads) {
            const next = {};
            const enrichPromises = [];
            for (const t of threads || []) {
                if (!t || !t.otherUserId) continue;
                next[t.otherUserId] = t;
                if (!t.otherPhotoUrl) {
                    enrichPromises.push((async () => {
                        try {
                            const snap = await ProfileManager.getProfile(t.otherUserId);
                            if (snap.exists()) {
                                const data = snap.data() || {};
                                next[t.otherUserId].otherPhotoUrl = data.profilePicture || null;
                                next[t.otherUserId].otherDisplayName = data.username || data.displayName || next[t.otherUserId].otherDisplayName;
                            }
                        } catch { /* ignore */ }
                    })());
                }
            }
            Promise.all(enrichPromises).then(() => {
                AppState.dmThreads = next;
                syncDmUnreadCounts();
                NotificationCenter.syncDmThreads(next);
                // Auto-clear unread if currently viewing this DM or DMs tab open.
                const active = getActiveChannel();
                if (active && active.startsWith && active.startsWith('dm_')) {
                    const otherId = active.replace('dm_', '');
                    markThreadRead(otherId);
                } else if (AppState.widgetChatMode === 'dms') {
                    NotificationCenter.markActiveChannel();
                }
            }).catch(() => {
                AppState.dmThreads = next;
                syncDmUnreadCounts();
                NotificationCenter.syncDmThreads(next);
            });
        },
        openDm(otherUserId) {
            if (!dmEnabled) {
                alert('Sign in to use direct messages.');
                return Promise.resolve();
            }
            return openDmConversation(otherUserId);
        },
        setDmEnabled(enabled) {
            setDmEnabled(enabled);
        },
        isDmEnabled() {
            return dmEnabled;
        },
        clearChannel(channel) {
            if (!channel) return;
            messageStore.delete(channel);
            if (messagesEl && messagesEl.style.display !== 'none' && getActiveChannel() === channel) {
                renderChannel(channel);
            }
        },
        reset() {
            messageStore.clear();
            AppState.dmThreads = {};
            NotificationCenter.reset();
            updateUnreadBadge();
            renderDmList();
            if (messagesEl) messagesEl.innerHTML = '';
            if (typeof activeDmUnsub === 'function') activeDmUnsub();
            activeDmUnsub = null;
            activeDmUserId = null;
            activeDmSeenKeys = new Set();
        },
        renderActive() {
            const active = getActiveChannel();
            if (active === 'global' || active === 'game' || (active && active.startsWith && active.startsWith('dm_'))) {
                renderChannel(active);
            }
        }
    };

    function openDmStartModal() {
        if (!dmStartModal) return;
        if (dmStartResults) dmStartResults.innerHTML = '';
        if (dmStartInput) dmStartInput.value = '';
        ViewManager.showModal('dm-start-modal');
        setTimeout(() => dmStartInput?.focus(), 50);
    }

    function closeDmStartModal() {
        if (!dmStartModal) return;
        ViewManager.hideModal('dm-start-modal');
    }

    async function resolveUsernameToUserId(username) {
        const uname = String(username || '').trim().toLowerCase();
        if (!uname) return null;
        try {
            const snap = await getDoc(doc(firestore, 'usernames', uname));
            if (snap.exists()) {
                const data = snap.data() || {};
                if (data.userId) return { userId: data.userId, username: uname };
            }
        } catch { /* ignore */ }
        const profile = await ProfileManager.getProfileByUsername(uname);
        if (!profile) return null;
        const data = profile.data() || {};
        return { userId: data.userId || profile.id, username: data.usernameLower || uname };
    }

    async function searchDmUsers(prefix) {
        const p = String(prefix || '').trim().toLowerCase();
        if (!p) return [];
        const q = query(collection(firestore, 'usernames'), where(documentId(), '>=', p), where(documentId(), '<=', p + '\uf8ff'), limit(12));
        const snap = await getDocs(q);
        return snap.docs
            .map((d) => ({ username: d.id, userId: d.data()?.userId }))
            .filter((x) => x.userId);
    }

	    function renderDmStartResults(items) {
	        if (!dmStartResults) return;
	        dmStartResults.innerHTML = '';
	        if (!items || items.length === 0) return;
        const list = document.createElement('div');
        list.className = 'dm-start-list';
        for (const item of items) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dm-start-item';
            btn.textContent = item.username;
            btn.addEventListener('click', async () => {
                try {
                    await openDmConversation(item.userId);
                    closeDmStartModal();
                } catch (e) {
                    console.error('Failed to open DM', e);
                    alert('Failed to open DM.');
                }
            });
            list.appendChild(btn);
        }
        dmStartResults.appendChild(list);
    }

    let dmStartSearchTimer = null;
	    dmStartInput?.addEventListener('input', () => {
	        if (!dmEnabled) return;
	        if (dmStartSearchTimer) clearTimeout(dmStartSearchTimer);
	        dmStartSearchTimer = setTimeout(async () => {
	            const items = await searchDmUsers(dmStartInput.value);
	            renderDmStartResults(items);
	        }, 120);
	    });

	    const setDmQuickStatus = (msg, isError = false) => {
	        if (!dmQuickStatus) return;
	        dmQuickStatus.textContent = msg || '';
	        dmQuickStatus.classList.toggle('error', !!isError);
	    };

	    const getDmQuickTarget = async () => {
	        const raw = dmQuickInput?.value || '';
	        const username = raw.replace(/^@/, '').trim();
	        if (!username) {
	            setDmQuickStatus('Enter a username.', true);
	            return null;
	        }
	        const resolved = await resolveUsernameToUserId(username);
	        if (!resolved) {
	            setDmQuickStatus('User not found.', true);
	            return null;
	        }
        return resolved;
	    };

	    dmQuickOpenBtn?.addEventListener('click', async () => {
	        setDmQuickStatus('');
	        if (!dmEnabled) {
	            setDmQuickStatus('Sign in with email to use DMs.', true);
	            return;
	        }
	        try {
	            const resolved = await getDmQuickTarget();
	            if (!resolved) return;
	            await openDmConversation(resolved.userId);
	            setDmQuickStatus(`Opened DM with @${resolved.username}`, false);
	            if (dmQuickInput) dmQuickInput.value = '';
	        } catch (e) {
	            console.error('Quick DM failed', e);
	            setDmQuickStatus('Failed to open DM.', true);
	        }
	    });

	    dmQuickAddBtn?.addEventListener('click', async () => {
	        setDmQuickStatus('');
	        if (!isRegisteredUser()) {
	            setDmQuickStatus('Add friend requires an email account.', true);
	            return;
	        }
	        try {
	            const resolved = await getDmQuickTarget();
	            if (!resolved) return;
	            const result = await ProfileManager.sendFriendRequest(AppState.currentUser.uid, resolved.userId);
	            const accepted = result === 'accepted_existing';
	            setDmQuickStatus(accepted ? `Accepted pending request with @${resolved.username}` : `Friend request sent to @${resolved.username}`, false);
	            if (accepted) await FriendsManager.refresh();
	        } catch (e) {
	            console.error('Quick add friend failed', e);
	            setDmQuickStatus(e?.message || 'Failed to send friend request.', true);
	        }
	    });

	    friendAddBtn?.addEventListener('click', async () => {
	        if (!isRegisteredUser()) {
	            UI.showToast('Sign in with email to add friends.', 'error');
	            return;
	        }
	        const raw = friendHandleInput?.value || '';
	        const username = raw.replace(/^@/, '').trim();
	        if (!username) {
	            UI.showToast('Enter a username.', 'error');
	            return;
	        }
	        try {
	            const resolved = await resolveUsernameToUserId(username);
	            if (!resolved) {
	                UI.showToast('User not found.', 'error');
	                return;
	            }
	            const result = await ProfileManager.sendFriendRequest(AppState.currentUser.uid, resolved.userId);
	            const accepted = result === 'accepted_existing';
	            UI.showToast(accepted ? `Accepted pending request with @${resolved.username}` : `Friend request sent to @${resolved.username}`, 'success');
	            if (accepted) await FriendsManager.refresh();
	            if (friendHandleInput) friendHandleInput.value = '';
	        } catch (e) {
	            console.error('Friend add failed', e);
	            UI.showToast(e?.message || 'Failed to send friend request.', 'error');
	        }
	    });

	    document.getElementById('dm-start-form')?.addEventListener('submit', async (e) => {
	        e.preventDefault();
	        if (!dmEnabled) return;
	        const username = dmStartInput?.value || '';
	        try {
            const resolved = await resolveUsernameToUserId(username);
            if (!resolved) {
                alert('User not found.');
                return;
            }
            await openDmConversation(resolved.userId);
            closeDmStartModal();
        } catch (e2) {
            console.error('Failed to start DM', e2);
            alert('Failed to start DM.');
        }
    });

    dmStartCancel?.addEventListener('click', closeDmStartModal);
    dmStartModal?.addEventListener('click', (e) => {
        if (e.target === dmStartModal) closeDmStartModal();
    });

    newDmBtn?.addEventListener('click', () => {
        if (!AppState.currentUser) return;
        if (!dmEnabled) {
            alert('Sign in to use direct messages.');
            return;
        }
        openDmStartModal();
    });
    
    // FAB click - open chat
    fab.addEventListener('click', () => {
        widget.classList.remove('minimized');
        fab.classList.add('hidden');
        clearActiveUnread();
        window.ChatWidget?.renderActive?.();
        input?.focus();
        showChatModerationNotice();
    });
    
    // Minimize
    minimizeBtn?.addEventListener('click', () => {
        widget.classList.add('minimized');
        widget.classList.remove('maximized');
        fab.classList.remove('hidden');
        suggestionBox.style.display = 'none';
    });
    
    // Draggable header
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    header?.addEventListener('mousedown', (e) => {
        if (e.target.closest && e.target.closest('button')) return;
        isDragging = true;
        widget.classList.add('dragging');
        const rect = widget.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        widget.style.left = `${Math.max(0, Math.min(x, window.innerWidth - 340))}px`;
        widget.style.top = `${Math.max(0, Math.min(y, window.innerHeight - 100))}px`;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        if (suggestionBox.style.display !== 'none') positionSuggestionBox();
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        widget.classList.remove('dragging');
    });
    
        // Tab switching
        document.querySelectorAll('.widget-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const chatMode = tab.dataset.chat;
                if ((chatMode === 'dms' || chatMode === 'friends') && !dmEnabled) {
                    alert('Sign in to use direct messages.');
                    return;
                }
                document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                suggestionBox.style.display = 'none';

                // Handle DMs / Friends tabs specially
                if (chatMode === 'dms') {
                    AppState.widgetChatMode = 'dms';
                    renderDmList();
                } else if (chatMode === 'friends') {
                    AppState.widgetChatMode = 'friends';
                    renderDmFriends();
                } else {
                    AppState.widgetChatMode = chatMode;
                    renderChannel(chatMode);
                }

                syncChatModeUi(AppState.widgetChatMode);
                NotificationCenter.markActiveChannel();
                if (chatMode === 'global' || chatMode === 'game') {
                    NotificationCenter.markRead(chatMode);
                } else {
                    NotificationCenter.updateBadgeUi();
                }
                showChatModerationNotice();
            });
        });
    
    // Emoji picker
    emojiToggle?.addEventListener('click', () => {
        if (emojiPicker) {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    // Emoji buttons in widget
    document.querySelectorAll('#emoji-picker-widget .emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (input) {
                input.value += btn.textContent;
                input.focus();
            }
            if (emojiPicker) emojiPicker.style.display = 'none';
        });
    });
    
    // Send message
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input?.value.trim();
        
        if (text && AppState.currentUser) {
            if (AppState.moderation.muted || AppState.moderation.blocked) {
                alert('Messaging is disabled for your account. Please contact an administrator.');
                return;
            }
            // No inline whisper command supported; use DMs or Friends panel for private messages.
            const displayName = getCurrentDisplayName();
            
            const activeTab = document.querySelector('.widget-tab.active');
            const chatMode = activeTab?.dataset.chat || 'global';
            
            try {
                if (chatMode === 'dms' && !(AppState.widgetChatMode && AppState.widgetChatMode.startsWith('dm_'))) {
                    // In DM list view, do nothing.
                    return;
                }
                if (chatMode === 'game') {
                    if (AppState.currentMatch) {
                        await ChatManager.sendGameMessage(AppState.currentMatch, AppState.currentUser.uid, displayName, text);
                    } else if (AppState.currentView === 'pregame-lobby' && AppState.currentRoom) {
                        await LobbyManager.sendLobbyChat(AppState.currentRoom, AppState.currentUser.uid, displayName, text);
                    } else {
                        throw new Error('Game chat is only available during multiplayer sessions.');
                    }
                } else if (AppState.widgetChatMode.startsWith('dm_')) {
                    // Sending to a specific DM conversation
                    const otherUserId = AppState.widgetChatMode.replace('dm_', '');
                    const toName = AppState.dmThreads?.[otherUserId]?.otherDisplayName || null;
                    await ChatManager.sendDirectMessage(AppState.currentUser.uid, displayName, otherUserId, text, toName);
                } else {
                    await ChatManager.sendGlobalMessage(AppState.currentUser.uid, displayName, text);
                }
            } catch (err) {
                console.error('Failed to send chat message', err);
                alert('Failed to send message: ' + (err.message || err));
            }
            if (input) input.value = '';
        }
    });

    // Whisper/autocomplete removed: no-op
    
    // Helper to update unread badge
    function updateUnreadBadge() {
        NotificationCenter.updateBadgeUi();
    }

    // Expose a minimal notifications surface for other modules.
    window.ChatNotifications = {
        markIncoming: NotificationCenter.markIncoming,
        markRead: NotificationCenter.markRead,
        markActive: NotificationCenter.markActiveChannel,
        reset: NotificationCenter.reset,
        prefs: NotificationCenter.prefs,
        setPref: NotificationCenter.setPref
    };

    syncChatModeUi(AppState.widgetChatMode);
}

// ===========================================
// Creative Improvements
// ===========================================
const CreativeFeatures = {
    streak: 0,
    
    showStreak() {
        const indicator = document.querySelector('.streak-indicator') || this.createStreakIndicator();
        indicator.textContent = `Integrity: ${this.streak}`;
        indicator.classList.add('visible');
        
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    },
    
    createStreakIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'streak-indicator';
        document.body.appendChild(indicator);
        return indicator;
    },
    
    incrementStreak() {
        this.streak++;
        if (this.streak >= 3) {
            this.showStreak();
        }
    },
    
    resetStreak() {
        this.streak = 0;
    },
    
    showConfetti() {
        if (typeof MotionSystem?.prefersReducedMotion === 'function' && MotionSystem.prefersReducedMotion()) return;

        const colors = ['#d8d1c5', '#c6c1b6', '#9c7b45', '#3f5543', '#0e0f12'];

        for (let i = 0; i < 26; i++) {
            setTimeout(() => {
                const chip = document.createElement('div');
                const w = 3 + Math.random() * 5;
                const h = 3 + Math.random() * 10;
                const drift = (Math.random() - 0.5) * 120;

                chip.className = 'dust-chip';
                chip.style.left = `${Math.random() * 100}vw`;
                chip.style.width = `${w.toFixed(1)}px`;
                chip.style.height = `${h.toFixed(1)}px`;
                chip.style.background = colors[Math.floor(Math.random() * colors.length)];
                chip.style.opacity = `${0.2 + Math.random() * 0.35}`;
                chip.style.setProperty('--dust-drift', `${drift.toFixed(1)}px`);
                chip.style.animationDuration = `${3.6 + Math.random() * 2.2}s`;
                document.body.appendChild(chip);

                setTimeout(() => chip.remove(), 6500);
            }, i * 45);
        }
    },
    
    animateCellComplete(row, col) {
        const cell = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('just-completed');
            setTimeout(() => cell.classList.remove('just-completed'), 400);
        }
    },
    
    animateGroupComplete(cells) {
        cells.forEach(({ row, col }) => {
            const cell = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('group-complete');
                setTimeout(() => cell.classList.remove('group-complete'), 600);
            }
        });
    },
    
    checkGroupCompletion(puzzle, row, col) {
        // Check row completion
        const rowComplete = puzzle[row].every(v => v !== 0);
        if (rowComplete) {
            const cells = [];
            for (let c = 0; c < 9; c++) cells.push({ row, col: c });
            this.animateGroupComplete(cells);
        }
        
        // Check column completion
        let colComplete = true;
        for (let r = 0; r < 9; r++) {
            if (puzzle[r][col] === 0) colComplete = false;
        }
        if (colComplete) {
            const cells = [];
            for (let r = 0; r < 9; r++) cells.push({ row: r, col });
            this.animateGroupComplete(cells);
        }
        
        // Check box completion
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        let boxComplete = true;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (puzzle[r][c] === 0) boxComplete = false;
            }
        }
        if (boxComplete) {
            const cells = [];
            for (let r = boxRow; r < boxRow + 3; r++) {
                for (let c = boxCol; c < boxCol + 3; c++) {
                    cells.push({ row: r, col: c });
                }
            }
            this.animateGroupComplete(cells);
        }
    }
};

// Game UI now lives in src/client/ui/gameUi.js (instantiated once dependencies exist)
GameUI = createGameUI({
    AppState,
    BoardIntegritySystem,
    GameHelpers,
    AudioManager,
    CreativeFeatures,
    ArchitecturalStateSystem,
    UI,
    ProfileManager,
    ViewManager,
    MatchManager,
    showPostMatchScreen
});
window.GameUI = GameUI;

// ===========================================
// Game Functions
// ===========================================

// Navigate cells with arrow keys
function navigateCell(direction) {
    if (!AppState.selectedCell) {
        GameUI.selectCell(0, 0);
        return;
    }
    
    let { row, col } = AppState.selectedCell;
    
    switch (direction) {
        case 'ArrowUp':
            row = Math.max(0, row - 1);
            break;
        case 'ArrowDown':
            row = Math.min(8, row + 1);
            break;
        case 'ArrowLeft':
            col = Math.max(0, col - 1);
            break;
        case 'ArrowRight':
            col = Math.min(8, col + 1);
            break;
    }
    
    GameUI.selectCell(row, col);
}

function startSinglePlayerGame(difficulty, options = null) {
    AppState.gameMode = 'single';
    AppState.currentDifficulty = difficulty;
    AppState.playerScore = 0;
    AppState.selectedCell = null;
    AppState.timeLimitSeconds = Number(options?.timeLimitSeconds || 0) || 0;
    AppState.maxMistakes = Number(options?.maxMistakes || AppState.maxMistakes || 3) || 3;
    if (typeof options?.autoCheck === 'boolean') {
        AppState.settings.autoCheck = options.autoCheck;
    }
    
    // Reset QOL state
    GameHelpers.resetGameState();
    GameHelpers.resetToolLimits(difficulty);
    ArchitecturalStateSystem.reset();
    ArchitecturalStateSystem.startIdleWatch();
    
    const { puzzle, solution } = SudokuGenerator.createPuzzle(difficulty);
    AppState.puzzle = puzzle.map(row => [...row]);
    AppState.solution = solution;
    AppState.originalPuzzle = puzzle.map(row => [...row]); // Store original for progress tracking
    
    GameUI.createGrid();
    GameUI.renderPuzzle(AppState.puzzle);
    
    // Update UI elements
    const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    document.getElementById('current-difficulty').textContent = difficultyLabel;
    const vsHeader = document.getElementById('game-header-versus');
    if (vsHeader) vsHeader.style.display = 'none';
    const singleHeader = document.getElementById('game-header-single');
    if (singleHeader) singleHeader.style.display = 'flex';
    
    // Hide game chat tab in widget (single player = global only)
    const widgetGameTab = document.getElementById('widget-game-tab');
    if (widgetGameTab) widgetGameTab.style.display = 'none';
    
    // Initialize number counts and progress (starts at 0%)
    GameHelpers.updateRemainingCounts();
    GameHelpers.updateProgress();
    GameHelpers.updateMistakesDisplay();
    
    ViewManager.show('game');
    GameUI.startTimer();
    PresenceManager.updateActivity(`Playing: ${difficultyLabel} Mode`);
}

async function startVersusGame(roomData) {
    AppState.gameMode = 'versus';
    AppState.playerScore = 0;
    AppState.opponentScore = 0;
    AppState.selectedCell = null;
    // Reset UI/game helper state for a fresh versus match
    GameHelpers.resetGameState();
    // Tools are disabled in versus mode.
    GameHelpers.resetToolLimits('hard');
    ArchitecturalStateSystem.reset();
    ArchitecturalStateSystem.startIdleWatch();
    AppState.isGameOver = false;
    // Ensure lives display is clean
    GameUI.resetLivesDisplay();
    
    // Reset countdown display for next time
    const countdownEl = document.getElementById('pregame-countdown');
    const vsText = document.querySelector('.vs-text');
    if (countdownEl) countdownEl.style.display = 'none';
    if (vsText) vsText.style.display = 'block';
    
    // Generate puzzle (host generates)
    const isHost = roomData.host === AppState.currentUser?.uid;
    let matchId;
    // Hide single-player header in versus
    const singleHeader = document.getElementById('game-header-single');
    if (singleHeader) singleHeader.style.display = 'none';
    
    if (isHost) {
        const { puzzle, solution } = SudokuGenerator.createPuzzle('medium');
        matchId = await MatchManager.createMatch(
            AppState.currentRoom,
            roomData.players,
            puzzle,
            solution
        );
    } else {
        // Wait for match to be created
        const roomRef = ref(rtdb, `lobbies/${AppState.currentRoom}`);
        const snapshot = await get(roomRef);
        matchId = snapshot.val()?.matchId;
        
        // If not ready, wait a bit
        if (!matchId) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retrySnapshot = await get(roomRef);
            matchId = retrySnapshot.val()?.matchId;
        }
    }
    
    if (!matchId) {
        alert('Failed to start game. Please try again.');
        ViewManager.show('lobby');
        return;
    }
    
    AppState.currentMatch = matchId;
    
    // Get opponent info
    const opponentId = Object.keys(roomData.players).find(
        id => id !== AppState.currentUser?.uid
    );
    AppState.currentOpponent = opponentId;
    const opponent = roomData.players[opponentId];
    
    console.log('Starting versus game:', { matchId, opponentId, opponent });
    
    GameUI.createGrid();
    
    // Add versus-mode class to hide single-player elements
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) gameContainer.classList.add('versus-mode');
    
    // Show versus mode header
    const versusHeader = document.getElementById('game-header-versus');
    if (versusHeader) versusHeader.style.display = 'flex';
    
    // Update player names
    const playerNameEl = document.getElementById('game-player-name');
    if (playerNameEl) playerNameEl.textContent = roomData.players[AppState.currentUser?.uid]?.name || 'You';
    
    const opponentNameEl = document.getElementById('opponent-name');
    if (opponentNameEl) opponentNameEl.textContent = opponent?.name || 'Opponent';
    
    const playerScoreEl = document.getElementById('player-score');
    if (playerScoreEl) playerScoreEl.textContent = '0';
    
    const opponentScoreEl = document.getElementById('opponent-score');
    if (opponentScoreEl) opponentScoreEl.textContent = '0';
    
    // Reset lives display
    document.querySelectorAll('#player-lives .life-heart').forEach(heart => heart.textContent = '❤️');
    document.querySelectorAll('#opponent-lives .life-heart').forEach(heart => heart.textContent = '❤️');
    
    // Show game chat tab in widget for multiplayer
    const widgetGameTab = document.getElementById('widget-game-tab');
    if (widgetGameTab) widgetGameTab.style.display = 'inline-block';
    
    ViewManager.show('game');
    GameUI.startTimer();
    PresenceManager.updateActivity('Playing: Bust the Board');
    
    // Listen for match updates
    MatchManager.listenToMatch(matchId, handleMatchUpdate);
    
    // Immediately fetch match data to render initial board
    console.log('Fetching initial match data...');
    try {
        const matchSnapshot = await get(ref(rtdb, `matches/${matchId}`));
        const matchData = matchSnapshot.val();
        if (matchData) {
            console.log('Initial match data fetched, rendering...');
            handleMatchUpdate(matchData);
        } else {
            console.error('Match data not found!');
        }
    } catch (error) {
        console.error('Error fetching initial match data:', error);
    }
    
    // Start heartbeat for this player
    MatchManager.setupMatchHeartbeat(matchId, AppState.currentUser.uid);
    
    // Monitor opponent presence for disconnects
    if (opponentId) {
        MatchManager.startOpponentPresenceMonitor(matchId, opponentId, () => {
            // Opponent disconnected - show notification and end game
            if (AppState.gameMode === 'versus' && AppState.currentMatch === matchId) {
                showOpponentDisconnectModal(opponent?.name || 'Opponent');
            }
        });
    }
    
    // Listen for game chat and forward to floating widget
    if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
    AppState.widgetGameChatUnsub = null;
    AppState.widgetGameChatContext = `match:${matchId}`;
    window.ChatWidget?.clearChannel?.('game');
    window.ChatNotifications?.markRead?.('game');
    AppState.widgetGameChatUnsub = ChatManager.listenToGameChat(matchId, (message) => {
        window.ChatWidget?.ingestMessage?.('game', message);
    });
}

function handleRoomUpdate(room) {
    if (!room) {
        // Room was deleted
        ViewManager.show('lobby');
        AppState.currentRoom = null;
        return;
    }
    
    const players = room.players || {};
    const playerIds = Object.keys(players);
    const playerCount = playerIds.length;
    
    console.log('Room update:', { playerCount, status: room.status, players });
    
    // If waiting for opponent (only 1 player) - show waiting room
    if (playerCount === 1 && room.status === 'waiting') {
        if (AppState.currentView !== 'waiting') {
            ViewManager.show('waiting');
        }
        return;
    }
    
    // If 2 players joined and status is 'waiting', go to pre-game lobby
    if (playerCount === 2 && room.status === 'waiting') {
        // Move to pre-game lobby
        if (AppState.currentView !== 'pregame-lobby') {
            showPregameLobby(room);
        } else {
            // Already in pregame lobby, just update UI
            updatePregameLobbyUI(room);
        }
        
        // Check if both players are ready
        const allReady = playerIds.every(id => players[id].ready === true);
        if (allReady) {
            console.log('Both players ready! Starting countdown...');
            startGameCountdown(room);
        }
        return;
    }
    
    // If status changed to 'playing', game has started
    if (room.status === 'playing' && AppState.currentView !== 'game') {
        // Game already started by countdown - match listener should handle it
        console.log('Room status is playing, match should be active');
    }
}

// Pre-game lobby functions
function showPregameLobby(room) {
    console.log('Showing pre-game lobby');
    
    ViewManager.show('pregame-lobby');
    PresenceManager.updateActivity('In Pre-Game Lobby');
    
    updatePregameLobbyUI(room);

    // Use the floating chat widget's Game tab as the multiplayer chat surface.
    const widgetGameTab = document.getElementById('widget-game-tab');
    if (widgetGameTab) widgetGameTab.style.display = 'inline-block';

    // Reset previous game-channel listeners (match or lobby) and clear the channel history.
    if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
    AppState.widgetGameChatUnsub = null;
    AppState.widgetGameChatContext = AppState.currentRoom ? `lobby:${AppState.currentRoom}` : null;
    window.ChatWidget?.clearChannel?.('game');
    window.ChatNotifications?.markRead?.('game');

    // Listen to lobby chat and push into the widget's Game channel.
    if (AppState.currentRoom) {
        const chatRef = ref(rtdb, `lobbies/${AppState.currentRoom}/chat`);
        AppState.widgetGameChatUnsub = onChildAdded(chatRef, (snapshot) => {
            window.ChatWidget?.ingestMessage?.('game', snapshot.val());
        });
    }
}

function updatePregameLobbyUI(room) {
    const players = room.players || {};
    const playerIds = Object.keys(players);
    const userId = AppState.currentUser?.uid;
    
    // Find self and opponent
    const selfPlayer = players[userId];
    const opponentId = playerIds.find(id => id !== userId);
    const opponentPlayer = players[opponentId];
    
    // Update player names
    document.getElementById('pregame-player-name').textContent = selfPlayer?.name || 'You';
    document.getElementById('pregame-opponent-name').textContent = opponentPlayer?.name || 'Opponent';
    
    // Update ready statuses
    const selfCard = document.querySelector('.pregame-player.self');
    const opponentCard = document.querySelector('.pregame-player.opponent');
    const selfStatus = document.getElementById('pregame-player-status');
    const opponentStatus = document.getElementById('pregame-opponent-status');
    
    if (selfPlayer?.ready) {
        selfCard?.classList.add('ready');
        selfStatus.querySelector('.status-text').textContent = '✓ Ready!';
    } else {
        selfCard?.classList.remove('ready');
        selfStatus.querySelector('.status-text').textContent = 'Not Ready';
    }
    
    if (opponentPlayer?.ready) {
        opponentCard?.classList.add('ready');
        opponentStatus.querySelector('.status-text').textContent = '✓ Ready!';
    } else {
        opponentCard?.classList.remove('ready');
        opponentStatus.querySelector('.status-text').textContent = 'Not Ready';
    }
    
    // Update ready button state
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) {
        if (selfPlayer?.ready) {
            readyBtn.classList.add('is-ready');
            readyBtn.querySelector('.ready-text').textContent = 'Ready!';
        } else {
            readyBtn.classList.remove('is-ready');
            readyBtn.querySelector('.ready-text').textContent = 'Ready Up!';
        }
    }
}

function renderPregameChat(messages) {
    const container = document.getElementById('pregame-chat-messages');
    if (!container) return;
    
    // Keep system message at top
    let html = '<div class="chat-system-msg">Say hello to your opponent!</div>';
    
    messages.forEach(msg => {
        const isSelf = msg.userId === AppState.currentUser?.uid;
        html += `
            <div class="chat-msg ${isSelf ? 'self' : ''}">
                <span class="chat-author">${msg.displayName}:</span>
                <span class="chat-text">${escapeHtml(msg.text)}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

let countdownInterval = null;

async function startGameCountdown(room) {
    // Prevent multiple countdowns
    if (countdownInterval) return;
    
    const countdownEl = document.getElementById('pregame-countdown');
    const countdownNum = countdownEl?.querySelector('.countdown-number');
    const vsText = document.querySelector('.vs-text');
    
    if (countdownEl) countdownEl.style.display = 'flex';
    if (vsText) vsText.style.display = 'none';
    
    let count = 3;
    
    countdownInterval = setInterval(async () => {
        if (countdownNum) countdownNum.textContent = count;
        
        if (count === 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            
            // Start the actual game
            await startVersusGame(room);
        }
        count--;
    }, 1000);
}

// ===========================================
// Post-Match Screen Functions
// ===========================================
let rematchListener = null;

function showPostMatchScreen(match, userId, opponentId, isWinner, isTie, isDisconnect, isMistakesLoss) {
    // Store match data for rematch
    AppState.lastMatch = match;
    AppState.lastOpponentId = opponentId;
    
    // Set title based on result
    const header = document.querySelector('.postmatch-header');
    const title = document.getElementById('postmatch-title');
    
    if (isTie) {
        title.textContent = "It's a Tie!";
        header.classList.remove('victory', 'defeat');
    } else if (isWinner) {
        title.textContent = 'Victory!';
        header.classList.add('victory');
        header.classList.remove('defeat');
    } else {
        title.textContent = 'Defeat';
        header.classList.add('defeat');
        header.classList.remove('victory');
    }
    
    // Get player names
    const selfName = match.players?.[userId]?.name || 'You';
    const opponentName = match.players?.[opponentId]?.name || 'Opponent';
    
    // Set winner/loser display
    const winnerName = isTie ? selfName : (isWinner ? selfName : opponentName);
    const loserName = isTie ? opponentName : (isWinner ? opponentName : selfName);
    const winnerScore = isTie ? (match.scores?.[userId] || 0) : (isWinner ? (match.scores?.[userId] || 0) : (match.scores?.[opponentId] || 0));
    const loserScore = isTie ? (match.scores?.[opponentId] || 0) : (isWinner ? (match.scores?.[opponentId] || 0) : (match.scores?.[userId] || 0));
    
    document.getElementById('postmatch-winner-name').textContent = winnerName;
    document.getElementById('postmatch-loser-name').textContent = loserName;
    document.getElementById('postmatch-winner-score').textContent = `${winnerScore} points`;
    document.getElementById('postmatch-loser-score').textContent = `${loserScore} points`;
    
    // Hide trophy for ties
    const winnerDiv = document.getElementById('postmatch-winner');
    const trophyIcon = winnerDiv?.querySelector('.trophy-icon');
    if (trophyIcon) trophyIcon.style.display = isTie ? 'none' : 'block';
    
    // Set result label
    const winnerLabel = winnerDiv?.querySelector('.result-label');
    const loserLabel = document.getElementById('postmatch-loser')?.querySelector('.result-label');
    if (isTie) {
        if (winnerLabel) winnerLabel.textContent = 'TIED';
        if (loserLabel) loserLabel.textContent = 'TIED';
    } else {
        if (winnerLabel) winnerLabel.textContent = 'WINNER';
        if (loserLabel) loserLabel.textContent = 'DEFEATED';
    }
    
    // Set time and reason
    document.getElementById('postmatch-time').textContent = UI.formatTime(AppState.gameSeconds);
    
    let reasonText = 'Board Completed';
    if (isDisconnect) reasonText = 'Opponent Disconnected';
    else if (isMistakesLoss) reasonText = isWinner ? 'Opponent Out of Lives' : 'Out of Lives';
    else if (match.winReason === 'resign') reasonText = isWinner ? 'Opponent Resigned' : 'Resigned';
    document.getElementById('postmatch-reason').textContent = reasonText;
    
    // Reset rematch UI
    document.getElementById('rematch-actions').style.display = 'flex';
    document.getElementById('rematch-waiting').style.display = 'none';
    document.getElementById('rematch-vote-self').className = 'vote-indicator self';
    document.getElementById('rematch-vote-self').querySelector('.vote-icon').textContent = '❓';
    document.getElementById('rematch-vote-opponent').className = 'vote-indicator opponent';
    document.getElementById('rematch-vote-opponent').querySelector('.vote-icon').textContent = '❓';
    
    // Update opponent name in vote indicator
    document.getElementById('rematch-vote-opponent').querySelector('.vote-label').textContent = opponentName;
    
    // Initialize rematch votes in database
    initRematchVoting(match.id, userId, opponentId);
    
    // Show postmatch view
    ViewManager.show('postmatch');
    PresenceManager.updateActivity('Post-Match');
}

async function initRematchVoting(matchId, userId, opponentId) {
    // Set up rematch votes in the match
    const rematchRef = ref(rtdb, `matches/${matchId}/rematch`);
    
    // Initialize votes if not exist
    await update(rematchRef, {
        [userId]: null,
        [opponentId]: null
    });
    
    // Listen for rematch vote changes
    if (rematchListener) {
        // Clean up old listener
        off(ref(rtdb, `matches/${AppState.lastMatch?.id}/rematch`));
    }
    
    rematchListener = onValue(rematchRef, (snapshot) => {
        const votes = snapshot.val();
        if (!votes) return;
        
        handleRematchVoteUpdate(votes, userId, opponentId);
    });
}

function handleRematchVoteUpdate(votes, userId, opponentId) {
    const selfVote = votes[userId];
    const opponentVote = votes[opponentId];
    
    // Update self vote UI
    const selfVoteEl = document.getElementById('rematch-vote-self');
    if (selfVote === true) {
        selfVoteEl.className = 'vote-indicator self voted-yes';
        selfVoteEl.querySelector('.vote-icon').textContent = '✓';
    } else if (selfVote === false) {
        selfVoteEl.className = 'vote-indicator self voted-no';
        selfVoteEl.querySelector('.vote-icon').textContent = '✕';
    }
    
    // Update opponent vote UI
    const opponentVoteEl = document.getElementById('rematch-vote-opponent');
    if (opponentVote === true) {
        opponentVoteEl.className = 'vote-indicator opponent voted-yes';
        opponentVoteEl.querySelector('.vote-icon').textContent = '✓';
    } else if (opponentVote === false) {
        opponentVoteEl.className = 'vote-indicator opponent voted-no';
        opponentVoteEl.querySelector('.vote-icon').textContent = '✕';
    }
    
    // Check for rematch or decline
    if (selfVote === true && opponentVote === true) {
        // Both want rematch - go back to pregame lobby
        console.log('Both players want rematch!');
        startRematch();
    } else if (selfVote === false || opponentVote === false) {
        // Someone declined - immediately clean up and redirect both players
        const statusEl = document.getElementById('rematch-status');
        if (selfVote === false) {
            statusEl.querySelector('.rematch-text').textContent = 'You declined the rematch';
        } else if (opponentVote === false) {
            statusEl.querySelector('.rematch-text').textContent = 'Opponent declined rematch';
        }
        
        // Hide voting UI
        document.getElementById('rematch-actions').style.display = 'none';
        document.getElementById('rematch-waiting').style.display = 'none';
        
        // Auto-redirect to lobby after 2 seconds
        setTimeout(() => {
            cleanupAfterMatch();
            ViewManager.show('lobby');
            PresenceManager.updateActivity('In Lobby');
        }, 2000);
    }
}

async function startRematch() {
    const roomCode = AppState.currentRoom;
    const userId = AppState.currentUser?.uid;
    
    if (!roomCode || !userId) {
        ViewManager.show('lobby');
        return;
    }
    
    // Reset ready status for both players
    const roomRef = ref(rtdb, `lobbies/${roomCode}`);
    const snapshot = await get(roomRef);
    const room = snapshot.val();
    
    if (!room) {
        ViewManager.show('lobby');
        return;
    }
    
    // Reset all players to not ready
    const players = room.players || {};
    const updates = {};
    Object.keys(players).forEach(id => {
        updates[`players/${id}/ready`] = false;
    });
    updates['status'] = 'waiting';
    updates['matchId'] = null;
    
    await update(roomRef, updates);
    
    // Clean up old match listener
    if (rematchListener) {
        off(ref(rtdb, `matches/${AppState.lastMatch?.id}/rematch`));
        rematchListener = null;
    }
    
    // Reset game state
    AppState.currentMatch = null;
    AppState.lastMatch = null;
    AppState.lastOpponentId = null;
    AppState.gameMode = 'lobby';
    
    // Remove versus-mode class
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) gameContainer.classList.remove('versus-mode');
    
    // Go back to pre-game lobby
    ViewManager.show('pregame-lobby');
    PresenceManager.updateActivity('In Pre-Game Lobby');
    
    // Re-fetch room data to update UI
    const freshSnapshot = await get(roomRef);
    const freshRoom = freshSnapshot.val();
    if (freshRoom) {
        updatePregameLobbyUI(freshRoom);
    }
}

// Handle opponent disconnect during a match
async function showOpponentDisconnectModal(opponentName) {
    // Only show if we're still in a match
    if (!AppState.currentMatch || AppState.gameMode !== 'versus') return;
    
    const matchId = AppState.currentMatch;
    const userId = AppState.currentUser?.uid;
    
    if (!userId) return;
    
    // Update match as won by forfeit
    try {
        await MatchManager.handleOpponentDisconnect(matchId, userId);
        
        // Update user stats (win)
        await ProfileManager.updateStats(userId, true);
        
        // Show win modal
        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-over-title');
        const message = document.getElementById('game-over-message');
        
        if (title) title.textContent = 'Victory!';
        if (message) message.textContent = `${opponentName} disconnected. You win by forfeit!`;
        
        ViewManager.showModal('game-over-modal');
        
        // Reset game state
        AppState.currentMatch = null;
        AppState.currentOpponent = null;
        AppState.gameMode = 'lobby';
    } catch (error) {
        console.error('Error handling opponent disconnect:', error);
    }
}

function handleMatchUpdate(match) {
    if (!match) {
        console.log('handleMatchUpdate: match is null');
        return;
    }
    
    console.log('handleMatchUpdate called:', { 
        status: match.status, 
        hasBoard: !!match.board,
        scores: match.scores 
    });
    
    // Update board
    const board = match.board;
    const puzzle = [];
    for (let row = 0; row < 9; row++) {
        puzzle[row] = [];
        for (let col = 0; col < 9; col++) {
            const cellData = board[`${row}_${col}`];
            puzzle[row][col] = cellData?.value || 0;
        }
    }
    
    GameUI.renderPuzzle(puzzle, board);
    GameUI.updateScores(match.scores, match.playerIds);
    GameUI.updateLives(match.mistakes, match.playerIds, match.maxMistakes || 3);
    
    // Check if game ended
    if (match.status === 'finished') {
        GameUI.endVersusGame(match);
    }
}

	// ===========================================
	// Auth State Handler
	// ===========================================
	let authListenerRegistered = false;
    let userProfileUnsub = null;
    let friendRequestsUnsub = null;
	async function configureAuthPersistence() {
	    try {
	        await setPersistence(auth, browserLocalPersistence);
	        return 'local';
	    } catch (e1) {
	        try {
	            await setPersistence(auth, browserSessionPersistence);
	            return 'session';
	        } catch (e2) {
	            try {
	                await setPersistence(auth, inMemoryPersistence);
	                return 'memory';
	            } catch (e3) {
	                console.warn('Auth persistence configuration failed; using SDK default.', e3);
	                return 'default';
	            }
	        }
	    }
	}

	function getFallbackDisplayName(user, profileData = null) {
    const base = profileData?.username || profileData?.displayName || user?.displayName;
    if (base) return base;
    const uid = String(user?.uid || '');
    if (uid) {
        return user?.isAnonymous ? `guest_${uid.substring(0, 6)}` : `Player_${uid.substring(0, 6)}`;
    }
    return user?.isAnonymous ? 'guest' : 'Player';
}

	function showAuthenticatedShell(displayName) {
	    const safeName = String(displayName || 'Player');
	    const truncatedName = safeName.length > 15 ? safeName.substring(0, 15) + '...' : safeName;
	    const userInfo = document.getElementById('user-info');
	    const headerName = document.getElementById('user-name');
	    const welcomeName = document.getElementById('welcome-name');
	    if (userInfo) userInfo.style.display = 'flex';
	    if (headerName) headerName.textContent = truncatedName;
	    if (welcomeName) welcomeName.textContent = safeName;

	    const chatWidget = document.getElementById('chat-widget');
	    const chatFab = document.getElementById('chat-fab');
	    if (chatWidget) chatWidget.style.display = 'flex';
	    if (chatFab) chatFab.style.display = 'flex';
	}

	function shouldDeferLobbyRedirect() {
	    const hash = window.location.hash || '';
	    if (hash.startsWith('#/updates') || hash.startsWith('#/admin')) return true;
	    if (hash.startsWith('#/profile/') || hash.startsWith('#profile/')) return true;
	    const pathname = window.location.pathname || '';
	    return /^\/(?:profile|user|u)\//i.test(pathname);
	}

function registerAuthListener() {
    if (authListenerRegistered) return;
    authListenerRegistered = true;
    onAuthStateChanged(auth, async (user) => {
        AppState.authReady = true;
	        try {
	            if (user) {
                // Guest account expiry (self-healing cleanup)
                // If an anonymous account hasn't been used for a while, delete it on next load.
                const ANON_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
                if (user.isAnonymous) {
                    const lastSignIn = Date.parse(user.metadata?.lastSignInTime || '') || 0;
                    if (lastSignIn && Date.now() - lastSignIn > ANON_TTL_MS) {
                        try {
                            await PresenceManager.cleanup();
                        } catch { /* ignore */ }
                        try {
                            await deleteDoc(doc(firestore, 'users', user.uid));
                        } catch { /* ignore */ }
                        try {
                            await deleteUser(user);
                        } catch (e) {
                            console.warn('Failed to delete expired anonymous user', e);
                        }
                        AppState.currentUser = null;
                        ViewManager.show('auth');
                        return;
                    }
                }

	                AppState.currentUser = user;
	                AppState.passwordReset.active = false;

	                // Reset prior profile listener (user switching / logout-login).
                    try { if (typeof userProfileUnsub === 'function') userProfileUnsub(); } catch { /* ignore */ }
                    userProfileUnsub = null;
                    try { if (typeof friendRequestsUnsub === 'function') friendRequestsUnsub(); } catch { /* ignore */ }
                    friendRequestsUnsub = null;
                    try { if (typeof friendRequestsUnsub === 'function') friendRequestsUnsub(); } catch { /* ignore */ }
                    friendRequestsUnsub = null;
                
                // If we're in the middle of onboarding, don't redirect to lobby
                if (AppState.onboarding.active) {
                    console.log('Onboarding active, skipping auth redirect');
                    return;
                }
                
	                // Check if we have a pending username from signup
	                const pendingUsername = AppState.pendingUsername;
	                AppState.pendingUsername = null;

	                // Show authenticated shell immediately so refreshes don't appear like a sign-out.
	                const initialName = getFallbackDisplayName(user);
	                showAuthenticatedShell(initialName);
	                window.ChatWidget?.setDmEnabled?.(isRegisteredUser(user));

	                // Default view for authenticated users (unless deep-linking elsewhere).
	                if (!shouldDeferLobbyRedirect()) {
	                    ViewManager.show('lobby');
	                }

	                let profileData = null;
                try {
                    const profile = await ProfileManager.createOrUpdateProfile(user.uid, {
                        username: pendingUsername || null,
                        displayName: user.displayName || pendingUsername || `Player_${user.uid.substring(0, 6)}`,
                        email: user.email
                    });
                    profileData = profile?.data?.() || null;
                    AppState.profile = profileData || null;
                    applyProfileModeration(profileData);
                } catch (e) {
                    console.warn('Profile create/update failed; continuing with limited session.', e);
                    AppState.profile = null;
                }

	                const displayName = getFallbackDisplayName(user, profileData);
	                showAuthenticatedShell(displayName);
                AdminConsole.refreshAdminState().catch(() => {});
                UI.updateStats(profileData?.stats || { wins: 0, losses: 0 });
                UI.updateBadges(profileData?.badges || []);
                AppState.friends = profileData?.friends || [];
                FriendsManager.render().catch(() => {});
                if (user.isAnonymous) {
                    UI.showToast('You are playing as a guest. Create an account to save progress.', 'info');
                }

	                // Live profile updates (stats, badges, friends, username, admin flag).
	                try {
                    userProfileUnsub = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
                        if (!snap.exists()) return;
                        const data = snap.data() || {};
                        AppState.profile = data;
                        AppState.friends = data.friends || [];
                        applyProfileModeration(data);
                        UI.updateStats(data.stats || { wins: 0, losses: 0 });
                        UI.updateBadges(data.badges || []);
                        FriendsManager.render().catch(() => {});
                        const name = data.username || data.displayName || `Player_${user.uid.substring(0, 6)}`;
                        const truncated = name.length > 15 ? name.substring(0, 15) + '...' : name;
                        const headerName = document.getElementById('user-name');
                        const welcomeName = document.getElementById('welcome-name');
                        if (headerName) headerName.textContent = truncated;
	                        if (welcomeName) welcomeName.textContent = name;
	                        AdminConsole.refreshAdminState().catch(() => {});
	                    });
	                } catch (e) {
	                    console.warn('Failed to attach profile listener', e);
	                }

                    // Real-time incoming friend requests for this user (so requests appear instantly)
                    try {
                        // Clean any previous listener first
                        try { if (typeof friendRequestsUnsub === 'function') friendRequestsUnsub(); } catch {}
                        const frQuery = query(
                            collection(firestore, 'friendRequests'),
                            where('toUid', '==', user.uid),
                            where('status', '==', 'pending')
                        );
                        friendRequestsUnsub = onSnapshot(frQuery, (qsnap) => {
                            // Rerender the friends panel so the incoming requests list updates immediately.
                            // Keep this lightweight: render handles fetching profiles and UI updates.
                            try { FriendsManager.render().catch(() => {}); } catch (e) { console.warn('FriendRequests onSnapshot handler failed', e); }
                        }, (err) => {
                            console.warn('FriendRequests listener error', err);
                        });
                    } catch (e) {
                        console.warn('Failed to attach friendRequests listener', e);
                    }

                // Initialize realtime systems (best-effort; do not block view transitions).
                PresenceManager.init(user.uid, displayName).catch((e) => console.warn('Presence init failed', e));
                PresenceManager.listenToOnlinePlayers((players) => {
                    AppState.onlinePlayers = players;
                    UI.updatePlayersList(players);
                });

                // Listen for moderation flags + notices
                try {
                    const muteRef = ref(rtdb, `mutes/${user.uid}`);
                    const blockRef = ref(rtdb, `blocks/${user.uid}`);
                    const noticeRef = ref(rtdb, `moderation/notices/${user.uid}`);
                    const handleMute = onValue(muteRef, (snap) => {
                        const fromProfile = !!AppState.profile?.moderation?.muted;
                        setModerationState({ muted: snap.exists() || fromProfile }, { notify: true });
                    });
                    const handleBlock = onValue(blockRef, (snap) => {
                        const fromProfile = !!AppState.profile?.moderation?.blocked;
                        setModerationState({ blocked: snap.exists() || fromProfile }, { notify: true });
                    });
                    const handleNotice = onValue(noticeRef, (snap) => {
                        if (snap.exists()) {
                            const data = snap.val();
                            const msg = data?.message || 'You have a moderation notice.';
                            UI.showToast(msg, 'info');
                        }
                    });
                    AppState.listeners.push({ ref: muteRef, callback: handleMute });
                    AppState.listeners.push({ ref: blockRef, callback: handleBlock });
                    AppState.listeners.push({ ref: noticeRef, callback: handleNotice });
                } catch (e) {
                    console.warn('Moderation listeners failed', e);
                }

                ChatManager.listenToGlobalChat((message) => {
                    window.ChatWidget?.ingestMessage?.('global', message);
                });

	                const allowDirectMessages = isRegisteredUser(user, profileData);
	                window.ChatWidget?.setDmEnabled?.(allowDirectMessages);
	                if (allowDirectMessages) {
	                    ChatManager.listenToDmThreads(user.uid, (threads) => {
	                        window.ChatWidget?.setDmThreads?.(threads);
	                    });
	                } else {
	                    window.ChatWidget?.setDmThreads?.([]);
	                }

	                ChallengeSystem.listenToNotifications(user.uid, (otherUserId, notification) => {
	                    handleNotification(otherUserId, notification);
	                });
	            } else {
	                AppState.currentUser = null;
	                try { if (typeof userProfileUnsub === 'function') userProfileUnsub(); } catch { /* ignore */ }
	                userProfileUnsub = null;
                document.getElementById('user-info').style.display = 'none';
                AdminConsole.refreshAdminState().catch(() => {});
                window.ChatWidget?.reset?.();
                window.ChatWidget?.setDmEnabled?.(false);
                const friendsCard = document.getElementById('friends-card');
                if (friendsCard) friendsCard.style.display = 'none';
                
                // Hide chat widget and FAB for logged out users
                const chatWidget = document.getElementById('chat-widget');
                const chatFab = document.getElementById('chat-fab');
                if (chatWidget) chatWidget.style.display = 'none';
                if (chatFab) chatFab.style.display = 'none';
                
                // Cleanup listeners
                AppState.listeners = [];

                if (!AppState.passwordReset.active && AppState.gameMode !== 'single') {
                    ViewManager.show('auth');
                }
            }
        } catch (err) {
	            console.error('Auth state handling failed', err);
	        }
	    });
	}

// ===========================================
// ===========================================
// Debug Functions (accessible from console)
// ===========================================
window.StonedokuDebug = {
    // Get current app state
    getState() {
        return {
            currentUser: AppState.currentUser?.uid,
            gameMode: AppState.gameMode,
            currentMatch: AppState.currentMatch,
            currentRoom: AppState.currentRoom,
            currentOpponent: AppState.currentOpponent,
            selectedCell: AppState.selectedCell,
            currentView: AppState.currentView
        };
    },
    
    // Get current match data from Firebase
    async getMatchData() {
        if (!AppState.currentMatch) {
            console.log('No current match');
            return null;
        }
        const snapshot = await get(ref(rtdb, `matches/${AppState.currentMatch}`));
        return snapshot.val();
    },
    
    // Test making a move at a specific cell
    async testMove(row, col, value) {
        if (!AppState.currentMatch || !AppState.currentUser) {
            console.log('Not in a match');
            return;
        }
        const result = await MatchManager.makeMove(
            AppState.currentMatch,
            AppState.currentUser.uid,
            row, col, value
        );
        console.log('Test move result:', result);
        return result;
    },
    
    // Force refresh match data
    async refreshMatch() {
        if (!AppState.currentMatch) {
            console.log('No current match');
            return;
        }
        const snapshot = await get(ref(rtdb, `matches/${AppState.currentMatch}`));
        const match = snapshot.val();
        console.log('Refreshed match data:', match);
        if (match) {
            handleMatchUpdate(match);
        }
    },
    
    // Check if user is authorized for match
    async checkMatchAuth() {
        if (!AppState.currentMatch || !AppState.currentUser) {
            console.log('No current match or user');
            return false;
        }
        const matchRef = ref(rtdb, `matches/${AppState.currentMatch}`);
        try {
            const snapshot = await get(matchRef);
            const match = snapshot.val();
            console.log('Match data:', match);
            console.log('User ID:', AppState.currentUser.uid);
            console.log('PlayerIds:', match?.playerIds);
            console.log('Is authorized:', match?.playerIds?.[AppState.currentUser.uid] === true);
            return match?.playerIds?.[AppState.currentUser.uid] === true;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    },
    
    // Simulate a game for testing
    async simulateGame() {
        console.log('=== SIMULATING 1v1 GAME ===');
        console.log('Current state:', this.getState());
        
        const match = await this.getMatchData();
        if (!match) {
            console.log('No match found. Create a room first.');
            return;
        }
        
        console.log('Match status:', match.status);
        console.log('Board has', Object.keys(match.board).length, 'cells');
        
        // Find an empty cell
        for (const cellId in match.board) {
            const cell = match.board[cellId];
            if (!cell.given && cell.filledBy === null) {
                const [row, col] = cellId.split('_').map(Number);
                const solution = match.solution[row * 9 + col];
                console.log(`Found empty cell at ${row},${col}. Solution is ${solution}`);
                console.log('Testing move...');
                const result = await this.testMove(row, col, solution);
                console.log('Move result:', result);
                return result;
            }
        }
        console.log('No empty cells found');
    }
};

// Expose a few helpers for E2E and integration tests
window.startSinglePlayerGame = startSinglePlayerGame;
window.AppState = AppState;

// Expose core managers for incremental splitting/refactor
window.Stonedoku = window.Stonedoku || {};
window.Stonedoku.Managers = Object.assign(window.Stonedoku.Managers || {}, {
    ViewManager,
    PresenceManager,
    ProfileManager,
    FriendsManager,
    LobbyManager,
    MatchManager,
    UpdatesCenter,
    AdminConsole,
    AudioManager,
    GameHelpers,
    GameUI,
    SudokuGenerator,
    ArchitecturalStateSystem,
    MotionSystem,
    AccessibilityManager,
    CookieConsent,
    LegalModals
});

// ===========================================
// Cookie Consent Manager (UK PECR Compliant)
// ===========================================
const CookieConsent = {
    STORAGE_KEY: 'stonedoku_cookie_consent',
    
    init() {
        const consent = this.getConsent();
        if (!consent) {
            this.showBanner();
        } else {
            this.applyConsent();
        }
        this.setupListeners();
    },
    
    getConsent() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY));
        } catch {
            return null;
        }
    },
    
    saveConsent(consent) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            ...consent,
            timestamp: new Date().toISOString(),
            version: '1.0'
        }));
    },
    
    showBanner() {
        const banner = document.getElementById('cookie-consent');
        if (banner) {
            banner.style.display = 'block';
            // Focus first interactive element for accessibility
            setTimeout(() => {
                const firstBtn = banner.querySelector('button');
                firstBtn?.focus();
            }, 100);
        }
    },
    
    hideBanner() {
        const banner = document.getElementById('cookie-consent');
        if (banner) {
            banner.style.display = 'none';
        }
    },
    
    acceptAll() {
        this.saveConsent({
            essential: true,
            analytics: true,
            preferences: true
        });
        this.hideBanner();
        this.applyConsent();
    },
    
    acceptSelected() {
        this.saveConsent({
            essential: true,
            analytics: document.getElementById('cookie-analytics')?.checked || false,
            preferences: document.getElementById('cookie-preferences')?.checked || false
        });
        this.hideBanner();
        this.applyConsent();
    },
    
    rejectNonEssential() {
        this.saveConsent({
            essential: true,
            analytics: false,
            preferences: false
        });
        this.hideBanner();
        this.applyConsent();
    },
    
    canUseAnalytics() {
        const consent = this.getConsent();
        return !!consent?.analytics;
    },

    canUsePreferences() {
        const consent = this.getConsent();
        return !!consent?.preferences;
    },

    applyConsent() {
        const consent = this.getConsent();
        if (!consent) return;
        
        // Apply analytics consent (would enable/disable analytics here)
        if (consent.analytics) {
            console.log('Analytics enabled');
            // Enable Firebase Analytics or other analytics
        } else {
            console.log('Analytics disabled');
        }
        
        // Apply preference cookies
        if (consent.preferences) {
            console.log('Preference cookies enabled');
        } else {
            console.log('Preference cookies disabled');
            // Remove previously stored preference keys.
            try { localStorage.removeItem('stonedoku_theme'); } catch { /* ignore */ }
        }
    },
    
    setupListeners() {
        document.getElementById('cookie-accept-all')?.addEventListener('click', () => this.acceptAll());
        document.getElementById('cookie-accept-selected')?.addEventListener('click', () => this.acceptSelected());
        document.getElementById('cookie-reject')?.addEventListener('click', () => this.rejectNonEssential());
        document.getElementById('cookie-learn-more')?.addEventListener('click', () => {
            this.hideBanner();
            LegalModals.open('cookies');
        });
        
        // Allow reopening cookie settings from footer
        document.getElementById('cookies-link')?.addEventListener('click', () => {
            this.showBanner();
        });
    }
};

// ===========================================
// Legal Modals Manager
// ===========================================
const LegalModals = {
    init() {
        this.setupListeners();
    },
    
    open(type) {
        const modal = document.getElementById(`${type}-modal`);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Focus trap and accessibility
            const closeBtn = modal.querySelector('.modal-close');
            closeBtn?.focus();
            
            // Close on escape
            modal.addEventListener('keydown', this.handleEscape);
        }
    },
    
    close(type) {
        const modal = document.getElementById(`${type}-modal`);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            modal.removeEventListener('keydown', this.handleEscape);
        }
    },
    
    closeAll() {
        ['privacy', 'terms', 'cookies', 'accessibility'].forEach(type => this.close(type));
    },
    
    handleEscape(e) {
        if (e.key === 'Escape') {
            LegalModals.closeAll();
        }
    },
    
    setupListeners() {
        // Footer links
        document.getElementById('privacy-link')?.addEventListener('click', () => this.open('privacy'));
        document.getElementById('terms-link')?.addEventListener('click', () => this.open('terms'));
        document.getElementById('cookies-link')?.addEventListener('click', () => this.open('cookies'));
        document.getElementById('accessibility-link')?.addEventListener('click', () => this.open('accessibility'));
        
        // Auth form links
        document.getElementById('auth-terms-link')?.addEventListener('click', () => this.open('terms'));
        document.getElementById('auth-privacy-link')?.addEventListener('click', () => this.open('privacy'));
        
        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAll());
        });
        
        // Close on backdrop click
        document.querySelectorAll('.legal-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAll();
                }
            });
        });
    }
};

// ===========================================
// Community Updates (Firestore-driven)
// ===========================================
const UpdatesCenter = {
    unsub: null,
    items: [],
    state: {
        expanded: false,
        dismissedId: null,
        currentId: null
    },

    init() {
        this.bannerEl = document.getElementById('updates-banner');
        if (!this.bannerEl) return;

        this.feedEl = document.getElementById('updates-feed');
        this.backBtn = document.getElementById('updates-back-btn');
        this.eyebrowEl = document.getElementById('updates-banner-eyebrow');
        this.titleEl = document.getElementById('updates-banner-title');
        this.bodyEl = document.getElementById('updates-banner-body');
        this.toggleBtn = document.getElementById('updates-banner-toggle');
        this.dismissBtn = document.getElementById('updates-banner-dismiss');
        this.openBtn = document.getElementById('updates-banner-open');
        this.navBtn = document.getElementById('updates-nav-btn');

        this.toggleBtn?.addEventListener('click', () => {
            this.setExpanded(!this.state.expanded);
        });
        this.dismissBtn?.addEventListener('click', () => {
            this.dismissBanner();
        });

        const open = () => this.openFeed(this.state.currentId);
        this.openBtn?.addEventListener('click', open);
        this.navBtn?.addEventListener('click', open);

        this.backBtn?.addEventListener('click', () => {
            if (AppState.currentUser) {
                ViewManager.show('lobby');
            } else {
                ViewManager.show('auth');
            }
        });

        this.listen();
    },

    getTimeMs(value) {
        try {
            if (!value) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') return Date.parse(value) || 0;
            if (value instanceof Date) return value.getTime();
            if (value?.toMillis) return value.toMillis();
            if (value?.seconds) return Number(value.seconds) * 1000;
        } catch { /* ignore */ }
        return 0;
    },

    normalizeItem(id, data) {
        const title = String(data?.title || data?.heading || data?.name || '').trim();
        const body = String(data?.body || data?.message || data?.summary || '').trim();
        const kind = String(data?.type || data?.kind || 'update').trim();
        const severity = String(data?.severity || 'info').trim();
        const createdAtMs = this.getTimeMs(data?.createdAt || data?.publishedAt || data?.timestamp);
        const startsAtMs = this.getTimeMs(data?.startsAt || data?.startAt);
        const endsAtMs = this.getTimeMs(data?.endsAt || data?.endAt);
        const active = data?.active !== false && String(data?.status || 'active') !== 'archived';
        const banner = data?.banner !== false;
        const pinned = data?.pinned === true;

        return {
            id,
            title: title || 'Update',
            body,
            kind,
            severity,
            createdAtMs,
            startsAtMs,
            endsAtMs,
            active,
            banner,
            pinned
        };
    },

    pickBannerItem(items) {
        const now = Date.now();
        const candidates = items
            .filter((item) => item.active && item.banner)
            .filter((item) => (item.startsAtMs ? item.startsAtMs <= now : true))
            .filter((item) => (item.endsAtMs ? item.endsAtMs >= now : true))
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            });
        return candidates[0] || null;
    },

    setExpanded(expanded) {
        this.state.expanded = !!expanded;
        this.bannerEl?.classList.toggle('is-expanded', this.state.expanded);
        if (this.toggleBtn) {
            this.toggleBtn.setAttribute('aria-expanded', String(this.state.expanded));
            this.toggleBtn.setAttribute('aria-label', this.state.expanded ? 'Collapse update' : 'Expand update');
            this.toggleBtn.setAttribute('title', this.state.expanded ? 'Collapse' : 'Expand');
        }
    },

    dismissBanner() {
        this.state.dismissedId = this.state.currentId;
        if (this.bannerEl) this.bannerEl.style.display = 'none';
    },

    renderBanner(items) {
        const banner = this.pickBannerItem(items);
        if (!banner || (this.state.dismissedId && banner.id === this.state.dismissedId)) {
            if (this.bannerEl) this.bannerEl.style.display = 'none';
            return;
        }

        const isNew = banner.id !== this.state.currentId;
        this.state.currentId = banner.id;
        if (isNew) this.setExpanded(false);

        if (this.eyebrowEl) this.eyebrowEl.textContent = banner.kind === 'status' ? 'Status' : 'Update';
        if (this.titleEl) this.titleEl.textContent = banner.title;
        if (this.bodyEl) this.bodyEl.textContent = banner.body;

        this.bannerEl.dataset.updateId = banner.id;
        this.bannerEl.dataset.severity = banner.severity;
        this.bannerEl.style.display = 'block';
    },

    formatDate(ms) {
        if (!ms) return '';
        try {
            return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    },

    renderFeed(items) {
        const container = this.feedEl || document.getElementById('updates-feed');
        if (!container) return;

        const visible = (items || [])
            .filter((item) => item.active)
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            })
            .slice(0, 100);

        container.innerHTML = '';

        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'updates-empty card';
            empty.textContent = 'No updates yet.';
            container.appendChild(empty);
            return;
        }

        for (const item of visible) {
            const details = document.createElement('details');
            details.className = 'update-card';
            details.dataset.updateId = item.id;
            if (item.pinned) details.classList.add('is-pinned');
            details.dataset.kind = item.kind;
            details.dataset.severity = item.severity;

            const summary = document.createElement('summary');
            summary.className = 'update-card-summary';

            const meta = document.createElement('div');
            meta.className = 'update-meta';

            const tag = document.createElement('span');
            tag.className = 'update-tag';
            tag.textContent = item.kind === 'status' ? 'Status' : 'Update';
            meta.appendChild(tag);

            if (item.pinned) {
                const pinned = document.createElement('span');
                pinned.className = 'update-tag update-tag--pinned';
                pinned.textContent = 'Pinned';
                meta.appendChild(pinned);
            }

            const time = document.createElement('time');
            time.className = 'update-time';
            time.textContent = this.formatDate(item.createdAtMs);
            meta.appendChild(time);

            const title = document.createElement('div');
            title.className = 'update-title';
            title.textContent = item.title;

            const chevron = document.createElement('span');
            chevron.className = 'update-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            chevron.innerHTML = '<svg class="ui-icon"><use href="#i-chevron-down"></use></svg>';

            summary.appendChild(meta);
            summary.appendChild(title);
            summary.appendChild(chevron);

            const body = document.createElement('div');
            body.className = 'update-card-body';
            body.textContent = item.body || '';

            details.appendChild(summary);
            details.appendChild(body);
            container.appendChild(details);
        }
    },

    listen() {
        try {
            const q = query(collection(firestore, 'updates'), orderBy('createdAt', 'desc'), limit(25));
            if (typeof this.unsub === 'function') this.unsub();
            this.unsub = onSnapshot(
                q,
                (snapshot) => {
                    const items = snapshot.docs.map((d) => this.normalizeItem(d.id, d.data()));
                    this.items = items;
                    this.renderBanner(items);
                    this.renderFeed(items);
                },
                (error) => {
                    console.warn('UpdatesCenter listener error', error);
                }
            );
        } catch (error) {
            console.warn('UpdatesCenter failed to start', error);
        }
    },

    openFeed(focusId) {
        const viewId = 'updates-view';
        const el = document.getElementById(viewId);
        if (!el) {
            // Avoid breaking navigation if feed isn't yet in the DOM.
            return;
        }

        if (!ViewManager.views.includes('updates')) {
            ViewManager.views.push('updates');
        }
        ViewManager.show('updates');

        try {
            const target = focusId ? `#/updates/${encodeURIComponent(focusId)}` : '#/updates';
            if (window.location.hash !== target) {
                window.history.replaceState({}, document.title, target);
            }
        } catch { /* ignore */ }

        if (focusId) {
            requestAnimationFrame(() => {
                const card = document.querySelector(`[data-update-id="${focusId}"]`);
                if (card?.tagName === 'DETAILS') card.open = true;
                card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                card?.classList.add('is-highlighted');
                setTimeout(() => card?.classList.remove('is-highlighted'), 2200);
            });
        }
    }
};

// ===========================================
// Admin Console (Firestore-driven)
// ===========================================
const AdminConsole = {
    isAdmin: false,
    unsub: null,
    editingUpdateId: null, // Add this line
    allowlistForm: null,
    allowlistInput: null,
    allowlistStatus: null,
    allowlistAddBtn: null,
    allowlistRemoveBtn: null,
    lookupInput: null,
    lookupStatus: null,
    lookupBtn: null,
    lookupCopyBtn: null,
    modSearchInput: null,
    modSearchBtn: null,
    modSearchClearBtn: null,
    modSearchStatus: null,
    modSearchResult: null,
    modTargetInput: null,
    modStatus: null,
    modMuteBtn: null,
    modUnmuteBtn: null,
    modBlockBtn: null,
    modUnblockBtn: null,
    modClearGlobalBtn: null,
    modClearUserGlobalBtn: null,

    init() {
        this.navBtn = document.getElementById('admin-nav-btn');
        this.backBtn = document.getElementById('admin-back-btn');
        this.form = document.getElementById('admin-update-form');
        this.statusEl = document.getElementById('admin-update-status');
        this.listEl = document.getElementById('admin-updates-list');
        this.allowlistForm = document.getElementById('admin-allowlist-form');
        this.allowlistInput = document.getElementById('admin-allowlist-uid');
        this.allowlistStatus = document.getElementById('admin-allowlist-status');
        this.allowlistAddBtn = document.getElementById('admin-allowlist-add');
        this.allowlistRemoveBtn = document.getElementById('admin-allowlist-remove');
        this.lookupInput = document.getElementById('admin-lookup-username');
        this.lookupStatus = document.getElementById('admin-lookup-status');
        this.lookupBtn = document.getElementById('admin-lookup-btn');
        this.lookupCopyBtn = document.getElementById('admin-lookup-copy');
        this.modSearchInput = document.getElementById('admin-mod-search');
        this.modSearchBtn = document.getElementById('admin-mod-search-btn');
        this.modSearchClearBtn = document.getElementById('admin-mod-search-clear');
        this.modSearchStatus = document.getElementById('admin-mod-search-status');
        this.modSearchResult = document.getElementById('admin-mod-search-result');
        this.modTargetInput = document.getElementById('mod-target-uid');
        this.modStatus = document.getElementById('mod-status');
        this.modMuteBtn = document.getElementById('mod-mute');
        this.modUnmuteBtn = document.getElementById('mod-unmute');
        this.modBlockBtn = document.getElementById('mod-block');
        this.modUnblockBtn = document.getElementById('mod-unblock');
        this.modClearGlobalBtn = document.getElementById('mod-clear-global');
        this.modClearUserGlobalBtn = document.getElementById('mod-clear-user-global');

        this.navBtn?.addEventListener('click', () => this.openFromNav());
        this.backBtn?.addEventListener('click', () => {
            ViewManager.show(AppState.currentUser ? 'lobby' : 'auth');
        });

        const setAllowStatus = (msg, isError = false) => {
            if (!this.allowlistStatus) return;
            this.allowlistStatus.textContent = msg || '';
            this.allowlistStatus.classList.toggle('error', !!isError);
        };

        const setLookupStatus = (msg, isError = false) => {
            if (!this.lookupStatus) return;
            this.lookupStatus.textContent = msg || '';
            this.lookupStatus.classList.toggle('error', !!isError);
        };

        const getUidFromInput = () => {
            const uid = (this.allowlistInput?.value || '').trim();
            if (!uid) {
                setAllowStatus('Enter a user UID.', true);
                return null;
            }
            setAllowStatus('');
            return uid;
        };

        this.allowlistAddBtn?.addEventListener('click', async () => {
            if (!this.isAdmin) {
                setAllowStatus('Admin required.', true);
                return;
            }
            const uid = getUidFromInput();
            if (!uid) return;
            try {
                await setDoc(doc(firestore, 'admins', uid), {
                    userId: uid,
                    addedBy: AppState.currentUser?.uid || null,
                    addedAt: Timestamp.now()
                });
                setAllowStatus('Admin granted.', false);
            } catch (e) {
                console.error('Grant admin failed', e);
                setAllowStatus('Failed to grant admin.', true);
            }
        });

        this.allowlistRemoveBtn?.addEventListener('click', async () => {
            if (!this.isAdmin) {
                setAllowStatus('Admin required.', true);
                return;
            }
            const uid = getUidFromInput();
            if (!uid) return;
            try {
                await deleteDoc(doc(firestore, 'admins', uid));
                setAllowStatus('Admin revoked.', false);
            } catch (e) {
                console.error('Revoke admin failed', e);
                setAllowStatus('Failed to revoke admin.', true);
            }
        });

        const lookupUser = async () => {
            const raw = (this.lookupInput?.value || '').trim().replace(/^@/, '').toLowerCase();
            if (!raw) {
                setLookupStatus('Enter a username.', true);
                return null;
            }
            try {
                setLookupStatus('Looking up...', false);
                // Try usernames collection first
                const unameSnap = await getDoc(doc(firestore, 'usernames', raw));
                if (unameSnap.exists()) {
                    const uid = unameSnap.data()?.userId;
                    if (uid) {
                        setLookupStatus(`UID: ${uid}`, false);
                        if (this.lookupCopyBtn) {
                            this.lookupCopyBtn.disabled = false;
                            this.lookupCopyBtn.dataset.uid = uid;
                        }
                        return uid;
                    }
                }
                // Fallback query users by usernameLower
                const q = query(collection(firestore, 'users'), where('usernameLower', '==', raw), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const docSnap = snap.docs[0];
                    setLookupStatus(`UID: ${docSnap.id}`, false);
                    if (this.lookupCopyBtn) {
                        this.lookupCopyBtn.disabled = false;
                        this.lookupCopyBtn.dataset.uid = docSnap.id;
                    }
                    return docSnap.id;
                }
                setLookupStatus('User not found.', true);
                if (this.lookupCopyBtn) this.lookupCopyBtn.disabled = true;
                return null;
            } catch (e) {
                console.error('Lookup failed', e);
                setLookupStatus('Lookup failed.', true);
                return null;
            }
        };

        this.lookupBtn?.addEventListener('click', lookupUser);
        this.lookupCopyBtn?.addEventListener('click', () => {
            const uid = this.lookupCopyBtn?.dataset?.uid;
            if (!uid) return;
            try {
                navigator.clipboard.writeText(uid);
                setLookupStatus('UID copied.', false);
            } catch {
                setLookupStatus('Copy failed.', true);
            }
        });

        const setModSearchStatus = (msg, isError = false) => {
            if (!this.modSearchStatus) return;
            this.modSearchStatus.textContent = msg || '';
            this.modSearchStatus.classList.toggle('error', !!isError);
        };

        const toMillis = (value) => {
            if (typeof value === 'number') return value;
            if (value && typeof value === 'object') {
                if (typeof value.toMillis === 'function') return value.toMillis();
                const sec = Number(value.seconds);
                const ns = Number(value.nanoseconds);
                if (Number.isFinite(sec)) return sec * 1000 + (Number.isFinite(ns) ? Math.floor(ns / 1e6) : 0);
            }
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        const renderModResult = (info) => {
            if (!this.modSearchResult) return;
            if (!info) {
                this.modSearchResult.innerHTML = '';
                return;
            }
            const { uid, username, displayName, email, stats, presence, muted, blocked, isAdmin, adminDoc, friendsCount } = info;
            const wins = Number(stats?.wins) || 0;
            const losses = Number(stats?.losses) || 0;
            const total = wins + losses;
            const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
            const presTs = toMillis(presence?.last_changed);
            const presText = presence?.status ? `${presence.status}${presTs ? ` • ${UpdatesCenter.formatDate(presTs)}` : ''}` : 'unknown';
            const pills = [];
            pills.push(`<span class="mod-pill">UID: ${UI.escapeHtml(uid)}</span>`);
            if (username) pills.push(`<span class="mod-pill">@${UI.escapeHtml(username)}</span>`);
            if (isAdmin || adminDoc) pills.push('<span class="mod-pill">Admin</span>');
            if (muted) pills.push('<span class="mod-pill muted">Muted</span>');
            if (blocked) pills.push('<span class="mod-pill blocked">Blocked</span>');
            const modStatus = muted && blocked ? 'Muted & Blocked' : muted ? 'Muted' : blocked ? 'Blocked' : 'Clear';
            this.modSearchResult.innerHTML = `
                <div class="mod-grid">
                    <div><strong>Name</strong><br>${UI.escapeHtml(displayName || username || 'Unknown')}</div>
                    <div><strong>Email</strong><br>${UI.escapeHtml(email || '—')}</div>
                    <div><strong>Presence</strong><br>${UI.escapeHtml(presText)}</div>
                    <div><strong>Friends</strong><br>${friendsCount ?? 0}</div>
                </div>
                <div class="mod-grid">
                    <div><strong>Wins</strong><br>${wins}</div>
                    <div><strong>Losses</strong><br>${losses}</div>
                    <div><strong>Win rate</strong><br>${winrate}%</div>
                    <div><strong>Moderation</strong><br>${UI.escapeHtml(modStatus)}</div>
                </div>
                <div class="mod-grid">
                    <div><strong>Flags</strong><br>${pills.join(' ')}</div>
                </div>
            `;
        };

        const safeRtdbGet = async (path) => {
            try {
                const snap = await get(ref(rtdb, path));
                return { ok: true, snap };
            } catch (err) {
                console.warn('Mod lookup read failed', path, err);
                return { ok: false, snap: null, error: err };
            }
        };

        const resolveUserId = async (raw) => {
            const value = String(raw || '').trim();
            if (!value) throw new Error('Enter a username or UID.');
            // Try UID straight away
            if (value.length >= 24) {
                const snap = await getDoc(doc(firestore, 'users', value));
                if (snap.exists()) return { uid: value, profileSnap: snap };
            }
            const uname = value.replace(/^@/, '').toLowerCase();
            const unameSnap = await getDoc(doc(firestore, 'usernames', uname));
            if (unameSnap.exists()) {
                const uid = unameSnap.data()?.userId;
                if (uid) {
                    const profileSnap = await getDoc(doc(firestore, 'users', uid));
                    return { uid, profileSnap };
                }
            }
            const q = query(collection(firestore, 'users'), where('usernameLower', '==', uname), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                return { uid: snap.docs[0].id, profileSnap: snap.docs[0] };
            }
            throw new Error('User not found.');
        };

        const fetchModerationInfo = async () => {
            try {
                setModSearchStatus('Searching...');
                renderModResult(null);
                const searchVal = this.modSearchInput?.value || '';
                const resolved = await resolveUserId(searchVal);
                const uid = resolved.uid;
                const profileSnap = resolved.profileSnap || await getDoc(doc(firestore, 'users', uid));
                const profileData = profileSnap?.data?.() || {};
                const [presenceRes, muteRes, blockRes, adminSnap] = await Promise.all([
                    safeRtdbGet(`presence/${uid}`),
                    safeRtdbGet(`mutes/${uid}`),
                    safeRtdbGet(`blocks/${uid}`),
                    getDoc(doc(firestore, 'admins', uid))
                ]);
                const presenceData = typeof presenceRes?.snap?.val === 'function' ? (presenceRes.snap.val() || {}) : {};
                const muteSnap = muteRes?.snap;
                const blockSnap = blockRes?.snap;
                const partial = !presenceRes?.ok || !muteRes?.ok || !blockRes?.ok;
                const profileMuted = !!profileData?.moderation?.muted;
                const profileBlocked = !!profileData?.moderation?.blocked;
                const info = {
                    uid,
                    username: profileData.username || profileData.usernameLower || null,
                    displayName: profileData.displayName || profileData.username || null,
                    email: profileData.email || null,
                    stats: profileData.stats || {},
                    friendsCount: Array.isArray(profileData.friends) ? profileData.friends.length : 0,
                    presence: presenceData?.status ? { status: presenceData.status, last_changed: presenceData.last_changed || null, activity: presenceData.current_activity || null } : {},
                    muted: profileMuted || (typeof muteSnap?.exists === 'function' ? muteSnap.exists() : false),
                    blocked: profileBlocked || (typeof blockSnap?.exists === 'function' ? blockSnap.exists() : false),
                    isAdmin: profileData.isAdmin === true,
                    adminDoc: typeof adminSnap?.exists === 'function' ? adminSnap.exists() : false
                };
                renderModResult(info);
                setModSearchStatus(partial ? 'Partial data (some reads restricted).' : 'Ready.', partial);
            } catch (e) {
                console.error('Mod lookup failed', e);
                setModSearchStatus(e?.message || 'Lookup failed.', true);
                renderModResult(null);
            }
        };

        this.modSearchBtn?.addEventListener('click', fetchModerationInfo);
        this.modSearchClearBtn?.addEventListener('click', () => {
            if (this.modSearchInput) this.modSearchInput.value = '';
            setModSearchStatus('');
            renderModResult(null);
        });
        this.modSearchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchModerationInfo();
            }
        });

        const setModStatus = (msg, isError = false) => {
            if (!this.modStatus) return;
            this.modStatus.textContent = msg || '';
            this.modStatus.classList.toggle('error', !!isError);
        };

        const getModTarget = () => {
            const uid = (this.modTargetInput?.value || '').trim();
            if (!uid) {
                setModStatus('Enter target UID.', true);
                return null;
            }
            setModStatus('');
            return uid;
        };

        const callMod = async (action, targetUid = null) => {
            const fn = httpsCallable(functions, 'moderate');
            const payload = Object.assign({ action }, targetUid ? { targetUid } : {});
            await fn(payload);
        };

        const wrapMod = (action, needsTarget = true) => async () => {
            if (!this.isAdmin) {
                setModStatus('Admin required.', true);
                return;
            }
            const target = needsTarget ? getModTarget() : null;
            if (needsTarget && !target) return;
            try {
                const labels = {
                    mute: 'Muting user',
                    unmute: 'Unmuting user',
                    block: 'Blocking user',
                    unblock: 'Unblocking user',
                    clearGlobalChat: 'Clearing global chat',
                    clearUserGlobalChat: 'Clearing user messages'
                };
                setModStatus(`${labels[action] || 'Working'}...`);
                await callMod(action, target);
                setModStatus(`${labels[action] || 'Done'}${target ? ` (${target})` : ''}`, false);
            } catch (e) {
                console.error('Moderation action failed', e);
                setModStatus(e?.message || 'Failed to run action.', true);
            }
        };

        this.modMuteBtn?.addEventListener('click', wrapMod('mute'));
        this.modUnmuteBtn?.addEventListener('click', wrapMod('unmute'));
        this.modBlockBtn?.addEventListener('click', wrapMod('block'));
        this.modUnblockBtn?.addEventListener('click', wrapMod('unblock'));
        this.modClearGlobalBtn?.addEventListener('click', wrapMod('clearGlobalChat', false));
        this.modClearUserGlobalBtn?.addEventListener('click', wrapMod('clearUserGlobalChat'));

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'admin-update-cancel';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.display = 'none';
        this.form.querySelector('.admin-form-actions').appendChild(cancelBtn);
        cancelBtn.addEventListener('click', () => this.cancelEdit());

        this.form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.isAdmin) return;
            const title = document.getElementById('admin-update-title')?.value?.trim();
            const body = document.getElementById('admin-update-body')?.value?.trim();
            const kind = document.getElementById('admin-update-kind')?.value || 'update';
            const severity = document.getElementById('admin-update-severity')?.value || 'info';
            const banner = !!document.getElementById('admin-update-banner')?.checked;
            const pinned = !!document.getElementById('admin-update-pinned')?.checked;

            if (!title || !body) return;
            if (this.statusEl) this.statusEl.textContent = '';

            const data = {
                title,
                body,
                kind,
                severity,
                active: true,
                banner,
                pinned,
                updatedAt: Timestamp.now(),
                authorUid: AppState.currentUser?.uid || null
            };

            try {
                if (this.editingUpdateId) {
                    const docRef = doc(firestore, 'updates', this.editingUpdateId);
                    await updateDoc(docRef, data);
                    if (this.statusEl) this.statusEl.textContent = 'Update saved.';
                } else {
                    data.createdAt = Timestamp.now();
                    await addDoc(collection(firestore, 'updates'), data);
                    if (this.statusEl) this.statusEl.textContent = 'Published.';
                }
                this.cancelEdit();
                setTimeout(() => { if (this.statusEl) this.statusEl.textContent = ''; }, 1500);
            } catch (err) {
                console.error('Admin publish/update failed', err);
                if (this.statusEl) this.statusEl.textContent = 'Failed to save.';
            }
        });
    },

    updateNav() {
        if (this.navBtn) this.navBtn.style.display = this.isAdmin ? 'inline-flex' : 'none';
    },

    async refreshAdminState() {
        this.isAdmin = false;
        if (!AppState.currentUser) {
            this.updateNav();
            return false;
        }
        try {
            const adminDocRef = doc(firestore, 'admins', AppState.currentUser.uid);
            const snap = await getDoc(adminDocRef);
            if (snap.exists()) {
                this.isAdmin = true;
            }
        } catch (e) {
            console.warn('Admin check failed', e);
        }
        this.updateNav();
        return this.isAdmin;
    },

    async openFromNav() {
        await waitForAuthReady();
        const ok = await this.refreshAdminState();
        if (!ok) {
            alert('Admin access required.');
            return;
        }
        this.open();
    },

    async openFromHash() {
        await waitForAuthReady();
        const ok = await this.refreshAdminState();
        if (!ok) {
            alert('Admin access required.');
            ViewManager.show(AppState.currentUser ? 'lobby' : 'auth');
            return;
        }
        this.open();
    },

    open() {
        ViewManager.show('admin');
        try {
            if (window.location.hash !== '#/admin') window.history.replaceState({}, document.title, '#/admin');
        } catch { /* ignore */ }
        this.listen();
    },

    listen() {
        if (!this.listEl) return;
        if (typeof this.unsub === 'function') this.unsub();
        const q = query(collection(firestore, 'updates'), orderBy('createdAt', 'desc'), limit(50));
        this.unsub = onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map((d) => UpdatesCenter.normalizeItem(d.id, d.data()));
                this.renderList(items);
            },
            (error) => {
                console.warn('Admin updates listener error', error);
            }
        );
    },

    renderList(items) {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';
        const visible = (items || []).slice(0, 50);
        if (!visible.length) {
            this.listEl.innerHTML = '<div class="friend-empty">No updates yet.</div>';
            return;
        }

        for (const item of visible) {
            const row = document.createElement('div');
            row.className = 'admin-update-item';
            row.dataset.updateId = item.id;

            const meta = document.createElement('div');
            meta.className = 'admin-update-meta';
            meta.textContent = `${item.kind || 'update'} • ${item.severity || 'info'} • ${UpdatesCenter.formatDate(item.createdAtMs)}`;

            const title = document.createElement('div');
            title.className = 'admin-update-title';
            title.textContent = item.title;

            const actions = document.createElement('div');
            actions.className = 'admin-update-actions';
            actions.innerHTML = `
                <div class="admin-update-toggles">
                    <label class="admin-update-toggle"><input type="checkbox" class="admin-toggle-active"> Active</label>
                    <label class="admin-update-toggle"><input type="checkbox" class="admin-toggle-banner"> Banner</label>
                    <label class="admin-update-toggle"><input type="checkbox" class="admin-toggle-pinned"> Pinned</label>
                </div>
                <button type="button" class="btn btn-secondary btn-sm admin-update-edit">Edit</button>
                <button type="button" class="btn btn-secondary btn-sm admin-update-danger">Delete</button>
            `;

            const activeEl = actions.querySelector('.admin-toggle-active');
            const bannerEl = actions.querySelector('.admin-toggle-banner');
            const pinnedEl = actions.querySelector('.admin-toggle-pinned');
            const editBtn = actions.querySelector('.admin-update-edit');
            const deleteBtn = actions.querySelector('button.admin-update-danger');

            if (activeEl) activeEl.checked = !!item.active;
            if (bannerEl) bannerEl.checked = !!item.banner;
            if (pinnedEl) pinnedEl.checked = !!item.pinned;

            const updateFlags = async (patch) => {
                try {
                    await updateDoc(doc(firestore, 'updates', item.id), { ...patch, updatedAt: Timestamp.now() });
                } catch (e) {
                    console.error('Failed to update update doc', e);
                    alert('Failed to update.');
                }
            };

            activeEl?.addEventListener('change', () => updateFlags({ active: !!activeEl.checked }));
            bannerEl?.addEventListener('change', () => updateFlags({ banner: !!bannerEl.checked }));
            pinnedEl?.addEventListener('change', () => updateFlags({ pinned: !!pinnedEl.checked }));
            editBtn?.addEventListener('click', () => this.startEdit(item));
            deleteBtn?.addEventListener('click', async () => {
                if (!confirm('Delete this update?')) return;
                try {
                    await deleteDoc(doc(firestore, 'updates', item.id));
                } catch (e) {
                    console.error('Delete failed', e);
                    alert('Failed to delete.');
                }
            });

            row.appendChild(meta);
            row.appendChild(title);
            row.appendChild(actions);
            this.listEl.appendChild(row);
        }
    },

    startEdit(item) {
        this.editingUpdateId = item.id;
        document.getElementById('admin-update-title').value = item.title;
        document.getElementById('admin-update-body').value = item.body;
        document.getElementById('admin-update-kind').value = item.kind;
        document.getElementById('admin-update-severity').value = item.severity;
        document.getElementById('admin-update-banner').checked = item.banner;
        document.getElementById('admin-update-pinned').checked = item.pinned;

        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        const cancelBtn = document.getElementById('admin-update-cancel');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        this.form.scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        this.editingUpdateId = null;
        this.form.reset();
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Publish';

        const cancelBtn = document.getElementById('admin-update-cancel');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
};

// ===========================================
// Accessibility Enhancements
// ===========================================
const AccessibilityManager = {
    init() {
        this.setupKeyboardNavigation();
        this.addAriaLabels();
        this.announceToScreenReader = this.createAnnouncer();
    },
    
    setupKeyboardNavigation() {
        // Sudoku grid keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!AppState.selectedCell) return;
            
            const { row, col } = AppState.selectedCell;
            let newRow = row;
            let newCol = col;
            
            switch (e.key) {
                case 'ArrowUp':
                    newRow = Math.max(0, row - 1);
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    newRow = Math.min(8, row + 1);
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    newCol = Math.max(0, col - 1);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    newCol = Math.min(8, col + 1);
                    e.preventDefault();
                    break;
                case 'Tab':
                    // Allow normal tab behavior for accessibility
                    return;
                default:
                    return;
            }
            
            if (newRow !== row || newCol !== col) {
                GameUI.selectCell(newRow, newCol);
                const cell = document.querySelector(`.sudoku-cell[data-row="${newRow}"][data-col="${newCol}"]`);
                cell?.focus();
            }
        });
    },
    
    addAriaLabels() {
        // Add labels to game elements on load
        setTimeout(() => {
            // Number pad buttons
            document.querySelectorAll('.num-btn').forEach(btn => {
                const num = btn.dataset.num;
                btn.setAttribute('aria-label', `Enter number ${num}`);
            });
            
            // Difficulty buttons
            document.querySelectorAll('.difficulty-btn, .diff-btn').forEach(btn => {
                const diff = btn.dataset.difficulty;
                btn.setAttribute('aria-label', `Start ${diff} difficulty game`);
            });
            
            // Toggle switches
            document.querySelectorAll('.toggle-switch input').forEach(input => {
                const label = input.closest('.setting-row')?.querySelector('.setting-label')?.textContent;
                if (label) {
                    input.setAttribute('aria-label', label);
                }
            });
        }, 500);
    },
    
    createAnnouncer() {
        // Create live region for screen reader announcements
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        announcer.id = 'sr-announcer';
        document.body.appendChild(announcer);
        
        return (message) => {
            announcer.textContent = '';
            setTimeout(() => {
                announcer.textContent = message;
            }, 100);
        };
    },
    
    // Announce game events
    announceMove(row, col, num, isCorrect) {
        const message = isCorrect 
            ? `${num} placed correctly at row ${row + 1}, column ${col + 1}`
            : `${num} is incorrect at row ${row + 1}, column ${col + 1}`;
        this.announceToScreenReader(message);
    },
    
    announceGameStart(mode, difficulty) {
        const message = mode === 'versus' 
            ? 'Versus game started. Race to fill the board!'
            : `New ${difficulty} game started. Good luck!`;
        this.announceToScreenReader(message);
    },
    
    announceGameEnd(won, score) {
        const message = won 
            ? `Congratulations! You won with a score of ${score}!`
            : 'Game over. Better luck next time!';
        this.announceToScreenReader(message);
    }
};

// ===========================================
// Initialize App
// ===========================================
async function bootstrapApp() {
    console.log('Stonedoku initialized - v2.1 (Europe DB, WCAG 2.1 AA)');
    console.log('Database URL:', firebaseConfig.databaseURL);
    console.log('Debug tools available at window.StonedokuDebug');

    try { document.body.classList.toggle('front-page', FRONT_PAGE_VIEWS.includes(AppState.currentView)); } catch { /* ignore */ }

    await configureAuthPersistence();
    registerAuthListener();
    // If auth credential already present synchronously, show authenticated UI early
    try {
        if (auth && auth.currentUser) {
            try { showAuthenticatedShell(getFallbackDisplayName(auth.currentUser)); } catch (e) { /* ignore */ }
        }
    } catch (e) {}
    // Some test environments set auth asynchronously; poll briefly so E2E sees the authenticated shell quickly.
    try {
        if (typeof window !== 'undefined') {
            const start = Date.now();
            const earlyPoll = setInterval(() => {
                try {
                    if (auth && auth.currentUser) {
                        try { showAuthenticatedShell(getFallbackDisplayName(auth.currentUser)); } catch (e) { /* ignore */ }
                        clearInterval(earlyPoll);
                    }
                    if (Date.now() - start > 5000) clearInterval(earlyPoll);
                } catch (e) { clearInterval(earlyPoll); }
            }, 200);
        }
    } catch (e) { /* ignore polling failures */ }
    // Initialize orientation manager early so onboarding/tour get nudges on mobile
    try { OrientationManager.init(); } catch (e) { console.warn('OrientationManager init failed', e); }
    
    // Initialize audio
    AudioManager.init();
    
    // Initialize cookie consent (UK PECR compliant)
    CookieConsent.init();

    // Initialize community updates
    UpdatesCenter.init();
    AdminConsole.init();
    
    // Initialize legal modals
    LegalModals.init();
    
    // Initialize accessibility features
    AccessibilityManager.init();
    
    // Set up event listeners
    setupEventListeners();
    PasswordReset.hydrateFromUrl();

    // Run QA diagnostics if requested via ?qa=1
    if (location.search.includes('qa=1')) {
        (async function runQA() {
            try {
                const vp = window.visualViewport || { width: window.innerWidth, height: window.innerHeight };
                const viewportW = Math.round(vp.width);
                const viewportH = Math.round(vp.height);
                const appEl = document.getElementById('app');
                const appRect = appEl ? appEl.getBoundingClientRect() : { width: 0, height: 0, left: 0 };
                const gaps = { left: Math.round(appRect.left), right: Math.round(viewportW - (appRect.left + appRect.width)) };
                const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                const inlineTransformCount = document.querySelectorAll('[style*="transform:"]').length;
                const criticalInline = !!document.querySelector('head style') && Array.from(document.querySelectorAll('head style')).some(s=>/Critical inline CSS/i.test(s.textContent||''));
                const bodyOverflow = getComputedStyle(document.body).overflow || document.body.style.overflow || '';
                const report = {
                    createdAt: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    viewport: { width: viewportW, height: viewportH },
                    app: { width: Math.round(appRect.width), height: Math.round(appRect.height), left: Math.round(appRect.left) },
                    gaps, percentViewportUsed: Math.round((appRect.width / viewportW) * 100),
                    rootFontSize: rootFont,
                    inlineTransformCount,
                    criticalInline,
                    bodyOverflow
                };
                console.log('QA report', report);
                try {
                    // Write to Firestore for remote review (collection: qaReports)
                    if (CookieConsent?.canUseAnalytics?.()) {
                        await addDoc(collection(firestore, 'qaReports'), report);
                        console.log('QA report saved to Firestore: qaReports');
                    } else {
                        console.log('QA report not saved (analytics consent not granted)');
                    }
                } catch (e) {
                    console.warn('Failed to save QA report to Firestore', e);
                }
            } catch (e) {
                console.warn('QA run failed', e);
            }
        })();
    }
    
    // Create initial grid structure
    GameUI.createGrid();
}

document.addEventListener('DOMContentLoaded', () => {
    bootstrapApp();
});
