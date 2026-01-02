import { AppState as defaultAppState } from '../core/appState.js';

const defaultBadgeInfo = {
    rookie: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Rookie' },
    learner: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Learner' },
    veteran: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Veteran' },
    marathoner: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Marathoner' },
    legend: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-crown"></use></svg>', name: 'Legend' },
    winner: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-trophy"></use></svg>', name: 'Winner' },
    champion: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-crown"></use></svg>', name: 'Champion' },
    unstoppable: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-crown"></use></svg>', name: 'Unstoppable' },
    undefeated: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>', name: 'Undefeated' },
    tactician: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-target"></use></svg>', name: 'Tactician' },
    speedster: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-bolt"></use></svg>', name: 'Speedster' },
    socialite: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>', name: 'Socialite' },
    connector: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>', name: 'Connector' },
    ambassador: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>', name: 'Ambassador' },
    storyteller: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-book"></use></svg>', name: 'Storyteller' },
    portrait: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>', name: 'Portrait' },
    warden: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-lock"></use></svg>', name: 'Warden' }
};

export function createUiHelpers({
    AppState = defaultAppState,
    ViewManager = globalThis.ViewManager,
    ProfileManager = globalThis.ProfileManager,
    FriendsManager = globalThis.FriendsManager,
    ChallengeManager = () => globalThis.ChallengeManager,
    BadgeInfo = defaultBadgeInfo,
    isRegisteredUser = globalThis.isRegisteredUser,
    getCurrentDisplayName = globalThis.getCurrentDisplayName,
    rtdb = globalThis.rtdb,
    ref = globalThis.ref,
    get = globalThis.get
} = {}) {
    const resolveChallengeManager = typeof ChallengeManager === 'function'
        ? ChallengeManager
        : () => ChallengeManager;
    const badgeInfo = BadgeInfo || defaultBadgeInfo;
    const ui = {
        badgeInfo,
        hoverTimeout: null,
        miniProfileTimeout: null,
        miniProfileHideTimer: null,

        updatePlayersList(players) {
            const container = document.getElementById('players-list');
            if (!container) return;

            container.innerHTML = '';

            for (const [id, player] of Object.entries(players || {})) {
                if (player.status === 'online') {
                    const item = document.createElement('div');
                    item.className = 'player-item';
                    item.dataset.userId = id;
                    item.innerHTML = `
                        <div class="player-item-info">
                            <span class="player-item-status status-dot ${player.status}"></span>
                            <span class="player-item-name player-name-hoverable" data-user-id="${id}">${ui.escapeHtml(player.displayName || 'Anonymous')}</span>
                        </div>
                        <span class="player-item-activity">${ui.escapeHtml(player.current_activity || '')}</span>
                    `;

                    const nameEl = item.querySelector('.player-name-hoverable');
                    nameEl.addEventListener('mouseenter', (e) => ui.showHoverProfile(e, id, player));
                    nameEl.addEventListener('mouseleave', () => ui.hideHoverProfile());

                    item.addEventListener('click', () => ui.showPlayerProfile(id));
                    container.appendChild(item);
                }
            }

            const onlineCount = Object.values(players || {}).filter(p => p.status === 'online').length;
            const countEl = document.getElementById('online-count');
            if (countEl) countEl.textContent = onlineCount;
        },

        async showHoverProfile(event, userId, basicData) {
            if (ui.hoverTimeout) {
                clearTimeout(ui.hoverTimeout);
            }

            const tooltip = document.getElementById('hover-profile');
            if (!tooltip) return;

            const rect = event.target.getBoundingClientRect();
            tooltip.style.left = `${rect.right + 10}px`;
            tooltip.style.top = `${rect.top - 10}px`;

            if (rect.right + 200 > window.innerWidth) {
                tooltip.style.left = `${rect.left - 200}px`;
            }

            tooltip.querySelector('.hover-profile-name').textContent = basicData?.displayName || 'Anonymous';
            tooltip.querySelector('#hover-activity').textContent = basicData?.current_activity || 'Online';

            // Set up action buttons
            const dmBtn = tooltip.querySelector('#hover-dm-btn');
            const friendBtn = tooltip.querySelector('#hover-friend-btn');
            const actionsDiv = tooltip.querySelector('.hover-profile-actions');
            
            const isSelf = AppState.currentUser && userId === AppState.currentUser.uid;
            const viewerCanSocial = isRegisteredUser?.();
            
            // Fetch profile to check if target is guest
            let targetIsGuest = true;
            try {
                const profile = await ProfileManager?.getProfile?.(userId);
                if (profile?.exists()) {
                    const data = profile.data();
                    targetIsGuest = !data?.email;
                    const wins = data.stats?.wins || 0;
                    const losses = data.stats?.losses || 0;
                    const total = wins + losses;
                    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

                    tooltip.querySelector('#hover-wins').textContent = wins;
                    tooltip.querySelector('#hover-losses').textContent = losses;
                    tooltip.querySelector('#hover-winrate').textContent = `${winrate}%`;
                }
            } catch (e) {
                console.warn('Could not fetch profile for hover:', e);
            }

            const canSocial = viewerCanSocial && !targetIsGuest && !isSelf;

            // Show/hide buttons based on permissions
            if (actionsDiv) {
                actionsDiv.style.display = canSocial ? 'flex' : 'none';
            }

            if (dmBtn && canSocial) {
                // Remove old listener and add new one
                const newDmBtn = dmBtn.cloneNode(true);
                dmBtn.parentNode.replaceChild(newDmBtn, dmBtn);
                newDmBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    ui.hideHoverProfile();
                    try {
                        await window.ChatWidget?.openDm?.(userId);
                    } catch (err) {
                        console.warn('DM open failed:', err);
                    }
                });
            }

            if (friendBtn && canSocial) {
                const newFriendBtn = friendBtn.cloneNode(true);
                friendBtn.parentNode.replaceChild(newFriendBtn, friendBtn);
                newFriendBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    ui.hideHoverProfile();
                    try {
                        const result = await ProfileManager?.sendFriendRequest?.(AppState.currentUser.uid, userId);
                        const accepted = result === 'accepted_existing';
                        ui.showToast(accepted ? 'Friend request accepted.' : 'Friend request sent.', 'success');
                    } catch (err) {
                        console.warn('Friend request failed:', err);
                        ui.showToast(err?.message || 'Failed to send friend request.', 'error');
                    }
                });
            }

            tooltip.style.display = 'block';
            
            // Keep tooltip visible while mouse is over it
            tooltip.onmouseenter = () => {
                if (ui.hoverTimeout) {
                    clearTimeout(ui.hoverTimeout);
                    ui.hoverTimeout = null;
                }
            };
            tooltip.onmouseleave = () => ui.hideHoverProfile();
        },

        hideHoverProfile() {
            ui.hoverTimeout = setTimeout(() => {
                const tooltip = document.getElementById('hover-profile');
                if (tooltip) tooltip.style.display = 'none';
            }, 300);
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        async showPlayerProfile(userId) {
            const profile = await ProfileManager?.getProfile?.(userId);
            if (!profile?.exists()) return;

            const data = profile.data();
            const targetIsGuest = !data.email;
            const viewerCanSocial = isRegisteredUser?.();

            document.getElementById('profile-name').textContent = data.displayName || 'Anonymous';
            document.getElementById('profile-member-since').textContent =
                `Member since: ${data.memberSince?.toDate?.()?.toLocaleDateString() || 'Unknown'}`;
            document.getElementById('profile-wins').textContent = data.stats?.wins || 0;
            document.getElementById('profile-losses').textContent = data.stats?.losses || 0;

            const badgesContainer = document.getElementById('profile-badges');
            badgesContainer.innerHTML = '';
            const badgeHelp = document.getElementById('profile-badge-help');
            if (badgeHelp) badgeHelp.textContent = 'Tap a badge to learn what it means.';
            (data.badges || []).forEach(badge => {
                const badgeEl = document.createElement('span');
                badgeEl.className = `badge ${badge}`;
                const info = badgeInfo[badge] || { name: badge, desc: '' };
                badgeEl.textContent = info.name || badge;
                if (info.desc) badgeEl.title = info.desc;
                badgeEl.addEventListener('click', () => {
                    if (badgeHelp) badgeHelp.textContent = info.desc || info.name || badge;
                });
                badgesContainer.appendChild(badgeEl);
            });
            if (badgeHelp && (data.badges || []).length === 0) {
                badgeHelp.textContent = 'Earn badges by playing and completing feats.';
            }

            const challengeBtn = document.getElementById('challenge-player');
            if (challengeBtn) {
                challengeBtn.onclick = async () => {
                    const cs = resolveChallengeManager();
                    if (cs?.sendChallenge && AppState.currentUser) {
                        await cs.sendChallenge(AppState.currentUser.uid, getCurrentDisplayName?.(), userId);
                        ViewManager?.hideModal?.('profile-modal');
                        ui.showToast('Challenge sent!', 'success');
                    }
                };
            }

            const dmBtn = document.getElementById('profile-modal-dm');
            if (dmBtn) {
                if (targetIsGuest || !viewerCanSocial || userId === AppState.currentUser?.uid) {
                    dmBtn.disabled = true;
                    dmBtn.title = targetIsGuest ? 'Direct messages unavailable for guests' : 'Sign in to DM';
                } else {
                    dmBtn.disabled = false;
                    dmBtn.onclick = async () => {
                        try { await window.ChatWidget?.openDm?.(userId); } catch (e) { console.warn('Modal DM failed', e); }
                        ViewManager?.hideModal?.('profile-modal');
                    };
                }
            }

            ViewManager?.showModal?.('profile-modal');
        },

        async showProfilePage(userId) {
            const isOwnProfile = userId === AppState.currentUser?.uid;

            const profile = await ProfileManager?.getProfile?.(userId);
            if (!profile?.exists()) {
                ui.showToast('Profile not found', 'error');
                return;
            }

            const data = profile.data();
            AppState.viewingProfileId = userId;
            const profileView = document.getElementById('profile-view');
            if (profileView) profileView.dataset.userId = userId;

            const username = data.username || data.displayName || 'Anonymous';
            document.getElementById('profile-page-title').textContent = isOwnProfile ? 'Your Profile' : `${username}'s Profile`;
            document.getElementById('profile-page-username').textContent = username;
            document.getElementById('profile-page-bio').textContent = data.bio || 'No bio yet...';

            const pictureEl = document.getElementById('profile-page-picture');
            const placeholderEl = document.getElementById('profile-picture-placeholder');
            if (data.profilePicture) {
                try {
                    const resp = await fetch(`/api/avatar/${userId}`);
                    if (resp.ok) {
                        const json = await resp.json();
                        pictureEl.src = json.url;
                    } else {
                        pictureEl.src = data.profilePicture;
                    }
                } catch (e) {
                    pictureEl.src = data.profilePicture;
                }
                pictureEl.style.display = 'block';
                placeholderEl.style.display = 'none';
            } else {
                pictureEl.style.display = 'none';
                placeholderEl.style.display = 'flex';
            }

            document.getElementById('profile-picture-edit').style.display = isOwnProfile ? 'block' : 'none';

            let memberDate = null;
            try {
                if (data.memberSince?.toDate) memberDate = data.memberSince.toDate();
                else if (typeof data.memberSince === 'number') memberDate = new Date(data.memberSince);
                else if (typeof data.memberSince === 'string') memberDate = new Date(data.memberSince);
            } catch { /* ignore */ }
            const memberText = memberDate && !Number.isNaN(memberDate.getTime())
                ? memberDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Unknown';
            document.getElementById('profile-page-member-since').textContent = memberText;

            const vanityEl = document.getElementById('profile-vanity-url');
            const vanityLinkEl = document.getElementById('profile-vanity-link');
            const hostBase = window.location.origin || 'https://stone-doku.web.app';
            const vanityUrl = `${hostBase}/u/${encodeURIComponent(username.toLowerCase())}`;
            const isRegistered = !!data.email;
            const targetIsGuest = !isRegistered;
            if (isRegistered && vanityEl && vanityLinkEl) {
                vanityLinkEl.href = `/u/${encodeURIComponent(username.toLowerCase())}`;
                vanityLinkEl.textContent = vanityUrl;
                vanityEl.style.display = 'flex';
            } else if (vanityEl) {
                vanityEl.style.display = 'none';
            }

            const stats = data.stats || { wins: 0, losses: 0, gamesPlayed: 0 };
            document.getElementById('profile-page-wins').textContent = stats.wins || 0;
            document.getElementById('profile-page-losses').textContent = stats.losses || 0;
            const totalGames = (stats.wins || 0) + (stats.losses || 0);
            const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
            document.getElementById('profile-page-winrate').textContent = `${winRate}%`;
            document.getElementById('profile-page-games').textContent = totalGames;

            const badgesContainer = document.getElementById('profile-page-badges');
            badgesContainer.innerHTML = '';
            const badgeHelp = document.getElementById('profile-badge-help');
            if (badgeHelp) badgeHelp.textContent = 'Tap a badge to learn what it means.';
            const badges = data.badges || [];
            if (badges.length === 0) {
                badgesContainer.innerHTML = '<div class="badge-empty">No badges yet. Keep playing to earn badges!</div>';
                if (badgeHelp) badgeHelp.textContent = 'Earn badges by playing and completing feats.';
            } else {
                badges.forEach(badge => {
                    const info = badgeInfo[badge] || { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-trophy"></use></svg>', name: String(badge), desc: '' };
                    const badgeEl = document.createElement('div');
                    badgeEl.className = 'badge-item';
                    badgeEl.title = info.desc || info.name;
                    badgeEl.setAttribute('role', 'button');
                    badgeEl.setAttribute('tabindex', '0');

                    const iconEl = document.createElement('span');
                    iconEl.className = 'badge-icon';
                    iconEl.setAttribute('aria-hidden', 'true');
                    iconEl.innerHTML = info.iconHtml;

                    const nameEl = document.createElement('span');
                    nameEl.className = 'badge-name';
                    nameEl.textContent = info.name;

                    badgeEl.appendChild(iconEl);
                    badgeEl.appendChild(nameEl);

                    badgeEl.addEventListener('click', () => {
                        if (badgeHelp) badgeHelp.textContent = info.desc || info.name || badge;
                    });

                    badgesContainer.appendChild(badgeEl);
                });
            }

            document.getElementById('profile-own-actions').style.display = isOwnProfile ? 'flex' : 'none';
            document.getElementById('profile-other-actions').style.display = isOwnProfile ? 'none' : 'flex';

            if (!isOwnProfile) {
                const isFriend = (AppState.friends || []).includes(userId);
                const friendBtn = document.getElementById('profile-friend-btn');
                const labelEl = friendBtn?.querySelector('.btn-label');
                const dmBtn = document.getElementById('profile-dm-btn');
                const socialEnabled = isRegisteredUser?.() && !targetIsGuest;
                let hasIncomingRequest = false;
                let hasOutgoingRequest = false;

                if (!socialEnabled) {
                    if (friendBtn) friendBtn.style.display = 'none';
                    if (dmBtn) dmBtn.style.display = 'none';
                } else {
                    if (friendBtn) friendBtn.style.display = '';
                    if (dmBtn) dmBtn.style.display = '';

                    try {
                        const reqSnap = await ProfileManager?.getFriendRequestBetween?.(AppState.currentUser.uid, userId);
                        if (reqSnap?.exists()) {
                            const reqData = reqSnap.data() || {};
                            if (reqData.status === 'pending') {
                                hasIncomingRequest = reqData.toUid === AppState.currentUser.uid;
                                hasOutgoingRequest = reqData.fromUid === AppState.currentUser.uid;
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to check friend request state', e);
                    }

                    if (hasIncomingRequest) {
                        if (labelEl) labelEl.textContent = 'Accept Request';
                        else if (friendBtn) friendBtn.textContent = 'Accept Request';
                        if (friendBtn) {
                            friendBtn.disabled = false;
                            friendBtn.onclick = async () => {
                                try {
                                    await ProfileManager?.acceptFriendRequest?.(AppState.currentUser.uid, userId);
                                    ui.showToast('Friend request accepted.', 'success');
                                    await FriendsManager?.refresh?.();
                                } catch (err) {
                                    ui.showToast(err?.message || 'Failed to accept request.', 'error');
                                }
                            };
                        }
                    } else if (hasOutgoingRequest) {
                        if (labelEl) labelEl.textContent = 'Request Sent';
                        else if (friendBtn) friendBtn.textContent = 'Request Sent';
                        if (friendBtn) {
                            friendBtn.disabled = true;
                            friendBtn.onclick = null;
                        }
                    } else if (isFriend) {
                        if (labelEl) labelEl.textContent = 'Remove Friend';
                        else if (friendBtn) friendBtn.textContent = 'Remove Friend';
                        if (friendBtn) {
                            friendBtn.disabled = false;
                            friendBtn.onclick = async () => {
                                try {
                                    await ProfileManager?.removeFriend?.(AppState.currentUser.uid, userId);
                                    ui.showToast('Friend removed.', 'info');
                                    await FriendsManager?.refresh?.();
                                } catch (err) {
                                    ui.showToast(err?.message || 'Failed to remove friend.', 'error');
                                }
                            };
                        }
                    } else {
                        if (labelEl) labelEl.textContent = 'Add Friend';
                        else if (friendBtn) friendBtn.textContent = 'Add Friend';
                        if (friendBtn) {
                            friendBtn.disabled = false;
                            friendBtn.onclick = async () => {
                                try {
                                    const result = await ProfileManager?.sendFriendRequest?.(AppState.currentUser.uid, userId);
                                    ui.showToast(result === 'accepted_existing' ? 'Friend request accepted.' : 'Friend request sent.', 'success');
                                    await FriendsManager?.refresh?.();
                                } catch (err) {
                                    ui.showToast(err?.message || 'Failed to send request.', 'error');
                                }
                            };
                        }
                    }
                }
            }

            ViewManager?.show?.('profile');
        },

        addChatMessage(containerId, sender, text, timestamp, userId = null) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const messageEl = document.createElement('div');
            messageEl.className = 'chat-message';

            const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            const senderEl = document.createElement('span');
            senderEl.className = 'chat-sender';
            if (userId) {
                senderEl.classList.add('clickable-user');
                senderEl.dataset.userId = userId;
            }
            senderEl.textContent = sender;

            const textEl = document.createElement('span');
            textEl.className = 'chat-text';
            textEl.textContent = text;

            const timeEl = document.createElement('span');
            timeEl.className = 'chat-time';
            timeEl.textContent = time;

            const headerRow = document.createElement('div');
            headerRow.className = 'chat-header-row';
            headerRow.appendChild(senderEl);
            headerRow.appendChild(timeEl);

            messageEl.appendChild(headerRow);
            messageEl.appendChild(textEl);

            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;

            if (userId) {
                senderEl.addEventListener('mouseenter', (e) => {
                    ui.showMiniProfile(userId, sender, e.target);
                });
                senderEl.addEventListener('mouseleave', () => {
                    ui.hideMiniProfile();
                });
            }
        },

        async showMiniProfile(userId, displayName, targetEl) {
            if (ui.miniProfileTimeout) {
                clearTimeout(ui.miniProfileTimeout);
                ui.miniProfileTimeout = null;
            }
            if (ui.miniProfileHideTimer) {
                clearTimeout(ui.miniProfileHideTimer);
                ui.miniProfileHideTimer = null;
            }

            let miniProfile = document.getElementById('chat-mini-profile');
            if (!miniProfile) {
                miniProfile = document.createElement('div');
                miniProfile.id = 'chat-mini-profile';
                miniProfile.className = 'chat-mini-profile';
                document.body.appendChild(miniProfile);
                miniProfile.addEventListener('mouseenter', () => {
                    if (ui.miniProfileHideTimer) {
                        clearTimeout(ui.miniProfileHideTimer);
                        ui.miniProfileHideTimer = null;
                    }
                });
                miniProfile.addEventListener('mouseleave', () => {
                    ui.hideMiniProfile(400);
                });
            }

            const rect = targetEl.getBoundingClientRect();
            miniProfile.style.left = `${rect.left}px`;
            miniProfile.style.top = `${rect.bottom + 8}px`;

            miniProfile.innerHTML = `
                <div class="mini-profile-header">
                    <div class="mini-profile-avatar" aria-hidden="true"><svg class="ui-icon"><use href="#i-user"></use></svg></div>
                    <div class="mini-profile-name">${ui.escapeHtml(displayName)}</div>
                </div>
                <div class="mini-profile-loading">Loading...</div>
            `;
            miniProfile.classList.add('visible');

            try {
                const profilePromise = ProfileManager?.getProfile?.(userId);
                const presencePromise = (ref && get && rtdb)
                    ? get(ref(rtdb, `presence/${userId}`))
                    : Promise.resolve({ val: () => null });
                const [profileSnap, presenceSnapshot] = await Promise.all([
                    profilePromise,
                    presencePromise
                ]);

                const presenceData = presenceSnapshot?.val?.();
                const isOnline = presenceData?.status === 'online';
                const profileData = profileSnap?.data?.() || {};
                const stats = profileData.stats || { wins: 0, losses: 0 };
                const total = stats.wins + stats.losses;
                const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
                const statusClass = isOnline ? 'online' : 'offline';
                const statusText = isOnline ? 'Online' : 'Offline';
                const name = profileData.username || profileData.displayName || displayName;
                const isRegistered = !!profileData?.email;
                const targetIsGuest = !profileData?.email;
                const isSelf = AppState.currentUser && userId === AppState.currentUser.uid;

                const viewerCanSocial = isRegisteredUser?.();
                if (miniProfile.classList.contains('visible')) {
                    const canSocialWithTarget = viewerCanSocial && isRegistered && !isSelf;
                    miniProfile.innerHTML = `
                        <div class="mini-profile-header">
                            <div class="mini-profile-avatar" aria-hidden="true"><svg class="ui-icon"><use href="#i-user"></use></svg></div>
                            <div class="mini-profile-info">
                                <div class="mini-profile-name">${ui.escapeHtml(name)}</div>
                                <div class="mini-profile-status ${statusClass}">
                                        <span class="status-dot"></span>
                                        ${statusText}
                                    </div>
                                </div>
                            </div>
                            <div class="mini-profile-stats">
                                <div class="mini-stat">
                                    <span class="mini-stat-value">${stats.wins || 0}</span>
                                    <span class="mini-stat-label">Wins</span>
                                </div>
                                <div class="mini-stat">
                                    <span class="mini-stat-value">${stats.losses || 0}</span>
                                    <span class="mini-stat-label">Losses</span>
                                </div>
                                <div class="mini-stat">
                                    <span class="mini-stat-value">${winrate}%</span>
                                    <span class="mini-stat-label">Win Rate</span>
                                </div>
                            </div>
                            ${(canSocialWithTarget) ? `
                            <div class="mini-profile-actions">
                                <button type="button" class="btn btn-secondary btn-sm mini-dm-btn">DM</button>
                                <button type="button" class="btn btn-ghost btn-sm mini-friend-btn">Add Friend</button>
                                <button type="button" class="btn btn-ghost btn-sm mini-profile-btn">Profile</button>
                            </div>
                            ` : (targetIsGuest ? `<div class="mini-profile-actions muted-note">Guest account — social disabled</div>` : '')}
                        `;
                    if (canSocialWithTarget) {
                        const dmBtn = miniProfile.querySelector('.mini-dm-btn');
                        const friendBtn = miniProfile.querySelector('.mini-friend-btn');
                        const profileBtn = miniProfile.querySelector('.mini-profile-btn');
                        dmBtn?.addEventListener('click', async () => {
                            try { await window.ChatWidget?.openDm?.(userId); } catch (e) { console.warn('Mini profile DM failed', e); }
                        });
                        friendBtn?.addEventListener('click', async () => {
                            if (!isRegisteredUser?.()) {
                                ui.showToast('Sign in with email to add friends.', 'error');
                                return;
                            }
                            try {
                                const result = await ProfileManager?.sendFriendRequest?.(AppState.currentUser.uid, userId);
                                const accepted = result === 'accepted_existing';
                                ui.showToast(accepted ? 'Friend request accepted.' : 'Friend request sent.', 'success');
                                friendBtn.disabled = true;
                                friendBtn.textContent = accepted ? 'Friends' : 'Request Sent';
                                if (accepted) await FriendsManager?.refresh?.();
                            } catch (e) {
                                console.warn('Mini profile add friend failed', e);
                                ui.showToast(e?.message || 'Failed to send friend request.', 'error');
                            }
                        });
                        profileBtn?.addEventListener('click', () => {
                            ui.hideMiniProfile(0);
                            ui.showProfilePage(userId);
                        });
                    }
                }
            } catch (err) {
                console.error('Error fetching mini profile:', err);
            }
        },

        hideMiniProfile(delay = 900) {
            if (ui.miniProfileTimeout) {
                clearTimeout(ui.miniProfileTimeout);
                ui.miniProfileTimeout = null;
            }
            ui.miniProfileHideTimer = setTimeout(() => {
                const miniProfile = document.getElementById('chat-mini-profile');
                if (miniProfile) {
                    miniProfile.classList.remove('visible');
                }
            }, delay);
        },

        updateStats(stats) {
            document.getElementById('stat-wins').textContent = stats.wins || 0;
            document.getElementById('stat-losses').textContent = stats.losses || 0;

            const total = (stats.wins || 0) + (stats.losses || 0);
            const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
            document.getElementById('stat-winrate').textContent = `${winrate}%`;
        },

        updateBadges(badges) {
            const container = document.getElementById('badges-list');
            if (!container) return;
            container.innerHTML = '';
            (badges || []).forEach(badge => {
                const info = badgeInfo[badge] || { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-trophy"></use></svg>', name: badge, desc: '' };
                const badgeEl = document.createElement('button');
                badgeEl.className = `badge badge-pill ${badge}`;
                badgeEl.setAttribute('type', 'button');
                badgeEl.setAttribute('aria-label', info.name || badge);
                badgeEl.title = info.desc || info.name || badge;
                const iconSpan = document.createElement('span');
                iconSpan.className = 'badge-icon';
                iconSpan.innerHTML = info.iconHtml || '';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'badge-label';
                nameSpan.textContent = info.name || badge;
                badgeEl.appendChild(iconSpan);
                badgeEl.appendChild(nameSpan);
                badgeEl.addEventListener('click', () => {
                    ui.showBadgeReveal(badge);
                });
                container.appendChild(badgeEl);
            });
        },

        showBadgeReveal(badgeKey) {
            try {
                const info = badgeInfo[badgeKey] || { name: badgeKey, desc: '', iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-trophy"></use></svg>' };
                const existing = document.getElementById('badge-reveal');
                if (existing) existing.remove();
                const el = document.createElement('div');
                el.id = 'badge-reveal';
                el.className = 'badge-reveal';
                el.innerHTML = `
                    <div class="badge-reveal-card">
                        <div class="badge-reveal-icon">${info.iconHtml}</div>
                        <div class="badge-reveal-body">
                            <div class="badge-reveal-name">${ui.escapeHtml(info.name || badgeKey)}</div>
                            <div class="badge-reveal-desc">${ui.escapeHtml(info.desc || '')}</div>
                            <div class="badge-reveal-actions">
                                <button class="btn btn-primary btn-sm" id="badge-reveal-view">View Badges</button>
                            </div>
                        </div>
                    </div>`;
                document.body.appendChild(el);
                el.style.position = 'fixed';
                el.style.right = '20px';
                el.style.bottom = '20px';
                el.style.zIndex = '9999';
                el.style.pointerEvents = 'auto';
                const btn = document.getElementById('badge-reveal-view');
                if (btn) btn.addEventListener('click', () => {
                    if (AppState.currentUser) ui.showProfilePage(AppState.currentUser.uid);
                });
                setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 450); }, 4200);
            } catch (e) {
                console.warn('showBadgeReveal failed', e);
            }
        },

        showToast(message, type = 'info') {
            const text = String(message || '').trim();
            if (!text) return;

            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.setAttribute('aria-live', 'polite');
                container.setAttribute('aria-atomic', 'true');
                document.body.appendChild(container);
            }

            const el = document.createElement('div');
            el.className = `toast toast-${type}`;
            el.textContent = text;
            container.appendChild(el);

            setTimeout(() => {
                el.classList.add('toast-hide');
                setTimeout(() => el.remove(), 350);
            }, 2400);
        },

        showLoading(message = 'Loading...') {
            let el = document.getElementById('app-loading-overlay');
            if (!el) {
                el = document.createElement('div');
                el.id = 'app-loading-overlay';
                el.className = 'app-loading-overlay';
                el.innerHTML = `
                    <div class="app-loading-card">
                        <div class="spinner" aria-hidden="true"></div>
                        <div class="loading-message" id="app-loading-message">${ui.escapeHtml(message)}</div>
                    </div>`;
                document.body.appendChild(el);
            }
            const msg = document.getElementById('app-loading-message');
            if (msg) msg.textContent = String(message || 'Loading...');
            el.style.display = 'flex';
        },

        hideLoading() {
            const el = document.getElementById('app-loading-overlay');
            if (el) el.style.display = 'none';
        },

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    };

    return ui;
}
