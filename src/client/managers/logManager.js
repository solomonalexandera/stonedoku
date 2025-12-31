// src/client/managers/logManager.js
import { addDoc, collection, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function hasAnalyticsConsent() {
    try {
        const raw = localStorage.getItem('stonedoku_cookie_consent');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return !!parsed?.analytics;
    } catch {
        return false;
    }
}

export function createLogManager(firestore, getAppState) {
    const orig = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };

    let disabled = false;

    async function writeToFirestore(level, args) {
        if (disabled) return;
        if (!hasAnalyticsConsent()) return;
        const appState = getAppState();
        if (!appState || !appState.currentUser) return;

        try {
            const message = args.map(a => {
                try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
            }).join(' ');

            const meta = { src: 'client', href: window.location.href };

            await addDoc(collection(firestore, 'clientLogs'), {
                level: level,
                message: message,
                meta: meta,
                createdAt: Timestamp.now()
            });
        } catch (e) {
            try {
                orig.error('LogManager write failed:', e);
            } catch (_) { }
            if (e && (e.code === 'permission-denied' || String(e).includes('Missing or insufficient permissions'))) {
                disabled = true;
            } else {
                disabled = true;
            }
        }
    }

    // Override console methods
    console.log = (...args) => { orig.log(...args); writeToFirestore('debug', args); };
    console.info = (...args) => { orig.info(...args); writeToFirestore('info', args); };
    console.warn = (...args) => { orig.warn(...args); writeToFirestore('warn', args); };
    console.error = (...args) => { orig.error(...args); writeToFirestore('error', args); };

    return {
        _orig: orig,
        log: (...args) => writeToFirestore('debug', args),
        info: (...args) => writeToFirestore('info', args),
        warn: (...args) => writeToFirestore('warn', args),
        error: (...args) => writeToFirestore('error', args)
    };
}
