import { MotionManager } from './motionManager.js';

/**
 * Architectural State Manager (Clash of Worlds)
 * Manages visual states: calm, strain, collapse, restore
 */
export function createArchitecturalStateManager({ AppState, MotionManager: motion = MotionManager } = {}) {
    return {
        _state: 'calm',
        _mistakeChain: 0,
        _timers: new Set(),
        _idleTimer: null,
        _idleInit: false,
        _lastInteraction: Date.now(),

        prefersReducedMotion() {
            return typeof motion?.prefersReducedMotion === 'function' && motion.prefersReducedMotion();
        },

        _clearTimers() {
            for (const t of this._timers) clearTimeout(t);
            this._timers.clear();
        },

        _apply(state) {
            this._state = state;
            const targets = [document.body, document.getElementById('app')].filter(Boolean);
            const all = ['state--calm', 'state--strain', 'state--collapse', 'state--restore'];
            targets.forEach((el) => {
                all.forEach((c) => el.classList.remove(c));
                el.classList.add(`state--${state}`);
            });
        },

        reset() {
            this._mistakeChain = 0;
            this._clearTimers();
            if (this._idleTimer) clearTimeout(this._idleTimer);
            this._idleTimer = null;
            this._apply('calm');
        },

        startIdleWatch() {
            if (this._idleInit) {
                this._scheduleIdle();
                return;
            }
            this._idleInit = true;

            const bump = () => {
                this._lastInteraction = Date.now();
                this._scheduleIdle();
            };

            ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
                document.addEventListener(evt, bump, { passive: true });
            });

            bump();
        },

        _scheduleIdle() {
            if (this._idleTimer) clearTimeout(this._idleTimer);
            this._idleTimer = setTimeout(() => {
                const shouldRun = AppState?.currentView === 'game' && !this.prefersReducedMotion() && this._state === 'calm';
                if (shouldRun) this.pulseStrain(900);
                this._scheduleIdle();
            }, 150000);
        },

        noteCorrect() {
            this._mistakeChain = 0;
            // Let existing sequences finish; otherwise ensure we return to calm quickly.
            if (this._state === 'strain') {
                this._clearTimers();
                const t = setTimeout(() => this._apply('calm'), 550);
                this._timers.add(t);
            }
        },

        pulseStrain(durationMs = 1100) {
            if (this.prefersReducedMotion()) return;
            this._clearTimers();
            this._apply('strain');
            const t = setTimeout(() => this._apply('calm'), durationMs);
            this._timers.add(t);
        },

        collapseSequence() {
            if (this.prefersReducedMotion()) return;
            this._clearTimers();
            this._apply('collapse');
            const t1 = setTimeout(() => this._apply('restore'), 2800);
            const t2 = setTimeout(() => this._apply('calm'), 4600);
            this._timers.add(t1);
            this._timers.add(t2);
        },

        noteMistake() {
            this._mistakeChain += 1;
            if (this._mistakeChain >= 2) {
                this.pulseStrain(1600);
            } else {
                this.pulseStrain(950);
            }
        },

        onVictory({ perfect = false } = {}) {
            this._mistakeChain = 0;
            if (perfect) {
                this.collapseSequence();
                return;
            }
            if (this.prefersReducedMotion()) return;
            this._clearTimers();
            this._apply('restore');
            const t = setTimeout(() => this._apply('calm'), 1200);
            this._timers.add(t);
        }
    };
}
