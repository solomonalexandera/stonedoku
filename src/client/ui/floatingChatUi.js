/**
 * Floating Chat Widget Module
 * Handles the chat widget UI, direct messages, notifications, and channel management.
 * 
 * @module ui/floatingChat
 */

/**
 * Normalize timestamp values from various formats
 */
export function normalizeTimestamp(ts) {
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string' && ts) {
        const n = Number(ts);
        if (Number.isFinite(n)) return n;
    }
    if (ts && typeof ts === 'object') {
        const n = Number(ts);
        if (Number.isFinite(n)) return n;
    }
    return Date.now();
}

/**
 * Normalize chat message structure
 */
export function normalizeChatMessage(raw) {
    const userId = raw?.userId ?? raw?.from ?? null;
    const displayName = raw?.displayName ?? raw?.fromDisplayName ?? raw?.sender ?? (userId ? `Player_${String(userId).substring(0, 6)}` : 'Player');
    const text = String(raw?.text ?? '').trim();
    const timestamp = normalizeTimestamp(raw?.timestamp);
    return { userId, displayName, text, timestamp };
}

/**
 * Create notification center for chat
 */
export function createNotificationCenter(deps) {
    const { AppState, AudioManager, notifToggles, widget, getActiveChannel } = deps;

    const defaults = { global: true, game: true, dms: true, sound: true, badges: true };
    const counts = { global: 0, game: 0, dm: new Map() };

    const loadPrefs = () => {
        try {
            const raw = localStorage.getItem('stonedoku_notif_prefs');
            if (raw) return JSON.parse(raw);
        } catch { /* ignore */ }
        return {};
    };

    const prefs = Object.assign({}, defaults, AppState.settings.notifications || {}, loadPrefs());
    AppState.settings.notifications = prefs;

    const persist = () => {
        AppState.settings.notifications = Object.assign({}, prefs);
        try { localStorage.setItem('stonedoku_notif_prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
    };

    const syncToggles = () => {
        Object.entries(notifToggles).forEach(([key, el]) => {
            if (el) el.checked = !!prefs[key];
        });
    };
    syncToggles();

    const isChannelActive = (channel) => {
        const active = getActiveChannel();
        const minimized = widget.classList.contains('minimized');
        return !minimized && active === channel;
    };

    const shouldCount = (channel) => {
        if (channel === 'global') return !!prefs.global;
        if (channel === 'game') return !!prefs.game;
        if (channel && channel.startsWith && channel.startsWith('dm_')) return !!prefs.dms;
        return true;
    };

    const getTotal = () => {
        let dmTotal = 0;
        counts.dm.forEach((v) => { dmTotal += v; });
        return counts.global + counts.game + dmTotal;
    };

    const updateBadgeUi = () => {
        const fabUnread = document.getElementById('fab-unread');
        const widgetUnread = document.getElementById('unread-badge');
        const total = getTotal();

        if (!prefs.badges) {
            if (fabUnread) fabUnread.style.display = 'none';
            if (widgetUnread) widgetUnread.style.display = 'none';
            return;
        }

        if (total > 0) {
            if (fabUnread) {
                fabUnread.textContent = total > 99 ? '99+' : total;
                fabUnread.style.display = 'block';
            }
            if (widgetUnread) {
                widgetUnread.textContent = total > 99 ? '99+' : total;
                widgetUnread.style.display = 'inline-block';
            }
        } else {
            if (fabUnread) fabUnread.style.display = 'none';
            if (widgetUnread) widgetUnread.style.display = 'none';
        }
    };

    const markRead = (channel) => {
        if (!channel) return;
        if (channel === 'global') counts.global = 0;
        else if (channel === 'game') counts.game = 0;
        else if (channel.startsWith && channel.startsWith('dm_')) {
            const id = channel.replace('dm_', '');
            counts.dm.delete(id);
        }
        updateBadgeUi();
    };

    const markActiveChannel = () => {
        const active = getActiveChannel();
        if (active) markRead(active);
    };

    const markIncoming = (channel, senderId = null, dmId = null) => {
        if (senderId && AppState.currentUser && senderId === AppState.currentUser.uid) return;
        if (!shouldCount(channel)) return;
        if (isChannelActive(channel)) return;

        if (channel === 'global') counts.global += 1;
        else if (channel === 'game') counts.game += 1;
        else if (channel.startsWith && channel.startsWith('dm_')) {
            const id = dmId || channel.replace('dm_', '');
            const next = (counts.dm.get(id) || 0) + 1;
            counts.dm.set(id, next);
        }

        updateBadgeUi();

        const allowSound = prefs.sound && shouldCount(channel);
        if (allowSound) {
            if (channel.startsWith && channel.startsWith('dm_')) AudioManager.playDmPing();
            else AudioManager.playChatPing();
        }
    };

    const syncDmThreads = (threadsMap) => {
        counts.dm.clear();
        if (threadsMap) {
            Object.entries(threadsMap).forEach(([uid, thread]) => {
                const unread = Math.max(0, Number(thread?.unread) || 0);
                if (unread > 0) counts.dm.set(uid, unread);
            });
        }
        updateBadgeUi();
    };

    const reset = () => {
        counts.global = 0;
        counts.game = 0;
        counts.dm.clear();
        updateBadgeUi();
    };

    const setPref = (key, value) => {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            prefs[key] = !!value;
            persist();
            syncToggles();
            updateBadgeUi();
        }
    };

    return {
        markIncoming,
        markRead,
        markActiveChannel,
        syncDmThreads,
        reset,
        prefs,
        setPref,
        updateBadgeUi
    };
}

/**
 * Create the floating chat widget
 */
export function createFloatingChat(deps) {
    const {
        AppState, ViewManager, UI, AudioManager, ProfileManager, ChatManager, LobbyManager,
        ref, rtdb, get, update, onChildAdded,
        firestore, collection, query, where, limit, getDocs, getDoc, doc, orderBy, documentId,
        isRegisteredUser, getCurrentDisplayName
    } = deps;

    const widget = document.getElementById('chat-widget');
    const fab = document.getElementById('chat-fab');
    const header = document.getElementById('chat-widget-header');
    const minimizeBtn = document.getElementById('chat-minimize');
    const form = document.getElementById('chat-widget-form');
    const input = document.getElementById('chat-widget-input');

    // Ensure guests always see a hint in the input
    if (input && !input.placeholder) {
        input.placeholder = 'Type a message…';
    }

    if (!widget || !fab) return null;

    // State
    const MAX_MESSAGES_PER_CHANNEL = 200;
    const messageStore = new Map();
    let activeDmUnsub = null;
    let activeDmUserId = null;
    let activeDmSeenKeys = new Set();
    let dmUnreadCache = new Map();
    let dmEnabled = false;
    let suggestionHideTimer = null;

    // DOM elements
    const dmListEl = document.getElementById('dm-list');
    const dmConversationsEl = document.getElementById('dm-conversations');
    const chatHintEl = document.getElementById('chat-hint');
    const messagesEl = document.getElementById('chat-widget-messages');
    const newDmBtn = document.getElementById('new-dm-btn');
    const dmTabBtn = document.getElementById('widget-dms-tab');
    const friendsTabBtn = document.getElementById('widget-friends-tab');
    const dmQuickSection = document.getElementById('dm-quick');
    const dmFriendsSection = document.getElementById('dm-friends');
    const dmFriendsListEl = document.getElementById('dm-friends-list');
    const dmConversationsSection = document.getElementById('dm-list');
    const dmStartModal = document.getElementById('dm-start-modal');
    const dmStartInput = document.getElementById('dm-start-username');
    const dmStartResults = document.getElementById('dm-start-results');
    const dmStartCancel = document.getElementById('dm-start-cancel');
    const dmQuickInput = document.getElementById('dm-quick-handle');
    const dmQuickStatus = document.getElementById('dm-quick-status');
    const dmQuickOpenBtn = document.getElementById('dm-quick-open');
    const dmQuickAddBtn = document.getElementById('dm-quick-add');
    const friendHandleInput = document.getElementById('friend-handle-input');
    const friendAddBtn = document.getElementById('friend-add-btn');
    const emojiToggle = document.getElementById('widget-emoji-toggle');
    const emojiPicker = document.getElementById('emoji-picker-widget');
    const notificationBtn = document.getElementById('chat-notify-btn');
    const notificationPanel = document.getElementById('chat-notify-panel');

    const notifToggles = {
        global: document.getElementById('notify-global'),
        game: document.getElementById('notify-game'),
        dms: document.getElementById('notify-dms'),
        sound: document.getElementById('notify-sound'),
        badges: document.getElementById('notify-badge')
    };

    // Moderation notice
    const showChatModerationNotice = (() => {
        let shown = false;
        return () => {
            if (shown) return;
            if (AppState.moderation.muted || AppState.moderation.blocked) {
                const msg = AppState.moderation.muted && AppState.moderation.blocked
                    ? 'Messaging restricted: muted and blocked by an administrator.'
                    : AppState.moderation.muted
                        ? 'Messaging restricted: you are muted by an administrator.'
                        : 'Messaging restricted: you are blocked from messaging.';
                UI.showToast(msg, 'warn');
                shown = true;
            }
        };
    })();

    // Viewport offset for mobile keyboards
    (function initViewportOffset() {
        const applyOffset = () => {
            if (!window.visualViewport) {
                document.documentElement.style.setProperty('--chat-vv-offset', '0px');
                return;
            }
            const offset = Math.max(0, window.innerHeight - window.visualViewport.height);
            document.documentElement.style.setProperty('--chat-vv-offset', `${offset}px`);
        };
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', applyOffset);
            window.visualViewport.addEventListener('scroll', applyOffset);
            applyOffset();
        }
        input?.addEventListener('focus', applyOffset);
        input?.addEventListener('blur', () => setTimeout(applyOffset, 150));
    })();

    // Get active channel
    function getActiveChannel() {
        const activeTab = document.querySelector('.widget-tab.active');
        const tabMode = activeTab?.dataset.chat || 'global';
        const stateMode = AppState.widgetChatMode || tabMode;
        if (stateMode && stateMode.startsWith && stateMode.startsWith('dm_')) return stateMode;
        if (stateMode === 'global' || stateMode === 'game' || stateMode === 'dms' || stateMode === 'friends') return stateMode;
        return tabMode;
    }

    // Create notification center
    const NotificationCenter = createNotificationCenter({
        AppState,
        AudioManager,
        notifToggles,
        widget,
        getActiveChannel
    });

    // Wire up notification toggles
    Object.entries(notifToggles).forEach(([key, el]) => {
        el?.addEventListener('change', (e) => {
            NotificationCenter.setPref(key, e.target.checked);
        });
    });

    NotificationCenter.updateBadgeUi();

    notificationBtn?.addEventListener('click', () => {
        if (!notificationPanel) return;
        const visible = notificationPanel.style.display !== 'none';
        notificationPanel.style.display = visible ? 'none' : 'block';
    });

    function clearActiveUnread() {
        NotificationCenter.markActiveChannel();
    }

    // Username suggestion box for whisper autocomplete
    const suggestionBox = document.createElement('div');
    suggestionBox.id = 'chat-suggestion-box';
    suggestionBox.style.cssText = `
        position: fixed; z-index: 9999;
        background: var(--color-card-bg-solid);
        border: 1px solid var(--color-grid-border);
        box-shadow: var(--shadow-md);
        display: none; min-width: 180px;
        max-height: 240px; overflow: auto;
        border-radius: 0; padding: 6px 0; font-size: 14px;
    `;
    document.body.appendChild(suggestionBox);

    let suggestions = [];
    let selectedIndex = -1;

    async function fetchUsernameSuggestions(prefix) {
        if (!dmEnabled) return [];
        if (!prefix) return [];
        const p = prefix.toLowerCase();
        const selfUsername = (AppState.profile?.usernameLower || AppState.profile?.username || '').toLowerCase();
        const seed = (selfUsername && selfUsername.startsWith(p)) ? [selfUsername] : [];

        try {
            const q = query(collection(firestore, 'usernames'), where(documentId(), '>=', p), where(documentId(), '<=', p + '\\uf8ff'), limit(32));
            const snap = await getDocs(q);
            const candidates = snap.docs.map(d => ({ username: d.id, userId: d.data().userId }));

            try {
                const presRef = ref(rtdb, 'presence');
                const presSnap = await get(presRef);
                const onlineSet = new Set();
                presSnap.forEach(child => {
                    const val = child.val() || {};
                    const last = val.last_changed || 0;
                    const now = Date.now();
                    const recent = typeof last === 'number' ? (now - last) < 45000 : true;
                    if (val.status === 'online' && recent) onlineSet.add(child.key);
                });

                const online = [];
                const offline = [];
                for (const c of candidates) {
                    if (onlineSet.has(c.userId)) online.push(c.username);
                    else offline.push(c.username);
                }
                const merged = seed.concat(online, offline).slice(0, 8);
                if (merged.length > 0) return merged;
            } catch (e) {
                console.warn('Presence read failed for suggestions, falling back:', e);
            }

            if (candidates.length > 0) {
                return seed.concat(candidates.slice(0, 8).map(c => c.username));
            }

            const usersQ = query(
                collection(firestore, 'users'),
                orderBy('usernameLower'),
                where('usernameLower', '>=', p),
                where('usernameLower', '<=', p + '\uf8ff'),
                limit(8)
            );
            const userSnap = await getDocs(usersQ);
            const fromUsers = userSnap.docs.map(d => d.data()?.usernameLower || d.data()?.username).filter(Boolean);
            return Array.from(new Set(seed.concat(fromUsers))).slice(0, 8);
        } catch (e) {
            console.error('Username suggestion fetch failed', e);
            try {
                const slice = await getDocs(query(collection(firestore, 'users'), limit(32)));
                const local = [];
                slice.forEach((d) => {
                    const data = d.data() || {};
                    const uname = (data.usernameLower || data.username || '').toLowerCase();
                    if (uname && uname.startsWith(p)) local.push(uname);
                });
                return Array.from(new Set(seed.concat(local))).slice(0, 8);
            } catch (_e) {
                return seed;
            }
        }
    }

    function positionSuggestionBox() {
        if (!input) return;
        if (widget.classList.contains('minimized')) {
            suggestionBox.style.display = 'none';
            return;
        }
        const rect = input.getBoundingClientRect();
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const viewportH = window.innerHeight || document.documentElement.clientHeight;
        const safeBottom = 10 + (window.visualViewport?.offsetTop || 0);

        const boxMaxH = 240;
        const desiredW = rect.width;
        const desiredLeft = rect.left;
        const belowTop = rect.bottom + 6;
        const aboveTop = rect.top - 6 - boxMaxH;

        let left = Math.max(10, Math.min(desiredLeft, viewportW - desiredW - 10));
        let top = belowTop;
        if (belowTop + boxMaxH > viewportH - safeBottom) {
            top = Math.max(10, aboveTop);
        }

        suggestionBox.style.left = `${Math.round(left)}px`;
        suggestionBox.style.top = `${Math.round(top)}px`;
        suggestionBox.style.width = `${Math.round(desiredW)}px`;
    }

    function renderSuggestions(list) {
        suggestions = list || [];
        selectedIndex = -1;
        if (suggestionHideTimer) {
            clearTimeout(suggestionHideTimer);
            suggestionHideTimer = null;
        }
        suggestionBox.innerHTML = '';
        if (!suggestions || suggestions.length === 0) {
            suggestionBox.style.display = 'none';
            return;
        }
        suggestionBox.style.display = 'block';
        suggestions.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'chat-suggestion-item';
            item.style.cssText = 'padding: 6px 10px; cursor: pointer; white-space: nowrap;';
            item.textContent = s;
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                applySuggestion(s);
            });
            suggestionBox.appendChild(item);
        });
        positionSuggestionBox();
    }

    function applySuggestion(username) {
        if (!input) return;
        const value = input.value || '';
        const m = value.match(/^(@w(?:hisper)?\s+)([A-Za-z0-9_\-]*)(.*)$/i);
        if (!m) return;
        const prefix = m[1];
        const rest = m[3] || '';
        const needsSpace = rest.length > 0 && !rest.startsWith(' ');
        input.value = `${prefix}${username}${needsSpace ? ' ' : ''}${rest}`.replace(/\s{2,}/g, ' ');
        input.focus();
        suggestionBox.style.display = 'none';
    }

    function updateSelection() {
        const items = suggestionBox.querySelectorAll('.chat-suggestion-item');
        items.forEach((it, idx) => {
            it.style.background = idx === selectedIndex ? 'rgba(0,0,0,0.06)' : 'transparent';
        });
        if (selectedIndex >= 0 && items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // Keyboard navigation for suggestions
    input?.addEventListener('keydown', (e) => {
        if (suggestionBox.style.display === 'none') return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(suggestions.length - 1, selectedIndex + 1);
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(0, selectedIndex - 1);
            updateSelection();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                e.preventDefault();
                applySuggestion(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            suggestionBox.style.display = 'none';
        }
    });

    input?.addEventListener('input', async (e) => {
        if (!dmEnabled) {
            suggestionBox.style.display = 'none';
            return;
        }
        const val = e.target.value || '';
        const m = val.match(/^(@w(?:hisper)?\s+)([A-Za-z0-9_\-]{0,})(.*)$/i);
        if (!m) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 200);
            return;
        }

        const prefix = m[1] || '';
        const fragment = m[2] || '';
        const rest = m[3] || '';
        const cursor = typeof input.selectionStart === 'number' ? input.selectionStart : val.length;
        const usernameStart = prefix.length;
        const usernameEnd = usernameStart + fragment.length;

        if (cursor < usernameStart || cursor > usernameEnd) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
            return;
        }

        if (rest.length > 0 && !rest.startsWith(' ')) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
            return;
        }

        if (fragment.length < 1) {
            suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
            return;
        }
        const list = await fetchUsernameSuggestions(fragment);
        renderSuggestions(list);
    });

    input?.addEventListener('blur', () => {
        suggestionHideTimer = setTimeout(() => { suggestionBox.style.display = 'none'; }, 150);
    });

    // DM helpers
    const getDmDisplayName = (otherUserId) => {
        if (!otherUserId) return 'Player';
        const thread = AppState.dmThreads?.[otherUserId];
        if (thread?.otherDisplayName) return thread.otherDisplayName;
        return `Player_${String(otherUserId).substring(0, 6)}`;
    };

    const ensureDmDisplayMeta = async (otherUserId) => {
        if (!otherUserId) return null;
        if (!AppState.dmThreads) AppState.dmThreads = {};
        const existing = AppState.dmThreads[otherUserId] || {};
        if (existing.otherDisplayName && existing.otherPhotoUrl) return existing;
        try {
            const snap = await ProfileManager.getProfile(otherUserId);
            if (snap.exists()) {
                const data = snap.data() || {};
                const updated = {
                    ...existing,
                    otherDisplayName: data.displayName || data.username || existing.otherDisplayName || `Player_${String(otherUserId).substring(0, 6)}`,
                    otherPhotoUrl: data.profilePicture || existing.otherPhotoUrl || null
                };
                AppState.dmThreads[otherUserId] = updated;
                return updated;
            }
        } catch (e) {
            console.warn('ensureDmDisplayMeta failed', e);
        }
        return existing;
    };

    const markThreadRead = async (otherUserId) => {
        if (!otherUserId || !AppState.currentUser) return;
        try {
            await update(ref(rtdb, `dmThreads/${AppState.currentUser.uid}/${otherUserId}`), { unread: 0 });
        } catch { /* ignore */ }
        const channel = `dm_${otherUserId}`;
        NotificationCenter.markRead(channel);
    };

    function setChatHint(message) {
        if (!chatHintEl) return;
        const textEl = chatHintEl.querySelector('#chat-hint-text');
        if (textEl) textEl.textContent = message;
    }

    function setDmEnabled(next) {
        dmEnabled = !!next;
        if (dmTabBtn) dmTabBtn.style.display = dmEnabled ? '' : 'none';
        if (friendsTabBtn) friendsTabBtn.style.display = dmEnabled ? '' : 'none';
        if (newDmBtn) newDmBtn.style.display = dmEnabled ? '' : 'none';

        if (!dmEnabled) {
            if (AppState.widgetChatMode === 'dms' || AppState.widgetChatMode === 'friends' || (AppState.widgetChatMode && AppState.widgetChatMode.startsWith && AppState.widgetChatMode.startsWith('dm_'))) {
                AppState.widgetChatMode = 'global';
                document.querySelectorAll('.widget-tab').forEach((t) => t.classList.toggle('active', t.dataset.chat === 'global'));
                if (dmListEl) dmListEl.style.display = 'none';
                if (dmFriendsSection) dmFriendsSection.style.display = 'none';
                if (messagesEl) messagesEl.style.display = 'flex';
                if (chatHintEl) chatHintEl.style.display = 'none';
                renderChannel('global');
            }
            setChatHint('Sign in to start direct messages.');
        } else {
            setChatHint('Tip: Use direct messages to send private messages');
        }
    }

    function syncChatModeUi(mode) {
        const isDmConversation = mode && mode.startsWith && mode.startsWith('dm_');
        const isDmList = mode === 'dms';
        const isFriends = mode === 'friends';
        const isDmArea = isDmConversation || isDmList;

        if (dmQuickSection) dmQuickSection.style.display = dmEnabled && isDmList ? 'block' : 'none';

        if (!isDmArea && !isFriends) {
            if (dmConversationsSection) dmConversationsSection.style.display = 'none';
            if (dmFriendsSection) dmFriendsSection.style.display = 'none';
            if (messagesEl) messagesEl.style.display = 'flex';
            if (chatHintEl) chatHintEl.style.display = 'none';
            return;
        }

        if (dmConversationsSection) dmConversationsSection.style.display = isDmList ? 'block' : 'none';
        if (dmFriendsSection) dmFriendsSection.style.display = isFriends ? 'block' : 'none';
        if (messagesEl) messagesEl.style.display = isDmConversation ? 'flex' : 'none';
        if (chatHintEl) chatHintEl.style.display = isDmList ? 'block' : 'none';
    }

    async function renderDmFriends() {
        if (!dmFriendsListEl) return;
        const friendIds = Array.isArray(AppState.friends) ? AppState.friends : [];
        dmFriendsListEl.innerHTML = '';
        if (friendIds.length === 0) {
            dmFriendsListEl.innerHTML = '<div class="dm-empty">No friends yet.</div>';
            return;
        }
        const profiles = await Promise.all(friendIds.map(async (id) => {
            try {
                const snap = await ProfileManager.getProfile(id);
                return snap.exists() ? { id, ...(snap.data() || {}) } : { id };
            } catch {
                return { id };
            }
        }));
        for (const p of profiles) {
            const row = document.createElement('div');
            row.className = 'dm-friend-item';
            row.dataset.userId = p.id;
            const name = p.displayName || p.username || `Player_${String(p.id).substring(0, 6)}`;
            row.innerHTML = `
                <div class="dm-friend-name">${UI.escapeHtml(name)}</div>
                <div class="dm-friend-actions">
                    <button type="button" class="btn btn-secondary btn-sm dm-friend-btn">DM</button>
                </div>
            `;
            dmFriendsListEl.appendChild(row);
        }
    }

    function storeAppend(channel, raw) {
        if (!channel) return;
        const msg = normalizeChatMessage(raw);
        if (!msg.text) return;

        const list = messageStore.get(channel) || [];
        
        // Deduplicate: check if message already exists by matching text, userId, and approximate timestamp
        const isDuplicate = list.some(existing => 
            existing.text === msg.text && 
            existing.userId === msg.userId &&
            Math.abs((existing.timestamp || 0) - (msg.timestamp || 0)) < 5000 // within 5 seconds
        );
        if (isDuplicate) return;

        list.push(msg);
        if (list.length > MAX_MESSAGES_PER_CHANNEL) list.splice(0, list.length - MAX_MESSAGES_PER_CHANNEL);
        messageStore.set(channel, list);

        const active = getActiveChannel();
        const isActive = active === channel;
        const messagesVisible = messagesEl && messagesEl.style.display !== 'none';
        if (isActive && messagesVisible && !widget.classList.contains('minimized')) {
            UI.addChatMessage('chat-widget-messages', msg.displayName, msg.text, msg.timestamp, msg.userId);
        }
    }

    function renderChannel(channel) {
        if (!messagesEl) return;
        messagesEl.innerHTML = '';

        if (channel && channel.startsWith && channel.startsWith('dm_')) {
            const otherId = channel.replace('dm_', '');
            const name = getDmDisplayName(otherId);
            const headerMsg = document.createElement('div');
            headerMsg.className = 'chat-system-msg';
            headerMsg.textContent = `Direct messages with ${name}`;
            messagesEl.appendChild(headerMsg);
        }

        const list = messageStore.get(channel) || [];
        for (const msg of list) {
            UI.addChatMessage('chat-widget-messages', msg.displayName, msg.text, msg.timestamp, msg.userId);
        }

        clearActiveUnread();
    }

    function renderDmList() {
        if (!dmConversationsEl) return;

        const threads = Object.entries(AppState.dmThreads || {})
            .map(([otherUserId, data]) => ({ otherUserId, ...(data || {}) }))
            .sort((a, b) => (Number(b.lastTimestamp) || 0) - (Number(a.lastTimestamp) || 0));

        if (threads.length === 0) {
            dmConversationsEl.innerHTML = '<div class="dm-empty">No conversations yet. Start one from a profile or the + button.</div>';
            return;
        }

        dmConversationsEl.innerHTML = '';
        for (const t of threads) {
            const item = document.createElement('div');
            item.className = 'dm-conversation-item';
            item.dataset.userId = t.otherUserId;

            if (AppState.widgetChatMode === `dm_${t.otherUserId}`) item.classList.add('active');

            const avatar = document.createElement('div');
            avatar.className = 'dm-avatar';
            if (t.otherPhotoUrl) {
                avatar.innerHTML = `<img src="${UI.escapeHtml(t.otherPhotoUrl)}" alt="">`;
            } else {
                avatar.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>';
            }

            const info = document.createElement('div');
            info.className = 'dm-info';

            const name = document.createElement('div');
            name.className = 'dm-name';
            name.textContent = getDmDisplayName(t.otherUserId);

            const preview = document.createElement('div');
            preview.className = 'dm-preview';
            preview.textContent = t.lastText || '';

            info.appendChild(name);
            info.appendChild(preview);

            item.appendChild(avatar);
            item.appendChild(info);

            const unread = Math.max(0, Number(t.unread) || 0);
            if (unread > 0) {
                const badge = document.createElement('div');
                badge.className = 'dm-unread';
                badge.textContent = unread > 99 ? '99+' : String(unread);
                item.appendChild(badge);
            }

            dmConversationsEl.appendChild(item);
        }
    }

    function syncDmUnreadCounts() {
        const dmCounts = {};
        for (const [otherUserId, thread] of Object.entries(AppState.dmThreads || {})) {
            const unread = Math.max(0, Number(thread?.unread) || 0);
            dmCounts[otherUserId] = thread;
            const prevUnread = Math.max(0, Number(dmUnreadCache.get(otherUserId)) || 0);
            if (unread > prevUnread && NotificationCenter.prefs.sound && NotificationCenter.prefs.dms) {
                AudioManager.playDmPing();
            }
            dmUnreadCache.set(otherUserId, unread);
        }

        for (const key of Array.from(dmUnreadCache.keys())) {
            if (!AppState.dmThreads || !Object.prototype.hasOwnProperty.call(AppState.dmThreads, key)) {
                dmUnreadCache.delete(key);
            }
        }

        NotificationCenter.syncDmThreads(dmCounts);
        renderDmList();
    }

    async function openDmConversation(otherUserId) {
        if (!otherUserId || !AppState.currentUser) return;
        if (otherUserId === AppState.currentUser.uid) return;

        widget.classList.remove('minimized');
        fab.classList.add('hidden');
        suggestionBox.style.display = 'none';

        document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.widget-tab[data-chat="dms"]')?.classList.add('active');

        AppState.widgetChatMode = `dm_${otherUserId}`;
        syncChatModeUi(AppState.widgetChatMode);
        if (dmListEl) dmListEl.style.display = 'none';
        if (messagesEl) messagesEl.style.display = 'flex';
        if (chatHintEl) chatHintEl.style.display = 'none';

        NotificationCenter.markRead(AppState.widgetChatMode);
        renderDmList();

        try {
            await update(ref(rtdb, `dmThreads/${AppState.currentUser.uid}/${otherUserId}`), { unread: 0 });
        } catch { /* ignore */ }

        if (typeof activeDmUnsub === 'function') activeDmUnsub();
        activeDmUnsub = null;
        activeDmUserId = otherUserId;
        activeDmSeenKeys = new Set();

        const dmId = ChatManager.dmIdFor(AppState.currentUser.uid, otherUserId);
        const dmRef = ref(rtdb, `directMessages/${dmId}`);
        await ChatManager.ensureDmParticipants(dmId, AppState.currentUser.uid, otherUserId);
        await ensureDmDisplayMeta(otherUserId);

        try {
            const snap = await get(dmRef);
            const history = [];
            if (snap.exists()) {
                snap.forEach((child) => {
                    activeDmSeenKeys.add(child.key);
                    history.push(child.val());
                });
            }
            history.sort((a, b) => normalizeTimestamp(a?.timestamp) - normalizeTimestamp(b?.timestamp));
            messageStore.set(`dm_${otherUserId}`, history.map(normalizeChatMessage));
        } catch (e) {
            console.warn('Failed to load DM history', e);
            messageStore.set(`dm_${otherUserId}`, []);
        }

        renderChannel(`dm_${otherUserId}`);
        renderDmList();
        markThreadRead(otherUserId);

        activeDmUnsub = onChildAdded(dmRef, (snapshot) => {
            if (activeDmUserId !== otherUserId) return;
            if (activeDmSeenKeys.has(snapshot.key)) return;
            activeDmSeenKeys.add(snapshot.key);

            const msg = snapshot.val();
            storeAppend(`dm_${otherUserId}`, msg);

            if (!widget.classList.contains('minimized') && getActiveChannel() === `dm_${otherUserId}` && msg?.from && msg.from !== AppState.currentUser.uid) {
                update(ref(rtdb, `dmThreads/${AppState.currentUser.uid}/${otherUserId}`), { unread: 0 }).catch(() => {});
            }
            if (msg?.from && msg.from !== AppState.currentUser?.uid) {
                NotificationCenter.markIncoming(`dm_${otherUserId}`, msg.from, otherUserId);
            }
        });
    }

    // Username resolution
    async function resolveUsernameToUserId(username) {
        const uname = String(username || '').trim().toLowerCase();
        if (!uname) return null;
        try {
            const snap = await getDoc(doc(firestore, 'usernames', uname));
            if (snap.exists()) {
                const data = snap.data() || {};
                if (data.userId) return { userId: data.userId, username: uname };
            }
        } catch { /* ignore */ }
        const profile = await ProfileManager.getProfileByUsername(uname);
        if (!profile) return null;
        const data = profile.data() || {};
        return { userId: data.userId || profile.id, username: data.usernameLower || uname };
    }

    async function searchDmUsers(prefix) {
        const p = String(prefix || '').trim().toLowerCase();
        if (!p) return [];
        const q = query(collection(firestore, 'usernames'), where(documentId(), '>=', p), where(documentId(), '<=', p + '\uf8ff'), limit(12));
        const snap = await getDocs(q);
        return snap.docs
            .map((d) => ({ username: d.id, userId: d.data()?.userId }))
            .filter((x) => x.userId);
    }

    function renderDmStartResults(items) {
        if (!dmStartResults) return;
        dmStartResults.innerHTML = '';
        if (!items || items.length === 0) return;
        const list = document.createElement('div');
        list.className = 'dm-start-list';
        for (const item of items) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dm-start-item';
            btn.textContent = item.username;
            btn.addEventListener('click', async () => {
                try {
                    await openDmConversation(item.userId);
                    closeDmStartModal();
                } catch (e) {
                    console.error('Failed to open DM', e);
                    alert('Failed to open DM.');
                }
            });
            list.appendChild(btn);
        }
        dmStartResults.appendChild(list);
    }

    function openDmStartModal() {
        if (!dmStartModal) return;
        if (dmStartResults) dmStartResults.innerHTML = '';
        if (dmStartInput) dmStartInput.value = '';
        ViewManager.showModal('dm-start-modal');
        setTimeout(() => dmStartInput?.focus(), 50);
    }

    function closeDmStartModal() {
        if (!dmStartModal) return;
        ViewManager.hideModal('dm-start-modal');
    }

    let dmStartSearchTimer = null;
    dmStartInput?.addEventListener('input', () => {
        if (!dmEnabled) return;
        if (dmStartSearchTimer) clearTimeout(dmStartSearchTimer);
        dmStartSearchTimer = setTimeout(async () => {
            const items = await searchDmUsers(dmStartInput.value);
            renderDmStartResults(items);
        }, 120);
    });

    const setDmQuickStatus = (msg, isError = false) => {
        if (!dmQuickStatus) return;
        dmQuickStatus.textContent = msg || '';
        dmQuickStatus.classList.toggle('error', !!isError);
    };

    const getDmQuickTarget = async () => {
        const raw = dmQuickInput?.value || '';
        const username = raw.replace(/^@/, '').trim();
        if (!username) {
            setDmQuickStatus('Enter a username.', true);
            return null;
        }
        const resolved = await resolveUsernameToUserId(username);
        if (!resolved) {
            setDmQuickStatus('User not found.', true);
            return null;
        }
        return resolved;
    };

    dmQuickOpenBtn?.addEventListener('click', async () => {
        setDmQuickStatus('');
        if (!dmEnabled) {
            setDmQuickStatus('Sign in with email to use DMs.', true);
            return;
        }
        try {
            const resolved = await getDmQuickTarget();
            if (!resolved) return;
            await openDmConversation(resolved.userId);
            setDmQuickStatus(`Opened DM with @${resolved.username}`, false);
            if (dmQuickInput) dmQuickInput.value = '';
        } catch (e) {
            console.error('Quick DM failed', e);
            setDmQuickStatus('Failed to open DM.', true);
        }
    });

    dmQuickAddBtn?.addEventListener('click', async () => {
        setDmQuickStatus('');
        if (!isRegisteredUser(AppState.currentUser, AppState.profile)) {
            setDmQuickStatus('Add friend requires an email account.', true);
            return;
        }
        try {
            const resolved = await getDmQuickTarget();
            if (!resolved) return;
            await ProfileManager.sendFriendRequest(AppState.currentUser.uid, resolved.userId);
            setDmQuickStatus(`Friend request sent to @${resolved.username}`, false);
        } catch (e) {
            console.error('Quick add friend failed', e);
            setDmQuickStatus(e?.message || 'Failed to send friend request.', true);
        }
    });

    friendAddBtn?.addEventListener('click', async () => {
        if (!isRegisteredUser(AppState.currentUser, AppState.profile)) {
            UI.showToast('Sign in with email to add friends.', 'error');
            return;
        }
        const raw = friendHandleInput?.value || '';
        const username = raw.replace(/^@/, '').trim();
        if (!username) {
            UI.showToast('Enter a username.', 'error');
            return;
        }
        try {
            const resolved = await resolveUsernameToUserId(username);
            if (!resolved) {
                UI.showToast('User not found.', 'error');
                return;
            }
            await ProfileManager.sendFriendRequest(AppState.currentUser.uid, resolved.userId);
            UI.showToast(`Friend request sent to @${resolved.username}`, 'success');
            if (friendHandleInput) friendHandleInput.value = '';
        } catch (e) {
            console.error('Friend add failed', e);
            UI.showToast(e?.message || 'Failed to send friend request.', 'error');
        }
    });

    document.getElementById('dm-start-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!dmEnabled) return;
        const username = dmStartInput?.value || '';
        try {
            const resolved = await resolveUsernameToUserId(username);
            if (!resolved) {
                alert('User not found.');
                return;
            }
            await openDmConversation(resolved.userId);
            closeDmStartModal();
        } catch (e2) {
            console.error('Failed to start DM', e2);
            alert('Failed to start DM.');
        }
    });

    dmStartCancel?.addEventListener('click', closeDmStartModal);
    dmStartModal?.addEventListener('click', (e) => {
        if (e.target === dmStartModal) closeDmStartModal();
    });

    newDmBtn?.addEventListener('click', () => {
        if (!AppState.currentUser) return;
        if (!dmEnabled) {
            alert('Sign in to use direct messages.');
            return;
        }
        openDmStartModal();
    });

    // FAB click - open chat
    fab.addEventListener('click', () => {
        widget.classList.remove('minimized');
        fab.classList.add('hidden');
        clearActiveUnread();
        window.ChatWidget?.renderActive?.();
        input?.focus();
        showChatModerationNotice();
    });

    // Event delegation for DM conversations list
    dmConversationsEl?.addEventListener('click', (e) => {
        const item = e.target.closest('.dm-conversation-item');
        if (item) {
            const userId = item.dataset.userId;
            if (userId) openDmConversation(userId);
        }
    });

    // Event delegation for DM friends list
    dmFriendsListEl?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.dm-friend-btn');
        if (btn) {
            const row = btn.closest('.dm-friend-item');
            const userId = row?.dataset.userId;
            if (!userId) return;
            
            if (!dmEnabled) {
                alert('Sign in with email to use direct messages.');
                return;
            }
            try {
                await openDmConversation(userId);
            } catch (e) {
                console.warn('Failed to open DM from friends list', e);
                alert('Failed to open DM.');
            }
        }
    });

    // Minimize
    minimizeBtn?.addEventListener('click', () => {
        widget.classList.add('minimized');
        widget.classList.remove('maximized');
        fab.classList.remove('hidden');
        suggestionBox.style.display = 'none';
    });

    // Draggable header
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header?.addEventListener('mousedown', (e) => {
        if (e.target.closest && e.target.closest('button')) return;
        isDragging = true;
        widget.classList.add('dragging');
        const rect = widget.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        widget.style.left = `${Math.max(0, Math.min(x, window.innerWidth - 340))}px`;
        widget.style.top = `${Math.max(0, Math.min(y, window.innerHeight - 100))}px`;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        if (suggestionBox.style.display !== 'none') positionSuggestionBox();
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        widget.classList.remove('dragging');
    });

    // Tab switching
    document.querySelectorAll('.widget-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const chatMode = tab.dataset.chat;
            if ((chatMode === 'dms' || chatMode === 'friends') && !dmEnabled) {
                alert('Sign in to use direct messages.');
                return;
            }
            document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            suggestionBox.style.display = 'none';

            // Clear friend input field when switching away from friends tab
            if (chatMode !== 'friends' && friendHandleInput) {
                friendHandleInput.value = '';
            }

            if (chatMode === 'dms') {
                AppState.widgetChatMode = 'dms';
                renderDmList();
            } else if (chatMode === 'friends') {
                AppState.widgetChatMode = 'friends';
                renderDmFriends();
            } else {
                AppState.widgetChatMode = chatMode;
                renderChannel(chatMode);
            }

            syncChatModeUi(AppState.widgetChatMode);
            NotificationCenter.markActiveChannel();
            if (chatMode === 'global' || chatMode === 'game') {
                NotificationCenter.markRead(chatMode);
            } else {
                NotificationCenter.updateBadgeUi();
            }
            showChatModerationNotice();
        });
    });

    // Emoji picker
    emojiToggle?.addEventListener('click', () => {
        if (emojiPicker) {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
        }
    });

    document.querySelectorAll('#emoji-picker-widget .emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (input) {
                input.value += btn.textContent;
                input.focus();
            }
            if (emojiPicker) emojiPicker.style.display = 'none';
        });
    });

    // Send message
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input?.value.trim();

        if (text && AppState.currentUser) {
            if (AppState.moderation.muted || AppState.moderation.blocked) {
                alert('Messaging is disabled for your account. Please contact an administrator.');
                return;
            }
            if ((text.startsWith('/dm ') || text.startsWith('/d ')) && !dmEnabled) {
                alert('Sign in to use direct messages.');
                return;
            }
            const displayName = getCurrentDisplayName?.() || 
                AppState.currentUser.displayName ||
                `Player_${AppState.currentUser.uid.substring(0, 6)}`;

            const activeTab = document.querySelector('.widget-tab.active');
            const chatMode = activeTab?.dataset.chat || 'global';

            try {
                if ((chatMode === 'dms' || chatMode === 'friends') && !(AppState.widgetChatMode && AppState.widgetChatMode.startsWith && AppState.widgetChatMode.startsWith('dm_'))) {
                    alert('Select a conversation to send a message.');
                    return;
                }
                if (chatMode === 'game') {
                    if (AppState.currentMatch) {
                        await ChatManager.sendGameMessage(AppState.currentMatch, AppState.currentUser.uid, displayName, text);
                    } else if (AppState.currentView === 'pregame-lobby' && AppState.currentRoom) {
                        await LobbyManager.sendLobbyChat(AppState.currentRoom, AppState.currentUser.uid, displayName, text);
                    } else {
                        throw new Error('Game chat is only available during multiplayer sessions.');
                    }
                } else if (AppState.widgetChatMode.startsWith('dm_')) {
                    const otherUserId = AppState.widgetChatMode.replace('dm_', '');
                    const toName = AppState.dmThreads?.[otherUserId]?.otherDisplayName || null;
                    await ChatManager.sendDirectMessage(AppState.currentUser.uid, displayName, otherUserId, text, toName);
                } else {
                    await ChatManager.sendGlobalMessage(AppState.currentUser.uid, displayName, text);
                    // Optimistically append so guests immediately see their message
                    storeAppend('global', {
                        userId: AppState.currentUser.uid,
                        displayName,
                        text,
                        timestamp: Date.now()
                    });
                }
            } catch (err) {
                console.error('Failed to send chat message', err);
                alert('Failed to send message: ' + (err.message || err));
            }
            if (input) input.value = '';
        }
    });

    // Autocomplete deprecated whisper command to /dm
    input?.addEventListener('input', (e) => {
        if (!dmEnabled) return;
        const val = e.target.value;
        if (/^@whi(?!s)/i.test(val)) {
            e.target.value = val.replace(/^@whi/i, '/dm');
        }
    });

    // Initial sync
    syncChatModeUi(AppState.widgetChatMode);

    // Expose global APIs
    window.ChatWidget = {
        ingestMessage(channel, raw) {
            const msg = normalizeChatMessage(raw);
            storeAppend(channel, raw);
            if (channel === 'game' || channel === 'global') {
                NotificationCenter.markIncoming(channel, msg.userId);
            }
        },
        setDmThreads(threads) {
            const next = {};
            const enrichPromises = [];
            for (const t of threads || []) {
                if (!t || !t.otherUserId) continue;
                next[t.otherUserId] = t;
                if (!t.otherPhotoUrl) {
                    enrichPromises.push((async () => {
                        try {
                            const snap = await ProfileManager.getProfile(t.otherUserId);
                            if (snap.exists()) {
                                const data = snap.data() || {};
                                next[t.otherUserId].otherPhotoUrl = data.profilePicture || null;
                                next[t.otherUserId].otherDisplayName = data.displayName || data.username || next[t.otherUserId].otherDisplayName;
                            }
                        } catch { /* ignore */ }
                    })());
                }
            }
            Promise.all(enrichPromises).then(() => {
                AppState.dmThreads = next;
                syncDmUnreadCounts();
                NotificationCenter.syncDmThreads(next);
                const active = getActiveChannel();
                if (active && active.startsWith && active.startsWith('dm_')) {
                    const otherId = active.replace('dm_', '');
                    markThreadRead(otherId);
                } else if (AppState.widgetChatMode === 'dms') {
                    NotificationCenter.markActiveChannel();
                }
            }).catch(() => {
                AppState.dmThreads = next;
                syncDmUnreadCounts();
                NotificationCenter.syncDmThreads(next);
            });
        },
        openDm(otherUserId) {
            if (!dmEnabled) {
                alert('Sign in to use direct messages.');
                return Promise.resolve();
            }
            return openDmConversation(otherUserId);
        },
        setDmEnabled(enabled) {
            setDmEnabled(enabled);
        },
        isDmEnabled() {
            return dmEnabled;
        },
        clearChannel(channel) {
            if (!channel) return;
            messageStore.delete(channel);
            if (messagesEl && messagesEl.style.display !== 'none' && getActiveChannel() === channel) {
                renderChannel(channel);
            }
        },
        reset() {
            messageStore.clear();
            AppState.dmThreads = {};
            NotificationCenter.reset();
            NotificationCenter.updateBadgeUi();
            renderDmList();
            if (messagesEl) messagesEl.innerHTML = '';
            if (typeof activeDmUnsub === 'function') activeDmUnsub();
            activeDmUnsub = null;
            activeDmUserId = null;
            activeDmSeenKeys = new Set();
        },
        renderActive() {
            const active = getActiveChannel();
            if (active === 'global' || active === 'game' || (active && active.startsWith && active.startsWith('dm_'))) {
                renderChannel(active);
            }
        }
    };

    window.ChatNotifications = {
        markIncoming: NotificationCenter.markIncoming,
        markRead: NotificationCenter.markRead,
        markActive: NotificationCenter.markActiveChannel,
        reset: NotificationCenter.reset,
        prefs: NotificationCenter.prefs,
        setPref: NotificationCenter.setPref
    };

    return {
        getActiveChannel,
        renderChannel,
        renderDmList,
        openDmConversation,
        setDmEnabled,
        NotificationCenter
    };
}

export default createFloatingChat;
