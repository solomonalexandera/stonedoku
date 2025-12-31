/**
 * Updates Center
 * Community updates feed and banner system, Firestore-driven
 */

/**
 * Create Updates Center manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.firestore - Firestore instance
 * @param {Function} deps.collection - Firestore collection function
 * @param {Function} deps.query - Firestore query function
 * @param {Function} deps.orderBy - Firestore orderBy function
 * @param {Function} deps.limit - Firestore limit function
 * @param {Function} deps.onSnapshot - Firestore onSnapshot function
 * @param {Object} deps.ViewManager - ViewManager instance
 * @returns {Object} Updates Center manager instance
 */
export function createUpdatesCenter({ firestore, collection, query, orderBy, limit, onSnapshot, ViewManager } = {}) {
    let unsub = null;
    let items = [];
    const state = {
        expanded: false,
        dismissedId: null,
        currentId: null
    };

    // DOM references
    let bannerEl = null;
    let feedEl = null;
    let backBtn = null;
    let eyebrowEl = null;
    let titleEl = null;
    let bodyEl = null;
    let toggleBtn = null;
    let dismissBtn = null;
    let openBtn = null;
    let navBtn = null;

    const getTimeMs = (value) => {
        try {
            if (!value) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') return Date.parse(value) || 0;
            if (value instanceof Date) return value.getTime();
            if (value?.toMillis) return value.toMillis();
            if (value?.seconds) return Number(value.seconds) * 1000;
        } catch { /* ignore */ }
        return 0;
    };

    const normalizeItem = (id, data) => {
        const title = String(data?.title || data?.heading || data?.name || '').trim();
        const body = String(data?.body || data?.message || data?.summary || '').trim();
        const kind = String(data?.type || data?.kind || 'update').trim();
        const severity = String(data?.severity || 'info').trim();
        const createdAtMs = getTimeMs(data?.createdAt || data?.publishedAt || data?.timestamp);
        const startsAtMs = getTimeMs(data?.startsAt || data?.startAt);
        const endsAtMs = getTimeMs(data?.endsAt || data?.endAt);
        const active = data?.active !== false && String(data?.status || 'active') !== 'archived';
        const banner = data?.banner !== false;
        const pinned = data?.pinned === true;

        return {
            id,
            title: title || 'Update',
            body,
            kind,
            severity,
            createdAtMs,
            startsAtMs,
            endsAtMs,
            active,
            banner,
            pinned
        };
    };

    const pickBannerItem = (items) => {
        const now = Date.now();
        const candidates = items
            .filter((item) => item.active && item.banner)
            .filter((item) => (item.startsAtMs ? item.startsAtMs <= now : true))
            .filter((item) => (item.endsAtMs ? item.endsAtMs >= now : true))
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            });
        return candidates[0] || null;
    };

    const setExpanded = (expanded) => {
        state.expanded = !!expanded;
        bannerEl?.classList.toggle('is-expanded', state.expanded);
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', String(state.expanded));
            toggleBtn.setAttribute('aria-label', state.expanded ? 'Collapse update' : 'Expand update');
            toggleBtn.setAttribute('title', state.expanded ? 'Collapse' : 'Expand');
        }
    };

    const dismissBanner = () => {
        state.dismissedId = state.currentId;
        if (bannerEl) bannerEl.style.display = 'none';
    };

    const renderBanner = (items) => {
        const banner = pickBannerItem(items);
        if (!banner || (state.dismissedId && banner.id === state.dismissedId)) {
            if (bannerEl) bannerEl.style.display = 'none';
            return;
        }

        const isNew = banner.id !== state.currentId;
        state.currentId = banner.id;
        if (isNew) setExpanded(false);

        if (eyebrowEl) eyebrowEl.textContent = banner.kind === 'status' ? 'Status' : 'Update';
        if (titleEl) titleEl.textContent = banner.title;
        if (bodyEl) bodyEl.textContent = banner.body;

        bannerEl.dataset.updateId = banner.id;
        bannerEl.dataset.severity = banner.severity;
        bannerEl.style.display = 'block';
    };

    const formatDate = (ms) => {
        if (!ms) return '';
        try {
            return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    const renderFeed = (items) => {
        const container = feedEl || document.getElementById('updates-feed');
        if (!container) return;

        const visible = (items || [])
            .filter((item) => item.active)
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                return (b.createdAtMs || 0) - (a.createdAtMs || 0);
            })
            .slice(0, 100);

        container.innerHTML = '';

        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'updates-empty card';
            empty.textContent = 'No updates yet.';
            container.appendChild(empty);
            return;
        }

        for (const item of visible) {
            const details = document.createElement('details');
            details.className = 'update-card';
            details.dataset.updateId = item.id;
            if (item.pinned) details.classList.add('is-pinned');
            details.dataset.kind = item.kind;
            details.dataset.severity = item.severity;

            const summary = document.createElement('summary');
            summary.className = 'update-card-summary';

            const meta = document.createElement('div');
            meta.className = 'update-meta';

            const tag = document.createElement('span');
            tag.className = 'update-tag';
            tag.textContent = item.kind === 'status' ? 'Status' : 'Update';
            meta.appendChild(tag);

            if (item.pinned) {
                const pinned = document.createElement('span');
                pinned.className = 'update-tag update-tag--pinned';
                pinned.textContent = 'Pinned';
                meta.appendChild(pinned);
            }

            const time = document.createElement('time');
            time.className = 'update-time';
            time.textContent = formatDate(item.createdAtMs);
            meta.appendChild(time);

            const title = document.createElement('div');
            title.className = 'update-title';
            title.textContent = item.title;

            const chevron = document.createElement('span');
            chevron.className = 'update-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            chevron.innerHTML = '<svg class="ui-icon"><use href="#i-chevron-down"></use></svg>';

            summary.appendChild(meta);
            summary.appendChild(title);
            summary.appendChild(chevron);

            const body = document.createElement('div');
            body.className = 'update-card-body';
            body.textContent = item.body || '';

            details.appendChild(summary);
            details.appendChild(body);
            container.appendChild(details);
        }
    };

    const listen = () => {
        if (!firestore || !collection || !query || !orderBy || !limit || !onSnapshot) {
            console.warn('UpdatesCenter: Missing Firestore dependencies');
            return;
        }
        try {
            const q = query(collection(firestore, 'updates'), orderBy('createdAt', 'desc'), limit(25));
            if (typeof unsub === 'function') unsub();
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    items = snapshot.docs.map((d) => normalizeItem(d.id, d.data()));
                    renderBanner(items);
                    renderFeed(items);
                },
                (error) => {
                    console.warn('UpdatesCenter listener error', error);
                }
            );
        } catch (error) {
            console.warn('UpdatesCenter failed to start', error);
        }
    };

    const openFeed = (focusId) => {
        const viewId = 'updates-view';
        const el = document.getElementById(viewId);
        if (!el) return;

        if (ViewManager && !ViewManager.views?.includes('updates')) {
            ViewManager.views?.push('updates');
        }
        ViewManager?.show('updates');

        try {
            const target = focusId ? `#/updates/${encodeURIComponent(focusId)}` : '#/updates';
            if (window.location.hash !== target) {
                window.history.replaceState({}, document.title, target);
            }
        } catch { /* ignore */ }

        if (focusId) {
            requestAnimationFrame(() => {
                const card = document.querySelector(`[data-update-id="${focusId}"]`);
                if (card?.tagName === 'DETAILS') card.open = true;
                card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                card?.classList.add('is-highlighted');
                setTimeout(() => card?.classList.remove('is-highlighted'), 2200);
            });
        }
    };

    const init = (currentUser = null) => {
        bannerEl = document.getElementById('updates-banner');
        if (!bannerEl) return;

        feedEl = document.getElementById('updates-feed');
        backBtn = document.getElementById('updates-back-btn');
        eyebrowEl = document.getElementById('updates-banner-eyebrow');
        titleEl = document.getElementById('updates-banner-title');
        bodyEl = document.getElementById('updates-banner-body');
        toggleBtn = document.getElementById('updates-banner-toggle');
        dismissBtn = document.getElementById('updates-banner-dismiss');
        openBtn = document.getElementById('updates-banner-open');
        navBtn = document.getElementById('updates-nav-btn');

        toggleBtn?.addEventListener('click', () => {
            setExpanded(!state.expanded);
        });
        dismissBtn?.addEventListener('click', () => {
            dismissBanner();
        });

        const open = () => openFeed(state.currentId);
        openBtn?.addEventListener('click', open);
        navBtn?.addEventListener('click', open);

        backBtn?.addEventListener('click', () => {
            if (currentUser) {
                ViewManager?.show('lobby');
            } else {
                ViewManager?.show('auth');
            }
        });

        listen();
    };

    return {
        init,
        listen,
        openFeed,
        formatDate,
        normalizeItem,
        getTimeMs,
        items: () => items,
        state: () => state
    };
}

// Default singleton export for backwards compatibility
export const UpdatesCenter = createUpdatesCenter();
