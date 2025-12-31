import { AppState } from '../core/appState.js';
import {
    onChildAdded,
    ref,
    remove,
    serverTimestamp,
    set,
    update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

export function createChallengeManager({ rtdb, lobbyManager, appState = AppState } = {}) {
    if (!rtdb) throw new Error('createChallengeManager: rtdb required');
    if (!lobbyManager) throw new Error('createChallengeManager: lobbyManager required');

    return {
        async sendChallenge(fromUserId, fromName, toUserId) {
            const notificationRef = ref(rtdb, `notifications/${toUserId}/${fromUserId}`);
            await set(notificationRef, {
                type: 'challenge',
                from: fromUserId,
                fromName,
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
            appState.listeners.push({ ref: notificationsRef, callback: listener });
            return listener;
        },

        async acceptChallenge(acceptingUserId, acceptingName, challengerId) {
            const code = await lobbyManager.createRoom(acceptingUserId, acceptingName);

            const acceptedPayload = {
                type: 'challenge',
                from: acceptingUserId,
                fromName: acceptingName,
                timestamp: serverTimestamp(),
                status: 'accepted',
                roomCode: code
            };

            await set(ref(rtdb, `notifications/${challengerId}/${acceptingUserId}`), acceptedPayload);
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
}
