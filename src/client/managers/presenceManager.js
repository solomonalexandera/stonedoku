import { AppState } from '../appState.js';
import {
    onValue,
    onDisconnect,
    ref,
    remove,
    serverTimestamp,
    set,
    update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

export function createPresenceManager({ rtdb, appState = AppState } = {}) {
    if (!rtdb) throw new Error('createPresenceManager: rtdb required');

    const state = {
        presenceRef: null,
        connectedRef: null,
        _ready: false,
        _readyPromise: null
    };

    return {
        async init(userId, displayName) {
            state.presenceRef = ref(rtdb, `presence/${userId}`);
            state.connectedRef = ref(rtdb, '.info/connected');
            state._ready = false;

            let resolveReady;
            state._readyPromise = new Promise((resolve) => { resolveReady = resolve; });

            onValue(state.connectedRef, async (snapshot) => {
                if (snapshot.val() === true) {
                    try {
                        await set(state.presenceRef, {
                            status: 'online',
                            displayName: displayName,
                            last_changed: serverTimestamp(),
                            current_activity: 'In Lobby'
                        });
                        state._ready = true;
                    } catch (e) {
                        state._ready = false;
                        console.warn('Presence init write failed', e);
                    } finally {
                        try { resolveReady?.(); } catch { /* ignore */ }
                    }

                    try {
                        onDisconnect(state.presenceRef).set({
                            status: 'offline',
                            displayName: displayName,
                            last_changed: serverTimestamp(),
                            current_activity: null
                        });
                    } catch (e) {
                        console.warn('Presence onDisconnect setup failed', e);
                    }
                }
            });
        },

        async updateActivity(activity) {
            if (!state.presenceRef || !appState.currentUser) return;
            try { await state._readyPromise; } catch { /* ignore */ }
            if (!state._ready) return;
            try {
                await update(state.presenceRef, {
                    current_activity: activity,
                    last_changed: serverTimestamp()
                });
            } catch (e) {
                console.warn('Presence updateActivity failed', e);
            }
        },

        async setStatus(status) {
            if (!state.presenceRef || !appState.currentUser) return;
            try { await state._readyPromise; } catch { /* ignore */ }
            if (!state._ready) return;
            try {
                await update(state.presenceRef, {
                    status: status,
                    last_changed: serverTimestamp()
                });
            } catch (e) {
                console.warn('Presence setStatus failed', e);
            }
        },

        listenToOnlinePlayers(callback) {
            const presenceListRef = ref(rtdb, 'presence');
            const listener = onValue(presenceListRef, (snapshot) => {
                const players = {};
                const now = Date.now();
                const graceMs = 45000;
                snapshot.forEach((child) => {
                    if (child.key === appState.currentUser?.uid) return;
                    const val = child.val() || {};
                    const lastChanged = val.last_changed || 0;
                    const isRecentlyActive = typeof lastChanged === 'number' ? (now - lastChanged) < graceMs : true;
                    const effectiveStatus = (val.status === 'online' && isRecentlyActive) ? 'online' : 'offline';
                    players[child.key] = Object.assign({}, val, { status: effectiveStatus });
                });
                callback(players);
            });
            appState.listeners.push({ ref: presenceListRef, callback: listener });
        },

        async cleanup() {
            if (!state.presenceRef) return;
            try {
                await remove(state.presenceRef);
            } catch (e) {
                console.warn('Presence cleanup failed', e);
            } finally {
                state._ready = false;
            }
        }
    };
}
