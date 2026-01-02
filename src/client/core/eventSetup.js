/**
 * Event Setup Module
 * Sets up all DOM event listeners for the application.
 * 
 * @module core/eventSetup
 */

/**
 * Theme management utilities
 */
export function applyTheme(mode, CookieConsent) {
    const body = document.body;
    body.classList.toggle('light-theme', mode === 'light');
    body.classList.toggle('dark-theme', mode !== 'light');
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.setAttribute('aria-pressed', mode !== 'light' ? 'true' : 'false');
        themeBtn.setAttribute('data-tooltip', mode === 'light' ? 'Theme: Light' : 'Theme: Dark');
    }
    if (typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
        try { localStorage.setItem('stonedoku_theme', mode); } catch { /* ignore */ }
    }
}

export function initTheme(CookieConsent) {
    let saved = null;
    if (typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
        try { saved = localStorage.getItem('stonedoku_theme'); } catch { /* ignore */ }
    }
    applyTheme(saved === 'dark' ? 'dark' : 'light', CookieConsent);
}

export function syncSoundToggleUi(AppState) {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    btn.classList.toggle('is-muted', !AppState.soundEnabled);
    btn.setAttribute('aria-pressed', AppState.soundEnabled ? 'true' : 'false');
    btn.setAttribute('data-tooltip', AppState.soundEnabled ? 'Sound: On' : 'Sound: Off');
}

/**
 * Header menu utilities for mobile
 */
export function setupHeaderMenu() {
    const headerMenuToggle = document.getElementById('header-menu-toggle');
    const headerMenu = document.getElementById('header-menu');
    const headerCompactMql = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;

    const closeHeaderMenu = () => {
        if (!headerMenu || !headerMenuToggle) return;
        headerMenu.classList.remove('is-open');
        headerMenuToggle.setAttribute('aria-expanded', 'false');
    };

    const toggleHeaderMenu = (ev) => {
        if (!headerMenu || !headerMenuToggle) return;
        if (headerCompactMql && !headerCompactMql.matches) return;
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        const next = !headerMenu.classList.contains('is-open');
        headerMenu.classList.toggle('is-open', next);
        headerMenuToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    };

    const syncHeaderCompactMode = () => {
        const compact = !!(headerCompactMql && headerCompactMql.matches);
        document.body.classList.toggle('header-compact', compact);
        if (!compact) closeHeaderMenu();
    };

    headerMenuToggle?.addEventListener('click', toggleHeaderMenu);
    document.addEventListener('click', (e) => {
        if (!headerMenu || !headerMenuToggle) return;
        const target = e.target;
        const clickedInside = headerMenu.contains(target) || headerMenuToggle.contains(target);
        if (!clickedInside) closeHeaderMenu();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeHeaderMenu();
    });
    window.addEventListener('resize', closeHeaderMenu, { passive: true });
    syncHeaderCompactMode();
    if (headerCompactMql) {
        try {
            headerCompactMql.addEventListener('change', syncHeaderCompactMode);
        } catch {
            headerCompactMql.addListener(syncHeaderCompactMode);
        }
    }

    // Close menu when nav buttons clicked
    ['updates-nav-btn', 'admin-nav-btn', 'logout-btn', 'my-profile-btn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', closeHeaderMenu);
    });

    return { closeHeaderMenu, toggleHeaderMenu };
}

/**
 * Setup auth-related event listeners
 */
export function setupAuthListeners(deps) {
    const { auth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword,
            updateProfile, signOut, deleteUser, deleteDoc, doc, firestore,
            AppState, ViewManager, PresenceManager, ProfileManager, PasswordPolicy, PasswordReset,
            OnboardingManager } = deps;

    // Anonymous login
    document.getElementById('anonymous-login')?.addEventListener('click', async () => {
        const btn = document.getElementById('anonymous-login');
        try {
            btn.disabled = true;
            btn.textContent = 'Connecting...';
            const result = await signInAnonymously(auth);
            console.log('Anonymous login successful:', result.user.uid);
        } catch (error) {
            console.error('Anonymous login failed:', error);
            if (error.code === 'auth/operation-not-allowed') {
                alert('Guest login is not enabled. Please contact the administrator or use email login.');
            } else if (error.code === 'auth/network-request-failed') {
                alert('Network error. Please check your connection and try again.');
            } else {
                alert('Login failed: ' + error.message);
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Play as Guest';
        }
    });

    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.dataset.mode;
            document.getElementById('signin-panel').style.display = mode === 'signin' ? 'block' : 'none';
            document.getElementById('signup-panel').style.display = mode === 'signup' ? 'block' : 'none';
        });
    });

    // Start Onboarding
    document.getElementById('start-onboarding')?.addEventListener('click', () => {
        OnboardingManager?.start();
    });

    // Sign In form
    document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('signin-email').value || '').trim();
        const password = document.getElementById('signin-password').value;
        const btn = e.target.querySelector('button[type="submit"]');

        try {
            btn.disabled = true;
            btn.textContent = 'Signing in...';
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Sign in failed:', error);
            if (error.code === 'auth/user-not-found') {
                alert('No account found with this email. Please sign up first.');
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alert('Incorrect password. Please try again.');
            } else if (error.code === 'auth/invalid-email') {
                alert('Please enter a valid email address.');
            } else if (error.code === 'auth/too-many-requests') {
                alert('Too many attempts. Please wait a moment and try again.');
            } else {
                alert('Sign in failed: ' + error.message);
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });

    // Forgot password
    document.getElementById('forgot-password')?.addEventListener('click', () => {
        const emailPrefill = document.getElementById('signin-email')?.value || '';
        PasswordReset.showRequest(emailPrefill);
    });

    document.getElementById('reset-request-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-request-email')?.value.trim();
        if (!email) {
            PasswordReset.setStatus('reset-request-status', 'Please enter your email address.', true);
            return;
        }
        await PasswordReset.sendResetRequest(email);
    });

    document.getElementById('reset-confirm-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('reset-new-password')?.value || '';
        const confirm = document.getElementById('reset-confirm-password')?.value || '';
        await PasswordReset.submitNewPassword(password, confirm);
    });

    document.getElementById('reset-back-to-login')?.addEventListener('click', () => {
        PasswordReset.togglePanels('request');
        PasswordReset.setStatus('reset-request-status', '');
        PasswordReset.setStatus('reset-confirm-status', '');
        AppState.passwordReset.active = false;
        ViewManager.show('auth');
    });

    document.getElementById('reset-return-login')?.addEventListener('click', () => {
        PasswordReset.togglePanels('request');
        PasswordReset.setStatus('reset-request-status', '');
        PasswordReset.setStatus('reset-confirm-status', '');
        AppState.passwordReset.active = false;
        ViewManager.show('auth');
    });

    // Sign Up form
    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameRaw = document.getElementById('signup-username').value.trim();
        const username = usernameRaw.toLowerCase();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const btn = e.target.querySelector('button[type="submit"]');

        if (!usernameRaw || usernameRaw.length < 3 || usernameRaw.length > 20) {
            alert('Username must be between 3 and 20 characters.');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(usernameRaw)) {
            alert('Username can only contain letters, numbers, and underscores.');
            return;
        }
        if (password !== confirm) {
            alert('Passwords do not match. Please try again.');
            return;
        }
        const policy = PasswordPolicy.validate(password);
        if (!policy.ok) {
            alert(PasswordPolicy.message(password) || 'Password does not meet requirements.');
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = 'Checking username...';

            const usernameAvailable = await ProfileManager.checkUsernameAvailable(username);
            if (!usernameAvailable) {
                alert('This username is already taken. Please choose another.');
                btn.disabled = false;
                btn.textContent = 'Create Account';
                return;
            }

            AppState.pendingUsername = usernameRaw;
            btn.textContent = 'Creating account...';
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: usernameRaw });
            await ProfileManager.createOrUpdateProfile(userCredential.user.uid, {
                username: usernameRaw,
                displayName: usernameRaw,
                email
            });
        } catch (error) {
            console.error('Sign up failed:', error);
            AppState.pendingUsername = null;
            if (error.code === 'auth/email-already-in-use') {
                UI?.showToast?.('An account with this email already exists. Please sign in instead.', 'error');
            } else if (error.code === 'auth/weak-password') {
                UI?.showToast?.(PasswordPolicy.message(password) || 'Password does not meet requirements.', 'error');
            } else if (error.message === 'username_taken') {
                UI?.showToast?.('This username was just taken. Please choose another.', 'error');
            } else if (error.message === 'username_reserved') {
                UI?.showToast?.('This username contains reserved terms and cannot be used. Please choose another.', 'error');
            } else {
                UI?.showToast?.('Sign up failed: ' + error.message, 'error');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        console.log('Logout button clicked');
        try {
            console.log('Starting logout process...');
            const user = auth.currentUser;
            await PresenceManager.cleanup();
            console.log('Presence cleaned up');

            if (user?.isAnonymous) {
                console.log('Anonymous user detected; deleting guest account');
                try {
                    await deleteDoc(doc(firestore, 'users', user.uid));
                } catch (e) {
                    console.warn('Failed to delete anonymous user profile doc', e);
                }
                try {
                    await deleteUser(user);
                } catch (e) {
                    console.warn('Failed to delete anonymous auth user', e);
                    await signOut(auth);
                }
            } else {
                console.log('Signing out...');
                await signOut(auth);
            }

            console.log('Signed out successfully');
            AppState.currentUser = null;
            ViewManager.show('auth');
        } catch (error) {
            console.error('Logout failed:', error);
            AppState.currentUser = null;
            ViewManager.show('auth');
        }
    });
}

/**
 * Setup game-related event listeners
 */
export function setupGameListeners(deps) {
    const { AppState, ViewManager, PresenceManager, MatchManager, LobbyManager, GameUI,
            GameHelpers, AudioManager, UI, ChallengeSystemManager, getCurrentDisplayName,
            startSinglePlayerGame, handleRoomUpdate, quitGame, navigateCell,
            ref, rtdb, get, update } = deps;

    let countdownInterval = null;

    // Resign button
    document.getElementById('resign-btn')?.addEventListener('click', async () => {
        if (AppState.gameMode !== 'versus') return;
        if (!AppState.currentMatch || !AppState.currentUser?.uid) return;
        if (!confirm('Leave this match? This counts as a resignation.')) return;
        try {
            await MatchManager.resignMatch(AppState.currentMatch, AppState.currentUser.uid);
        } catch (e) {
            console.warn('Resign failed', e);
            UI.showToast('Failed to leave match.', 'error');
        }
    });

    // Logo click to return home
    document.getElementById('logo-home')?.addEventListener('click', () => {
        if (AppState.currentUser) {
            if (AppState.currentView === 'game') {
                if (confirm('Are you sure you want to leave the game?')) {
                    quitGame();
                    ViewManager.show('lobby');
                }
            } else {
                ViewManager.show('lobby');
            }
        } else {
            ViewManager.show('auth');
        }
    });

    // Single player start
    document.getElementById('start-single')?.addEventListener('click', () => {
        const difficulty = document.getElementById('difficulty-select')?.value || 'medium';
        startSinglePlayerGame(difficulty);
    });

    // Lobby difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            if (difficulty) {
                startSinglePlayerGame(difficulty);
            }
        });
    });

    // Chat toggle
    document.getElementById('chat-toggle')?.addEventListener('click', () => {
        const chatSection = document.querySelector('.chat-section');
        chatSection?.classList.toggle('open');
    });

    // Create room
    document.getElementById('create-room')?.addEventListener('click', async () => {
        console.log('Create room button clicked');
        try {
            const displayName = AppState.currentUser?.displayName ||
                `Player_${AppState.currentUser?.uid.substring(0, 6)}`;
            console.log('Creating room for:', displayName);
            const code = await LobbyManager.createRoom(AppState.currentUser.uid, displayName);
            console.log('Room created with code:', code);

            AppState.currentRoom = code;
            document.getElementById('display-room-code').textContent = code;

            ViewManager.show('waiting');
            PresenceManager.updateActivity('Waiting for opponent');
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to create room:', error);
            UI?.showToast?.('Failed to create room: ' + error.message, 'error');
        }
    });

    // Join room
    const joinRoomHandler = async () => {
        const codeInput = document.getElementById('room-code-input');
        const code = codeInput?.value?.trim();

        console.log('Attempting to join room with code:', code);

        if (!code || code.length !== 4) {
            UI?.showToast?.('Please enter a valid 4-digit room code', 'error');
            return;
        }

        try {
            const displayName = AppState.currentUser?.displayName ||
                `Player_${AppState.currentUser?.uid.substring(0, 6)}`;
            console.log('User:', AppState.currentUser?.uid, 'Display:', displayName);

            await LobbyManager.joinRoom(code, AppState.currentUser.uid, displayName);
            console.log('Successfully joined room');

            AppState.currentRoom = code;
            ViewManager.show('waiting');
            document.getElementById('display-room-code').textContent = code;
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to join room:', error);
            UI?.showToast?.(error.message || 'Failed to join room', 'error');
        }
    };

    document.getElementById('join-room')?.addEventListener('click', joinRoomHandler);
    document.getElementById('room-code-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            joinRoomHandler();
        }
    });

    // Cancel waiting
    document.getElementById('cancel-waiting')?.addEventListener('click', async () => {
        if (AppState.currentRoom) {
            await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
            AppState.currentRoom = null;
        }
        try {
            if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
        } catch { /* ignore */ }
        AppState.widgetGameChatUnsub = null;
        AppState.widgetGameChatContext = null;
        window.ChatWidget?.clearChannel?.('game');
        window.ChatNotifications?.markRead?.('game');
        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'none';
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });

    // Copy room code
    document.getElementById('copy-code')?.addEventListener('click', () => {
        const code = document.getElementById('display-room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            UI?.showToast?.('Code copied to clipboard!', 'success') || alert('Code copied to clipboard!');
        }).catch(() => {
            alert(`Room code: ${code}`);
        });
    });

    // Share room code
    document.getElementById('share-code')?.addEventListener('click', async () => {
        const code = document.getElementById('display-room-code')?.textContent || '';
        const shareUrl = `${window.location.origin}?join=${code}`;
        const shareData = {
            title: 'Join my Stonedoku game!',
            text: `Join my Stonedoku 1v1 match! Room code: ${code}`,
            url: shareUrl
        };
        
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (e) {
                // User cancelled or share failed, fall back to clipboard
                navigator.clipboard.writeText(shareUrl).then(() => {
                    UI?.showToast?.('Link copied to clipboard!', 'success');
                }).catch(() => {
                    alert(`Share link: ${shareUrl}`);
                });
            }
        } else {
            // No native share, copy to clipboard
            navigator.clipboard.writeText(shareUrl).then(() => {
                UI?.showToast?.('Link copied to clipboard!', 'success');
            }).catch(() => {
                alert(`Share link: ${shareUrl}`);
            });
        }
    });

    // QR code for room
    document.getElementById('qr-code')?.addEventListener('click', () => {
        const code = document.getElementById('display-room-code')?.textContent || '';
        const qrContainer = document.getElementById('room-qr');
        const qrImg = document.getElementById('room-qr-img');
        
        if (!qrContainer || !qrImg) return;
        
        if (qrContainer.style.display === 'none' || !qrContainer.style.display) {
            // Generate QR code using a free API
            const shareUrl = `${window.location.origin}?join=${code}`;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;
            qrContainer.style.display = 'block';
        } else {
            qrContainer.style.display = 'none';
        }
    });

    // Ready up button
    document.getElementById('ready-btn')?.addEventListener('click', async () => {
        if (!AppState.currentRoom || !AppState.currentUser) return;
        const roomRef = ref(rtdb, `lobbies/${AppState.currentRoom}`);
        const snapshot = await get(roomRef);
        const room = snapshot.val();
        const currentReady = room?.players?.[AppState.currentUser.uid]?.ready || false;
        await LobbyManager.setReady(AppState.currentRoom, AppState.currentUser.uid, !currentReady);
    });

    // Leave pre-game lobby
    document.getElementById('leave-pregame')?.addEventListener('click', async () => {
        if (AppState.currentRoom) {
            await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
            AppState.currentRoom = null;
        }
        try {
            if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
        } catch { /* ignore */ }
        AppState.widgetGameChatUnsub = null;
        AppState.widgetGameChatContext = null;
        window.ChatWidget?.clearChannel?.('game');
        window.ChatNotifications?.markRead?.('game');
        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'none';
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });

    // Pre-game chat
    document.getElementById('pregame-chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('pregame-chat-input');
        const text = input.value.trim();
        if (text && AppState.currentRoom && AppState.currentUser) {
            const displayName = AppState.currentUser.displayName ||
                `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            await LobbyManager.sendLobbyChat(AppState.currentRoom, AppState.currentUser.uid, displayName, text);
            input.value = '';
        }
    });

    // Rematch - Yes
    document.getElementById('rematch-yes')?.addEventListener('click', async () => {
        const matchId = AppState.lastMatch?.id;
        const userId = AppState.currentUser?.uid;
        if (!matchId || !userId) return;
        await update(ref(rtdb, `matches/${matchId}/rematch`), { [userId]: true });
        document.getElementById('rematch-actions').style.display = 'none';
        document.getElementById('rematch-waiting').style.display = 'block';
    });

    // Rematch - No
    document.getElementById('rematch-no')?.addEventListener('click', async () => {
        const matchId = AppState.lastMatch?.id;
        const userId = AppState.currentUser?.uid;
        if (!matchId || !userId) return;
        await update(ref(rtdb, `matches/${matchId}/rematch`), { [userId]: false });
        deps.cleanupAfterMatch();
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });

    // Back to lobby from post-match
    document.getElementById('postmatch-back-lobby')?.addEventListener('click', () => {
        deps.cleanupAfterMatch();
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });

    // Number pad
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.dataset.num);
            GameUI.inputNumber(num);
        });
    });

    // Keyboard input
    document.addEventListener('keydown', (e) => {
        if (AppState.currentView !== 'game') return;
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            GameUI.inputNumber(num);
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            GameUI.inputNumber(0);
        }
    });

    // Quit game
    document.getElementById('quit-game')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to quit?')) {
            GameUI.stopTimer();
            if (AppState.currentMatch) {
                await MatchManager.endMatch(AppState.currentMatch);
                AppState.currentMatch = null;
            }
            if (AppState.currentRoom) {
                await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
                AppState.currentRoom = null;
            }
            ViewManager.show('lobby');
            PresenceManager.updateActivity('In Lobby');
        }
    });

    // Game over modal buttons
    document.getElementById('play-again')?.addEventListener('click', () => {
        ViewManager.hideModal('game-over-modal');
        if (AppState.gameMode === 'single') {
            const difficulty = document.getElementById('difficulty-select').value;
            startSinglePlayerGame(difficulty);
        } else {
            ViewManager.show('lobby');
        }
    });

    document.getElementById('back-to-lobby')?.addEventListener('click', () => {
        ViewManager.hideModal('game-over-modal');
        ViewManager.show('lobby');
        PresenceManager.updateActivity('In Lobby');
    });

    // Global chat (legacy)
    document.getElementById('global-chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('global-chat-input');
        const text = input.value.trim();
        if (text && AppState.currentUser) {
            const displayName = AppState.currentUser.displayName ||
                `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            await deps.ChatManager.sendGlobalMessage(AppState.currentUser.uid, displayName, text);
            input.value = '';
        }
    });

    // Challenge modal
    document.getElementById('accept-challenge')?.addEventListener('click', async () => {
        try {
            const current = AppState.pendingChallenge;
            if (!current || !AppState.currentUser) {
                ViewManager.hideModal('challenge-modal');
                return;
            }
            const displayName = getCurrentDisplayName();
            const code = await ChallengeSystemManager.acceptChallenge(AppState.currentUser.uid, displayName, current.fromUserId);
            AppState.currentRoom = code;
            const codeEl = document.getElementById('display-room-code');
            if (codeEl) codeEl.textContent = code;
            ViewManager.hideModal('challenge-modal');
            ViewManager.show('waiting');
            PresenceManager.updateActivity('Waiting for opponent');
            LobbyManager.listenToRoom(code, handleRoomUpdate);
            AppState.pendingChallenge = null;
        } catch (e) {
            console.warn('Accept challenge failed', e);
            alert('Failed to accept challenge. Please try again.');
        }
    });

    document.getElementById('decline-challenge')?.addEventListener('click', () => {
        (async () => {
            try {
                const current = AppState.pendingChallenge;
                if (current && AppState.currentUser) {
                    const displayName = getCurrentDisplayName();
                    await ChallengeSystemManager.declineChallenge(AppState.currentUser.uid, displayName, current.fromUserId);
                }
            } catch (e) {
                console.warn('Decline challenge failed', e);
            } finally {
                AppState.pendingChallenge = null;
                ViewManager.hideModal('challenge-modal');
            }
        })();
    });

    // Custom Sudoku modal
    document.getElementById('open-custom-sudoku')?.addEventListener('click', () => {
        ViewManager.showModal('custom-sudoku-modal');
        const auto = document.getElementById('custom-auto-check');
        if (auto) auto.checked = !!AppState.settings.autoCheck;
    });

    document.getElementById('custom-sudoku-cancel')?.addEventListener('click', () => {
        ViewManager.hideModal('custom-sudoku-modal');
    });

    document.getElementById('custom-sudoku-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const difficulty = document.getElementById('custom-difficulty')?.value || 'medium';
        const timeLimitSeconds = Number(document.getElementById('custom-time-limit')?.value || 0) || 0;
        const maxMistakes = Number(document.getElementById('custom-mistakes')?.value || 3) || 3;
        const autoCheck = !!document.getElementById('custom-auto-check')?.checked;
        ViewManager.hideModal('custom-sudoku-modal');
        startSinglePlayerGame(difficulty, { timeLimitSeconds, maxMistakes, autoCheck });
    });

    // Profile modal close
    document.getElementById('close-profile')?.addEventListener('click', () => {
        ViewManager.hideModal('profile-modal');
    });

    // Difficulty buttons in game view
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            if (difficulty) {
                startSinglePlayerGame(difficulty);
            }
        });
    });

    // Restart button
    document.getElementById('restart-btn')?.addEventListener('click', () => {
        if (confirm('Restart this puzzle?')) {
            startSinglePlayerGame(AppState.currentDifficulty);
        }
    });

    // Undo button
    document.getElementById('undo-btn')?.addEventListener('click', () => {
        GameHelpers.tryUndo();
        AudioManager.playCellFill();
    });

    // Erase button
    document.getElementById('erase-btn')?.addEventListener('click', () => {
        if (AppState.selectedCell) {
            GameUI.inputNumber(0);
        }
    });

    // Notes button
    document.getElementById('notes-btn')?.addEventListener('click', () => {
        GameHelpers.toggleNotesMode();
    });

    // Settings toggles
    document.getElementById('highlight-conflicts')?.addEventListener('change', (e) => {
        AppState.settings.highlightConflicts = e.target.checked;
    });
    document.getElementById('highlight-same')?.addEventListener('change', (e) => {
        AppState.settings.highlightSameNumbers = e.target.checked;
    });
    document.getElementById('auto-check')?.addEventListener('change', (e) => {
        AppState.settings.autoCheck = e.target.checked;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (AppState.currentView !== 'game') return;

        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            GameHelpers.tryUndo();
        }

        // N for notes mode toggle
        if (e.key === 'n' || e.key === 'N') {
            GameHelpers.toggleNotesMode();
        }

        // Arrow keys for cell navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            navigateCell(e.key);
        }
    });

    // Keyboard hints
    document.addEventListener('keydown', (e) => {
        if (e.key === '?' && AppState.currentView === 'game') {
            const hint = document.querySelector('.keyboard-hint');
            if (hint) hint.classList.toggle('visible');
        }
    });

    return { countdownInterval };
}

/**
 * Factory function to create the full event setup
 */
export function createEventSetup(deps) {
    const { CookieConsent, AppState, initFloatingChat, initProfilePage,
            handleVanityUrl, handleUpdatesUrl, handleAdminUrl } = deps;

    return {
        setup() {
            initTheme(CookieConsent);
            syncSoundToggleUi(AppState);

            setupHeaderMenu();

            // Theme toggle
            document.getElementById('theme-toggle')?.addEventListener('click', () => {
                const body = document.body;
                const isLight = body.classList.contains('light-theme');
                applyTheme(isLight ? 'dark' : 'light', CookieConsent);
            });

            // Sound toggle
            document.getElementById('sound-toggle')?.addEventListener('click', () => {
                AppState.soundEnabled = !AppState.soundEnabled;
                syncSoundToggleUi(AppState);
            });

            setupAuthListeners(deps);
            setupGameListeners(deps);

            // Initialize floating chat
            if (typeof initFloatingChat === 'function') {
                initFloatingChat();
            }

            // Initialize profile page
            if (typeof initProfilePage === 'function') {
                initProfilePage();
            }

            // Handle URL routing
            if (typeof handleVanityUrl === 'function') handleVanityUrl();
            if (typeof handleUpdatesUrl === 'function') handleUpdatesUrl();
            if (typeof handleAdminUrl === 'function') handleAdminUrl();

            window.addEventListener('hashchange', () => {
                if (typeof handleUpdatesUrl === 'function') handleUpdatesUrl();
                if (typeof handleAdminUrl === 'function') handleAdminUrl();
                if (typeof handleVanityUrl === 'function') handleVanityUrl();
            });
        }
    };
}

export default createEventSetup;
