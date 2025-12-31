import { AppState } from '../core/appState.js';
import { collection, getDocs, limit, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

    return {
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

            if (!isRegisteredUser()) {
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
                    const name = r.data?.username || r.data?.displayName || `Player_${String(r.id).substring(0, 6)}`;
                    const row = document.createElement('div');
                    row.className = 'friend-item';
                    row.innerHTML = `
                    <div class="friend-name">${UI?.escapeHtml?.(name) || name}</div>
                    <div class="friend-actions">
                        <button class="btn btn-icon" type="button" title="Accept"><svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg></button>
                        <button class="btn btn-icon" type="button" title="Decline"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
                    </div>
                `;
                    const [acceptBtn, declineBtn] = row.querySelectorAll('button');
                    acceptBtn?.addEventListener('click', async () => {
                        try {
                            await pm.acceptFriendRequest(appState.currentUser.uid, r.id);
                            await this.refresh();
                        } catch (e) {
                            console.error('Failed to accept friend request', e);
                            alert('Failed to accept request.');
                        }
                    });
                    declineBtn?.addEventListener('click', async () => {
                        try {
                            await pm.declineFriendRequest(appState.currentUser.uid, r.id);
                            await this.refresh();
                        } catch (e) {
                            console.error('Failed to decline friend request', e);
                            alert('Failed to decline request.');
                        }
                    });
                    requestsList.appendChild(row);
                }
            }

            const friendProfiles = await pm.getProfiles(friends);
            friendsList.innerHTML = '';
            if (friendProfiles.length === 0) {
                friendsList.innerHTML = '<div class="friend-empty">No friends yet.</div>';
            } else {
                for (const f of friendProfiles) {
                    const name = f.data?.username || f.data?.displayName || `Player_${String(f.id).substring(0, 6)}`;
                    const row = document.createElement('div');
                    row.className = 'friend-item';
                    row.innerHTML = `
                    <div class="friend-name">${UI?.escapeHtml?.(name) || name}</div>
                    <div class="friend-actions">
                        <button class="btn btn-icon" type="button" title="Profile"><svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg></button>
                        <button class="btn btn-icon" type="button" title="Message"><svg class="ui-icon" aria-hidden="true"><use href="#i-chat"></use></svg></button>
                        <button class="btn btn-icon" type="button" title="Remove"><svg class="ui-icon" aria-hidden="true"><use href="#i-x"></use></svg></button>
                    </div>
                `;
                    const [profileBtn, messageBtn, removeBtn] = row.querySelectorAll('button');
                    profileBtn?.addEventListener('click', () => UI?.showProfilePage?.(f.id));
                    messageBtn?.addEventListener('click', async () => {
                        try {
                            await resolveChatWidget()?.openDm?.(f.id);
                        } catch (e) {
                            console.warn('Failed to open DM from friends panel', e);
                        }
                    });
                    removeBtn?.addEventListener('click', async () => {
                        if (!confirm('Remove this friend?')) return;
                        try {
                            await pm.removeFriend(appState.currentUser.uid, f.id);
                            await this.refresh();
                        } catch (e) {
                            console.error('Failed to remove friend', e);
                            alert('Failed to remove friend.');
                        }
                    });
                    friendsList.appendChild(row);
                }
            }
        }
    };
}
