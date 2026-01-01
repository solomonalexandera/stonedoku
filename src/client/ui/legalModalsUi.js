/**
 * Legal Modals Manager
 * Handles privacy policy, terms of service, cookies, and accessibility modals
 */

/**
 * Create Legal Modals manager
 * @returns {Object} Legal Modals manager instance
 */
export function createLegalModals() {
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeAll();
        }
    };

    const open = (type) => {
        const modal = document.getElementById(`${type}-modal`);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            const closeBtn = modal.querySelector('.modal-close');
            closeBtn?.focus();
            
            modal.addEventListener('keydown', handleEscape);
        }
    };

    const close = (type) => {
        const modal = document.getElementById(`${type}-modal`);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            modal.removeEventListener('keydown', handleEscape);
        }
    };

    const closeAll = () => {
        ['privacy', 'terms', 'cookies', 'accessibility'].forEach(type => close(type));
    };

    const setupListeners = () => {
        // Footer links
        document.getElementById('privacy-link')?.addEventListener('click', () => open('privacy'));
        document.getElementById('terms-link')?.addEventListener('click', () => open('terms'));
        document.getElementById('cookies-link')?.addEventListener('click', () => open('cookies'));
        document.getElementById('accessibility-link')?.addEventListener('click', () => open('accessibility'));
        
        // Auth form links
        document.getElementById('auth-terms-link')?.addEventListener('click', () => open('terms'));
        document.getElementById('auth-privacy-link')?.addEventListener('click', () => open('privacy'));
        
        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => closeAll());
        });
        
        // Close on backdrop click
        document.querySelectorAll('.legal-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeAll();
                }
            });
        });
    };

    const init = () => {
        setupListeners();
    };

    return {
        init,
        open,
        close,
        closeAll,
        setupListeners
    };
}

// Default singleton export for backwards compatibility
export const LegalModals = createLegalModals();
