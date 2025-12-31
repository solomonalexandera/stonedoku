import { AppState } from '../core/appState.js';
import { ProfanityFilter } from '../lib/profanityFilter.js';
import {
    addDoc,
    collection,
    doc,
    setDoc,
    serverTimestamp as fsServerTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    get,
    limitToLast,
    onChildAdded,
    onValue,
    push,
    query,
    ref,
    runTransaction,
    serverTimestamp,
    set,
    update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

export function createChatManager({ rtdb, firestore, appState = AppState, profanityFilter = ProfanityFilter } = {}) {
    if (!rtdb) throw new Error('createChatManager: rtdb required');
    if (!firestore) throw new Error('createChatManager: firestore required');

    const state = {
        participantsEnsured: new Set()
    };

    return {
        dmIdFor(userA, userB) {
            return [userA, userB].sort().join('_');
        },

        async ensureDmParticipants(dmId, userA, userB) {
            try {
                if (!dmId || !userA || !userB) return;
                if (state.participantsEnsured.has(dmId)) return;
                const [a, b] = [userA, userB].sort();
                const participantsRef = ref(rtdb, `dmParticipants/${dmId}`);
                try {
                    await set(participantsRef, { a, b });
                } catch { /* ignore */ }
                try {
                    await setDoc(doc(firestore, 'dmParticipants', dmId), { participants: [a, b] });
                } catch (e) {
                    console.warn('Failed to write dmParticipants to Firestore', e);
                }
                state.participantsEnsured.add(dmId);
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

            const safeToName = toDisplayName || appState.dmThreads?.[toUserId]?.otherDisplayName || `Player_${toUserId.substring(0, 6)}`;
            const safeFromName = fromDisplayName || `Player_${fromUserId.substring(0, 6)}`;

            await update(senderThreadRef, {
                otherDisplayName: safeToName,
                lastText: preview,
                lastTimestamp: now,
                lastFrom: fromUserId,
                unread: 0
            });

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
            const filteredText = profanityFilter.filter(text);
            const chatRef = ref(rtdb, 'globalChat');

            let pushRef = null;
            try {
                pushRef = await push(chatRef, {
                    userId,
                    displayName,
                    text: filteredText,
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.warn('RTDB push for global chat failed', e);
            }

            try {
                await addDoc(collection(firestore, 'globalChat'), {
                    userId,
                    displayName,
                    text: filteredText,
                    rtdbKey: pushRef?.key || null,
                    timestamp: fsServerTimestamp()
                });
            } catch (e) {
                console.warn('Failed to write global chat message to Firestore', e);
            }

            return { type: 'global' };
        },

        async sendDirectMessage(fromUserId, fromDisplayName, toUserId, text, toDisplayName = null) {
            const filteredText = profanityFilter.filter(text);
            const dmId = this.dmIdFor(fromUserId, toUserId);
            const dmRef = ref(rtdb, `directMessages/${dmId}`);

            await this.ensureDmParticipants(dmId, fromUserId, toUserId);

            let pushRef = null;
            try {
                pushRef = await push(dmRef, {
                    from: fromUserId,
                    fromDisplayName,
                    to: toUserId,
                    text: filteredText,
                    timestamp: serverTimestamp(),
                    read: false
                });
            } catch (e) {
                console.warn('RTDB push for DM failed', e);
            }

            try {
                await addDoc(collection(firestore, 'directMessages', dmId, 'messages'), {
                    from: fromUserId,
                    fromDisplayName,
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
        },

        listenToDirectMessages(dmId, callback) {
            const dmRef = ref(rtdb, `directMessages/${dmId}`);
            const listener = onChildAdded(dmRef, (snapshot) => {
                callback(snapshot.val());
            });
            appState.listeners.push({ ref: dmRef, callback: listener });
            return listener;
        },

        listenToGlobalChat(callback) {
            const chatRef = ref(rtdb, 'globalChat');
            const seenKeys = new Set();
            get(query(chatRef, limitToLast(50))).then((snapshot) => {
                const initialMessages = [];
                snapshot.forEach((child) => {
                    seenKeys.add(child.key);
                    initialMessages.push(child.val());
                });
                initialMessages.forEach(callback);
            }).catch(e => console.warn('Failed to load initial global chat messages', e));

            const listener = onChildAdded(chatRef, (snapshot) => {
                if (seenKeys.has(snapshot.key)) return;
                seenKeys.add(snapshot.key);
                callback(snapshot.val());
            });

            appState.listeners.push({ ref: chatRef, callback: listener });
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
            appState.listeners.push({ ref: threadsRef, callback: listener });
            return listener;
        },

        async sendGameMessage(matchId, userId, displayName, text) {
            const filteredText = profanityFilter.filter(text);
            const chatRef = ref(rtdb, `matches/${matchId}/chat`);

            await push(chatRef, {
                userId,
                displayName,
                text: filteredText,
                timestamp: serverTimestamp()
            });
        },

        listenToGameChat(matchId, callback) {
            const chatRef = ref(rtdb, `matches/${matchId}/chat`);
            const listener = onChildAdded(chatRef, (snapshot) => {
                callback(snapshot.val());
            });
            appState.listeners.push({ ref: chatRef, callback: listener });
            return listener;
        }
    };
}
