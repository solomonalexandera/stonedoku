/**
 * Auth Flow - Authentication state management and persistence
 */

/**
 * Create Auth Flow manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.auth - Firebase Auth instance
 * @param {Function} deps.setPersistence - Auth persistence setter
 * @param {Object} deps.browserLocalPersistence - Browser local persistence
 * @param {Object} deps.browserSessionPersistence - Browser session persistence  
 * @param {Object} deps.inMemoryPersistence - In-memory persistence
 * @param {Object} deps.AppState - Application state
 * @returns {Object} Auth Flow manager instance
 */
export function createAuthFlow({
    auth,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
    AppState
} = {}) {

    const configureAuthPersistence = async () => {
        try {
            await setPersistence(auth, browserLocalPersistence);
            return 'local';
        } catch (e1) {
            try {
                await setPersistence(auth, browserSessionPersistence);
                return 'session';
            } catch (e2) {
                try {
                    await setPersistence(auth, inMemoryPersistence);
                    return 'memory';
                } catch (e3) {
                    console.warn('Auth persistence configuration failed; using SDK default.', e3);
                    return 'default';
                }
            }
        }
    };

    const getFallbackDisplayName = (user, profileData = null) => {
        const base = profileData?.username || profileData?.displayName || user?.displayName;
        if (base) return base;
        const uid = String(user?.uid || '');
        if (uid) {
            return user?.isAnonymous ? `guest_${uid.substring(0, 6)}` : `Player_${uid.substring(0, 6)}`;
        }
        return user?.isAnonymous ? 'guest' : 'Player';
    };

    const showAuthenticatedShell = (displayName) => {
        const safeName = String(displayName || 'Player');
        const truncatedName = safeName.length > 15 ? safeName.substring(0, 15) + '...' : safeName;
        const userInfo = document.getElementById('user-info');
        const headerName = document.getElementById('user-name');
        const welcomeName = document.getElementById('welcome-name');
        if (userInfo) userInfo.style.display = 'flex';
        if (headerName) headerName.textContent = truncatedName;
        if (welcomeName) welcomeName.textContent = safeName;

        const chatWidget = document.getElementById('chat-widget');
        const chatFab = document.getElementById('chat-fab');
        if (chatWidget) chatWidget.style.display = 'flex';
        if (chatFab) chatFab.style.display = 'flex';
    };

    const shouldDeferLobbyRedirect = () => {
        const hash = window.location.hash || '';
        if (hash.startsWith('#/updates') || hash.startsWith('#/admin')) return true;
        if (hash.startsWith('#/profile/') || hash.startsWith('#profile/')) return true;
        const pathname = window.location.pathname || '';
        return /^\/(?:profile|user|u)\//i.test(pathname);
    };

    const waitForAuthReady = (maxMs = 8000) => {
        if (AppState?.authReady) return Promise.resolve(true);
        return new Promise((resolve) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (AppState?.authReady) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start > maxMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    };

    const isRegisteredUser = (user = null, profile = null) => {
        const u = user || AppState?.currentUser;
        const p = profile || AppState?.profile;
        if (!u) return false;
        if (u.isAnonymous) return false;
        const email = u.email || p?.email || (u.providerData || []).map(pd => pd?.email).find(Boolean);
        return !!email;
    };

    const getCurrentDisplayName = () => {
        const user = AppState?.currentUser;
        const profile = AppState?.profile;
        return profile?.username || profile?.displayName || user?.displayName || 
               (user?.uid ? `Player_${user.uid.substring(0, 6)}` : 'Player');
    };

    return {
        configureAuthPersistence,
        getFallbackDisplayName,
        showAuthenticatedShell,
        shouldDeferLobbyRedirect,
        waitForAuthReady,
        isRegisteredUser,
        getCurrentDisplayName
    };
}
