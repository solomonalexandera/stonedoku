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
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
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
    runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    documentId,
    arrayUnion,
    arrayRemove,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

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
const firestore = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

// ==========================
// App version + cache management
// Fetches ` /version.txt ` at startup. If it differs from the stored
// `stonedoku_app_version`, clear caches, cookies, indexedDB and service
// workers to ensure clients pick up new assets after a deploy.
// To activate, update `public/version.txt` during your deploys.
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

        // Clear indexedDB databases (best-effort)
        if ('indexedDB' in window && indexedDB.databases) {
            try {
                const dbs = await indexedDB.databases();
                await Promise.all(dbs.map(d => new Promise((res) => { indexedDB.deleteDatabase(d.name).onsuccess = res; })));
            } catch (e) {
                // Some browsers restrict indexedDB.databases(); ignore if unavailable
            }
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
        if (local && local === remote) return; // same version

        // New version detected — clear caches/cookies/indexedDB and reload once
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
const LogManager = (function(){
    const orig = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };

    let disabled = false;
    async function writeToFirestore(level, args) {
        if (disabled) return;
        try {
            // Build a compact message and optional meta payload
            const message = args.map(a => {
                try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e) { return String(a); }
            }).join(' ');

            const meta = { src: 'client', href: window.location.href };

            await addDoc(collection(firestore, 'clientLogs'), {
                level: level,
                message: message,
                meta: meta,
                createdAt: Timestamp.now()
            });
        } catch (e) {
            // If permission errors occur, disable future writes to avoid spamming
            try {
                orig.error('LogManager write failed:', e);
            } catch (_) {}
            if (e && (e.code === 'permission-denied' || String(e).includes('Missing or insufficient permissions'))) {
                disabled = true;
            }
        }
    }

    // Override console methods to route logs to Firestore only (no noisy console output).
    console.log = (...args) => { writeToFirestore('debug', args); };
    console.info = (...args) => { writeToFirestore('info', args); };
    console.warn = (...args) => { writeToFirestore('warn', args); };
    console.error = (...args) => { writeToFirestore('error', args); };

    return {
        _orig: orig,
        log: (...args) => writeToFirestore('debug', args),
        info: (...args) => writeToFirestore('info', args),
        warn: (...args) => writeToFirestore('warn', args),
        error: (...args) => writeToFirestore('error', args)
    };
})();

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
    soundEnabled: true,
    listeners: [],
    onlinePlayers: {},
    currentOpponent: null, // opponent ID in 1v1 mode
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
    currentDifficulty: 'medium',
    widgetChatMode: 'global', // 'global', 'game', or 'dm_[userId]'
    activeDMs: {}, // userId -> { messages: [], unread: 0 }
    friends: [], // Array of friend user IDs
    settings: {
        highlightConflicts: true,
        highlightSameNumbers: true,
        autoCheck: true
    }
};

const AudioManager = {
    context: null,
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
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
    
    playCellFill() {
        this.playTone(800, 0.1, 'sine');
    },
    
    playError() {
        this.playTone(200, 0.3, 'square');
    },
    
    playCorrect() {
        this.playTone(600, 0.15, 'sine');
        setTimeout(() => this.playTone(800, 0.15, 'sine'), 100);
    },
    
    playVictory() {
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'sine'), i * 150);
        });
    },
    
    playDefeat() {
        [400, 350, 300, 250].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.25, 'sawtooth'), i * 200);
        });
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
const ViewManager = {
    views: ['auth', 'onboarding', 'lobby', 'waiting', 'pregame-lobby', 'game', 'postmatch', 'profile'],
    
    show(viewName) {
        this.views.forEach(view => {
            const element = document.getElementById(`${view}-view`);
            if (element) {
                element.style.display = view === viewName ? 'block' : 'none';
            }
        });
        AppState.currentView = viewName;
    },
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    },
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }
};

// ===========================================
// Presence System
// ===========================================
const PresenceSystem = {
    presenceRef: null,
    connectedRef: null,
    
    async init(userId, displayName) {
        this.presenceRef = ref(rtdb, `presence/${userId}`);
        this.connectedRef = ref(rtdb, '.info/connected');
        
        // Set up presence on connect/disconnect
        onValue(this.connectedRef, async (snapshot) => {
            if (snapshot.val() === true) {
                // We're connected
                await set(this.presenceRef, {
                    status: 'online',
                    displayName: displayName,
                    last_changed: serverTimestamp(),
                    current_activity: 'In Lobby'
                });
                
                // Set offline on disconnect
                onDisconnect(this.presenceRef).set({
                    status: 'offline',
                    displayName: displayName,
                    last_changed: serverTimestamp(),
                    current_activity: null
                });
            }
        });
    },
    
    async updateActivity(activity) {
        if (this.presenceRef && AppState.currentUser) {
            await update(this.presenceRef, {
                current_activity: activity,
                last_changed: serverTimestamp()
            });
        }
    },
    
    async setStatus(status) {
        if (this.presenceRef && AppState.currentUser) {
            await update(this.presenceRef, {
                status: status,
                last_changed: serverTimestamp()
            });
        }
    },
    
    listenToOnlinePlayers(callback) {
        const presenceListRef = ref(rtdb, 'presence');
        const listener = onValue(presenceListRef, (snapshot) => {
            const players = {};
            const now = Date.now();
            const graceMs = 45000; // consider online only if last_changed within this window
            snapshot.forEach((child) => {
                if (child.key === AppState.currentUser?.uid) return;
                const val = child.val() || {};
                // Normalize serverTimestamp values (may be number)
                const lastChanged = val.last_changed || 0;
                const isRecentlyActive = typeof lastChanged === 'number' ? (now - lastChanged) < graceMs : true;
                const effectiveStatus = (val.status === 'online' && isRecentlyActive) ? 'online' : 'offline';
                players[child.key] = Object.assign({}, val, { status: effectiveStatus });
            });
            callback(players);
        });
        AppState.listeners.push({ ref: presenceListRef, callback: listener });
    },
    
    async cleanup() {
        if (this.presenceRef) {
            await remove(this.presenceRef);
        }
    }
};

// ===========================================
// User Profile Manager
// ===========================================
const ProfileManager = {
    async createOrUpdateProfile(userId, data) {
        const profileRef = doc(firestore, 'users', userId);
        const existing = await getDoc(profileRef);
        
        if (!existing.exists()) {
            // Create new profile with username
            const username = data.username || data.displayName || `Player_${userId.substring(0, 6)}`;
            const usernameLower = username.toLowerCase();
            
            // Reserve the username in a separate collection
            if (data.username) {
                const usernameRef = doc(firestore, 'usernames', usernameLower);
                await setDoc(usernameRef, { 
                    userId: userId,
                    createdAt: Timestamp.now()
                });
            }
            
            await setDoc(profileRef, {
                userId: userId,
                username: username,
                usernameLower: usernameLower,
                displayName: data.displayName || username,
                email: data.email || null,
                memberSince: Timestamp.now(),
                badges: [],
                stats: {
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    bestTime: null
                },
                bio: '',
                profilePicture: null,
                friends: [],
                friendRequests: [],
                socialLinks: {},
                isPublic: true
            });
            // Create a vanity link mapping for registered users
            try {
                const vanityRef = doc(firestore, 'vanityLinks', usernameLower);
                await setDoc(vanityRef, {
                    userId: userId,
                    username: username,
                    path: `/profile/${usernameLower}`,
                    createdAt: Timestamp.now()
                });
            } catch (e) {
                console.warn('Failed to create vanity link:', e);
            }
        } else {
            // Update existing profile if username is provided and different
            const existingData = existing.data();
            if (data.username && (!existingData.username || existingData.usernameLower !== data.username.toLowerCase())) {
                const newLower = data.username.toLowerCase();
                const usernameRef = doc(firestore, 'usernames', newLower);
                await setDoc(usernameRef, {
                    userId: userId,
                    createdAt: Timestamp.now()
                });

                // Remove old vanity mapping if present
                try {
                    if (existingData.usernameLower && existingData.usernameLower !== newLower) {
                        const oldVanityRef = doc(firestore, 'vanityLinks', existingData.usernameLower);
                        await setDoc(oldVanityRef, { deprecated: true }, { merge: true });
                    }
                } catch (e) {
                    console.warn('Error updating vanity mappings:', e);
                }

                await updateDoc(profileRef, {
                    username: data.username,
                    usernameLower: newLower
                });

                // Ensure vanity link exists/updated
                try {
                    const vanityRef = doc(firestore, 'vanityLinks', newLower);
                    await setDoc(vanityRef, {
                        userId: userId,
                        username: data.username,
                        path: `/profile/${newLower}`,
                        updatedAt: Timestamp.now()
                    }, { merge: true });
                } catch (e) {
                    console.warn('Failed to set vanity link on update:', e);
                }
            }
        }
        
        return await getDoc(profileRef);
    },
    
    async checkUsernameAvailable(username) {
        const usernameLower = username.toLowerCase();
        const usernameRef = doc(firestore, 'usernames', usernameLower);
        const snapshot = await getDoc(usernameRef);
        return !snapshot.exists();
    },
    
    async getProfileByUsername(username) {
        const usernameLower = username.toLowerCase();
        const q = query(collection(firestore, 'users'), where('usernameLower', '==', usernameLower));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return snapshot.docs[0];
    },
    
    async getProfile(userId) {
        const profileRef = doc(firestore, 'users', userId);
        return await getDoc(profileRef);
    },
    
    async updateProfile(userId, data) {
        const profileRef = doc(firestore, 'users', userId);
        const existingSnap = await getDoc(profileRef);
        const existing = existingSnap.exists() ? existingSnap.data() : {};

        // If username is changing, update username reservation and vanity mapping
        if (data.username && data.username.toLowerCase() !== existing.usernameLower) {
            const newLower = data.username.toLowerCase();
            try {
                await setDoc(doc(firestore, 'usernames', newLower), {
                    userId: userId,
                    createdAt: Timestamp.now()
                });

                // Deprecate old vanity link if present
                if (existing.usernameLower && existing.usernameLower !== newLower) {
                    const oldVanityRef = doc(firestore, 'vanityLinks', existing.usernameLower);
                    await setDoc(oldVanityRef, { deprecated: true }, { merge: true });
                }

                // Create/merge new vanity link
                const vanityRef = doc(firestore, 'vanityLinks', newLower);
                await setDoc(vanityRef, {
                    userId: userId,
                    username: data.username,
                    path: `/profile/${newLower}`,
                    updatedAt: Timestamp.now()
                }, { merge: true });
            } catch (e) {
                console.warn('Error updating username/vanity mapping:', e);
            }
        }

        await updateDoc(profileRef, data);
        return await getDoc(profileRef);
    },
    
    async updateStats(userId, won) {
        const profileRef = doc(firestore, 'users', userId);
        const profile = await getDoc(profileRef);
        
        if (profile.exists()) {
            const stats = profile.data().stats || { wins: 0, losses: 0 };
            if (won) {
                stats.wins++;
            } else {
                stats.losses++;
            }
            
            await updateDoc(profileRef, { stats });
            
            // Check for badge achievements
            await this.checkBadges(userId, stats);
        }
    },
    
    async checkBadges(userId, stats) {
        const badges = [];
        
        // Veteran badge: 10+ games
        if (stats.wins + stats.losses >= 10) {
            badges.push('veteran');
        }
        
        // Winner badge: 5+ wins
        if (stats.wins >= 5) {
            badges.push('winner');
        }
        
        if (badges.length > 0) {
            const profileRef = doc(firestore, 'users', userId);
            await updateDoc(profileRef, {
                badges: arrayUnion(...badges)
            });
        }
    },
    
    async addBadge(userId, badge) {
        const profileRef = doc(firestore, 'users', userId);
        await updateDoc(profileRef, {
            badges: arrayUnion(badge)
        });
    },
    
    // Upload profile picture
    async uploadProfilePicture(userId, file) {
        if (!file || !userId) return null;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        // Max 2MB
        if (file.size > 2 * 1024 * 1024) {
            throw new Error('Image must be under 2MB');
        }
        
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const fileRef = storageRef(storage, `avatars/${userId}/${safeName}`);
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        
        // Update profile with new picture URL
        await this.updateProfile(userId, { profilePicture: downloadURL });
        
        return downloadURL;
    },
    
    // Friend system
    async sendFriendRequest(fromUserId, toUserId) {
        const toProfileRef = doc(firestore, 'users', toUserId);
        await updateDoc(toProfileRef, {
            friendRequests: arrayUnion({
                from: fromUserId,
                timestamp: Timestamp.now()
            })
        });
    },
    
    async acceptFriendRequest(userId, friendId) {
        const userRef = doc(firestore, 'users', userId);
        const friendRef = doc(firestore, 'users', friendId);
        
        // Add each other as friends
        await updateDoc(userRef, {
            friends: arrayUnion(friendId)
        });
        await updateDoc(friendRef, {
            friends: arrayUnion(userId)
        });
        
        // Remove the friend request
        const userDoc = await getDoc(userRef);
        const requests = userDoc.data().friendRequests || [];
        const updatedRequests = requests.filter(r => r.from !== friendId);
        await updateDoc(userRef, { friendRequests: updatedRequests });
    },
    
    async declineFriendRequest(userId, friendId) {
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);
        const requests = userDoc.data().friendRequests || [];
        const updatedRequests = requests.filter(r => r.from !== friendId);
        await updateDoc(userRef, { friendRequests: updatedRequests });
    },
    
    async removeFriend(userId, friendId) {
        const userRef = doc(firestore, 'users', userId);
        const friendRef = doc(firestore, 'users', friendId);
        
        await updateDoc(userRef, {
            friends: arrayRemove(friendId)
        });
        await updateDoc(friendRef, {
            friends: arrayRemove(userId)
        });
    },
    
    async getFriends(userId) {
        const profile = await this.getProfile(userId);
        if (!profile.exists()) return [];
        
        const friendIds = profile.data().friends || [];
        const friends = [];
        
        for (const friendId of friendIds) {
            const friendProfile = await this.getProfile(friendId);
            if (friendProfile.exists()) {
                friends.push({ id: friendId, ...friendProfile.data() });
            }
        }
        
        return friends;
    }
};

// ===========================================
// Lobby/Room Manager
// ===========================================
const LobbyManager = {
    generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },
    
    async createRoom(userId, displayName) {
        let code = this.generateRoomCode();
        let attempts = 0;
        
        // Ensure unique code
        while (attempts < 10) {
            const roomRef = ref(rtdb, `lobbies/${code}`);
            const snapshot = await get(roomRef);
            
            if (!snapshot.exists()) {
                await set(roomRef, {
                    code: code,
                    host: userId,
                    hostName: displayName,
                    players: {
                        [userId]: {
                            name: displayName,
                            ready: false,
                            joinedAt: serverTimestamp()
                        }
                    },
                    status: 'waiting',
                    createdAt: serverTimestamp(),
                    chat: {}
                });
                
                return code;
            }
            
            code = this.generateRoomCode();
            attempts++;
        }
        
        throw new Error('Could not generate unique room code');
    },
    
    async joinRoom(code, userId, displayName) {
        console.log('LobbyManager.joinRoom called with:', { code, userId, displayName });
        const roomRef = ref(rtdb, `lobbies/${code}`);
        const snapshot = await get(roomRef);
        
        console.log('Room snapshot exists:', snapshot.exists());
        
        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }
        
        const room = snapshot.val();
        console.log('Room data:', room);
        
        if (room.status !== 'waiting') {
            throw new Error('Game already started');
        }
        
        const playerCount = Object.keys(room.players || {}).length;
        console.log('Player count in room:', playerCount);
        
        if (playerCount >= 2) {
            throw new Error('Room is full');
        }
        
        // Add player to room (not ready yet)
        await update(ref(rtdb, `lobbies/${code}/players`), {
            [userId]: {
                name: displayName,
                ready: false,
                joinedAt: serverTimestamp()
            }
        });
        
        console.log('Player added to room successfully');
        return room;
    },
    
    // Set player ready status
    async setReady(code, userId, isReady) {
        console.log('Setting ready status:', { code, userId, isReady });
        await update(ref(rtdb, `lobbies/${code}/players/${userId}`), {
            ready: isReady
        });
    },
    
    // Send chat message to lobby
    async sendLobbyChat(code, userId, displayName, text) {
        const chatRef = ref(rtdb, `lobbies/${code}/chat`);
        const newMsgRef = push(chatRef);
        await set(newMsgRef, {
            userId: userId,
            displayName: displayName,
            text: text,
            timestamp: serverTimestamp()
        });
    },
    
    // Listen to lobby chat
    listenToLobbyChat(code, callback) {
        const chatRef = ref(rtdb, `lobbies/${code}/chat`);
        const listener = onValue(chatRef, (snapshot) => {
            const messages = [];
            snapshot.forEach(child => {
                messages.push({ id: child.key, ...child.val() });
            });
            callback(messages);
        });
        AppState.listeners.push({ ref: chatRef, callback: listener });
        return listener;
    },
    
    async leaveRoom(code, userId) {
        const roomRef = ref(rtdb, `lobbies/${code}`);
        const snapshot = await get(roomRef);
        
        if (snapshot.exists()) {
            const room = snapshot.val();
            
            // If host leaves, delete room
            if (room.host === userId) {
                await remove(roomRef);
            } else {
                // Remove player from room
                await remove(ref(rtdb, `lobbies/${code}/players/${userId}`));
            }
        }
    },
    
    listenToRoom(code, callback) {
        const roomRef = ref(rtdb, `lobbies/${code}`);
        const listener = onValue(roomRef, (snapshot) => {
            callback(snapshot.val());
        });
        AppState.listeners.push({ ref: roomRef, callback: listener });
        return listener;
    }
};

// ===========================================
// Match Manager (1v1 Gameplay)
// ===========================================
const MatchManager = {
    async createMatch(roomCode, players, puzzle, solution) {
        const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const playerIds = Object.keys(players);
        
        console.log('Creating match:', { matchId, roomCode, playerIds });
        
        // Create board state (flatten for easier updates)
        const boardState = {};
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cellId = `${row}_${col}`;
                boardState[cellId] = {
                    value: puzzle[row][col],
                    given: puzzle[row][col] !== 0,
                    filledBy: null
                };
            }
        }
        
        // Convert playerIds array to object for proper security rules
        const playerIdsObject = {};
        playerIds.forEach(id => playerIdsObject[id] = true);
        
        const matchData = {
            id: matchId,
            roomCode: roomCode,
            players: players,
            playerIds: playerIdsObject,
            scores: {
                [playerIds[0]]: 0,
                [playerIds[1]]: 0
            },
            mistakes: {
                [playerIds[0]]: 0,
                [playerIds[1]]: 0
            },
            maxMistakes: 3,
            board: boardState,
            solution: solution.flat(), // Store flat solution for validation
            status: 'active',
            startedAt: serverTimestamp(),
            winner: null,
            winReason: null
        };
        
        console.log('Match data prepared, writing to RTDB...');
        
        try {
            await set(ref(rtdb, `matches/${matchId}`), matchData);
            console.log('Match created successfully:', matchId);
        } catch (error) {
            console.error('Failed to create match:', error);
            throw error;
        }
        
        // Update room status
        await update(ref(rtdb, `lobbies/${roomCode}`), {
            status: 'playing',
            matchId: matchId
        });
        
        console.log('Room updated with matchId');
        
        return matchId;
    },
    
    async makeMove(matchId, userId, row, col, value) {
        const cellRef = ref(rtdb, `matches/${matchId}/board/${row}_${col}`);
        const matchRef = ref(rtdb, `matches/${matchId}`);
        
        console.log('makeMove called:', { matchId, userId, row, col, value });
        
        try {
            // Get match data first to check solution
            const matchSnapshot = await get(matchRef);
            const match = matchSnapshot.val();
            
            // Ensure the acting user is a participant in this match
            const participants = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds || [];
            if (!participants.includes(userId)) {
                console.warn('makeMove rejected: user is not a participant of match', { userId, participants });
                return { success: false, reason: 'Not a participant' };
            }

            if (!match || !match.solution) {
                console.error('Match data invalid:', match);
                return { success: false, reason: 'Match data invalid' };
            }
            
            // Get current cell data to check if it exists
            const cellSnapshot = await get(cellRef);
            const cellData = cellSnapshot.val();
            
            console.log('Current cell data:', JSON.stringify(cellData));
            
            if (!cellData) {
                console.error('Cell data not found - match may not exist');
                return { success: false, reason: 'Match not found' };
            }
            
            // Cell is a given (pre-filled)
            if (cellData.given === true) {
                console.log('Cell is a given number');
                return { success: false, reason: 'Cell is given' };
            }
            
            // Cell already filled by a player - check for truthy filledBy (not null/undefined)
            if (cellData.filledBy) {
                console.log('Cell already filled by:', cellData.filledBy);
                return { success: false, reason: 'Cell already filled' };
            }
            
            // Check if the guess is correct BEFORE writing to database
            const cellIndex = row * 9 + col;
            const isCorrect = match.solution[cellIndex] === value;
            
            console.log('Move result:', { isCorrect, solutionValue: match.solution[cellIndex], userValue: value });
            
            if (isCorrect) {
                // Correct guess - write to database
                await update(cellRef, {
                    value: value,
                    filledBy: userId
                });
                
                // Update score
                const newScore = (match.scores?.[userId] || 0) + 1;
                await update(ref(rtdb, `matches/${matchId}/scores`), {
                    [userId]: newScore
                });
                
                // Check win condition (board complete)
                await this.checkWinCondition(matchId);
            } else {
                // Wrong guess - increment mistakes (only for acting user)
                const currentMistakes = (match.mistakes?.[userId] || 0) + 1;
                console.log('About to record mistake', { matchId, userId, currentMistakes, previousMistakes: match.mistakes });
                await update(ref(rtdb, `matches/${matchId}/mistakes`), {
                    [userId]: currentMistakes
                });
                console.log('Mistake recorded:', { matchId, userId, currentMistakes, maxMistakes: match.maxMistakes || 3 });
                
                // Check if player has lost (3 mistakes)
                if (currentMistakes >= (match.maxMistakes || 3)) {
                    await this.endMatchByMistakes(matchId, userId);
                    return { success: true, correct: false, gameOver: true, reason: 'mistakes' };
                }
            }
            
            return { success: true, correct: isCorrect, mistakes: match.mistakes?.[userId] || 0 };
        } catch (error) {
            console.error('makeMove error:', error);
            return { success: false, reason: error.message };
        }
    },
    
    // Clear a cell after a wrong guess
    async clearCell(matchId, row, col) {
        const cellRef = ref(rtdb, `matches/${matchId}/board/${row}_${col}`);
        
        try {
            await update(cellRef, {
                value: 0,
                filledBy: null
            });
            console.log('Cell cleared:', row, col);
            return { success: true };
        } catch (error) {
            console.error('Clear cell error:', error);
            return { success: false, reason: error.message };
        }
    },
    
    // End match when a player runs out of lives
    async endMatchByMistakes(matchId, losingPlayerId) {
        const matchRef = ref(rtdb, `matches/${matchId}`);
        const snapshot = await get(matchRef);
        const match = snapshot.val();
        
        if (!match || match.status !== 'active') return;
        
        // Find the winning player (the one who didn't lose)
        const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds;
        console.log('endMatchByMistakes invoked', { matchId, losingPlayerId, playerIds, matchMistakes: match.mistakes });
        const winningPlayerId = playerIds.find(id => id !== losingPlayerId);
        
        console.log('Match ended by mistakes:', { losingPlayerId, winningPlayerId });
        
        await update(matchRef, {
            status: 'finished',
            winner: winningPlayerId,
            winReason: 'opponent_mistakes',
            finishedAt: serverTimestamp()
        });
    },
    
    async checkWinCondition(matchId) {
        const matchRef = ref(rtdb, `matches/${matchId}`);
        const snapshot = await get(matchRef);
        const match = snapshot.val();
        
        if (!match || match.status !== 'active') return;
        
        // Convert playerIds object to array
        const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds;
        
        // Check if board is complete
        const board = match.board;
        let filledCells = 0;
        let correctCells = 0;
        
        for (const cellId in board) {
            if (board[cellId].value !== 0) {
                filledCells++;
                // Check if the cell is correct
                const [row, col] = cellId.split('_').map(Number);
                const cellIndex = row * 9 + col;
                if (match.solution[cellIndex] === board[cellId].value) {
                    correctCells++;
                }
            }
        }
        
        // Win condition: board is completely and correctly filled
        if (correctCells === 81) {
            const scores = match.scores;
            let winner;
            if (scores[playerIds[0]] > scores[playerIds[1]]) {
                winner = playerIds[0];
            } else if (scores[playerIds[1]] > scores[playerIds[0]]) {
                winner = playerIds[1];
            } else {
                winner = 'tie';
            }
            
            await update(matchRef, {
                status: 'finished',
                winner: winner,
                winReason: 'board_complete',
                finishedAt: serverTimestamp()
            });
        }
    },
    
    listenToMatch(matchId, callback) {
        console.log('Setting up match listener for:', matchId);
        const matchRef = ref(rtdb, `matches/${matchId}`);
        const listener = onValue(matchRef, (snapshot) => {
            const data = snapshot.val();
            console.log('Match update received:', data ? 'data present' : 'null');
            if (data) {
                console.log('Match status:', data.status, 'Board cells:', Object.keys(data.board || {}).length);
            }
            callback(data);
        }, (error) => {
            console.error('Match listener error:', error);
        });
        AppState.listeners.push({ ref: matchRef, callback: listener });
        return listener;
    },
    
    // Monitor opponent presence during a match with proper idle detection
    startOpponentPresenceMonitor(matchId, opponentId, onDisconnect) {
        console.log('Starting opponent presence monitor for:', opponentId);
        
        const opponentPresenceRef = ref(rtdb, `presence/${opponentId}`);
        // Store timers so we can cancel if opponent returns
        AppState.opponentDisconnectTimers = AppState.opponentDisconnectTimers || {};

        const listener = onValue(opponentPresenceRef, (snapshot) => {
            const presenceData = snapshot.val();
            console.log('Opponent presence update:', presenceData);

            // If opponent is online, clear any pending disconnect timer
            if (presenceData && presenceData.status === 'online') {
                const existing = AppState.opponentDisconnectTimers[opponentId];
                if (existing) {
                    clearTimeout(existing);
                    delete AppState.opponentDisconnectTimers[opponentId];
                    console.log('Cleared pending disconnect timer for opponent');
                }
                return;
            }

            // Opponent appears offline or presence missing — start a cancellable grace timer
            console.log('Opponent appears offline, starting grace timeout...');
            const graceMs = 30000; // 30s grace period
            const timerId = setTimeout(() => {
                console.log('Opponent disconnect timeout reached, invoking onDisconnect');
                delete AppState.opponentDisconnectTimers[opponentId];
                try {
                    onDisconnect();
                } catch (e) {
                    console.error('onDisconnect handler threw:', e);
                }
            }, graceMs);

            // Replace any existing timer
            if (AppState.opponentDisconnectTimers[opponentId]) {
                clearTimeout(AppState.opponentDisconnectTimers[opponentId]);
            }
            AppState.opponentDisconnectTimers[opponentId] = timerId;
        });
        
        AppState.listeners.push({ 
            ref: opponentPresenceRef, 
            callback: listener
        });
        
        return listener;
    },
    
    // Handle when opponent disconnects
    async handleOpponentDisconnect(matchId, currentUserId) {
        const matchRef = ref(rtdb, `matches/${matchId}`);
        
        try {
            const snapshot = await get(matchRef);
            const match = snapshot.val();
            
            if (!match || match.status !== 'active') {
                console.log('Match already ended or invalid');
                return;
            }
            
            // The remaining player wins by forfeit
            await update(matchRef, {
                status: 'finished',
                winner: currentUserId,
                finishedAt: serverTimestamp(),
                endReason: 'opponent_disconnect'
            });
            
            console.log('Match ended due to opponent disconnect');
        } catch (error) {
            console.error('Error handling opponent disconnect:', error);
        }
    },
    
    // Set up activity heartbeat for current player in a match
    async setupMatchHeartbeat(matchId, userId) {
        const matchActivityRef = ref(rtdb, `matches/${matchId}/activity/${userId}`);
        
        // Set initial activity
        await set(matchActivityRef, {
            lastActive: serverTimestamp(),
            online: true
        });
        
        // Update activity every 15 seconds
        const heartbeatInterval = setInterval(async () => {
            if (AppState.currentMatch !== matchId) {
                clearInterval(heartbeatInterval);
                return;
            }
            
            try {
                await update(matchActivityRef, {
                    lastActive: serverTimestamp()
                });
            } catch (error) {
                console.error('Heartbeat update failed:', error);
            }
        }, 15000);
        
        // Set up onDisconnect to mark player as offline
        onDisconnect(matchActivityRef).update({
            online: false,
            disconnectedAt: serverTimestamp()
        });
        
        return heartbeatInterval;
    },

    async endMatch(matchId) {
        await update(ref(rtdb, `matches/${matchId}`), {
            status: 'finished',
            finishedAt: serverTimestamp()
        });
    }
};

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
            const passwordValid = password.length >= 6;
            const confirmValid = password === confirm;
            
            // Update error messages
            document.getElementById('email-error').textContent = 
                email && !emailValid ? 'Please enter a valid email' : '';
            document.getElementById('confirm-error').textContent = 
                confirm && !confirmValid ? 'Passwords do not match' : '';
            
            // Update password strength
            this.updatePasswordStrength(password);
            
            nextBtn2.disabled = !(emailValid && passwordValid && confirmValid);
            
            if (emailValid && passwordValid && confirmValid) {
                AppState.onboarding.data.email = email;
                AppState.onboarding.data.password = password;
            }
        };
        
        emailInput?.addEventListener('input', validateStep2);
        passwordInput?.addEventListener('input', validateStep2);
        confirmInput?.addEventListener('input', validateStep2);
        
        backBtn2?.addEventListener('click', () => this.goToStep(1));
        nextBtn2?.addEventListener('click', () => {
            if (!nextBtn2.disabled) {
                this.goToStep(3);
            }
        });
        
        // Step 3: Profile Picture
        const uploadArea = document.getElementById('profile-upload-area');
        const uploadPreview = document.getElementById('upload-preview');
        const avatarInput = document.getElementById('onboard-avatar');
        const previewImage = document.getElementById('preview-image');
        const nextBtn3 = document.getElementById('onboard-next-3');
        const skipBtn3 = document.getElementById('onboard-skip-3');
        const backBtn3 = document.getElementById('onboard-back-3');
        
        uploadPreview?.addEventListener('click', () => avatarInput?.click());
        
        // Drag and drop
        uploadPreview?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadPreview.style.borderColor = 'var(--color-primary)';
        });
        
        uploadPreview?.addEventListener('dragleave', () => {
            uploadPreview.style.borderColor = '';
        });
        
        uploadPreview?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadPreview.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleAvatarSelect(file);
            }
        });
        
        avatarInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleAvatarSelect(file);
            }
        });
        
        backBtn3?.addEventListener('click', () => this.goToStep(2));
        skipBtn3?.addEventListener('click', () => this.createAccount());
        nextBtn3?.addEventListener('click', () => this.createAccount());
        
        // Step 4: Tour
        document.getElementById('start-tour')?.addEventListener('click', () => {
            TourSystem.start();
        });
        
        document.getElementById('skip-tour')?.addEventListener('click', () => {
            this.complete();
        });
    },
    
    // Handle avatar file selection
    handleAvatarSelect(file) {
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB');
            return;
        }
        
        AppState.onboarding.data.avatarFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImage = document.getElementById('preview-image');
            const placeholder = document.querySelector('.upload-placeholder');
            const uploadPreview = document.getElementById('upload-preview');
            
            if (previewImage) {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            if (uploadPreview) uploadPreview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    },
    
    // Update password strength indicator
    updatePasswordStrength(password) {
        const strengthBar = document.querySelector('.strength-bar');
        const strengthText = document.querySelector('.strength-text');
        
        if (!strengthBar || !strengthText) return;
        
        let strength = 0;
        let text = '';
        let color = '';
        
        if (password.length >= 6) strength += 25;
        if (password.length >= 8) strength += 25;
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[a-z]/.test(password)) strength += 10;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 10;
        
        if (strength < 30) {
            text = 'Weak';
            color = 'var(--color-danger)';
        } else if (strength < 60) {
            text = 'Fair';
            color = 'var(--color-warning)';
        } else if (strength < 80) {
            text = 'Good';
            color = 'var(--color-success)';
        } else {
            text = 'Strong';
            color = 'var(--color-cyan)';
        }
        
        strengthBar.style.setProperty('--strength', `${strength}%`);
        strengthBar.style.setProperty('--strength-color', color);
        strengthText.textContent = password ? text : '';
        strengthText.style.color = color;
    },
    
    // Navigate to a specific step
    goToStep(step) {
        // Hide current step
        document.querySelectorAll('.onboarding-step').forEach(el => {
            el.classList.remove('active');
        });
        
        // Show new step
        const newStep = document.getElementById(`onboarding-step-${step}`);
        if (newStep) {
            newStep.classList.add('active');
        }
        
        AppState.onboarding.step = step;
        this.updateProgress();
        
        // Update display name on step 2
        if (step === 2) {
            const displayName = document.getElementById('onboard-display-name');
            if (displayName) {
                displayName.textContent = AppState.onboarding.data.username;
            }
        }
    },
    
    // Update progress indicators
    updateProgress() {
        const currentStep = AppState.onboarding.step;
        
        document.querySelectorAll('.progress-step').forEach(el => {
            const step = parseInt(el.dataset.step);
            el.classList.remove('active', 'completed');
            
            if (step < currentStep) {
                el.classList.add('completed');
            } else if (step === currentStep) {
                el.classList.add('active');
            }
        });
    },
    
    // Create the account
    async createAccount() {
        const { username, email, password, avatarFile } = AppState.onboarding.data;
        
        try {
            // Show loading state
            const buttons = document.querySelectorAll('#onboarding-step-3 .btn');
            buttons.forEach(btn => btn.disabled = true);
            
            // Create the user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Upload avatar if provided (do this first so we have the URL)
            let avatarUrl = null;
            if (avatarFile) {
                try {
                    avatarUrl = await ProfileManager.uploadProfilePicture(user.uid, avatarFile);
                } catch (uploadError) {
                    console.error('Avatar upload error:', uploadError);
                    // Continue without avatar
                }
            }
            
            // Update Firebase Auth profile with username and photo
            await updateProfile(user, { 
                displayName: username,
                photoURL: avatarUrl 
            });
            
            // Reserve the username in usernames collection
            await setDoc(doc(firestore, 'usernames', username.toLowerCase()), {
                userId: user.uid,
                createdAt: serverTimestamp()
            });
            
            // Create complete user profile in Firestore
            await setDoc(doc(firestore, 'users', user.uid), {
                userId: user.uid,
                displayName: username,
                username: username,
                usernameLower: username.toLowerCase(),
                email: email,
                profilePicture: avatarUrl,
                memberSince: serverTimestamp(),
                createdAt: serverTimestamp(),
                badges: [],
                stats: {
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    bestTime: null
                },
                wins: 0,
                losses: 0,
                gamesPlayed: 0,
                bio: '',
                friends: [],
                friendRequests: [],
                socialLinks: {},
                isPublic: true,
                isNewUser: true
            });

            // Create vanity link mapping for this username (registered users only)
            try {
                await setDoc(doc(firestore, 'vanityLinks', username.toLowerCase()), {
                    userId: user.uid,
                    username: username,
                    path: `/profile/${username.toLowerCase()}`,
                    createdAt: serverTimestamp()
                });
            } catch (e) {
                console.warn('Failed to create vanity link during onboarding:', e);
            }
            
            // Update AppState with user
            AppState.currentUser = user;
            
            // Show success step
            this.goToStep(4);
            this.showConfetti();
            
        } catch (error) {
            console.error('Account creation error:', error);
            
            // Re-enable buttons
            const buttons = document.querySelectorAll('#onboarding-step-3 .btn');
            buttons.forEach(btn => btn.disabled = false);
            
            // Show error
            let message = 'Failed to create account. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Try signing in instead.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password is too weak. Please use a stronger password.';
            }
            alert(message);
        }
    },
    
    // Show confetti animation
    showConfetti() {
        const container = document.getElementById('onboarding-confetti');
        if (!container) return;
        
        const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#22d3ee', '#a78bfa'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
                animation-delay: ${Math.random() * 0.5}s;
            `;
            container.appendChild(confetti);
        }
        
        // Add confetti animation if not exists
        if (!document.getElementById('confetti-style')) {
            const style = document.createElement('style');
            style.id = 'confetti-style';
            style.textContent = `
                @keyframes confettiFall {
                    to {
                        transform: translateY(500px) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Clean up after animation
        setTimeout(() => {
            container.innerHTML = '';
        }, 4000);
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
            
            // Use username as display name
            const displayName = profileData?.username || profileData?.displayName || user.displayName || 'Player';
            const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
            
            // Update UI
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('user-name').textContent = truncatedName;
            document.getElementById('welcome-name').textContent = displayName;
            
            // Store friends in state
            AppState.friends = profileData?.friends || [];
            
            // Update stats
            UI.updateStats(profileData?.stats || { wins: 0, losses: 0 });
            UI.updateBadges(profileData?.badges || []);
            
            // Initialize presence
            await PresenceSystem.init(user.uid, displayName);
            
            // Listen to online players
            PresenceSystem.listenToOnlinePlayers((players) => {
                AppState.onlinePlayers = players;
                UI.updatePlayersList(players);
            });
            
            // Listen to global chat
            ChatManager.listenToGlobalChat((message) => {
                const widgetMessages = document.getElementById('chat-widget-messages');
                const activeTab = document.querySelector('.widget-tab.active');
                const widgetMode = activeTab?.dataset.chat || 'global';
                
                if (widgetMessages && widgetMode === 'global') {
                    UI.addChatMessage('chat-widget-messages', message.displayName, message.text, message.timestamp, message.userId);
                }
                
                if (typeof window.incrementUnread === 'function') {
                    window.incrementUnread();
                }
            });
            
            // Listen for challenges
            ChallengeSystem.listenToNotifications(user.uid, (challengerId, notification) => {
                if (notification.status === 'pending') {
                    document.getElementById('challenger-name').textContent = notification.fromName;
                    ViewManager.showModal('challenge-modal');
                }
            });
            
            // Show chat widget
            const chatWidget = document.getElementById('chat-widget');
            const chatFab = document.getElementById('chat-fab');
            if (chatWidget) chatWidget.style.display = 'flex';
            if (chatFab) chatFab.style.display = 'flex';
            
            ViewManager.show('lobby');
            PresenceSystem.updateActivity('In Lobby');
            
        } catch (error) {
            console.error('Error completing onboarding:', error);
            ViewManager.show('lobby');
        }
    }
};

// ===========================================
// Tour System
// ===========================================
const TourSystem = {
    steps: [
        {
            target: '.single-card',
            title: '🧩 Solo Practice',
            description: 'Play classic Sudoku at your own pace. Choose from Easy, Medium, or Hard difficulty to sharpen your skills.',
            position: 'right'
        },
        {
            target: '.versus-card',
            title: '⚔️ Challenge Friends',
            description: 'Create a game room or join with a code to compete in real-time 1v1 battles. Race to fill the most cells correctly!',
            position: 'left'
        },
        {
            target: '.stats-card',
            title: '📊 Track Progress',
            description: 'Your wins, losses, and win rate are tracked here. Watch yourself improve over time!',
            position: 'left'
        },
        {
            target: '.players-card',
            title: '👥 See Who\'s Online',
            description: 'View other players currently online. Click their name to see their profile or challenge them to a game.',
            position: 'left'
        },
        {
            target: '#chat-fab',
            title: '💬 Chat & Connect',
            description: 'Use the chat to talk with other players, send whispers (@whisper username), or start direct messages.',
            position: 'top'
        }
    ],
    
    start() {
        // Make sure we're in the lobby first
        OnboardingSystem.complete();
        
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
                this.end();
                this.offerTutorial();
            }
        });
        
        document.getElementById('tour-skip')?.addEventListener('click', () => {
            this.end();
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
        
        // Update spotlight
        const rect = target.getBoundingClientRect();
        const padding = 10;
        
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        
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
    
    end() {
        AppState.tour.active = false;
        
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
        }
    },
    
    offerTutorial() {
        // Create and show tutorial offer modal
        const modal = document.createElement('div');
        modal.className = 'tutorial-offer-modal';
        modal.id = 'tutorial-offer-modal';
        modal.innerHTML = `
            <div class="tutorial-offer-card">
                <div class="modal-emoji">🎓</div>
                <h3>Learn How to Play?</h3>
                <p>Would you like a quick tutorial on how Sudoku works and some tips for competing?</p>
                <div class="tutorial-offer-actions">
                    <button class="btn btn-primary btn-lg" id="start-tutorial">Yes, Show Me!</button>
                    <button class="btn btn-outline" id="skip-tutorial">I Know How to Play</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('start-tutorial')?.addEventListener('click', () => {
            modal.remove();
            this.startTutorial();
        });
        
        document.getElementById('skip-tutorial')?.addEventListener('click', () => {
            modal.remove();
        });
    },
    
    startTutorial() {
        // Start an easy practice game with tutorial overlays
        alert('Starting tutorial... (Tutorial mode would show step-by-step Sudoku instructions during an easy game)');
        // For now, just start an easy game
        const event = new CustomEvent('startTutorialGame');
        document.dispatchEvent(event);
    }
};

// ===========================================
// Chat Manager
// ===========================================
const ChatManager = {
    async sendGlobalMessage(userId, displayName, text) {
        // Check for whisper command
        if (text.startsWith('@whisper ') || text.startsWith('@w ')) {
            const parts = text.match(/^@w(?:hisper)?\s+(\S+)\s+(.+)$/i);
            if (parts) {
                const targetUsername = parts[1];
                const message = parts[2];
                await this.sendWhisper(userId, displayName, targetUsername, message);
                return { type: 'whisper', target: targetUsername };
            }
        }
        
        const filteredText = ProfanityFilter.filter(text);
        const chatRef = ref(rtdb, 'globalChat');
        
        await push(chatRef, {
            userId: userId,
            displayName: displayName,
            text: filteredText,
            timestamp: serverTimestamp()
        });
        
        return { type: 'global' };
    },
    
    async sendWhisper(fromUserId, fromDisplayName, targetUsername, text) {
        // Find target user by username
        const targetProfile = await ProfileManager.getProfileByUsername(targetUsername);
        if (!targetProfile) {
            throw new Error(`User "${targetUsername}" not found`);
        }
        
        const targetUserId = targetProfile.data().userId;
        const filteredText = ProfanityFilter.filter(text);
        
        // Create a DM conversation ID (sorted user IDs to ensure consistency)
        const dmId = [fromUserId, targetUserId].sort().join('_');
        const dmRef = ref(rtdb, `directMessages/${dmId}`);
        
        await push(dmRef, {
            from: fromUserId,
            fromDisplayName: fromDisplayName,
            to: targetUserId,
            text: filteredText,
            timestamp: serverTimestamp(),
            read: false
        });
        
        return { dmId, targetUserId, targetUsername };
    },
    
    async sendDirectMessage(fromUserId, fromDisplayName, toUserId, text) {
        try {
            const filteredText = ProfanityFilter.filter(text);
            const dmId = [fromUserId, toUserId].sort().join('_');
            const dmRef = ref(rtdb, `directMessages/${dmId}`);

            await push(dmRef, {
                from: fromUserId,
                fromDisplayName: fromDisplayName,
                to: toUserId,
                text: filteredText,
                timestamp: serverTimestamp(),
                read: false
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
        
        // Only get last 50 messages
        const listener = onChildAdded(chatRef, (snapshot) => {
            callback(snapshot.val());
        });
        
        AppState.listeners.push({ ref: chatRef, callback: listener });
        return listener;
    },
    
    async sendGameMessage(matchId, userId, displayName, text) {
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
        const listener = onChildAdded(notificationsRef, (snapshot) => {
            callback(snapshot.key, snapshot.val());
        });
        AppState.listeners.push({ ref: notificationsRef, callback: listener });
        return listener;
    },
    
    async acceptChallenge(userId, challengerId) {
        // Create a room for both players
        const code = await LobbyManager.createRoom(challengerId, 'Challenger');
        
        // Update notification
        await update(ref(rtdb, `notifications/${userId}/${challengerId}`), {
            status: 'accepted',
            roomCode: code
        });
        
        return code;
    },
    
    async declineChallenge(userId, challengerId) {
        await remove(ref(rtdb, `notifications/${userId}/${challengerId}`));
    }
};

// ===========================================
// UI Helpers
// ===========================================
const UI = {
    hoverTimeout: null,
    
    updatePlayersList(players) {
        const container = document.getElementById('players-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (const [id, player] of Object.entries(players)) {
            if (player.status === 'online') {
                const item = document.createElement('div');
                item.className = 'player-item';
                item.dataset.userId = id;
                item.innerHTML = `
                    <div class="player-item-info">
                        <span class="player-item-status status-dot ${player.status}"></span>
                        <span class="player-item-name player-name-hoverable" data-user-id="${id}">${this.escapeHtml(player.displayName || 'Anonymous')}</span>
                    </div>
                    <span class="player-item-activity">${this.escapeHtml(player.current_activity || '')}</span>
                `;
                
                // Add hover profile listeners
                const nameEl = item.querySelector('.player-name-hoverable');
                nameEl.addEventListener('mouseenter', (e) => this.showHoverProfile(e, id, player));
                nameEl.addEventListener('mouseleave', () => this.hideHoverProfile());
                
                item.addEventListener('click', () => this.showPlayerProfile(id));
                container.appendChild(item);
            }
        }
        
        // Update online count
        const onlineCount = Object.values(players).filter(p => p.status === 'online').length;
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.textContent = onlineCount;
    },
    
    async showHoverProfile(event, userId, basicData) {
        // Clear any existing timeout
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
        }
        
        const tooltip = document.getElementById('hover-profile');
        if (!tooltip) return;
        
        // Position the tooltip
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top - 10}px`;
        
        // Check if tooltip would go off screen
        const tooltipRect = tooltip.getBoundingClientRect();
        if (rect.right + 200 > window.innerWidth) {
            tooltip.style.left = `${rect.left - 200}px`;
        }
        
        // Set basic data first
        tooltip.querySelector('.hover-profile-name').textContent = basicData?.displayName || 'Anonymous';
        tooltip.querySelector('#hover-activity').textContent = basicData?.current_activity || 'Online';
        
        // Show tooltip
        tooltip.style.display = 'block';
        
        // Fetch more detailed stats
        try {
            const profile = await ProfileManager.getProfile(userId);
            if (profile.exists()) {
                const data = profile.data();
                const wins = data.stats?.wins || 0;
                const losses = data.stats?.losses || 0;
                const total = wins + losses;
                const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
                
                tooltip.querySelector('#hover-wins').textContent = wins;
                tooltip.querySelector('#hover-losses').textContent = losses;
                tooltip.querySelector('#hover-winrate').textContent = `${winrate}%`;
            }
        } catch (e) {
            console.warn('Could not fetch profile for hover:', e);
        }
    },
    
    hideHoverProfile() {
        this.hoverTimeout = setTimeout(() => {
            const tooltip = document.getElementById('hover-profile');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }, 100);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    async showPlayerProfile(userId) {
        const profile = await ProfileManager.getProfile(userId);
        if (!profile.exists()) return;
        
        const data = profile.data();
        
        document.getElementById('profile-name').textContent = data.displayName || 'Anonymous';
        document.getElementById('profile-member-since').textContent = 
            `Member since: ${data.memberSince?.toDate?.()?.toLocaleDateString() || 'Unknown'}`;
        document.getElementById('profile-wins').textContent = data.stats?.wins || 0;
        document.getElementById('profile-losses').textContent = data.stats?.losses || 0;
        
        // Show badges
        const badgesContainer = document.getElementById('profile-badges');
        badgesContainer.innerHTML = '';
        (data.badges || []).forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badge}`;
            badgeEl.textContent = badge;
            badgesContainer.appendChild(badgeEl);
        });
        
        // Set up challenge button
        document.getElementById('challenge-player').onclick = async () => {
            await ChallengeSystem.sendChallenge(
                AppState.currentUser.uid,
                AppState.currentUser.displayName || 'Player',
                userId
            );
            ViewManager.hideModal('profile-modal');
            alert('Challenge sent!');
        };
        
        ViewManager.showModal('profile-modal');
    },
    
    // Full profile page view
    async showProfilePage(userId) {
        const isOwnProfile = userId === AppState.currentUser?.uid;
        
        const profile = await ProfileManager.getProfile(userId);
        if (!profile.exists()) {
            alert('Profile not found');
            return;
        }
        
        const data = profile.data();
        AppState.viewingProfileId = userId;
        
        // Update profile page elements
        const username = data.username || data.displayName || 'Anonymous';
        document.getElementById('profile-page-title').textContent = isOwnProfile ? 'Your Profile' : `${username}'s Profile`;
        document.getElementById('profile-page-username').textContent = username;
        document.getElementById('profile-page-bio').textContent = data.bio || 'No bio yet...';
        
        // Profile picture
        const pictureEl = document.getElementById('profile-page-picture');
        const placeholderEl = document.getElementById('profile-picture-placeholder');
        if (data.profilePicture) {
            pictureEl.src = data.profilePicture;
            pictureEl.style.display = 'block';
            placeholderEl.style.display = 'none';
        } else {
            pictureEl.style.display = 'none';
            placeholderEl.style.display = 'flex';
        }
        
        // Show edit button only for own profile
        document.getElementById('profile-picture-edit').style.display = isOwnProfile ? 'block' : 'none';
        
        // Member since
        const memberDate = data.memberSince?.toDate?.();
        document.getElementById('profile-page-member-since').textContent = 
            memberDate ? memberDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown';
        
        // Vanity URL - show only for registered users (not anonymous guest accounts)
        const vanityEl = document.getElementById('profile-vanity-url');
        const vanityLinkEl = document.getElementById('profile-vanity-link');
        const vanityUrl = `stone-doku.web.app/profile/${encodeURIComponent(username.toLowerCase())}`;
        // Consider a user 'registered' if they have an email on their profile
        const isRegistered = !!data.email;
        if (isRegistered) {
            vanityLinkEl.href = `/profile/${encodeURIComponent(username.toLowerCase())}`;
            vanityLinkEl.textContent = vanityUrl;
            vanityEl.style.display = 'flex';
        } else {
            // Hide vanity URL for anonymous/guest profiles
            vanityEl.style.display = 'none';
        }
        
        // Stats
        const stats = data.stats || { wins: 0, losses: 0, gamesPlayed: 0 };
        document.getElementById('profile-page-wins').textContent = stats.wins || 0;
        document.getElementById('profile-page-losses').textContent = stats.losses || 0;
        const totalGames = (stats.wins || 0) + (stats.losses || 0);
        const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
        document.getElementById('profile-page-winrate').textContent = `${winRate}%`;
        document.getElementById('profile-page-games').textContent = totalGames;
        
        // Badges
        const badgesContainer = document.getElementById('profile-page-badges');
        badgesContainer.innerHTML = '';
        const badges = data.badges || [];
        if (badges.length === 0) {
            badgesContainer.innerHTML = '<div class="badge-empty">No badges yet. Keep playing to earn badges!</div>';
        } else {
            const badgeInfo = {
                'veteran': { icon: '🎖️', name: 'Veteran' },
                'winner': { icon: '🏆', name: 'Winner' },
                'champion': { icon: '👑', name: 'Champion' },
                'speedster': { icon: '⚡', name: 'Speedster' }
            };
            badges.forEach(badge => {
                const info = badgeInfo[badge] || { icon: '🏅', name: badge };
                const badgeEl = document.createElement('div');
                badgeEl.className = 'badge-item';
                badgeEl.innerHTML = `
                    <span class="badge-icon">${info.icon}</span>
                    <span class="badge-name">${info.name}</span>
                `;
                badgesContainer.appendChild(badgeEl);
            });
        }
        
        // Show appropriate action buttons
        document.getElementById('profile-own-actions').style.display = isOwnProfile ? 'flex' : 'none';
        document.getElementById('profile-other-actions').style.display = isOwnProfile ? 'none' : 'flex';
        
        // Check friend status if viewing other profile
        if (!isOwnProfile) {
            const isFriend = AppState.friends.includes(userId);
            const friendBtn = document.getElementById('profile-friend-btn');
            if (isFriend) {
                friendBtn.textContent = '✓ Friends';
                friendBtn.disabled = true;
            } else {
                friendBtn.textContent = '👥 Add Friend';
                friendBtn.disabled = false;
            }
        }
        
        ViewManager.show('profile');
    },
    
    addChatMessage(containerId, sender, text, timestamp, userId = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        
        const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        // Create sender element with hover capability
        const senderEl = document.createElement('span');
        senderEl.className = 'chat-sender';
        if (userId) {
            senderEl.classList.add('clickable-user');
            senderEl.dataset.userId = userId;
        }
        senderEl.textContent = sender;
        
        const textEl = document.createElement('span');
        textEl.className = 'chat-text';
        textEl.textContent = text;
        
        const timeEl = document.createElement('span');
        timeEl.className = 'chat-time';
        timeEl.textContent = time;
        
        const headerRow = document.createElement('div');
        headerRow.className = 'chat-header-row';
        headerRow.appendChild(senderEl);
        headerRow.appendChild(timeEl);
        
        messageEl.appendChild(headerRow);
        messageEl.appendChild(textEl);
        
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
        
        // Add hover listener for profile
        if (userId) {
            senderEl.addEventListener('mouseenter', (e) => {
                this.showMiniProfile(userId, sender, e.target);
            });
            senderEl.addEventListener('mouseleave', () => {
                this.hideMiniProfile();
            });
        }
    },
    
    miniProfileTimeout: null,
    
    async showMiniProfile(userId, displayName, targetEl) {
        // Clear any pending hide
        if (this.miniProfileTimeout) {
            clearTimeout(this.miniProfileTimeout);
            this.miniProfileTimeout = null;
        }
        
        // Get or create mini profile element
        let miniProfile = document.getElementById('chat-mini-profile');
        if (!miniProfile) {
            miniProfile = document.createElement('div');
            miniProfile.id = 'chat-mini-profile';
            miniProfile.className = 'chat-mini-profile';
            document.body.appendChild(miniProfile);
        }
        
        // Position near the target
        const rect = targetEl.getBoundingClientRect();
        miniProfile.style.left = `${rect.left}px`;
        miniProfile.style.top = `${rect.bottom + 8}px`;
        
        // Show loading state
        miniProfile.innerHTML = `
            <div class="mini-profile-header">
                <div class="mini-profile-avatar">👤</div>
                <div class="mini-profile-name">${this.escapeHtml(displayName)}</div>
            </div>
            <div class="mini-profile-loading">Loading...</div>
        `;
        miniProfile.classList.add('visible');
        
        // Fetch profile data and presence status
        try {
            const [profile, presenceSnapshot] = await Promise.all([
                ProfileManager.getProfile(userId),
                get(ref(rtdb, `presence/${userId}`))
            ]);
            
            const presenceData = presenceSnapshot.val();
            const isOnline = presenceData?.status === 'online';
            
            if (profile && miniProfile.classList.contains('visible')) {
                const stats = profile.stats || { wins: 0, losses: 0 };
                const total = stats.wins + stats.losses;
                const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
                const statusClass = isOnline ? 'online' : 'offline';
                const statusText = isOnline ? 'Online' : 'Offline';
                
                miniProfile.innerHTML = `
                    <div class="mini-profile-header">
                        <div class="mini-profile-avatar">👤</div>
                        <div class="mini-profile-info">
                            <div class="mini-profile-name">${this.escapeHtml(displayName)}</div>
                            <div class="mini-profile-status ${statusClass}">
                                <span class="status-dot"></span>
                                ${statusText}
                            </div>
                        </div>
                    </div>
                    <div class="mini-profile-stats">
                        <div class="mini-stat">
                            <span class="mini-stat-value">${stats.wins}</span>
                            <span class="mini-stat-label">Wins</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value">${stats.losses}</span>
                            <span class="mini-stat-label">Losses</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value">${winrate}%</span>
                            <span class="mini-stat-label">Win Rate</span>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Error fetching mini profile:', err);
        }
    },
    
    hideMiniProfile() {
        this.miniProfileTimeout = setTimeout(() => {
            const miniProfile = document.getElementById('chat-mini-profile');
            if (miniProfile) {
                miniProfile.classList.remove('visible');
            }
        }, 200);
    },
    
    updateStats(stats) {
        document.getElementById('stat-wins').textContent = stats.wins || 0;
        document.getElementById('stat-losses').textContent = stats.losses || 0;
        
        const total = (stats.wins || 0) + (stats.losses || 0);
        const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
        document.getElementById('stat-winrate').textContent = `${winrate}%`;
    },
    
    updateBadges(badges) {
        const container = document.getElementById('badges-list');
        if (!container) return;
        
        container.innerHTML = '';
        (badges || []).forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badge}`;
            badgeEl.textContent = badge;
            container.appendChild(badgeEl);
        });
    },
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

// ===========================================
// Game UI Helper Functions
// ===========================================
const GameHelpers = {
    // Count how many of each number are placed
    countNumbers() {
        const counts = {};
        for (let i = 1; i <= 9; i++) counts[i] = 0;
        
        if (!AppState.puzzle) return counts;
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const num = AppState.puzzle[row][col];
                if (num > 0) counts[num]++;
            }
        }
        return counts;
    },
    
    // Update the remaining count display for each number
    updateRemainingCounts() {
        const counts = this.countNumbers();
        for (let i = 1; i <= 9; i++) {
            const remaining = 9 - counts[i];
            const el = document.getElementById(`remaining-${i}`);
            const btn = document.querySelector(`.num-btn[data-num="${i}"]`);
            if (el) {
                el.textContent = remaining > 0 ? `${remaining} left` : 'done';
            }
            if (btn) {
                btn.classList.toggle('completed', remaining === 0);
            }
        }
    },
    
    // Update progress display - only count user-filled cells, not given cells
    updateProgress() {
        if (!AppState.puzzle || !AppState.solution || !AppState.originalPuzzle) return;
        
        let filled = 0;
        let total = 0;
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                // Only count cells that were originally empty (not given)
                if (AppState.originalPuzzle[row][col] === 0) {
                    total++;
                    // Count if correctly filled by user
                    if (AppState.puzzle[row][col] === AppState.solution[row][col]) {
                        filled++;
                    }
                }
            }
        }
        
        const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
        const progressEl = document.getElementById('progress-percent');
        const fillEl = document.getElementById('progress-fill');
        
        if (progressEl) progressEl.textContent = `${percent}%`;
        if (fillEl) fillEl.style.width = `${percent}%`;
    },
    
    // Update mistakes display
    updateMistakesDisplay() {
        const container = document.getElementById('mistakes-display');
        if (!container) return;
        
        container.innerHTML = '';
        for (let i = 0; i < AppState.maxMistakes; i++) {
            const dot = document.createElement('span');
            dot.className = `mistake-dot${i >= AppState.mistakes ? ' empty' : ''}`;
            container.appendChild(dot);
        }
    },
    
    // Highlight cells with the same number
    highlightSameNumbers(num) {
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.classList.remove('same-number');
        });
        
        if (!AppState.settings.highlightSameNumbers || num === 0) return;
        
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            if (cell.textContent === String(num)) {
                cell.classList.add('same-number');
            }
        });
    },
    
    // Highlight conflicting cells
    highlightConflicts(row, col, num) {
        if (!AppState.settings.highlightConflicts || num === 0) return [];
        
        const conflicts = [];
        
        // Check row
        for (let c = 0; c < 9; c++) {
            if (c !== col && AppState.puzzle[row][c] === num) {
                conflicts.push({ row, col: c });
            }
        }
        
        // Check column
        for (let r = 0; r < 9; r++) {
            if (r !== row && AppState.puzzle[r][col] === num) {
                conflicts.push({ row: r, col });
            }
        }
        
        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if ((r !== row || c !== col) && AppState.puzzle[r][c] === num) {
                    conflicts.push({ row: r, col: c });
                }
            }
        }
        
        return conflicts;
    },
    
    // Add move to history for undo
    addToHistory(row, col, oldValue, newValue) {
        AppState.moveHistory.push({ row, col, oldValue, newValue });
        // Limit history size
        if (AppState.moveHistory.length > 100) {
            AppState.moveHistory.shift();
        }
    },
    
    // Undo last move
    undo() {
        if (AppState.moveHistory.length === 0) return false;
        
        const lastMove = AppState.moveHistory.pop();
        const { row, col, oldValue } = lastMove;
        
        AppState.puzzle[row][col] = oldValue;
        
        const cell = document.querySelector(
            `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
        );
        if (cell) {
            cell.textContent = oldValue !== 0 ? oldValue : '';
        }
        
        this.updateRemainingCounts();
        this.updateProgress();
        
        return true;
    },
    
    // Toggle notes mode
    toggleNotesMode() {
        AppState.notesMode = !AppState.notesMode;
        const btn = document.getElementById('notes-btn');
        if (btn) {
            btn.classList.toggle('active', AppState.notesMode);
        }
    },
    
    // Reset game state for new game
    resetGameState() {
        AppState.mistakes = 0;
        AppState.moveHistory = [];
        AppState.notes = {};
        AppState.notesMode = false;
        AppState.playerScore = 0;
        
        this.updateMistakesDisplay();
        this.updateProgress();
        this.updateRemainingCounts();
        
        const notesBtn = document.getElementById('notes-btn');
        if (notesBtn) notesBtn.classList.remove('active');
    }
};
// ===========================================
// Game UI
// ===========================================
const GameUI = {
    createGrid() {
        const grid = document.getElementById('sudoku-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Add ARIA attributes for accessibility
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-label', 'Sudoku puzzle board');
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // Accessibility attributes
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('tabindex', '0');
                cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}, empty`);
                
                cell.addEventListener('click', () => this.selectCell(row, col));
                
                // Allow keyboard selection
                cell.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.selectCell(row, col);
                    }
                });
                
                grid.appendChild(cell);
            }
        }
    },
    
    renderPuzzle(puzzle, board = null) {
        console.log('renderPuzzle called, board:', board ? 'present' : 'null');
        
        let cellsFound = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.querySelector(
                    `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
                );
                
                if (!cell) {
                    continue;
                }
                cellsFound++;
                
                cell.classList.remove('given', 'selected', 'error', 'correct', 
                                      'player-fill', 'opponent-fill');
                
                let value, isGiven, filledBy;
                
                if (board) {
                    // 1v1 mode - use board state from RTDB
                    const cellData = board[`${row}_${col}`];
                    value = cellData?.value || 0;
                    isGiven = cellData?.given || false;
                    filledBy = cellData?.filledBy;
                } else {
                    // Single player mode
                    value = puzzle[row][col];
                    // A cell is "given" if it was part of the original puzzle
                    isGiven = AppState.originalPuzzle?.[row]?.[col] !== 0;
                }
                
                cell.textContent = value !== 0 ? value : '';
                
                // Update ARIA label for accessibility
                let ariaLabel = `Row ${row + 1}, Column ${col + 1}`;
                if (value !== 0) {
                    ariaLabel += `, ${value}`;
                    if (isGiven) {
                        ariaLabel += ' (given)';
                    } else if (filledBy) {
                        ariaLabel += filledBy === AppState.currentUser?.uid ? ' (your entry)' : ' (opponent entry)';
                    }
                } else {
                    ariaLabel += ', empty';
                }
                cell.setAttribute('aria-label', ariaLabel);
                
                if (isGiven) {
                    cell.classList.add('given');
                } else if (filledBy) {
                    if (filledBy === AppState.currentUser?.uid) {
                        cell.classList.add('player-fill');
                    } else {
                        cell.classList.add('opponent-fill');
                    }
                }
            }
        }
        
        console.log('renderPuzzle complete, cells found:', cellsFound);
        
        // Store puzzle state for versus mode
        if (board) {
            AppState.puzzle = puzzle;
        }
    },
    
    selectCell(row, col) {
        // Remove previous selection
        document.querySelectorAll('.sudoku-cell.selected').forEach(c => {
            c.classList.remove('selected');
        });
        document.querySelectorAll('.sudoku-cell.same-number').forEach(c => {
            c.classList.remove('same-number');
        });
        
        const cell = document.querySelector(
            `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
        );
        
        if (cell) {
            cell.classList.add('selected');
            AppState.selectedCell = { row, col };
            
            // Highlight same numbers
            const num = AppState.puzzle?.[row]?.[col];
            if (num && num !== 0) {
                GameHelpers.highlightSameNumbers(num);
            }
        }
    },
    
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
        
        // In versus mode, check if cell is already filled by checking classes AND content
        if (AppState.gameMode === 'versus') {
            const hasPlayerFill = cell.classList.contains('player-fill');
            const hasOpponentFill = cell.classList.contains('opponent-fill');
            const hasContent = cell.textContent.trim() !== '';
            
            console.log('Cell state check:', { hasPlayerFill, hasOpponentFill, hasContent, content: cell.textContent });
            
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
                        cell.textContent = num;
                        
                        setTimeout(() => {
                            cell.classList.remove('correct');
                        }, 500);
                    } else {
                        // Wrong guess - show error animation but don't persist
                        AudioManager.playError();
                        cell.classList.add('error');
                        cell.textContent = num;
                        
                        // Clear the wrong number after animation (local only - not saved to DB)
                        setTimeout(() => {
                            cell.classList.remove('error');
                            cell.textContent = '';
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
                cell.textContent = '';
                AppState.puzzle[row][col] = 0;
                GameHelpers.addToHistory(row, col, oldValue, 0);
            } else {
                cell.textContent = num;
                AppState.puzzle[row][col] = num;
                GameHelpers.addToHistory(row, col, oldValue, num);
                
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
                    } else {
                        AudioManager.playError();
                        cell.classList.add('error');
                        
                        // Reset streak on wrong answer
                        CreativeFeatures.resetStreak();
                        
                        // Increment mistakes
                        AppState.mistakes++;
                        GameHelpers.updateMistakesDisplay();
                        
                        // Remove wrong number after animation
                        setTimeout(() => {
                            cell.textContent = '';
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
        
        AppState.gameTimer = setInterval(() => {
            AppState.gameSeconds++;
            if (timerEl) {
                timerEl.textContent = UI.formatTime(AppState.gameSeconds);
            }
        }, 1000);
    },
    
    stopTimer() {
        if (AppState.gameTimer) {
            clearInterval(AppState.gameTimer);
            AppState.gameTimer = null;
        }
    },
    
    endSinglePlayerGame(won) {
        this.stopTimer();
        
        document.getElementById('game-over-title').textContent = won ? 'Congratulations!' : 'Game Over';
        document.getElementById('result-icon').textContent = won ? '🏆' : '😔';
        document.getElementById('result-message').textContent = won ? 'You solved the puzzle!' : 'Better luck next time!';
        document.getElementById('final-score').textContent = AppState.playerScore;
        document.getElementById('final-time').textContent = UI.formatTime(AppState.gameSeconds);
        const oppRow = document.getElementById('opponent-score-row');
        if (oppRow) {
            oppRow.style.display = 'none';
        }
        
        if (won) {
            AudioManager.playVictory();
            CreativeFeatures.showConfetti();
        } else {
            AudioManager.playDefeat();
        }
        
        ViewManager.show('lobby');
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

        if (isWinner) {
            AudioManager.playVictory();
            CreativeFeatures.showConfetti();
            ProfileManager.updateStats(userId, true);
        } else if (isWinner === false) {
            AudioManager.playDefeat();
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
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const body = document.body;
        const isDark = body.classList.contains('dark-theme');
        body.classList.remove('dark-theme', 'light-theme');
        body.classList.add(isDark ? 'light-theme' : 'dark-theme');
        
        const icon = document.querySelector('.theme-icon');
        if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    });
    
    // Sound toggle
    document.getElementById('sound-toggle')?.addEventListener('click', () => {
        AppState.soundEnabled = !AppState.soundEnabled;
        const icon = document.querySelector('.sound-icon');
        if (icon) icon.textContent = AppState.soundEnabled ? '🔊' : '🔇';
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
    
    // Tutorial game listener
    document.addEventListener('startTutorialGame', () => {
        startSinglePlayerGame('easy');
    });
    
    // Sign In form
    document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value;
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
            } else if (error.code === 'auth/wrong-password') {
                alert('Incorrect password. Please try again.');
            } else {
                alert('Sign in failed: ' + error.message);
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });
    
    // Sign Up form
    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const btn = e.target.querySelector('button[type="submit"]');
        
        // Validate username
        if (!username || username.length < 3 || username.length > 20) {
            alert('Username must be between 3 and 20 characters.');
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            alert('Username can only contain letters, numbers, and underscores.');
            return;
        }
        
        if (password !== confirm) {
            alert('Passwords do not match. Please try again.');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }
        
        try {
            btn.disabled = true;
            btn.textContent = 'Checking username...';
            
            // Check if username is already taken
            const usernameAvailable = await ProfileManager.checkUsernameAvailable(username.toLowerCase());
            if (!usernameAvailable) {
                alert('This username is already taken. Please choose another.');
                btn.disabled = false;
                btn.textContent = 'Create Account';
                return;
            }
            
            btn.textContent = 'Creating account...';
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Update the user's display name in Firebase Auth
            await updateProfile(userCredential.user, { displayName: username });
            
            // The profile will be created in onAuthStateChanged with the username
            AppState.pendingUsername = username;
            
        } catch (error) {
            console.error('Sign up failed:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('An account with this email already exists. Please sign in instead.');
            } else if (error.code === 'auth/weak-password') {
                alert('Password is too weak. Please use at least 6 characters.');
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
            await PresenceSystem.cleanup();
            console.log('Presence cleaned up, signing out...');
            await signOut(auth);
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
            const displayName = AppState.currentUser?.displayName || 
                              `Player_${AppState.currentUser?.uid.substring(0, 6)}`;
            console.log('Creating room for:', displayName);
            const code = await LobbyManager.createRoom(AppState.currentUser.uid, displayName);
            console.log('Room created with code:', code);
            
            AppState.currentRoom = code;
            document.getElementById('display-room-code').textContent = code;
            
            ViewManager.show('waiting');
            PresenceSystem.updateActivity('Waiting for opponent');
            
            // Listen for player joins
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room: ' + error.message);
        }
    });
    
    // Join room
    const joinRoomHandler = async () => {
        const codeInput = document.getElementById('room-code-input');
        const code = codeInput?.value?.trim();
        
        console.log('Attempting to join room with code:', code);
        
        if (!code || code.length !== 4) {
            alert('Please enter a valid 4-digit room code');
            return;
        }
        
        try {
            const displayName = AppState.currentUser?.displayName || 
                              `Player_${AppState.currentUser?.uid.substring(0, 6)}`;
            console.log('User:', AppState.currentUser?.uid, 'Display:', displayName);
            
            await LobbyManager.joinRoom(code, AppState.currentUser.uid, displayName);
            console.log('Successfully joined room');
            
            AppState.currentRoom = code;
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
        ViewManager.show('lobby');
        PresenceSystem.updateActivity('In Lobby');
    });
    
    // Copy room code
    document.getElementById('copy-code')?.addEventListener('click', () => {
        const code = document.getElementById('display-room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert('Code copied to clipboard!');
        });
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
        // Reset countdown if running
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        ViewManager.show('lobby');
        PresenceSystem.updateActivity('In Lobby');
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
        PresenceSystem.updateActivity('In Lobby');
    });
    
    // Back to lobby from post-match
    document.getElementById('postmatch-back-lobby')?.addEventListener('click', () => {
        cleanupAfterMatch();
        ViewManager.show('lobby');
        PresenceSystem.updateActivity('In Lobby');
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
    document.getElementById('hint-btn')?.addEventListener('click', () => {
        if (AppState.gameMode === 'single' && AppState.selectedCell) {
            const { row, col } = AppState.selectedCell;
            const correctValue = AppState.solution[row][col];
            GameUI.inputNumber(correctValue);
        }
    });
    
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
            PresenceSystem.updateActivity('In Lobby');
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
        PresenceSystem.updateActivity('In Lobby');
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
        // Handle challenge acceptance
        ViewManager.hideModal('challenge-modal');
    });
    
    document.getElementById('decline-challenge')?.addEventListener('click', () => {
        ViewManager.hideModal('challenge-modal');
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
        GameHelpers.undo();
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
            GameHelpers.undo();
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
        PresenceSystem.updateActivity('In Lobby');
    });
    
    // Edit profile button
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
        document.querySelector('.profile-view-mode')?.classList.add('hidden');
        document.querySelector('.profile-edit-mode')?.classList.remove('hidden');
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
            const bioDisplay = document.getElementById('profile-bio');
            if (bioDisplay) bioDisplay.textContent = bio || 'No bio yet';
            
            // Switch back to view mode
            document.querySelector('.profile-edit-mode')?.classList.add('hidden');
            document.querySelector('.profile-view-mode')?.classList.remove('hidden');
            
            alert('Profile updated!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        }
    });
    
    // Cancel edit
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
        document.querySelector('.profile-edit-mode')?.classList.add('hidden');
        document.querySelector('.profile-view-mode')?.classList.remove('hidden');
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
            const img = document.getElementById('profile-picture-display');
            if (img) {
                img.src = url;
                img.style.display = 'block';
            }
            
            progressIndicator.remove();
            alert('Profile picture updated!');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            alert('Failed to upload profile picture');
        }
    });
    
    // Copy profile URL
    document.getElementById('copy-profile-url')?.addEventListener('click', () => {
        const urlInput = document.getElementById('profile-vanity-url');
        if (urlInput) {
            navigator.clipboard.writeText(urlInput.value).then(() => {
                alert('Profile URL copied!');
            });
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
            alert('Stats copied to clipboard!');
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
        
        const btn = document.getElementById('profile-friend-btn');
        const currentText = btn?.textContent || '';
        
        try {
            if (currentText.includes('Add Friend')) {
                await ProfileManager.sendFriendRequest(AppState.currentUser.uid, profileUserId);
                if (btn) btn.textContent = '📤 Request Sent';
                alert('Friend request sent!');
            } else if (currentText.includes('Remove Friend')) {
                await ProfileManager.removeFriend(AppState.currentUser.uid, profileUserId);
                if (btn) btn.textContent = '👤 Add Friend';
                alert('Friend removed');
            } else if (currentText.includes('Accept Request')) {
                await ProfileManager.acceptFriendRequest(AppState.currentUser.uid, profileUserId);
                if (btn) btn.textContent = '✓ Friends';
            }
        } catch (error) {
            console.error('Friend action error:', error);
            alert('Failed to complete action');
        }
    });
    
    // DM from profile
    document.getElementById('profile-dm-btn')?.addEventListener('click', async () => {
        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
        if (!profileUserId) return;
        
        // Open chat widget with DM tab
        const widget = document.getElementById('chat-widget');
        const fab = document.getElementById('chat-fab');
        
        if (widget && fab) {
            widget.classList.remove('minimized');
            fab.classList.add('hidden');
        }
        
        // Switch to DM mode with this user
        AppState.widgetChatMode = `dm_${profileUserId}`;
        
        // Highlight DM tab
        document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.widget-tab[data-chat="dms"]')?.classList.add('active');
        
        // Start listening to DMs with this user
        // Compute dmId and load history + listener
        try {
            const dmId = [AppState.currentUser.uid, profileUserId].sort().join('_');
            const messagesEl = document.getElementById('chat-widget-messages');
            if (messagesEl) {
                messagesEl.innerHTML = '<div class="chat-info">Direct messages with this user</div>';
                // Load existing history
                const dmSnapshot = await get(ref(rtdb, `directMessages/${dmId}`));
                if (dmSnapshot.exists()) {
                    dmSnapshot.forEach(child => {
                        const msg = child.val();
                        UI.addChatMessage('chat-widget-messages', msg.fromDisplayName || msg.from, msg.text, msg.timestamp, msg.from);
                    });
                }
            }

            ChatManager.listenToDirectMessages(dmId, (msg) => {
                UI.addChatMessage('chat-widget-messages', msg.fromDisplayName || msg.from, msg.text, msg.timestamp, msg.from);
                if (typeof window.incrementUnread === 'function') window.incrementUnread();
            });
        } catch (e) {
            console.warn('Failed to open DM conversation:', e);
        }
        
        // Clear messages and load DM history
        const messagesEl = document.getElementById('chat-widget-messages');
        if (messagesEl) {
            messagesEl.innerHTML = '<div class="chat-info">Direct messages with this user</div>';
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
    const profile = AppState.currentUser ? ProfileManager.cache.get(AppState.currentUser.uid) : null;
    const wins = profile?.wins || 0;
    const losses = profile?.losses || 0;
    const badges = profile?.badges?.length || 0;
    
    return `🎮 My Stonedoku Stats!\n` +
           `🏆 Wins: ${wins}\n` +
           `📊 Win Rate: ${wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%\n` +
           `🎖️ Badges: ${badges}\n` +
           `Play now: https://stone-doku.web.app`;
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

// ===========================================
// Vanity URL Handler
// ===========================================
async function handleVanityUrl() {
    // Support hash-based and pathname-based vanity URLs.
    try {
        // Hash-based: #profile/username
        const hash = window.location.hash;
        if (hash.startsWith('#profile/')) {
            const username = hash.replace('#profile/', '');
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

        // Pathname-based: /profile/username or /user/username
        const pathname = window.location.pathname || '';
        const pathMatch = pathname.match(/^\/(?:profile|user)\/(.+)$/i);
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

// Listen for hash changes
window.addEventListener('hashchange', handleVanityUrl);

// ===========================================
// Floating Chat Widget
// ===========================================
function initFloatingChat() {
    const widget = document.getElementById('chat-widget');
    const fab = document.getElementById('chat-fab');
    const header = document.getElementById('chat-widget-header');
    const minimizeBtn = document.getElementById('chat-minimize');
    const maximizeBtn = document.getElementById('chat-maximize');
    const form = document.getElementById('chat-widget-form');
    const input = document.getElementById('chat-widget-input');
    // Suggestion popup for @whisper username autocomplete
    const suggestionBox = document.createElement('div');
    suggestionBox.id = 'chat-suggestion-box';
    suggestionBox.style.position = 'absolute';
    suggestionBox.style.zIndex = '9999';
    suggestionBox.style.background = '#fff';
    suggestionBox.style.border = '1px solid rgba(0,0,0,0.12)';
    suggestionBox.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
    suggestionBox.style.display = 'none';
    suggestionBox.style.minWidth = '180px';
    suggestionBox.style.maxHeight = '240px';
    suggestionBox.style.overflow = 'auto';
    suggestionBox.style.borderRadius = '6px';
    suggestionBox.style.padding = '6px 0';
    suggestionBox.style.fontSize = '14px';
    widget.appendChild(suggestionBox);

    let suggestions = [];
    let selectedIndex = -1;

    async function fetchUsernameSuggestions(prefix) {
        if (!prefix) return [];
        const p = prefix.toLowerCase();
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
                const merged = online.concat(offline).slice(0, 8);
                return merged;
            } catch (e) {
                // If presence read fails, fall back to username list
                console.warn('Presence read failed for suggestions, falling back:', e);
                return candidates.slice(0, 8).map(c => c.username);
            }
        } catch (e) {
            console.error('Username suggestion fetch failed', e);
            return [];
        }
    }

    function positionSuggestionBox() {
        if (!input) return;
        const rect = input.getBoundingClientRect();
        suggestionBox.style.left = `${rect.left + window.scrollX}px`;
        suggestionBox.style.top = `${rect.bottom + window.scrollY + 6}px`;
        suggestionBox.style.width = `${rect.width}px`;
    }

    function renderSuggestions(list) {
        suggestions = list || [];
        selectedIndex = -1;
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
        input.value = `@whisper ${username} `;
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
        const val = e.target.value;
        // match @w or @whisper followed by space and a fragment
        const m = val.match(/^@w(?:hisper)?\s+([A-Za-z0-9_\-]{1,})$/i);
        if (!m) {
            // also handle when user types @username right after @whisper
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 200);
            return;
        }
        const fragment = m[1];
        const list = await fetchUsernameSuggestions(fragment);
        renderSuggestions(list);
    });

    input?.addEventListener('blur', () => {
        // Delay hide to allow click handler to run
        suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
    });
    const emojiToggle = document.getElementById('widget-emoji-toggle');
    const emojiPicker = document.getElementById('emoji-picker-widget');
    
    if (!widget || !fab) return;
    
    // Track unread messages
    let unreadCount = 0;
    
    // FAB click - open chat
    fab.addEventListener('click', () => {
        widget.classList.remove('minimized');
        fab.classList.add('hidden');
        unreadCount = 0;
        updateUnreadBadge();
        input?.focus();
    });
    
    // Minimize
    minimizeBtn?.addEventListener('click', () => {
        widget.classList.add('minimized');
        widget.classList.remove('maximized');
        fab.classList.remove('hidden');
    });
    
    // Maximize/restore
    maximizeBtn?.addEventListener('click', () => {
        widget.classList.toggle('maximized');
    });
    
    // Draggable header
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    header?.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
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
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        widget.classList.remove('dragging');
    });
    
    // Tab switching
    document.querySelectorAll('.widget-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const chatMode = tab.dataset.chat;
            
            const dmList = document.getElementById('dm-list');
            const messages = document.getElementById('chat-widget-messages');
            const chatHint = document.getElementById('chat-hint');
            
            // Handle DMs tab specially
            if (chatMode === 'dms') {
                AppState.widgetChatMode = 'dms';
                if (dmList) dmList.style.display = 'block';
                if (messages) messages.style.display = 'none';
                if (chatHint) chatHint.style.display = 'block';
            } else {
                AppState.widgetChatMode = chatMode;
                if (dmList) dmList.style.display = 'none';
                if (messages) messages.style.display = 'flex';
                if (chatHint) chatHint.style.display = 'none';
                
                // Just scroll to bottom when switching tabs
                if (messages) {
                    messages.scrollTop = messages.scrollHeight;
                }
            }
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
            const displayName = AppState.currentUser.displayName || 
                              `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            
            const activeTab = document.querySelector('.widget-tab.active');
            const chatMode = activeTab?.dataset.chat || 'global';
            
            try {
                if (chatMode === 'game' && AppState.currentMatch) {
                    await ChatManager.sendGameMessage(AppState.currentMatch, AppState.currentUser.uid, displayName, text);
                } else if (AppState.widgetChatMode.startsWith('dm_')) {
                    // Sending to a specific DM conversation
                    const otherUserId = AppState.widgetChatMode.replace('dm_', '');
                    await ChatManager.sendDirectMessage(AppState.currentUser.uid, displayName, otherUserId, text);
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

    // Autocomplete whisper command: @whi -> @whisper
    input?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^@whi(?!s)/i.test(val)) {
            e.target.value = val.replace(/^@whi/i, '@whisper');
        }
    });
    
    // Helper to update unread badge
    function updateUnreadBadge() {
        const fabUnread = document.getElementById('fab-unread');
        const widgetUnread = document.getElementById('unread-badge');
        
        if (unreadCount > 0) {
            if (fabUnread) {
                fabUnread.textContent = unreadCount > 99 ? '99+' : unreadCount;
                fabUnread.style.display = 'block';
            }
            if (widgetUnread) {
                widgetUnread.textContent = unreadCount > 99 ? '99+' : unreadCount;
                widgetUnread.style.display = 'inline-block';
            }
        } else {
            if (fabUnread) fabUnread.style.display = 'none';
            if (widgetUnread) widgetUnread.style.display = 'none';
        }
    }
    
    // Store the function globally for use in chat listener
    window.incrementUnread = () => {
        if (widget.classList.contains('minimized')) {
            unreadCount++;
            updateUnreadBadge();
        }
    };
}

// ===========================================
// Creative Improvements
// ===========================================
const CreativeFeatures = {
    streak: 0,
    
    showStreak() {
        const indicator = document.querySelector('.streak-indicator') || this.createStreakIndicator();
        indicator.textContent = `${this.streak} in a row!`;
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
        const colors = ['#22c55e', '#6366f1', '#f59e0b', '#ef4444', '#a78bfa', '#22d3ee'];
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = `${Math.random() * 100}vw`;
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
                confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 4000);
            }, i * 30);
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

function startSinglePlayerGame(difficulty) {
    AppState.gameMode = 'single';
    AppState.currentDifficulty = difficulty;
    AppState.playerScore = 0;
    AppState.selectedCell = null;
    
    // Reset QOL state
    GameHelpers.resetGameState();
    
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
    
    ViewManager.show('game');
    GameUI.startTimer();
    PresenceSystem.updateActivity(`Playing: ${difficultyLabel} Mode`);
}

async function startVersusGame(roomData) {
    AppState.gameMode = 'versus';
    AppState.playerScore = 0;
    AppState.opponentScore = 0;
    AppState.selectedCell = null;
    // Reset UI/game helper state for a fresh versus match
    GameHelpers.resetGameState();
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
    PresenceSystem.updateActivity('Playing: Bust the Board');
    
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
    ChatManager.listenToGameChat(matchId, (message) => {
        // Add to floating chat widget if game tab is active
        const activeWidgetTab = document.querySelector('.widget-tab.active');
        if (activeWidgetTab?.dataset.chat === 'game') {
            UI.addChatMessage('chat-widget-messages', message.displayName, message.text, message.timestamp, message.userId);
        }
        
        // Show unread notification
        if (typeof window.incrementUnread === 'function') {
            window.incrementUnread();
        }
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
    PresenceSystem.updateActivity('In Pre-Game Lobby');
    
    updatePregameLobbyUI(room);
    
    // Listen to lobby chat
    LobbyManager.listenToLobbyChat(AppState.currentRoom, (messages) => {
        renderPregameChat(messages);
    });
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
        title.textContent = '🏆 Victory!';
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
    PresenceSystem.updateActivity('Post-Match');
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
            PresenceSystem.updateActivity('In Lobby');
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
    PresenceSystem.updateActivity('In Pre-Game Lobby');
    
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
        
        if (title) title.textContent = '🏆 Victory!';
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
onAuthStateChanged(auth, async (user) => {
    AppState.authReady = true;
    
    if (user) {
        AppState.currentUser = user;
        
        // If we're in the middle of onboarding, don't redirect to lobby
        if (AppState.onboarding.active) {
            console.log('Onboarding active, skipping auth redirect');
            return;
        }
        
        // Check if we have a pending username from signup
        const pendingUsername = AppState.pendingUsername;
        AppState.pendingUsername = null;
        
        // Create/update user profile
        const profile = await ProfileManager.createOrUpdateProfile(user.uid, {
            username: pendingUsername || null,
            displayName: user.displayName || pendingUsername || `Player_${user.uid.substring(0, 6)}`,
            email: user.email
        });
        
        const profileData = profile.data();
        
        // Use username as display name, fall back to displayName, truncate if too long
        const displayName = profileData?.username || profileData?.displayName || 'Player';
        const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
        
        // Update UI
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = truncatedName;
        document.getElementById('welcome-name').textContent = displayName;
        
        // Store friends in state
        AppState.friends = profileData?.friends || [];
        
        UI.updateStats(profileData?.stats || { wins: 0, losses: 0 });
        UI.updateBadges(profileData?.badges || []);
        
        // Initialize presence with proper username
        await PresenceSystem.init(user.uid, displayName);
        
        // Listen to online players
        PresenceSystem.listenToOnlinePlayers((players) => {
            AppState.onlinePlayers = players;
            UI.updatePlayersList(players);
        });
        
        // Listen to global chat
        ChatManager.listenToGlobalChat((message) => {
            // Add to floating chat widget (global mode)
            const widgetMessages = document.getElementById('chat-widget-messages');
            const activeTab = document.querySelector('.widget-tab.active');
            const widgetMode = activeTab?.dataset.chat || 'global';
            
            if (widgetMessages && widgetMode === 'global') {
                UI.addChatMessage('chat-widget-messages', message.displayName, message.text, message.timestamp, message.userId);
            }
            
            // Show unread notification if widget is minimized
            if (typeof window.incrementUnread === 'function') {
                window.incrementUnread();
            }
        });
        
        // Listen for challenges
        ChallengeSystem.listenToNotifications(user.uid, (challengerId, notification) => {
            if (notification.status === 'pending') {
                document.getElementById('challenger-name').textContent = notification.fromName;
                ViewManager.showModal('challenge-modal');
            }
        });
        
        // Show chat widget for logged in users
        const chatWidget = document.getElementById('chat-widget');
        const chatFab = document.getElementById('chat-fab');
        if (chatWidget) chatWidget.style.display = 'flex';
        if (chatFab) chatFab.style.display = 'flex';
        
        ViewManager.show('lobby');
    } else {
        AppState.currentUser = null;
        document.getElementById('user-info').style.display = 'none';
        
        // Hide chat widget and FAB for logged out users
        const chatWidget = document.getElementById('chat-widget');
        const chatFab = document.getElementById('chat-fab');
        if (chatWidget) chatWidget.style.display = 'none';
        if (chatFab) chatFab.style.display = 'none';
        
        // Cleanup listeners
        AppState.listeners = [];
        
        ViewManager.show('auth');
    }
});

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

// ===========================================
// Cookie Consent Manager (UK PECR Compliant)
// ===========================================
const CookieConsent = {
    STORAGE_KEY: 'stonedoku_cookie_consent',
    
    init() {
        const consent = this.getConsent();
        if (!consent) {
            this.showBanner();
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
    
    applyConsent() {
        const consent = this.getConsent();
        if (!consent) return;
        
        // Apply analytics consent (would enable/disable analytics here)
        if (consent.analytics) {
            console.log('Analytics enabled');
            // Enable Firebase Analytics or other analytics
        }
        
        // Apply preference cookies
        if (consent.preferences) {
            console.log('Preference cookies enabled');
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
document.addEventListener('DOMContentLoaded', () => {
    console.log('Stonedoku initialized - v2.1 (Europe DB, WCAG 2.1 AA)');
    console.log('Database URL:', firebaseConfig.databaseURL);
    console.log('Debug tools available at window.StonedokuDebug');
    
    // Initialize audio
    AudioManager.init();
    
    // Initialize cookie consent (UK PECR compliant)
    CookieConsent.init();
    
    // Initialize legal modals
    LegalModals.init();
    
    // Initialize accessibility features
    AccessibilityManager.init();
    
    // Set up event listeners
    setupEventListeners();

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
                    await addDoc(collection(firestore, 'qaReports'), report);
                    console.log('QA report saved to Firestore: qaReports');
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
});
