/**
 * Stonedoku Application Entry Point
 * 
 * This is the main bootstrap file that initializes Firebase and all application modules.
 * The actual business logic lives in src/client/{core,lib,managers,ui}.
 */

// ===========================================
// Firebase SDK Imports (from CDN)
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
    addDoc,
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
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// ===========================================
// Application Module Imports
// ===========================================
// Core
import { AppState, setModerationState, applyProfileModeration } from './core/appState.js';
import { createAuthFlow } from './core/authFlow.js';
import { createGameFlow } from './core/gameFlow.js';
import { createEventSetup } from './core/eventSetup.js';

// Libraries
import { PasswordPolicy } from './lib/passwordPolicy.js';
import { SudokuGenerator } from './lib/sudokuGenerator.js';
import { ProfanityFilter } from './lib/profanityFilter.js';
import { ensureAppVersionFresh } from './lib/versionUtils.js';

// Managers
import { createPresenceManager } from './managers/presenceManager.js';
import { createProfileManager } from './managers/profileManager.js';
import { createFriendsManager } from './managers/friendsManager.js';
import { createLobbyManager } from './managers/lobbyManager.js';
import { createMatchManager } from './managers/matchManager.js';
import { createChatManager } from './managers/chatManager.js';
import { createChallengeSystemManager } from './managers/challengeSystemManager.js';
import { createLogManager } from './managers/logManager.js';
import { AudioManager } from './managers/audioManager.js';
import { MotionUtils } from './lib/motionUtils.js';
import { createArchitecturalStateManager } from './managers/architecturalStateManager.js';
import { createCreativeFeatures, CreativeFeatures } from './managers/creativeFeaturesManager.js';
import { createAccessibilityManager, AccessibilityManager } from './managers/accessibilityManager.js';
import { createOnboardingManager } from './managers/onboardingManager.js';
import { createAdminManager } from './managers/adminManager.js';

// UI
import { createViewManager } from './managers/viewManager.js';
import { createUiHelpers } from './ui/uiHelpers.js';
import { createGameHelpers } from './ui/gameHelpersUi.js';
import { createGameUi } from './ui/gameUi.js';
import { BoardIntegrityHelper } from './ui/boardIntegrityUi.js';
import { createPasswordReset } from './ui/passwordResetUi.js';
import { createTourManager } from './managers/tourManager.js';
import { createCookieConsent, CookieConsent } from './ui/cookieConsentUi.js';
import { createLegalModals, LegalModals } from './ui/legalModalsUi.js';
import { createUpdatesCenter } from './ui/updatesCenterUi.js';
import { createAdminConsole } from './ui/adminConsoleUi.js';
import { createFloatingChat } from './ui/floatingChatUi.js';
import { createProfilePage, handleVanityUrl, handleUpdatesUrl, handleAdminUrl } from './ui/profilePageUi.js';

// ===========================================
// Firebase Configuration
// ===========================================
const firebaseConfig = {
    apiKey: "AIzaSyCp7BkBGFmgjSL_28iexOAO7X4RoY_7tQ4",
    authDomain: "stonedoku-c0898.firebaseapp.com",
    projectId: "stonedoku-c0898",
    storageBucket: "stonedoku-c0898.firebasestorage.app",
    messagingSenderId: "755062989426",
    appId: "1:755062989426:web:446a5be32bf4d6b66198eb",
    databaseURL: "https://stonedoku-c0898-default-rtdb.europe-west1.firebasedatabase.app"
};

// ===========================================
// Initialize Firebase
// ===========================================
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const rtdb = getDatabase(firebaseApp);
const firestore = initializeFirestore(firebaseApp, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
});
const functions = getFunctions(firebaseApp);
const storage = getStorage(firebaseApp);

// Start version check early
ensureAppVersionFresh();

// ===========================================
// Initialize Managers
// ===========================================
const PresenceManager = createPresenceManager({ rtdb, appState: AppState });
const ProfileManager = createProfileManager({
    firestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs,
    onSnapshot, arrayUnion, arrayRemove, runFsTransaction, fsServerTimestamp, storage, storageRef,
    uploadBytes, getDownloadURL, rtdb, ref, update, serverTimestamp, AppState, isRegisteredUser
});
const FriendsManager = createFriendsManager({
    firestore, AppState, profileManager: ProfileManager, isRegisteredUser, UI: null // Will be set after UI is created
});
const LobbyManager = createLobbyManager({ rtdb, appState: AppState });
const MatchManager = createMatchManager({ rtdb, appState: AppState });
const ChatManager = createChatManager({ rtdb, firestore, appState: AppState, profanityFilter: ProfanityFilter });
const LogManager = createLogManager(firestore, () => AppState);
const ArchitecturalStateManager = createArchitecturalStateManager({ AppState, MotionUtils });
const AdminManager = createAdminManager({ functions, httpsCallable, AppState, UI: null }); // UI set later

// ===========================================
// Initialize UI Components
// ===========================================
const ViewManager = createViewManager({ AppState, MotionUtils, ArchitecturalStateManager });
const UiHelpers = createUiHelpers({
    firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
    onSnapshot, limit, fsServerTimestamp, orderBy, arrayUnion, arrayRemove,
    rtdb, ref, get, onValue, onChildAdded, update, serverTimestamp, remove,
    storage, storageRef, uploadBytes, getDownloadURL,
    AppState, ViewManager, ProfileManager, PresenceManager, LobbyManager, MatchManager, ChatManager, AudioManager,
    MotionUtils, ArchitecturalStateManager, BoardIntegrityHelper,
    SudokuGenerator, ProfanityFilter, httpsCallable, functions,
    ChallengeManager: () => ChallengeSystemManager,
    getCurrentDisplayName
});
// Use UiHelpers as the primary UI object - it has the most complete functionality
const UI = UiHelpers;
const GameHelpers = createGameHelpers({ AppState, BoardIntegrityHelper });
const GameUi = createGameUi({
    AppState, ViewManager, AudioManager, SudokuGenerator, BoardIntegrityHelper, GameHelpers,
    PresenceManager, MatchManager, ProfileManager, UI, ArchitecturalStateManager, 
    CreativeFeatures, rtdb, ref, update
});

// Wire up FriendsManager.UI
FriendsManager.UI = UI;

// Wire up AdminManager.UI
AdminManager.UI = UI;

// Expose AdminManager globally for onclick handlers
window.AdminManager = AdminManager;

// ===========================================
// Updates Center and Admin Console (with proper deps)
// ===========================================
const UpdatesCenter = createUpdatesCenter({
    firestore,
    collection, query, orderBy, limit, onSnapshot,
    ViewManager
});

const AdminConsole = createAdminConsole({
    firestore,
    rtdb,
    functions,
    ViewManager,
    waitForAuthReady: () => {
        if (AppState.authReady) return Promise.resolve(true);
        return new Promise((resolve) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (AppState.authReady) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start > 8000) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    },
    UI,
    formatDate: UpdatesCenter.formatDate,
    normalizeItem: UpdatesCenter.normalizeItem,
    AppState,
    firestoreFns: {
        doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc,
        collection, query, where, getDocs, orderBy, limit,
        onSnapshot, Timestamp, documentId
    },
    rtdbFns: { ref, get },
    functionsFns: { httpsCallable }
});

const PasswordReset = createPasswordReset({
    auth, verifyPasswordResetCode, confirmPasswordReset, sendPasswordResetEmail,
    AppState, ViewManager
});
const TourManager = createTourManager({
    AppState, ViewManager, UI, firestore, doc, updateDoc, serverTimestamp: fsServerTimestamp, CookieConsent
});

// ===========================================
// Challenge System Manager
// ===========================================
let handleRoomUpdate; // Forward declaration
const ChallengeSystemManager = createChallengeSystemManager({
    rtdb, ref, set, remove, serverTimestamp, onChildAdded, update,
    AppState, LobbyManager, PresenceManager, ViewManager, UI,
    handleRoomUpdate: (...args) => handleRoomUpdate?.(...args)
});

// Assign to global scope for lazy resolution in UI helpers
globalThis.ChallengeManager = ChallengeSystemManager;

// ===========================================
// Game Flow
// ===========================================
const gameFlow = createGameFlow({
    AppState, ViewManager, GameUI: GameUi, GameHelpers, SudokuGenerator, AudioManager,
    PresenceManager, LobbyManager, MatchManager, ChatManager, ProfileManager, UI,
    rtdb, rtdbFns: { ref, get, update, onValue, onChildAdded, off },
    MotionUtils, ArchitecturalStateManager, BoardIntegrityHelper, CreativeFeatures
});

// Export handleRoomUpdate for ChallengeSystemManager
handleRoomUpdate = gameFlow.handleRoomUpdate;

// ===========================================
// Helper Functions
// ===========================================
function getCurrentDisplayName() {
    if (AppState.profile?.displayName) return AppState.profile.displayName;
    if (AppState.profile?.username) return AppState.profile.username;
    if (AppState.currentUser?.displayName) return AppState.currentUser.displayName;
    if (AppState.currentUser?.uid) return `Player_${AppState.currentUser.uid.substring(0, 6)}`;
    return 'Player';
}

function isRegisteredUser(user = AppState.currentUser, profile = AppState.profile) {
    if (!user) return false;
    if (user.isAnonymous) return false;
    const email = user.email || profile?.email || (user.providerData || []).map(p => p?.email).find(Boolean);
    return !!email;
}

function showAdminControls() {
    // Show admin button in header navigation
    const adminBtn = document.getElementById('admin-nav-btn');
    if (adminBtn) {
        adminBtn.style.display = 'inline-block';
    }
}

// ===========================================
// Notification Handler
// ===========================================
async function handleChallengeNotification(otherUserId, notification) {
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
        LobbyManager.listenToRoom(code, gameFlow.handleRoomUpdate);

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
}

async function handleNotification(otherUserId, notification) {
    if (!notification) return;
    if (notification.type === 'challenge') {
        await handleChallengeNotification(otherUserId, notification);
        return;
    }

    try {
        if (notification.type === 'friend_request') {
            FriendsManager.refresh?.();
            UI.showToast?.('New friend request received.', 'info');
        } else if (notification.type === 'friend_accept') {
            FriendsManager.refresh?.();
            UI.showToast?.('Friend request accepted.', 'success');
        } else if (notification.type === 'friend_decline') {
            UI.showToast?.('Friend request declined.', 'info');
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
// Floating Chat
// ===========================================
function initFloatingChat() {
    createFloatingChat({
        AppState, ViewManager, UI, AudioManager, ProfileManager, ChatManager, LobbyManager,
        ref, rtdb, get, update, onChildAdded,
        firestore, collection, query, where, limit, getDocs, getDoc, doc, orderBy, documentId,
        isRegisteredUser, getCurrentDisplayName
    });
}

// ===========================================
// Profile Page
// ===========================================
const ProfilePage = createProfilePage({
    AppState, ViewManager, PresenceManager, ProfileManager, LobbyManager,
    TourManager, UI: UiHelpers, UpdatesCenter, AdminConsole, isRegisteredUser
});

function initProfilePage() {
    ProfilePage.init();
}

// ===========================================
// Event Setup (DOM listeners)
// ===========================================
const eventSetup = createEventSetup({
    // Firebase
    auth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    updateProfile, signOut, deleteUser, deleteDoc, doc, getDoc, firestore, rtdb, ref, get, update,
    // State & Managers
    AppState, ViewManager, PresenceManager, ProfileManager, LobbyManager, MatchManager, ChatManager,
    GameUI: GameUi, GameHelpers, AudioManager, UI, ChallengeSystemManager, ArchitecturalStateManager,
    // Libraries
    SudokuGenerator,
    // Utilities
    PasswordPolicy, PasswordReset, CookieConsent, OnboardingManager: null, TourManager,
    getCurrentDisplayName, isRegisteredUser,
    startSinglePlayerGame: gameFlow.startSinglePlayerGame,
    handleRoomUpdate: gameFlow.handleRoomUpdate,
    quitGame: gameFlow.quitGame,
    navigateCell: gameFlow.navigateCell,
    cleanupAfterMatch: gameFlow.cleanupAfterMatch,
    // Sub-initializers
    initFloatingChat,
    initProfilePage,
    handleVanityUrl: () => handleVanityUrl({ AppState, ProfileManager, UI }),
    handleUpdatesUrl: () => handleUpdatesUrl(UpdatesCenter),
    handleAdminUrl: () => handleAdminUrl(AppState, AdminConsole)
});

// ===========================================
// Auth State Handler
// ===========================================
const authFlow = createAuthFlow({
    auth, setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
    CookieConsent, AppState
});

async function handleAuthStateChange(user) {
    if (user) {
        AppState.currentUser = user;
        AppState.passwordReset.active = false;
        
        // Check for custom claims (admin roles)
        try {
            const idTokenResult = await user.getIdTokenResult();
            AppState.currentUser.isSuperAdmin = idTokenResult.claims.superAdmin === true;
            AppState.currentUser.isAdmin = idTokenResult.claims.admin === true;
            AppState.currentUser.isModerator = idTokenResult.claims.moderator === true;
        } catch (e) {
            console.warn('Failed to load custom claims:', e);
            AppState.currentUser.isSuperAdmin = false;
            AppState.currentUser.isAdmin = false;
            AppState.currentUser.isModerator = false;
        }
        
        // Configure persistence based on cookie consent
        await authFlow.configureAuthPersistence();

        if (AppState.onboarding?.active) {
            AppState.authReady = true;
            return;
        }
        
        // Show authenticated UI shell immediately
        const initialName = authFlow.getFallbackDisplayName(user);
        authFlow.showAuthenticatedShell(initialName);
        window.ChatWidget?.setDmEnabled?.(isRegisteredUser(user));
        
        // Show lobby unless deep-linking elsewhere
        if (!authFlow.shouldDeferLobbyRedirect()) {
            ViewManager.show('lobby');
        }
        
        // Load/create profile
        let profileData = null;
        try {
            const pendingUsername = AppState.pendingUsername;
            AppState.pendingUsername = null;
            
            const profile = await ProfileManager.createOrUpdateProfile(user.uid, {
                username: pendingUsername || null,
                displayName: user.displayName || pendingUsername || `Player_${user.uid.substring(0, 6)}`,
                email: user.email
            });
            profileData = profile?.data?.() || null;
            AppState.profile = profileData || null;
            applyProfileModeration(AppState, profileData);
        } catch (e) {
            console.warn('Profile create/update failed; continuing with limited session.', e);
            AppState.profile = null;
        }
        
        // Update UI with profile data
        const displayName = authFlow.getFallbackDisplayName(user, profileData);
        authFlow.showAuthenticatedShell(displayName);
        UI.updateStats?.(profileData?.stats || { wins: 0, losses: 0 });
        UI.updateBadges?.(profileData?.badges || []);
        AppState.friends = profileData?.friends || [];
        
        // Show guest toast
        if (user.isAnonymous) {
            UI.showToast?.('You are playing as a guest. Create an account to save progress.', 'info');
        }
        
        // Show admin controls if user has admin privileges
        if (AppState.currentUser.isAdmin || AppState.currentUser.isSuperAdmin) {
            showAdminControls();
        }
        
        // Initialize presence
        PresenceManager.init(user.uid, displayName);
        PresenceManager.listenToOnlinePlayers?.((players) => {
            AppState.onlinePlayers = players;
            UI.updatePlayersList?.(players);
        });
        PresenceManager.updateActivity('In Lobby');
        
        // Enable DM for registered users
        const allowDirectMessages = isRegisteredUser(user, profileData);
        window.ChatWidget?.setDmEnabled?.(allowDirectMessages);
        if (allowDirectMessages && ChatManager.listenToDmThreads) {
            ChatManager.listenToDmThreads(user.uid, (threads) => {
                window.ChatWidget?.setDmThreads?.(threads);
            });
        } else {
            window.ChatWidget?.setDmThreads?.([]);
        }
        
        // Load friends for registered users
        if (isRegisteredUser(user, profileData)) {
            try {
                // getFriends returns full friend objects, but AppState.friends should be IDs
                const friendObjects = await ProfileManager.getFriends(user.uid);
                AppState.friends = friendObjects.map(f => f.id || f);
                FriendsManager.startRealtime?.();
                FriendsManager.refresh();
            } catch (e) {
                console.warn('Failed to load friends:', e);
            }
        }
        
        // Listen to global chat
        ChatManager.listenToGlobalChat?.((message) => {
            window.ChatWidget?.ingestMessage?.('global', message);
        });
        
        // Listen for challenge notifications
        ChallengeSystemManager.listenToNotifications?.(user.uid, handleNotification);
        
        // Initialize admin state if profile has isAdmin flag
        if (profileData?.isAdmin || isRegisteredUser(user, profileData)) {
            AdminConsole.refreshAdminState?.();
        }
        
    } else {
        // Signed out
        FriendsManager.stopRealtime?.();
        AppState.currentUser = null;
        AppState.profile = null;
        AppState.friends = [];
        if (AppState.onboarding) {
            AppState.onboarding.active = false;
            AppState.onboarding.step = 1;
        }
        
        // Hide authenticated UI elements
        const userInfo = document.getElementById('user-info');
        const chatWidget = document.getElementById('chat-widget');
        const chatFab = document.getElementById('chat-fab');
        const friendsCard = document.getElementById('friends-card');
        if (userInfo) userInfo.style.display = 'none';
        if (chatWidget) chatWidget.style.display = 'none';
        if (chatFab) chatFab.style.display = 'none';
        if (friendsCard) friendsCard.style.display = 'none';
        
        PresenceManager.cleanup();
        window.ChatWidget?.reset?.();
        window.ChatWidget?.setDmEnabled?.(false);
        ViewManager.show('auth');
    }
    
    AppState.authReady = true;
}

        const OnboardingManager = createOnboardingManager({
            AppState,
            ViewManager,
            PasswordPolicy,
            ProfileManager,
            auth,
            createUserWithEmailAndPassword,
            updateProfile,
            TourManager,
            MotionUtils,
            UI,
            startSinglePlayerGame: gameFlow.startSinglePlayerGame,
            onCompleteBootstrap: async () => {
                if (auth.currentUser) {
                    await handleAuthStateChange(auth.currentUser);
                }
    },
    // storage deps for avatar upload
    storage,
    storageRef,
    uploadBytes,
    getDownloadURL
});

// Rebind onboarding start button to the real manager (created after eventSetup initialization)
document.getElementById('start-onboarding')?.addEventListener('click', () => {
    try { OnboardingManager?.start?.(); } catch { /* ignore */ }
});

// ===========================================
// Application Bootstrap
// ===========================================
function bootstrap() {
    console.log('Stonedoku starting...');
    
    // Initialize cookie consent first
    CookieConsent.init?.();
    
    // Initialize accessibility features (ARIA labels, screen reader)
    AccessibilityManager.init?.();
    
    // Initialize Audio System
    AudioManager.init?.();

    // Initialize updates center and admin console
    UpdatesCenter.init?.();
    AdminConsole.init?.();
    
    // Set up event listeners
    eventSetup.setup();
    
    // Listen for auth state changes
    onAuthStateChanged(auth, handleAuthStateChange);
    
    // Handle password reset URLs
    PasswordReset.hydrateFromUrl();
    
    console.log('Stonedoku initialized');
}

// ===========================================
// Global Exports (for debugging and legacy support)
// ===========================================
window.Stonedoku = {
    AppState,
    firebase: {
        app: firebaseApp,
        auth,
        rtdb,
        firestore,
        functions,
        storage
    },
    Managers: {
        PresenceManager,
        ProfileManager,
        FriendsManager,
        LobbyManager,
        MatchManager,
        ChatManager,
        ChallengeManager: ChallengeSystemManager,
        ChallengeSystemManager,
        AudioManager,
        ViewManager,
        GameUi,
        GameHelpers,
        UI,
        TourManager,
        OnboardingManager,
        PasswordReset,
        UpdatesCenter,
        AdminConsole,
        CreativeFeatures,
        AccessibilityManager,
        MotionUtils,
        ArchitecturalStateManager
    },
    Utils: {
        getCurrentDisplayName,
        isRegisteredUser,
        PasswordPolicy,
        SudokuGenerator,
        ProfanityFilter
    }
};

// Legacy global exports (for backward compatibility)
window.AppState = AppState;
window.ViewManager = ViewManager;
window.UI = UI;
window.ProfileManager = ProfileManager;
window.PresenceManager = PresenceManager;

// Game functions for E2E tests and legacy support
window.startSinglePlayerGame = gameFlow.startSinglePlayerGame;
window.handleRoomUpdate = gameFlow.handleRoomUpdate;
window.quitGame = gameFlow.quitGame;
window.navigateCell = gameFlow.navigateCell;
window.cleanupAfterMatch = gameFlow.cleanupAfterMatch;

// ===========================================
// Start Application
// ===========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
