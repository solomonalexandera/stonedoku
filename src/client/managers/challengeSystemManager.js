/**
 * Challenge System Manager - handles player challenges
 */
export function createChallengeSystemManager({ rtdb, ref, set, remove, serverTimestamp, onChildAdded, update, AppState, LobbyManager, PresenceManager, ViewManager, UI, handleRoomUpdate }) {
    return {
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
                    if (callback) {
                        await callback(snapshot.key, snapshot.val());
                    }
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
}
