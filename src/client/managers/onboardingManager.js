/**
 * Onboarding Manager
 * Handles the multi-step registration flow that starts from the landing page.
 */
export function createOnboardingManager({
    AppState,
    ViewManager,
    PasswordPolicy,
    ProfileManager,
    auth,
    createUserWithEmailAndPassword,
    updateProfile,
    TourManager,
    MotionManager,
    UI,
    startSinglePlayerGame,
    onCompleteBootstrap,
    // Storage dependencies for avatar upload
    storage,
    storageRef,
    uploadBytes,
    getDownloadURL
} = {}) {
    if (!AppState) throw new Error('createOnboardingManager: AppState required');
    if (!ViewManager) throw new Error('createOnboardingManager: ViewManager required');
    if (!PasswordPolicy) throw new Error('createOnboardingManager: PasswordPolicy required');
    if (!ProfileManager) throw new Error('createOnboardingManager: ProfileManager required');
    if (!auth || !createUserWithEmailAndPassword || !updateProfile) {
        throw new Error('createOnboardingManager: auth dependencies required');
    }
    if (!storage || !storageRef || !uploadBytes || !getDownloadURL) {
        throw new Error('createOnboardingManager: storage dependencies required');
    }

    const state = {
        listenersBound: false,
        usernameCheckToken: 0,
        submitting: false
    };

    const data = () => {
        if (!AppState.onboarding) {
            AppState.onboarding = { active: false, step: 1, data: {} };
        }
        if (!AppState.onboarding.data) AppState.onboarding.data = {};
        return AppState.onboarding.data;
    };

    const getEl = (id) => document.getElementById(id);

    const notify = (message, type = 'info') => {
        if (UI?.showToast) UI.showToast(message, type);
        else alert(message);
    };

    const showError = (id, message = '', color = 'var(--color-danger)') => {
        const el = getEl(id);
        if (!el) return;
        el.textContent = message || '';
        el.style.color = message ? color : '';
    };

    const setButtonState = (buttons, isDisabled, text = null) => {
        buttons.forEach((btn) => {
            if (!btn) return;
            btn.disabled = !!isDisabled;
            if (text !== null) {
                if (!btn.dataset.prevText) btn.dataset.prevText = btn.textContent;
                btn.textContent = text;
            } else if (btn.dataset.prevText) {
                btn.textContent = btn.dataset.prevText;
                delete btn.dataset.prevText;
            }
        });
    };

    const resetUiState = () => {
        const usernameInput = getEl('onboard-username');
        if (usernameInput) usernameInput.value = '';
        showError('username-error');
        const next1 = getEl('onboard-next-1');
        if (next1) next1.disabled = true;

        const emailInput = getEl('onboard-email');
        const passwordInput = getEl('onboard-password');
        const confirmInput = getEl('onboard-confirm');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (confirmInput) confirmInput.value = '';
        showError('email-error');
        showError('password-error');
        showError('confirm-error');
        const next2 = getEl('onboard-next-2');
        if (next2) next2.disabled = true;
        const strengthBar = document.querySelector('#password-strength .strength-bar');
        const strengthText = document.querySelector('#password-strength .strength-text');
        if (strengthBar) {
            strengthBar.style.setProperty('--strength', '0%');
            strengthBar.style.setProperty('--strength-color', 'transparent');
        }
        if (strengthText) {
            strengthText.textContent = '';
            strengthText.style.color = '';
        }

        const previewImage = getEl('preview-image');
        if (previewImage) {
            previewImage.src = '';
            previewImage.style.display = 'none';
        }
        const placeholder = document.querySelector('.upload-placeholder');
        if (placeholder) placeholder.style.display = '';
        const uploadPreview = getEl('upload-preview');
        if (uploadPreview) uploadPreview.classList.remove('has-image');
        const confetti = getEl('onboarding-confetti');
        if (confetti) confetti.innerHTML = '';
        const dustStyle = document.getElementById('onboarding-dust-style');
        if (dustStyle) dustStyle.remove();
        const displayName = getEl('onboard-display-name');
        if (displayName) displayName.textContent = 'Player';
    };

    const updateProgress = () => {
        const current = AppState.onboarding?.step || 1;
        document.querySelectorAll('.progress-step').forEach((step) => {
            const value = Number(step.dataset.step || 0);
            step.classList.toggle('active', value === current);
            step.classList.toggle('completed', value < current);
        });
    };

    const goToStep = (step) => {
        document.querySelectorAll('.onboarding-step').forEach((el) => {
            el.classList.toggle('active', el.id === `onboarding-step-${step}`);
        });
        AppState.onboarding.step = step;
        updateProgress();
        if (step === 2) {
            const displayName = getEl('onboard-display-name');
            if (displayName) displayName.textContent = data().username || 'Player';
        }
    };

    const updatePasswordStrength = (password) => {
        const strengthBar = document.querySelector('#password-strength .strength-bar');
        const strengthText = document.querySelector('#password-strength .strength-text');
        if (!strengthBar || !strengthText) return;

        let score = 0;
        let label = '';
        let color = 'var(--color-danger)';
        const minLen = PasswordPolicy.minLength || 6;
        if (password.length >= minLen) score += 20;
        if (/[A-Z]/.test(password)) score += 20;
        if (/[a-z]/.test(password)) score += 20;
        if (/[^A-Za-z0-9]/.test(password)) score += 20;
        if (password.length >= Math.max(minLen + 4, 10)) score += 10;
        if (/[0-9]/.test(password)) score += 10;

        if (score < 30) {
            label = password ? 'Weak' : '';
            color = 'var(--color-danger)';
        } else if (score < 60) {
            label = 'Fair';
            color = 'var(--color-warning)';
        } else if (score < 80) {
            label = 'Good';
            color = 'var(--color-success)';
        } else {
            label = 'Strong';
            color = 'var(--color-cyan)';
        }

        strengthBar.style.setProperty('--strength', `${score}%`);
        strengthBar.style.setProperty('--strength-color', color);
        strengthText.textContent = label;
        strengthText.style.color = label ? color : '';
    };

    const handleAvatarSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            notify('Please choose an image file.', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            notify('Image must be under 2MB.', 'error');
            return;
        }
        data().avatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImage = getEl('preview-image');
            const placeholder = document.querySelector('.upload-placeholder');
            const uploadPreview = getEl('upload-preview');
            if (previewImage) {
                previewImage.src = e.target?.result || '';
                previewImage.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            uploadPreview?.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    };

    const submitAccount = async () => {
        if (state.submitting) return;
        const { username, email, password, avatarFile } = data();
        if (!username) {
            goToStep(1);
            showError('username-error', 'Choose a username first.');
            return;
        }
        if (!email || !password) {
            goToStep(2);
            showError('email-error', 'Provide account details to continue.');
            return;
        }

        const buttons = Array.from(document.querySelectorAll('#onboarding-step-3 .btn'));
        state.submitting = true;
        setButtonState(buttons, true, 'Creating...');

        try {
            console.log('onboarding: submitAccount start');
            AppState.pendingUsername = username;
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            const user = credential.user;
            console.log('onboarding: user created', user?.uid);
            let avatarUrl = null;

            // If user supplied an avatar, upload it to storage directly and get URL
            if (avatarFile) {
                try {
                    const safeName = `${Date.now()}_${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    const fileRef = storageRef(storage, `avatars/${user.uid}/${safeName}`);
                    await uploadBytes(fileRef, avatarFile);
                    avatarUrl = await getDownloadURL(fileRef);
                } catch (uploadError) {
                    console.warn('Avatar upload failed during onboarding', uploadError);
                    // Continue without avatar URL
                    avatarUrl = null;
                }
            }

            // Set Auth profile for immediate UX
            try {
                await updateProfile(user, { displayName: username, photoURL: avatarUrl });
            } catch (e) {
                console.warn('Failed to update auth profile', e);
            }

            // Finalize the account on the server: reserve username, create user doc, vanity link, enqueue welcome mail
            let resp = null;
            try {
                const idToken = await user.getIdToken();
                resp = await fetch('/api/auth/finalize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ username, displayName: username, email, profilePicture: avatarUrl })
                });

                if (resp && resp.status === 404) {
                    // API not available in this environment (dev); fallback to client-side creation below.
                    console.log('onboarding: server finalize returned 404, falling back');
                    resp = null;
                }

                if (resp && !resp.ok) {
                    const payload = await resp.json().catch(() => ({}));
                    if (resp.status === 409 || payload?.error === 'username_taken') {
                        // Username collision: return to step 1 so user can pick another
                        AppState.pendingUsername = null;
                        AppState.onboarding.data.username = '';
                        showError('username-error', 'Username already taken. Please choose another.');
                        goToStep(1);
                        state.submitting = false;
                        setButtonState(buttons, false, null);
                        return;
                    }
                    throw new Error(payload?.error || `server responded ${resp.status}`);
                }
            } catch (serverErr) {
                // If server unreachable, we'll fallback to client-side profile creation below
                console.warn('Failed to finalize account on server (will fallback to client-side):', serverErr);
                resp = null;
            }

            // If server not available (dev), fallback to client-side profile creation
            if (!resp) {
                console.log('onboarding: performing client-side fallback createOrUpdateProfile');
                try {
                    // Try to reserve and create the profile locally (best-effort fallback)
                    const profilePayload = { username, displayName: username, email };
                    if (avatarUrl) profilePayload.profilePicture = avatarUrl;
                    await ProfileManager.createOrUpdateProfile(user.uid, profilePayload);
                    console.log('onboarding: client-side profile creation succeeded');
                } catch (fallbackErr) {
                    console.error('Client-side fallback profile creation failed', fallbackErr);
                    notify('Failed to finalize account (server and fallback both failed). Please try again later.', 'error');
                    state.submitting = false;
                    setButtonState(buttons, false, null);
                    return;
                }
            }

            // success
            console.log('onboarding: finalize succeeded, advancing to step 4');
            AppState.currentUser = user;
            goToStep(4);
            showError('username-error');
            showError('email-error');
            showError('password-error');
            showError('confirm-error');
            notify('Account created! Finalize onboarding to continue.', 'success');
            showConfetti();
        } catch (error) {
            console.error('Account creation failed', error);
            let message = 'Failed to create account. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Sign in instead?';
            } else if (error.code === 'auth/weak-password') {
                message = PasswordPolicy.message?.(data().password) || 'Password does not meet requirements.';
            } else if (error.code === 'auth/network-request-failed') {
                message = 'Network error. Check your connection and retry.';
            }
            notify(message, 'error');
        } finally {
            state.submitting = false;
            setButtonState(buttons, false, null);
        }
    };

    const showConfetti = () => {
        if (MotionManager?.prefersReducedMotion?.()) return;
        const container = getEl('onboarding-confetti');
        if (!container) return;
        const colors = ['#d8d1c5', '#c6c1b6', '#9c7b45', '#3f5543', '#0e0f12'];
        for (let i = 0; i < 28; i++) {
            const chip = document.createElement('div');
            const width = 3 + Math.random() * 5;
            const height = 3 + Math.random() * 10;
            const drift = (Math.random() - 0.5) * 80;
            chip.style.cssText = `
                position: absolute;
                width: ${width.toFixed(1)}px;
                height: ${height.toFixed(1)}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -16px;
                opacity: ${0.25 + Math.random() * 0.35};
                transform: translateX(0);
                animation: onboardingDustFall ${3 + Math.random() * 2.2}s cubic-bezier(0.2, 0, 0, 1) forwards;
                animation-delay: ${Math.random() * 0.6}s;
            `;
            chip.style.setProperty('--dust-drift', `${drift.toFixed(1)}px`);
            container.appendChild(chip);
        }
        if (!document.getElementById('onboarding-dust-style')) {
            const style = document.createElement('style');
            style.id = 'onboarding-dust-style';
            style.textContent = `
                @keyframes onboardingDustFall {
                    to {
                        transform: translateY(520px) translateX(var(--dust-drift, 0px));
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        setTimeout(() => { container.innerHTML = ''; }, 5200);
    };

    const finalizeSession = async (action = 'skip') => {
        AppState.onboarding.active = false;
        AppState.onboarding.step = 4;
        data().avatarFile = null;
        try {
            if (typeof onCompleteBootstrap === 'function') {
                await onCompleteBootstrap();
            } else {
                ViewManager.show('lobby');
            }
        } catch (err) {
            console.warn('Onboarding completion bootstrap failed', err);
            ViewManager.show('lobby');
        }

        if (action === 'tour') {
            setTimeout(() => TourManager?.start?.(), 300);
        } else if (action === 'tutorial' && typeof startSinglePlayerGame === 'function') {
            setTimeout(() => startSinglePlayerGame('easy'), 400);
        }
    };

    const ensureListeners = () => {
        if (state.listenersBound) return;
        state.listenersBound = true;

        const usernameInput = getEl('onboard-username');
        const nextBtn1 = getEl('onboard-next-1');
        const backBtn1 = getEl('onboard-back-1');
        usernameInput?.addEventListener('input', async (e) => {
            const value = (e.target?.value || '').trim();
            data().username = '';
            AppState.pendingUsername = null;
            showError('username-error');
            if (nextBtn1) nextBtn1.disabled = true;
            if (!value) return;
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
                showError('username-error', '3-20 letters, numbers, or underscores.');
                return;
            }
            const token = ++state.usernameCheckToken;
            showError('username-error', 'Checking availability...', 'var(--color-secondary)');
            try {
                const available = await ProfileManager.checkUsernameAvailable(value);
                if (token !== state.usernameCheckToken) return;
                if (available) {
                    showError('username-error', '');
                    if (nextBtn1) nextBtn1.disabled = false;
                    data().username = value;
                    AppState.pendingUsername = value;
                } else {
                    showError('username-error', 'Username already taken.');
                    if (nextBtn1) nextBtn1.disabled = true;
                }
            } catch (err) {
                if (token !== state.usernameCheckToken) return;
                console.warn('Username availability lookup failed', err);
                showError('username-error', 'Unable to verify username right now.');
            }
        });
        backBtn1?.addEventListener('click', () => {
            AppState.onboarding.active = false;
            ViewManager.show('auth');
        });
        nextBtn1?.addEventListener('click', () => {
            if (nextBtn1?.disabled) return;
            goToStep(2);
        });

        const emailInput = getEl('onboard-email');
        const passwordInput = getEl('onboard-password');
        const confirmInput = getEl('onboard-confirm');
        const nextBtn2 = getEl('onboard-next-2');
        const backBtn2 = getEl('onboard-back-2');
        const validateStep2 = () => {
            const email = (emailInput?.value || '').trim();
            const password = passwordInput?.value || '';
            const confirm = confirmInput?.value || '';
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            const policy = PasswordPolicy.validate?.(password) || { ok: false };
            const passwordsMatch = password && password === confirm;
            showError('email-error', email && !emailValid ? 'Enter a valid email.' : '');
            showError('password-error', password ? (policy.ok ? '' : PasswordPolicy.message?.(password)) : '');
            showError('confirm-error', confirm && !passwordsMatch ? 'Passwords do not match.' : '');
            updatePasswordStrength(password);
            const ready = emailValid && policy.ok && passwordsMatch;
            if (nextBtn2) nextBtn2.disabled = !ready;
            if (ready) {
                data().email = email;
                data().password = password;
            }
        };
        emailInput?.addEventListener('input', validateStep2);
        passwordInput?.addEventListener('input', validateStep2);
        confirmInput?.addEventListener('input', validateStep2);
        backBtn2?.addEventListener('click', () => goToStep(1));
        nextBtn2?.addEventListener('click', () => {
            if (nextBtn2?.disabled) return;
            goToStep(3);
        });

        const uploadPreview = getEl('upload-preview');
        const avatarInput = getEl('onboard-avatar');
        const backBtn3 = getEl('onboard-back-3');
        const skipBtn3 = getEl('onboard-skip-3');
        const nextBtn3 = getEl('onboard-next-3');
        uploadPreview?.addEventListener('click', () => avatarInput?.click());
        uploadPreview?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadPreview.classList.add('drag-over');
        });
        uploadPreview?.addEventListener('dragleave', () => uploadPreview.classList.remove('drag-over'));
        uploadPreview?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadPreview.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) handleAvatarSelect(file);
        });
        avatarInput?.addEventListener('change', (e) => {
            const file = e.target?.files?.[0];
            if (file) handleAvatarSelect(file);
        });
        backBtn3?.addEventListener('click', () => goToStep(2));
        skipBtn3?.addEventListener('click', submitAccount);
        nextBtn3?.addEventListener('click', submitAccount);

        getEl('start-tour')?.addEventListener('click', () => finalizeSession('tour'));
        getEl('skip-tour')?.addEventListener('click', () => finalizeSession('skip'));
        getEl('start-tutorial')?.addEventListener('click', () => finalizeSession('tutorial'));
    };

    return {
        start() {
            data();
            AppState.onboarding.active = true;
            AppState.onboarding.step = 1;
            AppState.onboarding.data = {
                username: '',
                email: '',
                password: '',
                avatarFile: null,
                avatarUrl: null
            };
            AppState.pendingUsername = null;
            state.usernameCheckToken = 0;
            state.submitting = false;
            resetUiState();
            goToStep(1);
            updateProgress();
            ensureListeners();
            ViewManager.show('onboarding');
            setTimeout(() => getEl('onboard-username')?.focus({ preventScroll: true }), 150);
        },
        goToStep,
        updateProgress,
        handleAvatarSelect,
        updatePasswordStrength,
        createAccount: submitAccount,
        showConfetti,
        complete: finalizeSession
    };
}
