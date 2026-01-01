/**
 * Password Reset UI handler
 */
import { PasswordPolicy } from '../lib/passwordPolicy.js';

export function createPasswordReset({ auth, verifyPasswordResetCode, confirmPasswordReset, sendPasswordResetEmail, AppState, ViewManager }) {
    return {
        state: { oobCode: null, email: null },

        togglePanels(mode = 'request') {
            const request = document.getElementById('reset-request-panel');
            const confirm = document.getElementById('reset-confirm-panel');
            const success = document.getElementById('reset-success-panel');
            if (request) request.style.display = mode === 'request' ? 'block' : 'none';
            if (confirm) confirm.style.display = mode === 'confirm' ? 'block' : 'none';
            if (success) success.style.display = mode === 'success' ? 'block' : 'none';
        },

        setStatus(id, message, isError = true) {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = message || '';
            el.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
        },

        clearUrlParams() {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        },

        showRequest(prefillEmail = '') {
            AppState.passwordReset.active = true;
            this.state = { oobCode: null, email: prefillEmail || null };
            ViewManager.show('reset');
            this.togglePanels('request');
            this.setStatus('reset-request-status', '');
            this.setStatus('reset-confirm-status', '');
            const input = document.getElementById('reset-request-email');
            if (input) {
                input.value = prefillEmail || input.value || '';
                input.focus();
            }
        },

        extractFromHash() {
            const hash = window.location.hash || '';
            if (!hash.startsWith('#/reset')) return null;
            const queryIndex = hash.indexOf('?');
            const query = queryIndex !== -1 ? hash.substring(queryIndex + 1) : '';
            const params = new URLSearchParams(query);
            return {
                mode: params.get('mode'),
                oobCode: params.get('oobCode'),
                apiKey: params.get('apiKey')
            };
        },

        extractFromSearch() {
            const params = new URLSearchParams(window.location.search || '');
            const mode = params.get('mode');
            if (mode !== 'resetPassword') return null;
            return {
                mode,
                oobCode: params.get('oobCode'),
                apiKey: params.get('apiKey')
            };
        },

        async hydrateFromUrl() {
            try {
                const params = this.extractFromHash() || this.extractFromSearch();
                if (params && params.mode === 'resetPassword' && params.oobCode) {
                    await this.loadCode(params.oobCode);
                }
            } catch (e) {
                console.error('Failed to hydrate reset link', e);
            }
        },

        async loadCode(oobCode) {
            try {
                const email = await verifyPasswordResetCode(auth, oobCode);
                this.state = { oobCode, email };
                AppState.passwordReset.active = true;
                ViewManager.show('reset');
                this.togglePanels('confirm');
                this.setStatus('reset-request-status', '');
                this.setStatus('reset-confirm-status', '');
                const display = document.getElementById('reset-email-display');
                if (display) display.textContent = email;
                const newPass = document.getElementById('reset-new-password');
                if (newPass) newPass.focus();
                this.clearUrlParams();
            } catch (error) {
                console.error('Reset code invalid or expired:', error);
                this.showRequest();
                this.setStatus('reset-request-status', 'Reset link is invalid or expired. Please request a new one.', true);
            }
        },

        async sendResetRequest(email) {
            const btn = document.querySelector('#reset-request-form button[type="submit"]');
            try {
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Sending...';
                }
                this.setStatus('reset-request-status', '');
                const continueUrl = `${window.location.origin}${window.location.pathname}#/reset`;
                const actionCodeSettings = {
                    url: continueUrl,
                    handleCodeInApp: true
                };

                try {
                    await sendPasswordResetEmail(auth, email, actionCodeSettings);
                } catch (err) {
                    const code = err?.code || '';
                    // Avoid leaking whether an email exists.
                    if (code === 'auth/user-not-found') {
                        this.setStatus('reset-request-status', 'If that email exists, a reset link is on its way.', false);
                        return;
                    }
                    // If client-side email sending is blocked/misconfigured, fall back to the server helper.
                    try {
                        const resp = await fetch('/api/auth/reset', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });
                        const payload = await resp.json().catch(() => ({}));
                        if (!resp.ok) throw new Error(payload.error || 'Unable to send reset email.');
                    } catch (fallbackErr) {
                        // Prefer a helpful message when the email is invalid.
                        if (code === 'auth/invalid-email') throw new Error('Please enter a valid email address.');
                        throw err;
                    }
                }

                this.setStatus('reset-request-status', 'If that email exists, a reset link is on its way.', false);
            } catch (e) {
                console.error('Reset request failed', e);
                this.setStatus('reset-request-status', e.message || 'Failed to send reset email.', true);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Send reset link';
                }
            }
        },

        async submitNewPassword(password, confirm) {
            if (!this.state.oobCode) {
                this.setStatus('reset-confirm-status', 'Missing reset code. Please request a new link.', true);
                this.togglePanels('request');
                return;
            }
            const policy = PasswordPolicy.validate(password);
            if (!password || !policy.ok) {
                this.setStatus('reset-confirm-status', PasswordPolicy.message(password) || 'Password does not meet requirements.', true);
                return;
            }
            if (password !== confirm) {
                this.setStatus('reset-confirm-status', 'Passwords do not match.', true);
                return;
            }

            const btn = document.querySelector('#reset-confirm-form button[type="submit"]');
            try {
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Updating...';
                }
                await confirmPasswordReset(auth, this.state.oobCode, password);
                this.togglePanels('success');
                this.setStatus('reset-confirm-status', '');
                this.state = { oobCode: null, email: this.state.email };
                const newPass = document.getElementById('reset-new-password');
                const confirmPass = document.getElementById('reset-confirm-password');
                if (newPass) newPass.value = '';
                if (confirmPass) confirmPass.value = '';
                const emailInput = document.getElementById('signin-email');
                if (emailInput && this.state.email) {
                    emailInput.value = this.state.email;
                }
            } catch (error) {
                console.error('Failed to complete password reset', error);
                this.setStatus('reset-confirm-status', '');
                this.setStatus('reset-request-status', 'Unable to update password. Please request a new link.', true);
                this.togglePanels('request');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Update password';
                }
                this.clearUrlParams();
            }
        }
    };
}
