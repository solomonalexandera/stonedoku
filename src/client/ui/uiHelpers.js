import { AppState as defaultAppState } from '../core/appState.js';

const defaultBadgeInfo = {
    rookie: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Rookie', desc: 'Completed your first game' },
    learner: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Learner', desc: 'Completed 5 games' },
    veteran: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Veteran', desc: 'Completed 10 games' },
    marathoner: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-award"></use></svg>', name: 'Marathoner', desc: 'Completed 50 games' },
    legend: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-crown"></use></svg>', name: 'Legend', desc: 'Completed 100 games' },
    winner: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-trophy"></use></svg>', name: 'Winner', desc: 'Won your first match' },
    champion: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-crown"></use></svg>', name: 'Champion', desc: 'Won 20 matches' },
    unstoppable: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-crown"></use></svg>', name: 'Unstoppable', desc: 'Won 50 matches' },
    undefeated: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>', name: 'Undefeated', desc: '10 wins with no losses' },
    tactician: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-target"></use></svg>', name: 'Tactician', desc: '70% win rate with 20+ games' },
    speedster: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-bolt"></use></svg>', name: 'Speedster', desc: 'Solved puzzle in 3 minutes' },
    socialite: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>', name: 'Socialite', desc: 'Made your first friend' },
    connector: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>', name: 'Connector', desc: 'Have 5 friends' },
    ambassador: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>', name: 'Ambassador', desc: 'Have 15 friends' },
    storyteller: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-book"></use></svg>', name: 'Storyteller', desc: 'Wrote a bio' },
    portrait: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>', name: 'Portrait', desc: 'Uploaded a profile picture' },
    warden: { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-lock"></use></svg>', name: 'Warden', desc: 'Appointed as moderator' }
};

export function createUiHelpers({
    AppState = defaultAppState,
    ViewManager = globalThis.ViewManager,
    ProfileManager = globalThis.ProfileManager,
    FriendsManager = globalThis.FriendsManager,
    // Lazy load ChallengeManager to avoid circular dependency
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
        _playersListDelegationBound: false,
        _badgesDelegationBound: false,

        updatePlayersList(players) {
            const container = document.getElementById('players-list');
            if (!container) return;

            // Setup event delegation once
            if (!ui._playersListDelegationBound) {
                container.addEventListener('mouseenter', (e) => {
                    const nameEl = e.target.closest('.player-name-hoverable');
                    if (nameEl) {
                        const userId = nameEl.dataset.userId;
                        const displayName = nameEl.textContent;
                        const item = nameEl.closest('.player-item');
                        const activityEl = item?.querySelector('.player-item-activity');
                        const basicData = {
                            displayName: displayName,
                            current_activity: activityEl?.textContent || 'Online'
                        };
                        ui.showProfileTooltip(e, userId, basicData, 'hover');
                    }
                }, true);

                container.addEventListener('mouseleave', (e) => {
                    if (e.target.closest('.player-name-hoverable')) {
                        ui.hideProfileTooltip('hover');
                    }
                }, true);

                container.addEventListener('click', (e) => {
                    const item = e.target.closest('.player-item');
                    if (item) {
                        const userId = item.dataset.userId;
                        if (userId) ui.showPlayerProfile(userId);
                    }
                });

                ui._playersListDelegationBound = true;
            }

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
                    container.appendChild(item);
                }
            }

            const onlineCount = Object.values(players || {}).filter(p => p.status === 'online').length;
            const countEl = document.getElementById('online-count');
            if (countEl) countEl.textContent = onlineCount;
        },

        /**
         * Unified profile tooltip - shows user info with engagement buttons
         * @param {MouseEvent} event - The mouse event
         * @param {string} userId - The user ID to show profile for
         * @param {Object} basicData - Basic user data (displayName, current_activity, etc.)
         * @param {string} context - Either 'hover' (players list) or 'mini' (chat messages)
         */
        async showProfileTooltip(event, userId, basicData, context = 'hover') {
            // Clear any existing timeouts
            if (ui.hoverTimeout) {
                clearTimeout(ui.hoverTimeout);
                ui.hoverTimeout = null;
            }
            if (ui.miniProfileTimeout) {
                clearTimeout(ui.miniProfileTimeout);
                ui.miniProfileTimeout = null;
            }
            if (ui.miniProfileHideTimer) {
                clearTimeout(ui.miniProfileHideTimer);
                ui.miniProfileHideTimer = null;
            }

            // Get or create the appropriate tooltip element
            const tooltipId = context === 'hover' ? 'hover-profile' : 'chat-mini-profile';
            let tooltip = document.getElementById(tooltipId);
            
            if (context === 'mini' && !tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'chat-mini-profile';
                tooltip.className = 'chat-mini-profile';
                document.body.appendChild(tooltip);
                tooltip.addEventListener('mouseenter', () => {
                    if (ui.miniProfileHideTimer) {
                        clearTimeout(ui.miniProfileHideTimer);
                        ui.miniProfileHideTimer = null;
                    }
                });
                tooltip.addEventListener('mouseleave', () => {
                    ui.hideProfileTooltip(context, 400);
                });
            }

            if (!tooltip) return;

            // Position tooltip
            const rect = event.target.getBoundingClientRect();
            if (context === 'hover') {
                tooltip.style.left = `${rect.right + 10}px`;
                tooltip.style.top = `${rect.top - 10}px`;
                if (rect.right + 200 > window.innerWidth) {
                    tooltip.style.left = `${rect.left - 200}px`;
                }
            } else {
                tooltip.style.left = `${rect.left}px`;
                tooltip.style.top = `${rect.bottom + 8}px`;
            }

            // Show loading state for mini profile
            if (context === 'mini') {
                tooltip.innerHTML = `
                    <div class="mini-profile-header">
                        <div class="mini-profile-avatar" aria-hidden="true"><svg class="ui-icon"><use href="#i-user"></use></svg></div>
                        <div class="mini-profile-name">${ui.escapeHtml(basicData?.displayName || 'Anonymous')}</div>
                    </div>
                    <div class="mini-profile-loading">Loading...</div>
                `;
                tooltip.classList.add('visible');
            } else {
                tooltip.querySelector('.hover-profile-name').textContent = basicData?.displayName || 'Anonymous';
                tooltip.querySelector('#hover-activity').textContent = basicData?.current_activity || 'Online';
            }

            // Fetch full profile data
            const isSelf = AppState.currentUser && userId === AppState.currentUser.uid;
            // Check if viewer is registered - must have email from Auth or profile
            const viewerHasEmail = AppState.currentUser?.email || AppState.profile?.email;
            const viewerIsRegistered = !AppState.currentUser?.isAnonymous && !!viewerHasEmail;
            
            let targetIsGuest = true;
            let profileData = {};
            let presenceData = null;

            try {
                const profilePromise = ProfileManager?.getProfile?.(userId);
                const presencePromise = (ref && get && rtdb && context === 'mini')
                    ? get(ref(rtdb, `presence/${userId}`))
                    : Promise.resolve({ val: () => null });
                
                const [profileSnap, presenceSnapshot] = await Promise.all([
                    profilePromise,
                    presencePromise
                ]);

                if (profileSnap?.exists()) {
                    profileData = profileSnap.data() || {};
                    // A user is not a guest if they have an email in their profile
                    targetIsGuest = !profileData?.email;
                } else {
                    // If no profile exists, assume guest (anonymous user)
                    targetIsGuest = true;
                }
                presenceData = presenceSnapshot?.val?.();
            } catch (e) {
                console.warn('Could not fetch profile for tooltip:', e);
                // On error, assume guest to be safe
                targetIsGuest = true;
            }

            // Calculate stats
            const stats = profileData.stats || { wins: 0, losses: 0 };
            const total = stats.wins + stats.losses;
            const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
            const name = profileData.displayName || profileData.username || basicData?.displayName || 'Anonymous';

            // Determine what actions are available
            const canSocialWithTarget = viewerIsRegistered && !targetIsGuest && !isSelf;
            const showDisabledMessage = !canSocialWithTarget && (targetIsGuest || !viewerIsRegistered);

            // Update tooltip with full data
            if (context === 'hover') {
                tooltip.querySelector('#hover-wins').textContent = stats.wins || 0;
                tooltip.querySelector('#hover-losses').textContent = stats.losses || 0;
                tooltip.querySelector('#hover-winrate').textContent = `${winrate}%`;

                const actionsDiv = tooltip.querySelector('.hover-profile-actions');
                const dmBtn = tooltip.querySelector('#hover-dm-btn');
                const friendBtn = tooltip.querySelector('#hover-friend-btn');

                if (actionsDiv) {
                    actionsDiv.style.display = canSocialWithTarget ? 'flex' : 'none';
                }

                if (canSocialWithTarget) {
                    // Clone buttons to remove old listeners
                    if (dmBtn) {
                        const newDmBtn = dmBtn.cloneNode(true);
                        dmBtn.parentNode.replaceChild(newDmBtn, dmBtn);
                        newDmBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            ui.hideProfileTooltip('hover');
                            try {
                                await window.ChatWidget?.openDm?.(userId);
                            } catch (err) {
                                console.warn('DM open failed:', err);
                            }
                        });
                    }

                    if (friendBtn) {
                        const newFriendBtn = friendBtn.cloneNode(true);
                        friendBtn.parentNode.replaceChild(newFriendBtn, friendBtn);
                        newFriendBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            ui.hideProfileTooltip('hover');
                            try {
                                const result = await ProfileManager?.sendFriendRequest?.(AppState.currentUser.uid, userId);
                                const accepted = result === 'accepted_existing';
                                ui.showToast(accepted ? 'Friend request accepted.' : 'Friend request sent.', 'success');
                                if (accepted) await FriendsManager?.refresh?.();
                            } catch (err) {
                                console.warn('Friend request failed:', err);
                                ui.showToast(err?.message || 'Failed to send friend request.', 'error');
                            }
                        });
                    }
                }

                tooltip.style.display = 'block';
                tooltip.onmouseenter = () => {
                    if (ui.hoverTimeout) {
                        clearTimeout(ui.hoverTimeout);
                        ui.hoverTimeout = null;
                    }
                };
                tooltip.onmouseleave = () => ui.hideProfileTooltip('hover');
            } else {
                // Mini profile - reconstruct HTML with presence info
                const isOnline = presenceData?.status === 'online';
                const statusClass = isOnline ? 'online' : 'offline';
                const statusText = isOnline ? 'Online' : 'Offline';

                let actionsHtml = '';
                if (canSocialWithTarget) {
                    actionsHtml = `
                        <div class="mini-profile-actions">
                            <button type="button" class="btn btn-secondary btn-sm mini-dm-btn">DM</button>
                            <button type="button" class="btn btn-ghost btn-sm mini-friend-btn">Add Friend</button>
                            <button type="button" class="btn btn-ghost btn-sm mini-profile-btn">Profile</button>
                        </div>
                    `;
                } else if (!viewerIsRegistered) {
                    actionsHtml = `<div class="mini-profile-actions muted-note">Sign in with email to interact<br><small>Create an email account to send DMs and friend requests</small></div>`;
                } else if (targetIsGuest) {
                    actionsHtml = `<div class="mini-profile-actions muted-note">Guest account — social disabled<br><small>This player hasn't verified their email yet</small></div>`;
                } else if (isSelf) {
                    actionsHtml = `<div class="mini-profile-actions muted-note">Your profile</div>`;
                }

                if (tooltip.classList.contains('visible')) {
                    tooltip.innerHTML = `
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
                        ${actionsHtml}
                    `;

                    if (canSocialWithTarget) {
                        const dmBtn = tooltip.querySelector('.mini-dm-btn');
                        const friendBtn = tooltip.querySelector('.mini-friend-btn');
                        const profileBtn = tooltip.querySelector('.mini-profile-btn');

                        dmBtn?.addEventListener('click', async () => {
                            ui.hideProfileTooltip('mini', 0);
                            try {
                                await window.ChatWidget?.openDm?.(userId);
                            } catch (e) {
                                console.warn('Mini profile DM failed', e);
                            }
                        });

                        friendBtn?.addEventListener('click', async () => {
                            try {
                                const result = await ProfileManager?.sendFriendRequest?.(AppState.currentUser.uid, userId);
                                const accepted = result === 'accepted_existing';
                                ui.showToast(accepted ? 'Friend request accepted.' : 'Friend request sent.', 'success');
                                friendBtn.disabled = true;
                                friendBtn.textContent = accepted ? 'Friends' : 'Request Sent';
                                if (accepted) await FriendsManager?.refresh?.();
                            } catch (e) {
                                console.warn('Mini profile add friend failed', e);
                                if (e?.message === 'You are already friends.') {
                                    ui.showToast('You are already friends.', 'info');
                                    friendBtn.disabled = true;
                                    friendBtn.textContent = 'Friends';
                                } else {
                                    ui.showToast(e?.message || 'Failed to send friend request.', 'error');
                                }
                            }
                        });

                        profileBtn?.addEventListener('click', () => {
                            ui.hideProfileTooltip('mini', 0);
                            ui.showProfilePage(userId);
                        });
                    }
                }
            }
        },

        hideProfileTooltip(context = 'hover', delay = null) {
            const actualDelay = delay !== null ? delay : (context === 'hover' ? 300 : 900);
            const timeoutKey = context === 'hover' ? 'hoverTimeout' : 'miniProfileHideTimer';
            
            if (ui[timeoutKey]) {
                clearTimeout(ui[timeoutKey]);
            }
            
            ui[timeoutKey] = setTimeout(() => {
                const tooltipId = context === 'hover' ? 'hover-profile' : 'chat-mini-profile';
                const tooltip = document.getElementById(tooltipId);
                if (tooltip) {
                    if (context === 'hover') {
                        tooltip.style.display = 'none';
                    } else {
                        tooltip.classList.remove('visible');
                    }
                }
            }, actualDelay);
        },

        // Legacy compatibility methods
        async showHoverProfile(event, userId, basicData) {
            return ui.showProfileTooltip(event, userId, basicData, 'hover');
        },

        hideHoverProfile() {
            return ui.hideProfileTooltip('hover');
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
            // Check if viewer is registered - must have email from Auth or profile
            const viewerHasEmail = AppState.currentUser?.email || AppState.profile?.email;
            const viewerCanSocial = !AppState.currentUser?.isAnonymous && !!viewerHasEmail;

            document.getElementById('profile-name').textContent = data.displayName || data.username || 'Anonymous';
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

            const displayName = data.displayName || data.username || 'Anonymous';
            document.getElementById('profile-page-title').textContent = isOwnProfile ? 'Your Profile' : `${displayName}'s Profile`;
            document.getElementById('profile-page-username').textContent = displayName;
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
            const vanityUrl = `${hostBase}/u/${encodeURIComponent((data.username || '').toLowerCase())}`;
            const isRegistered = !!data.email;
            const targetIsGuest = !isRegistered;
            if (isRegistered && vanityEl && vanityLinkEl) {
                vanityLinkEl.href = `/u/${encodeURIComponent((data.username || '').toLowerCase())}`;
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
                // Check if viewer is registered - must have email from Auth or profile
                const viewerHasEmail = AppState.currentUser?.email || AppState.profile?.email;
                const viewerIsRegistered = !AppState.currentUser?.isAnonymous && !!viewerHasEmail;
                const socialEnabled = viewerIsRegistered && !targetIsGuest;
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
                        // Remove any previous onclick handlers to prevent conflicts with the global listener
                        if (friendBtn) {
                            friendBtn.disabled = false;
                            friendBtn.onclick = null;
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
                            friendBtn.onclick = null;
                        }
                    } else {
                        if (labelEl) labelEl.textContent = 'Add Friend';
                        else if (friendBtn) friendBtn.textContent = 'Add Friend';
                        if (friendBtn) {
                            friendBtn.disabled = false;
                            friendBtn.onclick = null;
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
            return ui.showProfileTooltip({ target: targetEl }, userId, { displayName }, 'mini');
        },

        hideMiniProfile(delay = 900) {
            return ui.hideProfileTooltip('mini', delay);
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
            
            // Setup event delegation once
            if (!ui._badgesDelegationBound) {
                container.addEventListener('click', (e) => {
                    const badgeEl = e.target.closest('.badge');
                    if (badgeEl) {
                        const badgeKey = badgeEl.dataset.badge;
                        if (badgeKey) ui.showBadgeReveal(badgeKey);
                    }
                });
                ui._badgesDelegationBound = true;
            }
            
            container.innerHTML = '';
            (badges || []).forEach(badge => {
                const info = badgeInfo[badge] || { iconHtml: '<svg class="ui-icon" aria-hidden="true"><use href="#i-trophy"></use></svg>', name: badge, desc: '' };
                const badgeEl = document.createElement('button');
                badgeEl.className = `badge badge-pill ${badge}`;
                badgeEl.dataset.badge = badge;
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
