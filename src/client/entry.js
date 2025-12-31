// src/client/entry.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getFirestore, initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

import { AppState } from './appState.js';
import { createLogManager } from './managers/logManager.js';
import { SudokuGenerator } from './lib/sudokuGenerator.js';
import { ProfanityFilter } from './lib/profanityFilter.js';

// Firebase Configuration
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
const firestore = initializeFirestore(firebaseApp, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
});
const functions = getFunctions(firebaseApp);
const storage = getStorage(firebaseApp);

// Initialize LogManager
const LogManager = createLogManager(firestore, () => AppState);

// Publish a single global namespace used by app.js and tests
const firebaseServices = {
    app: firebaseApp,
    auth,
    rtdb,
    firestore,
    functions,
    storage
};

const existing = window.Stonedoku || {};
window.Stonedoku = {
    ...existing,
    AppState,
    LogManager,
    SudokuGenerator,
    ProfanityFilter,
    firebase: firebaseServices
};

// Legacy globals maintained for backward compatibility
window.AppState = AppState;
window.LogManager = LogManager;
window.SudokuGenerator = SudokuGenerator;
window.ProfanityFilter = ProfanityFilter;
window.firebase = firebaseServices;

console.log("Stonedoku application entry point loaded.");
