/**
 * App version + cache management
 * Fetches `/version.txt` at startup. If it differs from the stored
 * `stonedoku_app_version`, clear caches, cookies, indexedDB and service
 * workers to ensure clients pick up new assets after a deploy.
 */

export async function clearAllCachesAndServiceWorkers() {
    try {
        // Clear the CacheStorage entries
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }

        // Unregister service workers
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
    } catch (e) {
        console.error('Cache clearing failed', e);
    }
}

export function clearAllCookies() {
    try {
        const cookies = document.cookie ? document.cookie.split(';') : [];
        for (const cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            // Expire cookie for root path
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
            // Also try without path
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
    } catch (e) {
        console.error('Cookie clearing failed', e);
    }
}

export async function ensureAppVersionFresh() {
    try {
        const res = await fetch('/version.txt', { cache: 'no-store' });
        if (!res.ok) return; // no version file
        const remote = (await res.text()).trim();
        if (!remote) return;
        const local = localStorage.getItem('stonedoku_app_version');
        if (!local) {
            // First run: record version without clearing persistence/auth data
            localStorage.setItem('stonedoku_app_version', remote);
            return;
        }
        if (local === remote) return; // same version

        // New version detected — clear caches/cookies and reload once
        console.info('New app version detected', { from: local, to: remote });
        await clearAllCachesAndServiceWorkers();
        clearAllCookies();
        localStorage.setItem('stonedoku_app_version', remote);
        // Use setTimeout so any in-flight operations can complete
        setTimeout(() => location.reload(true), 200);
    } catch (e) {
        console.error('ensureAppVersionFresh failed', e);
    }
}
