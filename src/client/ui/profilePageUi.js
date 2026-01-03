/**
 * Profile Page Module
 * Handles profile page initialization, editing, social sharing, and URL routing.
 * 
 * @module ui/profilePage
 */

/**
 * Generate share text for social media
 */
export function generateShareText(AppState) {
    const profile = AppState.profile || {};
    const wins = profile.stats?.wins || profile.wins || 0;
    const losses = profile.stats?.losses || profile.losses || 0;
    const badges = Array.isArray(profile.badges) ? profile.badges.length : 0;

    return `Stonedoku — Player Record\n` +
        `Wins: ${wins}\n` +
        `Win Rate: ${wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%\n` +
        `Badges: ${badges}\n` +
        `Play: https://stone-doku.web.app`;
}

/**
 * Share to social media platform
 */
export function shareToSocial(platform, AppState) {
    const text = generateShareText(AppState);
    const url = 'https://stone-doku.web.app';

    let shareUrl;
    switch (platform) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
            break;
        default:
            return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
}

/**
 * Handle vanity URL routing
 */
export async function handleVanityUrl(deps) {
    const { AppState, ProfileManager, UI } = deps;

    try {
        // Hash-based: #/profile/username or #profile/username
        const hash = window.location.hash;
        const hashMatch = hash.match(/^#\/?(?:profile|user|u)\/(.+)$/i);
        if (hashMatch && hashMatch[1]) {
            const username = decodeURIComponent(hashMatch[1]);
            if (username) {
                const profile = await ProfileManager.getProfileByUsername(username);
                if (profile) {
                    const checkAuth = () => {
                        if (AppState.authReady) {
                            UI.showProfilePage(profile.id);
                        } else {
                            setTimeout(checkAuth, 100);
                        }
                    };
                    checkAuth();
                    return;
                }
            }
        }

        // Pathname-based: /profile/username, /user/username, or /u/username
        const pathname = window.location.pathname || '';
        const pathMatch = pathname.match(/^\/(?:profile|user|u)\/(.+)$/i);
        if (pathMatch && pathMatch[1]) {
            const username = decodeURIComponent(pathMatch[1]);
            const profile = await ProfileManager.getProfileByUsername(username);
            if (profile) {
                const checkAuth2 = () => {
                    if (AppState.authReady) {
                        UI.showProfilePage(profile.id);
                    } else {
                        setTimeout(checkAuth2, 100);
                    }
                };
                checkAuth2();
                return;
            }
        }
    } catch (error) {
        console.error('Error loading profile from URL:', error);
    }
}

/**
 * Handle updates deep links (#/updates or #/updates/<docId>)
 */
export function handleUpdatesUrl(UpdatesCenter) {
    try {
        const hash = window.location.hash || '';
        if (!hash.startsWith('#/updates')) return false;
        const match = hash.match(/^#\/updates(?:\/([^?]+))?(?:\?(.*))?$/i);
        if (!match) return false;

        let focusId = match[1] ? decodeURIComponent(match[1]) : null;
        if (!focusId && match[2]) {
            const params = new URLSearchParams(match[2]);
            focusId = params.get('id');
        }

        UpdatesCenter.openFeed(focusId || null);
        return true;
    } catch (e) {
        console.warn('Failed to handle updates URL', e);
        return false;
    }
}

/**
 * Handle admin deep links (#/admin)
 */
export function handleAdminUrl(AppState, AdminConsole) {
    try {
        const hash = window.location.hash || '';
        if (hash.startsWith('#/admin')) {
            if (typeof AdminConsole?.openFromHash === 'function') {
                if (!AppState.authReady) {
                    setTimeout(() => AdminConsole.openFromHash().catch((e) => console.warn('Admin open failed (retry)', e)), 300);
                } else {
                    AdminConsole.openFromHash().catch((e) => console.warn('Admin open failed', e));
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        console.warn('Failed to handle admin URL', e);
        return false;
    }
}

/**
 * Wait for auth to be ready
 */
export function waitForAuthReady(AppState, maxMs = 8000) {
    if (AppState.authReady) return Promise.resolve(true);
    return new Promise((resolve) => {
        const start = Date.now();
        const timer = setInterval(() => {
            if (AppState.authReady) {
                clearInterval(timer);
                resolve(true);
            } else if (Date.now() - start > maxMs) {
                clearInterval(timer);
                resolve(false);
            }
        }, 100);
    });
}

/**
 * Initialize profile page event listeners
 */
export function initProfilePage(deps) {
    const {
        AppState, ViewManager, PresenceManager, ProfileManager, LobbyManager,
        TourManager, UI, isRegisteredUser
    } = deps;

    // Back button
    document.getElementById('profile-back-btn')?.addEventListener('click', () => {
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });

    // Edit profile button
    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
        const profileData = AppState.profile || {};
        const bioDisplay = document.getElementById('profile-page-bio');
        const bioInput = document.getElementById('profile-bio-input');
        const editFields = document.getElementById('profile-edit-fields');
        if (bioDisplay) bioDisplay.style.display = 'none';
        if (bioInput) {
            bioInput.style.display = 'block';
            bioInput.value = profileData.bio || '';
        }
        if (editFields) editFields.style.display = 'block';
        const twitterInput = document.getElementById('profile-twitter');
        const discordInput = document.getElementById('profile-discord');
        if (twitterInput) twitterInput.value = profileData.socialLinks?.twitter || '';
        if (discordInput) discordInput.value = profileData.socialLinks?.discord || '';
        document.getElementById('save-profile-btn').style.display = 'inline-block';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';
        document.getElementById('edit-profile-btn').style.display = 'none';
    });

    // Run orientation tour again (from profile)
    document.getElementById('run-tour-btn')?.addEventListener('click', () => {
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
        setTimeout(() => TourManager.start(true), 250);
    });

    // Save profile changes
    document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
        const bio = document.getElementById('profile-bio-input')?.value || '';
        const twitter = document.getElementById('profile-twitter')?.value || '';
        const discord = document.getElementById('profile-discord')?.value || '';

        try {
            await ProfileManager.updateProfile(AppState.currentUser.uid, {
                bio: bio.substring(0, 200),
                socialLinks: { twitter, discord }
            });

            const bioDisplay = document.getElementById('profile-page-bio');
            if (bioDisplay) bioDisplay.textContent = bio || 'No bio yet...';
            AppState.profile = Object.assign({}, AppState.profile || {}, {
                bio: bio,
                socialLinks: { twitter, discord }
            });

            const bioDisplayEl = document.getElementById('profile-page-bio');
            const bioInputEl = document.getElementById('profile-bio-input');
            const editFields = document.getElementById('profile-edit-fields');
            if (bioDisplayEl) bioDisplayEl.style.display = 'block';
            if (bioInputEl) bioInputEl.style.display = 'none';
            if (editFields) editFields.style.display = 'none';
            document.getElementById('save-profile-btn').style.display = 'none';
            document.getElementById('cancel-edit-btn').style.display = 'none';
            document.getElementById('edit-profile-btn').style.display = 'inline-block';

            UI.showToast('Profile updated.', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            UI.showToast('Failed to update profile.', 'error');
        }
    });

    // Cancel edit
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
        const bioDisplay = document.getElementById('profile-page-bio');
        const bioInput = document.getElementById('profile-bio-input');
        const editFields = document.getElementById('profile-edit-fields');
        if (bioDisplay) bioDisplay.style.display = 'block';
        if (bioInput) bioInput.style.display = 'none';
        if (editFields) editFields.style.display = 'none';
        document.getElementById('save-profile-btn').style.display = 'none';
        document.getElementById('cancel-edit-btn').style.display = 'none';
        document.getElementById('edit-profile-btn').style.display = 'inline-block';
    });

    // Profile picture upload
    document.getElementById('profile-picture-input')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file || !AppState.currentUser) return;

        if (!file.type.startsWith('image/')) {
            UI?.showToast?.('Please select an image file', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            UI?.showToast?.('Image must be less than 2MB', 'error');
            return;
        }

        try {
            const progressIndicator = document.createElement('div');
            progressIndicator.className = 'upload-progress';
            progressIndicator.textContent = 'Uploading...';
            document.querySelector('.profile-picture-wrapper')?.appendChild(progressIndicator);

            const url = await ProfileManager.uploadProfilePicture(AppState.currentUser.uid, file);

            const img = document.getElementById('profile-page-picture');
            const placeholder = document.getElementById('profile-picture-placeholder');
            if (img) {
                img.src = url;
                img.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';

            progressIndicator.remove();
            UI.showToast('Profile picture updated.', 'success');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            UI.showToast('Failed to upload profile picture.', 'error');
        }
    });

    // Copy profile URL
    document.getElementById('copy-profile-url')?.addEventListener('click', async () => {
        const linkEl = document.getElementById('profile-vanity-link');
        const url = linkEl?.href || linkEl?.textContent || '';
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            UI.showToast('Profile URL copied.', 'success');
        } catch (e) {
            console.warn('Clipboard write failed', e);
            try {
                window.prompt('Copy profile URL:', url);
            } catch { /* ignore */ }
            UI.showToast('Copy failed. URL shown for manual copy.', 'error');
        }
    });

    // Social sharing
    document.getElementById('share-twitter')?.addEventListener('click', () => {
        shareToSocial('twitter', AppState);
    });

    document.getElementById('share-facebook')?.addEventListener('click', () => {
        shareToSocial('facebook', AppState);
    });

    document.getElementById('share-copy')?.addEventListener('click', () => {
        const shareText = generateShareText(AppState);
        navigator.clipboard.writeText(shareText).then(() => {
            UI.showToast('Stats copied.', 'success');
        }).catch(() => {
            UI.showToast('Copy failed.', 'error');
        });
    });

    // Challenge from profile
    document.getElementById('profile-challenge-btn')?.addEventListener('click', async () => {
        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
        if (!profileUserId || !AppState.currentUser) return;
        const roomId = await LobbyManager.createRoom(AppState.currentUser.uid);
        alert(`Room created! Share code: ${roomId} with this player.`);
    });

    // Friend button
    document.getElementById('profile-friend-btn')?.addEventListener('click', async () => {
        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
        if (!profileUserId || !AppState.currentUser) return;
        if (!isRegisteredUser()) {
            UI?.showToast?.('Sign up with an email account to add friends.', 'info');
            return;
        }

        const btn = document.getElementById('profile-friend-btn');
        const currentText = btn?.textContent || '';
        const labelEl = btn?.querySelector('.btn-label');

        try {
            if (currentText.includes('Add Friend')) {
                await ProfileManager.sendFriendRequest(AppState.currentUser.uid, profileUserId);
                if (labelEl) labelEl.textContent = 'Request Sent';
                else if (btn) btn.textContent = 'Request Sent';
                UI?.showToast?.('Friend request sent!', 'success');
            } else if (currentText.includes('Remove Friend')) {
                await ProfileManager.removeFriend(AppState.currentUser.uid, profileUserId);
                if (labelEl) labelEl.textContent = 'Add Friend';
                else if (btn) btn.textContent = 'Add Friend';
                UI?.showToast?.('Friend removed', 'info');
            } else if (currentText.includes('Accept Request')) {
                await ProfileManager.acceptFriendRequest(AppState.currentUser.uid, profileUserId);
                if (labelEl) labelEl.textContent = 'Friends';
                else if (btn) btn.textContent = 'Friends';
            }
        } catch (error) {
            console.error('Friend action error:', error);
            const msg = error?.message || 'Failed to complete action';
            UI?.showToast?.(msg.includes('registered') ? msg : 'Failed to complete action: ' + msg, 'error');
        }
    });

    // DM from profile
    document.getElementById('profile-dm-btn')?.addEventListener('click', async () => {
        const profileUserId = document.getElementById('profile-view')?.dataset.userId;
        if (!profileUserId) return;
        if (!isRegisteredUser()) {
            UI?.showToast?.('Sign up with an email account to send direct messages and add friends.', 'info');
            return;
        }

        try {
            await window.ChatWidget?.openDm?.(profileUserId);
        } catch (e) {
            console.warn('Failed to open DM conversation:', e);
        }
    });

    // My Profile button in header
    document.getElementById('my-profile-btn')?.addEventListener('click', () => {
        if (AppState.currentUser) {
            UI.showProfilePage(AppState.currentUser.uid);
        }
    });
}

/**
 * Factory to create profile page manager
 */
export function createProfilePage(deps) {
    return {
        init() {
            initProfilePage(deps);
        },
        generateShareText: () => generateShareText(deps.AppState),
        shareToSocial: (platform) => shareToSocial(platform, deps.AppState),
        handleVanityUrl: () => handleVanityUrl(deps),
        handleUpdatesUrl: () => handleUpdatesUrl(deps.UpdatesCenter),
        handleAdminUrl: () => handleAdminUrl(deps.AppState, deps.AdminConsole),
        waitForAuthReady: (maxMs) => waitForAuthReady(deps.AppState, maxMs)
    };
}

export default createProfilePage;
