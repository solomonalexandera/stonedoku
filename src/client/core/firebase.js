/**
 * Firebase initialization and service instances
 */
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
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration
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

// Export all services
export {
    // Firebase instances
    firebaseApp,
    auth,
    rtdb,
    firestore,
    functions,
    storage,
    
    // Auth methods
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
    sendPasswordResetEmail,
    
    // Functions methods
    httpsCallable,
    
    // RTDB methods
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
    goOnline,
    
    // Firestore methods
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
    runFsTransaction,
    Timestamp,
    fsServerTimestamp,
    addDoc,
    
    // Storage methods
    storageRef,
    uploadBytes,
    getDownloadURL
};
