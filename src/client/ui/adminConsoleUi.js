/**
 * Admin Console
 * Admin panel for managing updates, moderation, and allowlists
 */

/**
 * Create Admin Console manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.firestore - Firestore instance
 * @param {Object} deps.rtdb - RTDB instance
 * @param {Object} deps.functions - Firebase Functions instance
 * @param {Object} deps.ViewManager - ViewManager instance
 * @param {Function} deps.waitForAuthReady - Auth ready waiter
 * @param {Object} deps.UI - UI utilities (escapeHtml)
 * @param {Function} deps.formatDate - Date formatting function
 * @param {Function} deps.normalizeItem - Item normalizer from UpdatesCenter
 * @param {Object} deps.AppState - Application state
 * @param {Object} deps.firestoreFns - Firestore functions (doc, getDoc, setDoc, deleteDoc, etc.)
 * @param {Object} deps.rtdbFns - RTDB functions (ref, get)
 * @param {Object} deps.functionsFns - Functions (httpsCallable)
 * @returns {Object} Admin Console manager instance
 */
export function createAdminConsole({
    firestore,
    rtdb,
    functions,
    ViewManager,
    waitForAuthReady,
    UI,
    formatDate,
    normalizeItem,
    AppState,
    firestoreFns = {},
    rtdbFns = {},
    functionsFns = {}
} = {}) {
    const {
        doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc,
        collection, query, where, getDocs, orderBy, limit,
        onSnapshot, Timestamp, documentId
    } = firestoreFns;

    const { ref, get } = rtdbFns;
    const { httpsCallable } = functionsFns;

    let isAdmin = false;
    let unsub = null;

    // DOM references
    let navBtn = null;
    let backBtn = null;
    let form = null;
    let statusEl = null;
    let listEl = null;
    let allowlistForm = null;
    let allowlistInput = null;
    let allowlistStatus = null;
    let allowlistAddBtn = null;
    let allowlistRemoveBtn = null;
    let lookupInput = null;
    let lookupStatus = null;
    let lookupBtn = null;
    let lookupCopyBtn = null;
    let modSearchInput = null;
    let modSearchBtn = null;
    let modSearchClearBtn = null;
    let modSearchStatus = null;
    let modSearchResult = null;
    let modTargetInput = null;
    let modStatus = null;
    let modMuteBtn = null;
    let modUnmuteBtn = null;
    let modBlockBtn = null;
    let modUnblockBtn = null;
    let modClearGlobalBtn = null;
    let modClearUserGlobalBtn = null;

    const updateNav = () => {
        if (navBtn) navBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    };

    const refreshAdminState = async () => {
        isAdmin = false;
        if (!AppState?.currentUser) {
            updateNav();
            return false;
        }
        // Check for custom claims (new system)
        isAdmin = AppState.currentUser.isAdmin === true || AppState.currentUser.isSuperAdmin === true;
        updateNav();
        return isAdmin;
    };

    const listen = () => {
        if (!listEl || !firestore) return;
        if (typeof unsub === 'function') unsub();
        const q = query(collection(firestore, 'updates'), orderBy('createdAt', 'desc'), limit(50));
        unsub = onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map((d) => normalizeItem(d.id, d.data()));
                renderList(items);
            },
            (error) => {
                console.warn('Admin updates listener error', error);
            }
        );
    };

    const renderList = (items) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        const visible = (items || []).slice(0, 50);
        if (!visible.length) {
            listEl.innerHTML = '<div class="friend-empty">No updates yet.</div>';
            return;
        }

        for (const item of visible) {
            const row = document.createElement('div');
            row.className = 'admin-update-item';
            row.dataset.updateId = item.id;

            const meta = document.createElement('div');
            meta.className = 'admin-update-meta';
            meta.textContent = `${item.kind || 'update'} • ${item.severity || 'info'} • ${formatDate(item.createdAtMs)}`;

            const title = document.createElement('div');
            title.className = 'admin-update-title';
            title.textContent = item.title;

            const actions = document.createElement('div');
            actions.className = 'admin-update-actions';
            actions.innerHTML = `
                <div class="admin-update-toggles">
                    <label class="admin-update-toggle"><input type="checkbox" class="admin-toggle-active"> Active</label>
                    <label class="admin-update-toggle"><input type="checkbox" class="admin-toggle-banner"> Banner</label>
                    <label class="admin-update-toggle"><input type="checkbox" class="admin-toggle-pinned"> Pinned</label>
                </div>
                <button type="button" class="btn btn-secondary btn-sm admin-update-danger">Delete</button>
            `;

            const activeEl = actions.querySelector('.admin-toggle-active');
            const bannerEl = actions.querySelector('.admin-toggle-banner');
            const pinnedEl = actions.querySelector('.admin-toggle-pinned');
            const deleteBtn = actions.querySelector('button');

            if (activeEl) activeEl.checked = !!item.active;
            if (bannerEl) bannerEl.checked = !!item.banner;
            if (pinnedEl) pinnedEl.checked = !!item.pinned;

            const updateFlags = async (patch) => {
                try {
                    await updateDoc(doc(firestore, 'updates', item.id), { ...patch, updatedAt: Timestamp.now() });
                } catch (e) {
                    console.error('Failed to update update doc', e);
                    alert('Failed to update.');
                }
            };

            activeEl?.addEventListener('change', () => updateFlags({ active: !!activeEl.checked }));
            bannerEl?.addEventListener('change', () => updateFlags({ banner: !!bannerEl.checked }));
            pinnedEl?.addEventListener('change', () => updateFlags({ pinned: !!pinnedEl.checked }));
            deleteBtn?.addEventListener('click', async () => {
                if (!confirm('Delete this update?')) return;
                try {
                    await deleteDoc(doc(firestore, 'updates', item.id));
                } catch (e) {
                    console.error('Delete failed', e);
                    alert('Failed to delete.');
                }
            });

            row.appendChild(meta);
            row.appendChild(title);
            row.appendChild(actions);
            listEl.appendChild(row);
        }
    };

    const open = () => {
        ViewManager?.show('admin');
        try {
            if (window.location.hash !== '#/admin') window.history.replaceState({}, document.title, '#/admin');
        } catch { /* ignore */ }
        listen();
        
        // Initialize role management UI if AdminManager is available
        if (window.AdminManager) {
            window.AdminManager.init();
        }
    };

    const openFromNav = async () => {
        await waitForAuthReady?.();
        const ok = await refreshAdminState();
        if (!ok) {
            alert('Admin access required.');
            return;
        }
        open();
    };

    const openFromHash = async () => {
        await waitForAuthReady?.();
        const ok = await refreshAdminState();
        if (!ok) {
            alert('Admin access required.');
            ViewManager?.show(AppState?.currentUser ? 'lobby' : 'auth');
            return;
        }
        open();
    };

    const init = () => {
        navBtn = document.getElementById('admin-nav-btn');
        backBtn = document.getElementById('admin-back-btn');
        form = document.getElementById('admin-update-form');
        statusEl = document.getElementById('admin-update-status');
        listEl = document.getElementById('admin-updates-list');
        allowlistForm = document.getElementById('admin-allowlist-form');
        allowlistInput = document.getElementById('admin-allowlist-uid');
        allowlistStatus = document.getElementById('admin-allowlist-status');
        allowlistAddBtn = document.getElementById('admin-allowlist-add');
        allowlistRemoveBtn = document.getElementById('admin-allowlist-remove');
        lookupInput = document.getElementById('admin-lookup-username');
        lookupStatus = document.getElementById('admin-lookup-status');
        lookupBtn = document.getElementById('admin-lookup-btn');
        lookupCopyBtn = document.getElementById('admin-lookup-copy');
        modSearchInput = document.getElementById('admin-mod-search');
        modSearchBtn = document.getElementById('admin-mod-search-btn');
        modSearchClearBtn = document.getElementById('admin-mod-search-clear');
        modSearchStatus = document.getElementById('admin-mod-search-status');
        modSearchResult = document.getElementById('admin-mod-search-result');
        modTargetInput = document.getElementById('mod-target-uid');
        modStatus = document.getElementById('mod-status');
        modMuteBtn = document.getElementById('mod-mute');
        modUnmuteBtn = document.getElementById('mod-unmute');
        modBlockBtn = document.getElementById('mod-block');
        modUnblockBtn = document.getElementById('mod-unblock');
        modClearGlobalBtn = document.getElementById('mod-clear-global');
        modClearUserGlobalBtn = document.getElementById('mod-clear-user-global');

        navBtn?.addEventListener('click', () => openFromNav());
        backBtn?.addEventListener('click', () => {
            ViewManager?.show(AppState?.currentUser ? 'lobby' : 'auth');
        });

        // Setup all the admin listeners (allowlist, lookup, moderation, etc.)
        // This is abbreviated - the full implementation would be in the init function
        setupAllowlistListeners();
        setupLookupListeners();
        setupModerationListeners();
        setupFormListener();
    };

    const setupAllowlistListeners = () => {
        const setAllowStatus = (msg, isError = false) => {
            if (!allowlistStatus) return;
            allowlistStatus.textContent = msg || '';
            allowlistStatus.classList.toggle('error', !!isError);
        };

        const getUidFromInput = () => {
            const uid = (allowlistInput?.value || '').trim();
            if (!uid) {
                setAllowStatus('Enter a user UID.', true);
                return null;
            }
            setAllowStatus('');
            return uid;
        };

        allowlistAddBtn?.addEventListener('click', async () => {
            if (!isAdmin) {
                setAllowStatus('Admin required.', true);
                return;
            }
            const uid = getUidFromInput();
            if (!uid) return;
            try {
                // Use new appointAdmin function instead of old /admins collection
                const appointFn = httpsCallable(functions, 'appointAdmin');
                await appointFn({ targetUid: uid, role: 'admin' });
                setAllowStatus('Admin granted.', false);
                allowlistInput.value = '';
            } catch (e) {
                console.error('Grant admin failed', e);
                setAllowStatus(`Failed: ${e.message}`, true);
            }
        });

        allowlistRemoveBtn?.addEventListener('click', async () => {
            if (!isAdmin) {
                setAllowStatus('Admin required.', true);
                return;
            }
            const uid = getUidFromInput();
            if (!uid) return;
            try {
                // Use appointAdmin to revoke role
                const appointFn = httpsCallable(functions, 'appointAdmin');
                await appointFn({ targetUid: uid, role: 'user' });
                setAllowStatus('Admin revoked.', false);
                allowlistInput.value = '';
            } catch (e) {
                console.error('Revoke admin failed', e);
                setAllowStatus(`Failed: ${e.message}`, true);
            }
        });
    };

    const setupLookupListeners = () => {
        const setLookupStatus = (msg, isError = false) => {
            if (!lookupStatus) return;
            lookupStatus.textContent = msg || '';
            lookupStatus.classList.toggle('error', !!isError);
        };

        const lookupUser = async () => {
            const raw = (lookupInput?.value || '').trim().replace(/^@/, '').toLowerCase();
            if (!raw) {
                setLookupStatus('Enter a username.', true);
                return null;
            }
            try {
                setLookupStatus('Looking up...', false);
                const unameSnap = await getDoc(doc(firestore, 'usernames', raw));
                if (unameSnap.exists()) {
                    const uid = unameSnap.data()?.userId;
                    if (uid) {
                        setLookupStatus(`UID: ${uid}`, false);
                        if (lookupCopyBtn) {
                            lookupCopyBtn.disabled = false;
                            lookupCopyBtn.dataset.uid = uid;
                        }
                        return uid;
                    }
                }
                const q = query(collection(firestore, 'users'), where('usernameLower', '==', raw), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const docSnap = snap.docs[0];
                    setLookupStatus(`UID: ${docSnap.id}`, false);
                    if (lookupCopyBtn) {
                        lookupCopyBtn.disabled = false;
                        lookupCopyBtn.dataset.uid = docSnap.id;
                    }
                    return docSnap.id;
                }
                setLookupStatus('User not found.', true);
                if (lookupCopyBtn) lookupCopyBtn.disabled = true;
                return null;
            } catch (e) {
                console.error('Lookup failed', e);
                setLookupStatus('Lookup failed.', true);
                return null;
            }
        };

        lookupBtn?.addEventListener('click', lookupUser);
        lookupCopyBtn?.addEventListener('click', () => {
            const uid = lookupCopyBtn?.dataset?.uid;
            if (!uid) return;
            try {
                navigator.clipboard.writeText(uid);
                if (lookupStatus) lookupStatus.textContent = 'UID copied.';
            } catch {
                if (lookupStatus) lookupStatus.textContent = 'Copy failed.';
            }
        });
    };

    const setupModerationListeners = () => {
        const setModStatus = (msg, isError = false) => {
            if (!modStatus) return;
            modStatus.textContent = msg || '';
            modStatus.classList.toggle('error', !!isError);
        };

        const getModTarget = () => {
            const uid = (modTargetInput?.value || '').trim();
            if (!uid) {
                setModStatus('Enter target UID.', true);
                return null;
            }
            setModStatus('');
            return uid;
        };

        const callMod = async (action, targetUid = null) => {
            const fn = httpsCallable(functions, 'moderate');
            const payload = Object.assign({ action }, targetUid ? { targetUid } : {});
            await fn(payload);
        };

        const wrapMod = (action, needsTarget = true) => async () => {
            if (!isAdmin) {
                setModStatus('Admin required.', true);
                return;
            }
            const target = needsTarget ? getModTarget() : null;
            if (needsTarget && !target) return;
            try {
                const labels = {
                    mute: 'Muting user',
                    unmute: 'Unmuting user',
                    block: 'Blocking user',
                    unblock: 'Unblocking user',
                    clearGlobalChat: 'Clearing global chat',
                    clearUserGlobalChat: 'Clearing user messages'
                };
                setModStatus(`${labels[action] || 'Working'}...`);
                await callMod(action, target);
                setModStatus(`${labels[action] || 'Done'}${target ? ` (${target})` : ''}`, false);
            } catch (e) {
                console.error('Moderation action failed', e);
                setModStatus(e?.message || 'Failed to run action.', true);
            }
        };

        modMuteBtn?.addEventListener('click', wrapMod('mute'));
        modUnmuteBtn?.addEventListener('click', wrapMod('unmute'));
        modBlockBtn?.addEventListener('click', wrapMod('block'));
        modUnblockBtn?.addEventListener('click', wrapMod('unblock'));
        modClearGlobalBtn?.addEventListener('click', wrapMod('clearGlobalChat', false));
        modClearUserGlobalBtn?.addEventListener('click', wrapMod('clearUserGlobalChat'));
    };

    const setupFormListener = () => {
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin) return;
            const title = document.getElementById('admin-update-title')?.value?.trim();
            const body = document.getElementById('admin-update-body')?.value?.trim();
            const kind = document.getElementById('admin-update-kind')?.value || 'update';
            const severity = document.getElementById('admin-update-severity')?.value || 'info';
            const banner = !!document.getElementById('admin-update-banner')?.checked;
            const pinned = !!document.getElementById('admin-update-pinned')?.checked;

            if (!title || !body) return;
            if (statusEl) statusEl.textContent = '';

            try {
                await addDoc(collection(firestore, 'updates'), {
                    title,
                    body,
                    kind,
                    severity,
                    active: true,
                    banner,
                    pinned,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    authorUid: AppState?.currentUser?.uid || null
                });
                form.reset();
                const bannerToggle = document.getElementById('admin-update-banner');
                if (bannerToggle) bannerToggle.checked = true;
                if (statusEl) statusEl.textContent = 'Published.';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 1500);
            } catch (err) {
                console.error('Admin publish failed', err);
                if (statusEl) statusEl.textContent = 'Failed to publish.';
            }
        });
    };

    return {
        init,
        open,
        openFromNav,
        openFromHash,
        refreshAdminState,
        updateNav,
        listen,
        renderList,
        isAdmin: () => isAdmin
    };
}

// Default singleton export
export const AdminConsole = createAdminConsole();
