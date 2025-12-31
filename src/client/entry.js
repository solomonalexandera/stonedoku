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
import { ensureAppVersionFresh } from './lib/versionManager.js';

// Managers
import { createPresenceManager } from './managers/presenceManager.js';
import { createProfileManager } from './managers/profileManager.js';
import { createFriendsManager } from './managers/friendsManager.js';
import { createLobbyManager } from './managers/lobbyManager.js';
import { createMatchManager } from './managers/matchManager.js';
import { createChatManager } from './managers/chatManager.js';
import { createChallengeManager } from './managers/challengeManager.js';
import { createChallengeSystem } from './managers/challengeSystem.js';
import { createLogManager } from './managers/logManager.js';
import { AudioManager } from './managers/audioManager.js';
import { MotionSystem } from './managers/motionSystem.js';
import { createArchitecturalStateSystem } from './managers/architecturalStateSystem.js';
import { createCreativeFeatures, CreativeFeatures } from './managers/creativeFeatures.js';
import { createAccessibilityManager, AccessibilityManager } from './managers/accessibilityManager.js';

// UI
import { createViewManager } from './managers/viewManager.js';
import { createUiHelpers } from './ui/uiHelpers.js';
import { createUiCore } from './ui/uiCore.js';
import { createGameHelpers } from './ui/gameHelpers.js';
import { createGameUi } from './ui/gameUi.js';
import { BoardIntegritySystem } from './ui/boardIntegrity.js';
import { createPasswordReset } from './ui/passwordReset.js';
import { createTourSystem } from './managers/tourSystem.js';
import { createCookieConsent, CookieConsent } from './ui/cookieConsent.js';
import { createLegalModals, LegalModals } from './ui/legalModals.js';
import { createUpdatesCenter, UpdatesCenter } from './ui/updatesCenter.js';
import { createAdminConsole, AdminConsole } from './ui/adminConsole.js';
import { createFloatingChat } from './ui/floatingChat.js';
import { createProfilePage, handleVanityUrl, handleUpdatesUrl, handleAdminUrl } from './ui/profilePage.js';

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
const PresenceSystem = createPresenceManager({ rtdb, appState: AppState });
const ProfileManager = createProfileManager({
    firestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs,
    onSnapshot, arrayUnion, arrayRemove, runFsTransaction, fsServerTimestamp, storage, storageRef,
    uploadBytes, getDownloadURL, rtdb, ref, update, serverTimestamp, AppState
});
const FriendsManager = createFriendsManager({
    AppState, ProfileManager, UI: null // Will be set after UI is created
});
const LobbyManager = createLobbyManager({ rtdb, appState: AppState });
const MatchManager = createMatchManager({ rtdb, appState: AppState });
const ChatManager = createChatManager({ rtdb, firestore, appState: AppState, profanityFilter: ProfanityFilter });
const ChallengeManager = createChallengeManager({ rtdb, lobbyManager: LobbyManager, appState: AppState });
const LogManager = createLogManager(firestore, () => AppState);
const ArchitecturalStateSystem = createArchitecturalStateSystem({ AppState, MotionSystem });

// ===========================================
// Initialize UI Components
// ===========================================
const ViewManager = createViewManager({ AppState, MotionSystem, ArchitecturalStateSystem });
const UiHelpers = createUiHelpers({
    firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
    onSnapshot, limit, fsServerTimestamp, orderBy, arrayUnion, arrayRemove,
    rtdb, ref, get, onValue, onChildAdded, update, serverTimestamp, remove,
    storage, storageRef, uploadBytes, getDownloadURL,
    AppState, ViewManager, ProfileManager, PresenceSystem, LobbyManager, MatchManager, ChatManager, AudioManager,
    MotionSystem, ArchitecturalStateSystem, BoardIntegritySystem,
    SudokuGenerator, ProfanityFilter, httpsCallable, functions
});
const UI = createUiCore({
    getProfile: (uid) => ProfileManager.getProfile(uid),
    rtdb, dbRef: ref, dbGet: get
});
const GameHelpers = createGameHelpers({ AppState, BoardIntegritySystem });
const GameUi = createGameUi({
    AppState, ViewManager, AudioManager, SudokuGenerator, BoardIntegritySystem, GameHelpers,
    PresenceSystem, MatchManager, ProfileManager, UI, rtdb, ref, update
});

// Wire up FriendsManager.UI
FriendsManager.UI = UI;

const PasswordReset = createPasswordReset({
    auth, verifyPasswordResetCode, confirmPasswordReset, sendPasswordResetEmail,
    AppState, ViewManager
});
const TourSystem = createTourSystem({
    AppState, ViewManager, UI, firestore, doc, updateDoc, serverTimestamp: fsServerTimestamp, CookieConsent
});

// ===========================================
// Challenge System
// ===========================================
let handleRoomUpdate; // Forward declaration
const ChallengeSystem = createChallengeSystem({
    rtdb, ref, set, remove, serverTimestamp,
    AppState, LobbyManager, PresenceSystem, ViewManager, UI,
    handleRoomUpdate: (...args) => handleRoomUpdate?.(...args)
});

// ===========================================
// Game Flow
// ===========================================
const gameFlow = createGameFlow({
    AppState, ViewManager, GameUi, GameHelpers, SudokuGenerator, AudioManager,
    PresenceSystem, LobbyManager, MatchManager, ChatManager, ProfileManager, UI,
    rtdb, ref, get, update, onValue, onChildAdded, off,
    MotionSystem, ArchitecturalStateSystem, BoardIntegritySystem, CreativeFeatures
});

// Export handleRoomUpdate for ChallengeSystem
handleRoomUpdate = gameFlow.handleRoomUpdate;

// ===========================================
// Helper Functions
// ===========================================
function getCurrentDisplayName() {
    if (AppState.profile?.displayName) return AppState.profile.displayName;
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

// ===========================================
// Floating Chat
// ===========================================
function initFloatingChat() {
    createFloatingChat({
        AppState, ViewManager, UI, AudioManager, ProfileManager, ChatManager, LobbyManager,
        ref, rtdb, get, update, onChildAdded,
        firestore, collection, query, where, limit, getDocs, getDoc, doc, orderBy, documentId,
        isRegisteredUser
    });
}

// ===========================================
// Profile Page
// ===========================================
const ProfilePage = createProfilePage({
    AppState, ViewManager, PresenceSystem, ProfileManager, LobbyManager,
    TourSystem, UI, UpdatesCenter, AdminConsole, isRegisteredUser
});

function initProfilePage() {
    ProfilePage.init();
}

// ===========================================
// Auth State Handler
// ===========================================
const authFlow = createAuthFlow({
    auth, setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
    CookieConsent, AppState
});

async function handleAuthStateChange(user) {
    console.log('Auth state changed:', user?.uid || 'signed out');
    
    if (user) {
        AppState.currentUser = user;
        
        // Configure persistence based on cookie consent
        await authFlow.configureAuthPersistence();
        
        // Load profile
        try {
            const profileSnap = await ProfileManager.getProfile(user.uid);
            if (profileSnap.exists()) {
                AppState.profile = profileSnap.data();
                applyProfileModeration(AppState, AppState.profile);
            } else if (!user.isAnonymous) {
                // Create profile for new registered users
                const displayName = AppState.pendingUsername || user.displayName || authFlow.getFallbackDisplayName(user);
                await ProfileManager.createOrUpdateProfile(user.uid, {
                    displayName,
                    username: AppState.pendingUsername || displayName,
                    email: user.email
                });
                AppState.pendingUsername = null;
            }
        } catch (e) {
            console.error('Failed to load profile:', e);
        }
        
        // Initialize presence
        PresenceSystem.init(user.uid, getCurrentDisplayName());
        
        // Enable DM for registered users
        window.ChatWidget?.setDmEnabled?.(isRegisteredUser());
        
        // Load friends
        if (isRegisteredUser()) {
            try {
                AppState.friends = await ProfileManager.loadFriends(user.uid);
                FriendsManager.refresh();
            } catch (e) {
                console.warn('Failed to load friends:', e);
            }
        }
        
        // Show lobby
        ViewManager.show('lobby');
        PresenceSystem.updateActivity('In Lobby');
        
    } else {
        // Signed out
        AppState.currentUser = null;
        AppState.profile = null;
        AppState.friends = [];
        PresenceSystem.cleanup();
        window.ChatWidget?.reset?.();
        ViewManager.show('auth');
    }
    
    AppState.authReady = true;
}

// ===========================================
// Event Setup
// ===========================================
const eventSetup = createEventSetup({
    // Firebase
    auth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    updateProfile, signOut, deleteUser, deleteDoc, doc, firestore, rtdb, ref, get, update,
    // State & Managers
    AppState, ViewManager, PresenceSystem, ProfileManager, LobbyManager, MatchManager, ChatManager,
    GameUi, GameHelpers, AudioManager, UI, ChallengeSystem,
    // Utilities
    PasswordPolicy, PasswordReset, CookieConsent, OnboardingSystem: null, TourSystem,
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
// Application Bootstrap
// ===========================================
function bootstrap() {
    console.log('Stonedoku starting...');
    
    // Initialize cookie consent first
    CookieConsent.init?.();
    
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
    Managers: {
        PresenceSystem,
        ProfileManager,
        FriendsManager,
        LobbyManager,
        MatchManager,
        ChatManager,
        ChallengeManager,
        ChallengeSystem,
        AudioManager,
        ViewManager,
        GameUi,
        GameHelpers,
        UI,
        TourSystem,
        PasswordReset,
        UpdatesCenter,
        AdminConsole,
        CreativeFeatures,
        AccessibilityManager
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
window.PresenceSystem = PresenceSystem;

// ===========================================
// Start Application
// ===========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
