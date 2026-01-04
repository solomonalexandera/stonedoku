/**
 * Cookie Consent Manager
 * Handles GDPR/PECR compliant cookie consent with granular preferences
 */

const STORAGE_KEY = 'stonedoku_cookie_consent';

/**
 * Create Cookie Consent manager
 * @param {Object} deps - Dependencies
 * @param {Function} deps.openLegalModal - Function to open legal/cookie modal
 * @returns {Object} Cookie Consent manager instance
 */
export function createCookieConsent({ openLegalModal } = {}) {
    const getConsent = () => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch {
            return null;
        }
    };

    const saveConsent = (consent) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...consent,
            timestamp: new Date().toISOString(),
            version: '1.0'
        }));
    };

    const showBanner = () => {
        const banner = document.getElementById('cookie-consent');
        if (banner) {
            banner.style.display = 'block';
            setTimeout(() => {
                const firstBtn = banner.querySelector('button');
                firstBtn?.focus();
            }, 100);
        }
    };

    const hideBanner = () => {
        const banner = document.getElementById('cookie-consent');
        if (banner) {
            banner.style.display = 'none';
        }
    };

    const acceptAll = () => {
        saveConsent({
            essential: true,
            analytics: true,
            preferences: true
        });
        hideBanner();
        applyConsent();
    };

    const acceptSelected = () => {
        saveConsent({
            essential: true,
            analytics: document.getElementById('cookie-analytics')?.checked || false,
            preferences: document.getElementById('cookie-preferences')?.checked || false
        });
        hideBanner();
        applyConsent();
    };

    const rejectNonEssential = () => {
        saveConsent({
            essential: true,
            analytics: false,
            preferences: false
        });
        hideBanner();
        applyConsent();
    };

    const canUseAnalytics = () => {
        const consent = getConsent();
        return !!consent?.analytics;
    };

    const canUsePreferences = () => {
        const consent = getConsent();
        return !!consent?.preferences;
    };

    const applyConsent = () => {
        const consent = getConsent();
        if (!consent) return;
        
        // Analytics and preference cookie handling
        // Analytics: controlled by consent.analytics
        // Preferences: controlled by consent.preferences
        
        if (!consent.preferences) {
            try { localStorage.removeItem('stonedoku_theme'); } catch { /* ignore */ }
        }
    };

    const setupListeners = () => {
        document.getElementById('cookie-accept-all')?.addEventListener('click', () => acceptAll());
        document.getElementById('cookie-accept-selected')?.addEventListener('click', () => acceptSelected());
        document.getElementById('cookie-reject')?.addEventListener('click', () => rejectNonEssential());
        document.getElementById('cookie-learn-more')?.addEventListener('click', () => {
            hideBanner();
            openLegalModal?.('cookies');
        });
        
        document.getElementById('cookies-link')?.addEventListener('click', () => {
            showBanner();
        });
    };

    const init = () => {
        const consent = getConsent();
        if (!consent) {
            showBanner();
        } else {
            applyConsent();
        }
        setupListeners();
    };

    return {
        init,
        getConsent,
        saveConsent,
        showBanner,
        hideBanner,
        acceptAll,
        acceptSelected,
        rejectNonEssential,
        canUseAnalytics,
        canUsePreferences,
        applyConsent,
        setupListeners
    };
}

// Default singleton export for backwards compatibility
export const CookieConsent = createCookieConsent();
