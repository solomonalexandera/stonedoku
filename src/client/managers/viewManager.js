import { MotionManager } from './motionManager.js';

/**
 * View Manager - handles view transitions and modals
 */
export function createViewManager({ AppState, MotionManager: motion = MotionManager, ArchitecturalStateManager } = {}) {
    return {
        views: ['auth', 'onboarding', 'reset', 'lobby', 'waiting', 'pregame-lobby', 'game', 'postmatch', 'profile', 'updates', 'admin'],
        
        show(viewName) {
            const prev = AppState.currentView;
            if (prev === viewName) return;

            // Keep architectural effects scoped to gameplay.
            if (viewName !== 'game' && ArchitecturalStateManager) {
                ArchitecturalStateManager.reset();
            }

            const nextEl = document.getElementById(`${viewName}-view`);
            const prevEl = prev ? document.getElementById(`${prev}-view`) : null;

            const setInert = (el, inert) => {
                if (!el) return;
                try {
                    if (inert) el.setAttribute('inert', '');
                    else el.removeAttribute('inert');
                } catch { /* ignore */ }
            };

            const isActiveWithin = (container) => {
                const active = document.activeElement;
                return !!(container && active && container.contains(active));
            };

            const focusFirstIn = (container) => {
                if (!container) return false;
                const focusableSelector = [
                    'a[href]',
                    'button:not([disabled])',
                    'input:not([disabled])',
                    'select:not([disabled])',
                    'textarea:not([disabled])',
                    '[tabindex]:not([tabindex="-1"])',
                    '[contenteditable="true"]'
                ].join(',');
                const candidate = container.querySelector(focusableSelector);
                try {
                    if (candidate && typeof candidate.focus === 'function') {
                        candidate.focus({ preventScroll: true });
                        return true;
                    }
                } catch { /* ignore */ }
                try {
                    // Make the container itself focusable as a fallback.
                    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
                    container.focus({ preventScroll: true });
                    return true;
                } catch {
                    return false;
                }
            };

            // Show next immediately so state stays synchronous
            if (nextEl) {
                nextEl.style.display = 'block';
                nextEl.setAttribute('aria-hidden', 'false');
                setInert(nextEl, false);
                motion.animateIn(nextEl, 'view');
            }

            // If focus is currently in the previous view, move it into the next view before hiding.
            if (prevEl && prevEl !== nextEl && isActiveWithin(prevEl)) {
                // Delay a tick so the target view is painted.
                setTimeout(() => {
                    if (!focusFirstIn(nextEl)) {
                        try { document.body?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
                    }
                }, 0);
            }

            // Animate out previous, then hide it
            if (prevEl && prevEl !== nextEl) {
                motion.animateOut(prevEl, 'view').then(() => {
                    // If the previous view still contains focus, blur it before hiding for a11y.
                    if (isActiveWithin(prevEl)) {
                        try { document.activeElement?.blur?.(); } catch { /* ignore */ }
                    }
                    prevEl.style.display = 'none';
                    prevEl.setAttribute('aria-hidden', 'true');
                    setInert(prevEl, true);
                });
            }

            // Hide all other non-target views
            this.views.forEach((view) => {
                if (view === viewName) return;
                if (prev && view === prev) return;
                const el = document.getElementById(`${view}-view`);
                if (el) {
                    if (isActiveWithin(el)) {
                        try { document.activeElement?.blur?.(); } catch { /* ignore */ }
                    }
                    el.style.display = 'none';
                    el.setAttribute('aria-hidden', 'true');
                    setInert(el, true);
                }
            });

            AppState.currentView = viewName;
        },
        
        showModal(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            try { modal.removeAttribute('inert'); } catch { /* ignore */ }
            motion.animateIn(modal, 'modal');
        },
        
        hideModal(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            motion.animateOut(modal, 'modal').then(() => {
                try {
                    if (modal.contains(document.activeElement)) document.activeElement?.blur?.();
                } catch { /* ignore */ }
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                try { modal.setAttribute('inert', ''); } catch { /* ignore */ }
            });
        }
    };
}
