/**
 * Motion Utils - handles animations with reduced motion support
 */
export const MotionUtils = {
    prefersReducedMotion() {
        try { 
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; 
        } catch { 
            return false; 
        }
    },

    animateIn(el, type = 'view') {
        if (!el || this.prefersReducedMotion() || !el.animate) return;
        const keyframesByType = {
            view: [
                { opacity: 0, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ],
            modal: [
                { opacity: 0, transform: 'translateY(10px) scale(0.98)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
            ]
        };
        const frames = keyframesByType[type] || keyframesByType.view;
        const duration = type === 'modal' ? 420 : 360;
        el.animate(frames, { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' });
    },

    animateOut(el, type = 'view') {
        if (!el || this.prefersReducedMotion() || !el.animate) return Promise.resolve();
        const keyframesByType = {
            view: [
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(6px)' }
            ],
            modal: [
                { opacity: 1, transform: 'translateY(0) scale(1)' },
                { opacity: 0, transform: 'translateY(10px) scale(0.98)' }
            ]
        };
        const frames = keyframesByType[type] || keyframesByType.view;
        const duration = type === 'modal' ? 320 : 260;
        const anim = el.animate(frames, { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' });
        return anim.finished.catch(() => {});
    }
};
