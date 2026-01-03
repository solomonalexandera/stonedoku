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
            try {
                const reqQ = query(
                    collection(firestore, 'friendRequests'),
                    where('toUid', '==', appState.currentUser.uid),
                    where('status', '==', 'pending'),
                    limit(30)
                );
                const snap = await getDocs(reqQ);
                incomingRequests = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
            } catch (e) {
                console.warn('Failed to load incoming friend requests', e);
            }

            const UI = resolveUI();

            const requestIds = incomingRequests.map((r) => r?.fromUid).filter(Boolean);
            const requestProfiles = await pm.getProfiles(requestIds);
            requestsList.innerHTML = '';
            if (requestProfiles.length === 0) {
                requestsList.innerHTML = '<div class="friend-empty">No incoming requests.</div>';
            } else {
                for (const r of requestProfiles) {
                    const name = r.data?.displayName || r.data?.username || `Player_${String(r.id).substring(0, 6)}`;
                    const row = document.createElement('div');
                    row.className = 'friend-item';
                    row.dataset.userId = r.id;
                    row.innerHTML = `
                    <div class="friend-name">${UI?.escapeHtml?.(name) || name}</div>
                    <div class="friend-actions">
                        <button class="btn btn-icon accept-request" type="button" title="Accept"><svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg></button>
                        <button class="btn btn-icon decline-request" type="button" title="Decline"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
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
                    } catch (e) {
                        console.error('Failed to accept friend request', e);
                        UI?.showToast?.('Failed to accept request.', 'error');
                    }
                } else if (btn.classList.contains('decline-request')) {
                    try {
                        await pm.declineFriendRequest(appState.currentUser.uid, userId);
                        await this.refresh();
                    } catch (e) {
                        console.error('Failed to decline friend request', e);
                        UI?.showToast?.('Failed to decline request.', 'error');
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
