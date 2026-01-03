import { AppState } from '../core/appState.js';
import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export function createFriendsManager({
    firestore,
    profileManager,
    appState = AppState,
    isRegisteredUser = () => true,
    getUI = () => globalThis.UI,
    getChatWidget = () => globalThis.ChatWidget
} = {}) {
    if (!firestore) throw new Error('createFriendsManager: firestore required');
    const pm = profileManager;
    const resolveUI = () => (typeof getUI === 'function' ? getUI() : getUI) || globalThis.UI;
    const resolveChatWidget = () => (typeof getChatWidget === 'function' ? getChatWidget() : getChatWidget) || globalThis.ChatWidget;

    let unsubscribeProfile = null;
    let delegationBound = false;

    return {
        startRealtime() {
            if (!appState.currentUser || !onSnapshot || !doc) return;
            if (unsubscribeProfile) unsubscribeProfile();
            const profileRef = doc(firestore, 'users', appState.currentUser.uid);
            unsubscribeProfile = onSnapshot(profileRef, (snap) => {
                if (!snap?.exists?.()) return;
                const data = snap.data() || {};
                appState.profile = data;
                appState.friends = Array.isArray(data.friends) ? data.friends : [];
                
                // Update UI stats when profile changes
                const UI = resolveUI();
                if (UI?.updateStats) {
                    UI.updateStats(data.stats || { wins: 0, losses: 0 });
                }
                
                this.render();
            });
        },

        stopRealtime() {
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }
        },

        async refresh() {
            if (!appState.currentUser) return;
            try {
                const snap = await pm.getProfile(appState.currentUser.uid);
                if (snap.exists()) {
                    const data = snap.data() || {};
                    appState.profile = data;
                    appState.friends = Array.isArray(data.friends) ? data.friends : [];
                }
            } catch (e) {
                console.warn('Failed to refresh profile for friends manager', e);
            }
            await this.render();
        },

        async render() {
            const card = document.getElementById('friends-card');
            const requestsList = document.getElementById('friend-requests-list');
            const friendsList = document.getElementById('friends-list');
            if (!card || !requestsList || !friendsList) return;

            // Setup event delegation once
            if (!delegationBound) {
                this._setupEventDelegation(requestsList, friendsList);
                delegationBound = true;
            }

            if (!isRegisteredUser(appState.currentUser, appState.profile)) {
                card.style.display = 'none';
                return;
            }
            card.style.display = 'block';

            const friends = Array.isArray(appState.friends) ? appState.friends : [];
            let incomingRequests = [];
            let outgoingRequests = [];
            
            try {
                // Load incoming requests
                const incomingQ = query(
                    collection(firestore, 'friendRequests'),
                    where('toUid', '==', appState.currentUser.uid),
                    where('status', '==', 'pending'),
                    limit(30)
                );
                const incomingSnap = await getDocs(incomingQ);
                incomingRequests = incomingSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}), direction: 'incoming' }));
                
                // Load outgoing requests
                const outgoingQ = query(
                    collection(firestore, 'friendRequests'),
                    where('fromUid', '==', appState.currentUser.uid),
                    where('status', '==', 'pending'),
                    limit(30)
                );
                const outgoingSnap = await getDocs(outgoingQ);
                outgoingRequests = outgoingSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}), direction: 'outgoing' }));
            } catch (e) {
                console.warn('Failed to load friend requests', e);
            }

            const UI = resolveUI();

            // Render incoming and outgoing requests
            const incomingIds = incomingRequests.map((r) => r?.fromUid).filter(Boolean);
            const outgoingIds = outgoingRequests.map((r) => r?.toUid).filter(Boolean);
            const allRequestIds = [...incomingIds, ...outgoingIds];
            const requestProfiles = await pm.getProfiles(allRequestIds);
            const profilesMap = new Map(requestProfiles.map(p => [p.id, p]));
            
            requestsList.innerHTML = '';
            const totalRequests = incomingRequests.length + outgoingRequests.length;
            
            if (totalRequests === 0) {
                requestsList.innerHTML = '<div class="friend-empty">No pending requests.</div>';
            } else {
                // Show incoming requests first
                for (const req of incomingRequests) {
                    const profile = profilesMap.get(req.fromUid);
                    const name = profile?.data?.displayName || profile?.data?.username || `Player_${String(req.fromUid).substring(0, 6)}`;
                    const row = document.createElement('div');
                    row.className = 'friend-item';
                    row.dataset.userId = req.fromUid;
                    row.innerHTML = `
                        <div class="friend-name">${UI?.escapeHtml?.(name) || name}</div>
                        <div class="friend-actions">
                            <button class="btn btn-icon accept-request" type="button" title="Accept"><svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg></button>
                            <button class="btn btn-icon decline-request" type="button" title="Decline"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
                        </div>
                    `;
                    requestsList.appendChild(row);
                }
                
                // Show outgoing requests
                for (const req of outgoingRequests) {
                    const profile = profilesMap.get(req.toUid);
                    const name = profile?.data?.displayName || profile?.data?.username || `Player_${String(req.toUid).substring(0, 6)}`;
                    const row = document.createElement('div');
                    row.className = 'friend-item friend-item-outgoing';
                    row.dataset.userId = req.toUid;
                    row.innerHTML = `
                        <div class="friend-name">${UI?.escapeHtml?.(name) || name} <span class="friend-status">(sent)</span></div>
                        <div class="friend-actions">
                            <button class="btn btn-icon cancel-request" type="button" title="Cancel request"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
                        </div>
                    `;
                    requestsList.appendChild(row);
                }
            }

            const friendProfiles = await pm.getProfiles(friends);
            friendsList.innerHTML = '';
            if (friendProfiles.length === 0) {
                friendsList.innerHTML = '<div class="friend-empty">No friends yet.</div>';
            } else {
                for (const f of friendProfiles) {
                    const name = f.data?.displayName || f.data?.username || `Player_${String(f.id).substring(0, 6)}`;
                    const row = document.createElement('div');
                    row.className = 'friend-item';
                    row.dataset.userId = f.id;
                    row.innerHTML = `
                    <div class="friend-name">${UI?.escapeHtml?.(name) || name}</div>
                    <div class="friend-actions">
                        <button class="btn btn-icon view-profile" type="button" title="Profile"><svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg></button>
                        <button class="btn btn-icon send-message" type="button" title="Message"><svg class="ui-icon" aria-hidden="true"><use href="#i-chat"></use></svg></button>
                        <button class="btn btn-icon remove-friend" type="button" title="Remove"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
                    </div>
                `;
                    friendsList.appendChild(row);
                }
            }
        },

        _setupEventDelegation(requestsList, friendsList) {
            // Friend requests delegation
            requestsList.addEventListener('click', async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const row = btn.closest('.friend-item');
                const userId = row?.dataset.userId;
                if (!userId) return;

                const UI = resolveUI();

                if (btn.classList.contains('accept-request')) {
                    try {
                        await pm.acceptFriendRequest(appState.currentUser.uid, userId);
                        await this.refresh();
                        UI?.showToast?.('Friend request accepted!', 'success');
                    } catch (e) {
                        console.error('Failed to accept friend request', e);
                        UI?.showToast?.('Failed to accept request.', 'error');
                    }
                } else if (btn.classList.contains('decline-request')) {
                    try {
                        await pm.declineFriendRequest(appState.currentUser.uid, userId);
                        await this.refresh();
                        UI?.showToast?.('Friend request declined.', 'info');
                    } catch (e) {
                        console.error('Failed to decline friend request', e);
                        UI?.showToast?.('Failed to decline request.', 'error');
                    }
                } else if (btn.classList.contains('cancel-request')) {
                    try {
                        await pm.cancelFriendRequest(appState.currentUser.uid, userId);
                        await this.refresh();
                        UI?.showToast?.('Friend request cancelled.', 'info');
                    } catch (e) {
                        console.error('Failed to cancel friend request', e);
                        UI?.showToast?.('Failed to cancel request.', 'error');
                    }
                }
            });

            // Friends list delegation
            friendsList.addEventListener('click', async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const row = btn.closest('.friend-item');
                const userId = row?.dataset.userId;
                if (!userId) return;

                const UI = resolveUI();

                if (btn.classList.contains('view-profile')) {
                    UI?.showProfilePage?.(userId);
                } else if (btn.classList.contains('send-message')) {
                    try {
                        await resolveChatWidget()?.openDm?.(userId);
                    } catch (e) {
                        console.warn('Failed to open DM from friends panel', e);
                    }
                } else if (btn.classList.contains('remove-friend')) {
                    const confirmed = await (UI?.confirm ? UI.confirm('Remove this friend?') : Promise.resolve(confirm('Remove this friend?')));
                    if (!confirmed) return;
                    try {
                        await pm.removeFriend(appState.currentUser.uid, userId);
                        await this.refresh();
                        UI?.showToast?.('Friend removed.', 'info');
                    } catch (e) {
                        console.error('Failed to remove friend', e);
                        UI?.showToast?.('Failed to remove friend.', 'error');
                    }
                }
            });
        }
    };
}
