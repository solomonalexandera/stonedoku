/**
 * Challenge System Manager - handles player challenges
 */
export function createChallengeSystemManager({ rtdb, ref, set, remove, serverTimestamp, onChildAdded, update, AppState, LobbyManager, PresenceManager, ViewManager, UI, handleRoomUpdate }) {
    return {
        async sendChallenge(fromUserId, fromName, toUserId) {
            // Use a unique ID for the notification to avoid overwriting other notifications
            // and to comply with the new database rules structure
            const notificationId = `challenge_${fromUserId}`;
            const notificationRef = ref(rtdb, `notifications/${toUserId}/${notificationId}`);
            
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
            const attachedAt = Date.now();
            const STALE_THRESHOLD_MS = 30000; // 30 seconds - ignore notifications older than this on page load
            
            const listener = onChildAdded(notificationsRef, async (snapshot) => {
                const data = snapshot.val();
                
                // Check if notification is stale (from before we attached the listener)
                // This prevents re-processing old notifications on page refresh
                let notificationTime = 0;
                if (data?.timestamp) {
                    notificationTime = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
                }
                const isStale = notificationTime > 0 && (attachedAt - notificationTime) > STALE_THRESHOLD_MS;
                
                // Always remove the notification from database
                try { 
                    await remove(snapshot.ref); 
                } catch (err) { 
                    console.warn('Failed to clear notification', err); 
                }
                
                // Only process if not stale
                if (isStale) {
                    console.log('Skipping stale notification:', snapshot.key);
                    return;
                }
                
                try {
                    if (callback) {
                        await callback(snapshot.key, data);
                    }
                } catch (e) {
                    console.warn('Notification callback failed', e);
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
            const notificationId = `challenge_accept_${acceptingUserId}`;
            await set(ref(rtdb, `notifications/${challengerId}/${notificationId}`), acceptedPayload);
            // Keep a copy for the acceptor too (useful for debugging / multi-device)
            // Note: This update might fail if the original notification was already deleted
            try {
                await update(ref(rtdb, `notifications/${acceptingUserId}/challenge_${challengerId}`), {
                    status: 'accepted',
                    roomCode: code
                });
            } catch (e) {
                console.warn('Failed to update local challenge status', e);
            }

            return code;
        },
        
        async declineChallenge(acceptingUserId, acceptingName, challengerId) {
            try {
                await remove(ref(rtdb, `notifications/${acceptingUserId}/challenge_${challengerId}`));
            } catch (e) {
                console.warn('Failed to remove challenge notification', e);
            }
            
            const notificationId = `challenge_decline_${acceptingUserId}`;
            await set(ref(rtdb, `notifications/${challengerId}/${notificationId}`), {
                type: 'challenge',
                from: acceptingUserId,
                fromName: acceptingName,
                timestamp: serverTimestamp(),
                status: 'declined'
            });
        }
    };
}
