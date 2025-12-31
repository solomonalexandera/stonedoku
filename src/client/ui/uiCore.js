/**
 * UI Core - Essential UI utility functions
 * Handles player list, profiles, chat messages, stats, badges, and toasts
 */

/**
 * Create UI Core manager
 * @param {Object} deps - Dependencies
 * @param {Function} deps.getProfile - ProfileManager.getProfile function
 * @param {Object} deps.rtdb - Firebase RTDB reference
 * @param {Function} deps.dbRef - Firebase ref function
 * @param {Function} deps.dbGet - Firebase get function
 * @returns {Object} UI Core manager instance
 */
export function createUICore({ getProfile, rtdb, dbRef, dbGet }) {
    let hoverTimeout = null;
    let miniProfileTimeout = null;
    let miniProfileHideTimer = null;

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const showToast = (message, type = 'info') => {
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
    };

    const updatePlayersList = (players, { showProfilePage, ChallengeSystem, ViewManager } = {}) => {
        const container = document.getElementById('players-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (const [id, player] of Object.entries(players)) {
            if (player.status === 'online') {
                const item = document.createElement('div');
                item.className = 'player-item';
                item.dataset.userId = id;
                item.innerHTML = `
                    <div class="player-item-info">
                        <span class="player-item-status status-dot ${player.status}"></span>
                        <span class="player-item-name player-name-hoverable" data-user-id="${id}">${escapeHtml(player.displayName || 'Anonymous')}</span>
                    </div>
                    <span class="player-item-activity">${escapeHtml(player.current_activity || '')}</span>
                `;
                
                // Add hover profile listeners
                const nameEl = item.querySelector('.player-name-hoverable');
                nameEl.addEventListener('mouseenter', (e) => showHoverProfile(e, id, player));
                nameEl.addEventListener('mouseleave', () => hideHoverProfile());
                
                if (showProfilePage) {
                    item.addEventListener('click', () => showPlayerProfile(id, { ChallengeSystem, ViewManager }));
                }
                container.appendChild(item);
            }
        }
        
        // Update online count
        const onlineCount = Object.values(players).filter(p => p.status === 'online').length;
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.textContent = onlineCount;
    };

    const showHoverProfile = async (event, userId, basicData) => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        
        const tooltip = document.getElementById('hover-profile');
        if (!tooltip) return;
        
        // Position the tooltip
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top - 10}px`;
        
        // Check if tooltip would go off screen
        if (rect.right + 200 > window.innerWidth) {
            tooltip.style.left = `${rect.left - 200}px`;
        }
        
        // Set basic data first
        tooltip.querySelector('.hover-profile-name').textContent = basicData?.displayName || 'Anonymous';
        tooltip.querySelector('#hover-activity').textContent = basicData?.current_activity || 'Online';
        
        // Show tooltip
        tooltip.style.display = 'block';
        
        // Fetch more detailed stats
        try {
            const profile = await getProfile(userId);
            if (profile.exists()) {
                const data = profile.data();
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
    };

    const hideHoverProfile = () => {
        hoverTimeout = setTimeout(() => {
            const tooltip = document.getElementById('hover-profile');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }, 100);
    };

    const showPlayerProfile = async (userId, { ChallengeSystem, ViewManager, currentUserId } = {}) => {
        const profile = await getProfile(userId);
        if (!profile.exists()) return;
        
        const data = profile.data();
        
        document.getElementById('profile-name').textContent = data.displayName || 'Anonymous';
        document.getElementById('profile-member-since').textContent = 
            `Member since: ${data.memberSince?.toDate?.()?.toLocaleDateString() || 'Unknown'}`;
        document.getElementById('profile-wins').textContent = data.stats?.wins || 0;
        document.getElementById('profile-losses').textContent = data.stats?.losses || 0;
        
        // Show badges
        const badgesContainer = document.getElementById('profile-badges');
        badgesContainer.innerHTML = '';
        (data.badges || []).forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badge}`;
            badgeEl.textContent = badge;
            badgesContainer.appendChild(badgeEl);
        });
        
        // Set up challenge button
        if (ChallengeSystem && currentUserId) {
            document.getElementById('challenge-player').onclick = async () => {
                await ChallengeSystem.sendChallenge(currentUserId, 'Player', userId);
                ViewManager?.hideModal('profile-modal');
                alert('Challenge sent!');
            };
        }
        
        ViewManager?.showModal('profile-modal');
    };

    const addChatMessage = (containerId, sender, text, timestamp, userId = null) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        
        const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        // Create sender element with hover capability
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
        
        // Add hover listener for profile
        if (userId) {
            senderEl.addEventListener('mouseenter', (e) => {
                showMiniProfile(userId, sender, e.target);
            });
            senderEl.addEventListener('mouseleave', () => {
                hideMiniProfile();
            });
        }
    };

    const showMiniProfile = async (userId, displayName, targetEl, { currentUserId, isRegisteredUser, sendFriendRequest } = {}) => {
        if (miniProfileTimeout) {
            clearTimeout(miniProfileTimeout);
            miniProfileTimeout = null;
        }
        if (miniProfileHideTimer) {
            clearTimeout(miniProfileHideTimer);
            miniProfileHideTimer = null;
        }
        
        let miniProfile = document.getElementById('chat-mini-profile');
        if (!miniProfile) {
            miniProfile = document.createElement('div');
            miniProfile.id = 'chat-mini-profile';
            miniProfile.className = 'chat-mini-profile';
            document.body.appendChild(miniProfile);
            miniProfile.addEventListener('mouseenter', () => {
                if (miniProfileHideTimer) {
                    clearTimeout(miniProfileHideTimer);
                    miniProfileHideTimer = null;
                }
            });
            miniProfile.addEventListener('mouseleave', () => {
                hideMiniProfile(400);
            });
        }
        
        const rect = targetEl.getBoundingClientRect();
        miniProfile.style.left = `${rect.left}px`;
        miniProfile.style.top = `${rect.bottom + 8}px`;
        
        miniProfile.innerHTML = `
            <div class="mini-profile-header">
                <div class="mini-profile-avatar" aria-hidden="true"><svg class="ui-icon"><use href="#i-user"></use></svg></div>
                <div class="mini-profile-name">${escapeHtml(displayName)}</div>
            </div>
            <div class="mini-profile-loading">Loading...</div>
        `;
        miniProfile.classList.add('visible');
        
        try {
            const [profileSnap, presenceSnapshot] = await Promise.all([
                getProfile(userId),
                rtdb && dbRef && dbGet ? dbGet(dbRef(rtdb, `presence/${userId}`)) : Promise.resolve(null)
            ]);
            
            const presenceData = presenceSnapshot?.val?.() || {};
            const isOnline = presenceData?.status === 'online';
            const profileData = profileSnap?.data?.() || {};
            const stats = profileData.stats || { wins: 0, losses: 0 };
            const total = stats.wins + stats.losses;
            const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
            const statusClass = isOnline ? 'online' : 'offline';
            const statusText = isOnline ? 'Online' : 'Offline';
            const name = profileData.username || profileData.displayName || displayName;
            const isRegistered = !!(profileData?.email || profileData?.username);
            const isSelf = currentUserId && userId === currentUserId;
            
            if (miniProfile.classList.contains('visible')) {
                miniProfile.innerHTML = `
                    <div class="mini-profile-header">
                        <div class="mini-profile-avatar" aria-hidden="true"><svg class="ui-icon"><use href="#i-user"></use></svg></div>
                        <div class="mini-profile-info">
                            <div class="mini-profile-name">${escapeHtml(name)}</div>
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
                    ${(isRegistered && !isSelf) ? `
                    <div class="mini-profile-actions">
                        <button type="button" class="btn btn-secondary btn-sm mini-dm-btn">DM</button>
                        <button type="button" class="btn btn-ghost btn-sm mini-friend-btn">Add Friend</button>
                    </div>
                    ` : ''}
                `;
            }
        } catch (err) {
            console.error('Error fetching mini profile:', err);
        }
    };

    const hideMiniProfile = (delay = 900) => {
        if (miniProfileTimeout) {
            clearTimeout(miniProfileTimeout);
            miniProfileTimeout = null;
        }
        miniProfileHideTimer = setTimeout(() => {
            const miniProfile = document.getElementById('chat-mini-profile');
            if (miniProfile) {
                miniProfile.classList.remove('visible');
            }
        }, delay);
    };

    const updateStats = (stats) => {
        document.getElementById('stat-wins').textContent = stats.wins || 0;
        document.getElementById('stat-losses').textContent = stats.losses || 0;
        
        const total = (stats.wins || 0) + (stats.losses || 0);
        const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
        document.getElementById('stat-winrate').textContent = `${winrate}%`;
    };

    const updateBadges = (badges) => {
        const container = document.getElementById('badges-list');
        if (!container) return;
        
        container.innerHTML = '';
        (badges || []).forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badge}`;
            badgeEl.textContent = badge;
            container.appendChild(badgeEl);
        });
    };

    return {
        escapeHtml,
        formatTime,
        showToast,
        updatePlayersList,
        showHoverProfile,
        hideHoverProfile,
        showPlayerProfile,
        addChatMessage,
        showMiniProfile,
        hideMiniProfile,
        updateStats,
        updateBadges
    };
}
