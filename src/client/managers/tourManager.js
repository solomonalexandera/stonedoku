/**
 * Tour Manager - interactive onboarding tour
 */
export function createTourManager({ AppState, ViewManager, UI, firestore, doc, updateDoc, serverTimestamp, CookieConsent }) {
    return {
        steps: [
            {
                target: '.single-card',
                title: 'Solo Practice',
                description: 'Play classic Sudoku at your own pace. Choose from Easy, Medium, or Hard difficulty to sharpen your skills.',
                position: 'right'
            },
            {
                target: '.versus-card',
                title: 'Challenge Friends',
                description: 'Create a game room or join with a code to compete in real-time 1v1 battles. Race to fill the most cells correctly!',
                position: 'left'
            },
            {
                target: '.stats-card',
                title: 'Track Progress',
                description: 'Your wins, losses, and win rate are tracked here. Watch yourself improve over time!',
                position: 'left'
            },
            {
                target: '.players-card',
                title: 'See Who\'s Online',
                description: 'View other players currently online. Click their name to see their profile or challenge them to a game.',
                position: 'left'
            },
            {
                target: '#chat-fab',
                title: 'Chat & Connect',
                description: 'Use the chat to talk with other players or start direct messages.',
                position: 'top'
            }
        ],
        
        start(force = false) {
            if (!force && typeof CookieConsent?.canUsePreferences === 'function' && CookieConsent.canUsePreferences()) {
                try {
                    if (localStorage.getItem('stonedoku_tour_done') === '1') {
                        UI.showToast('Orientation already completed. Run it again from your profile.', 'info');
                        return;
                    }
                } catch { /* ignore */ }
            }
            // Make sure we're in the lobby first (tour targets live there).
            if (AppState.currentView !== 'lobby') {
                try { ViewManager.show('lobby'); } catch { /* ignore */ }
            }
            
            // Small delay to let lobby render
            setTimeout(() => {
                AppState.tour.active = true;
                AppState.tour.step = 0;
                
                const overlay = document.getElementById('tour-overlay');
                if (overlay) {
                    overlay.style.display = 'block';
                    overlay.classList.add('active');
                }
                
                document.getElementById('tour-total').textContent = this.steps.length;
                this.showStep(0);
                this.setupListeners();
            }, 300);
        },
        
        setupListeners() {
            document.getElementById('tour-next')?.addEventListener('click', () => {
                if (AppState.tour.step < this.steps.length - 1) {
                    this.showStep(AppState.tour.step + 1);
                } else {
                    this.end(true);
                }
            });
            
            document.getElementById('tour-skip')?.addEventListener('click', () => {
                this.end(false);
            });
        },
        
        showStep(stepIndex) {
            const step = this.steps[stepIndex];
            if (!step) return;
            
            AppState.tour.step = stepIndex;
            
            const target = document.querySelector(step.target);
            const spotlight = document.getElementById('tour-spotlight');
            const tooltip = document.getElementById('tour-tooltip');
            
            if (!target || !spotlight || !tooltip) return;

            // Ensure the target is actually visible (mobile + smaller screens).
            try {
                target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
            } catch { /* ignore */ }
            
            // Update spotlight
            const rect = target.getBoundingClientRect();
            const padding = 10;
            
            spotlight.style.left = `${rect.left - padding}px`;
            spotlight.style.top = `${rect.top - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;
            
            // Update tooltip content
            document.getElementById('tour-title').textContent = step.title;
            document.getElementById('tour-description').textContent = step.description;
            document.getElementById('tour-current').textContent = stepIndex + 1;
            
            // Update next button text
            const nextBtn = document.getElementById('tour-next');
            if (nextBtn) {
                nextBtn.textContent = stepIndex === this.steps.length - 1 ? 'Finish' : 'Next →';
            }
            
            // Position tooltip
            tooltip.className = 'tour-tooltip position-' + step.position;
            
            const tooltipRect = tooltip.getBoundingClientRect();
            let tooltipX, tooltipY;
            
            switch (step.position) {
                case 'bottom':
                    tooltipX = rect.left + rect.width / 2 - tooltipRect.width / 2;
                    tooltipY = rect.bottom + 20;
                    break;
                case 'top':
                    tooltipX = rect.left + rect.width / 2 - tooltipRect.width / 2;
                    tooltipY = rect.top - tooltipRect.height - 20;
                    break;
                case 'left':
                    tooltipX = rect.left - tooltipRect.width - 20;
                    tooltipY = rect.top + rect.height / 2 - tooltipRect.height / 2;
                    break;
                case 'right':
                    tooltipX = rect.right + 20;
                    tooltipY = rect.top + rect.height / 2 - tooltipRect.height / 2;
                    break;
            }
            
            // Keep tooltip in viewport
            tooltipX = Math.max(10, Math.min(tooltipX, window.innerWidth - tooltipRect.width - 10));
            tooltipY = Math.max(10, Math.min(tooltipY, window.innerHeight - tooltipRect.height - 10));
            
            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = `${tooltipY}px`;
        },
        
        end(completed = false) {
            AppState.tour.active = false;
            
            const overlay = document.getElementById('tour-overlay');
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }

            if (completed) {
                UI.showToast('Orientation complete.', 'success');
                try {
                    const uid = AppState.currentUser?.uid;
                    if (uid) {
                        updateDoc(doc(firestore, 'users', uid), { tourCompletedAt: serverTimestamp() }).catch(() => {});
                    }
                } catch { /* ignore */ }
                // Persist completion flag (localStorage if available)
                try { localStorage.setItem('stonedoku_tour_done', '1'); } catch { /* ignore */ }

                // Enable tutorial button in the onboarding UI (so user can start tutorial after completing orientation)
                try {
                    const btn = document.getElementById('start-tutorial');
                    if (btn) btn.disabled = false;
                } catch (e) { /* ignore DOM errors */ }
            }
        },
    };
}
