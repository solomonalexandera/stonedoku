/**
 * Accessibility Manager
 * Handles ARIA labels and screen reader announcements
 * Note: Keyboard navigation is handled in eventSetup.js via navigateCell()
 */

/**
 * Create Accessibility Manager
 * @param {Object} deps - Dependencies (optional, uses globals as fallback)
 * @returns {Object} Accessibility Manager instance
 */
export function createAccessibilityManager() {
    let announceToScreenReader = null;

    const createAnnouncer = () => {
        // Check if announcer already exists
        let el = document.getElementById('sr-announcer');
        if (!el) {
            el = document.createElement('div');
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('aria-atomic', 'true');
            el.className = 'sr-only';
            el.id = 'sr-announcer';
            document.body.appendChild(el);
        }
        
        return (message) => {
            el.textContent = '';
            setTimeout(() => {
                el.textContent = message;
            }, 100);
        };
    };

    const addAriaLabels = () => {
        // Add labels to game elements
        // Number pad buttons
        document.querySelectorAll('.num-btn').forEach(btn => {
            const num = btn.dataset.num;
            if (num) btn.setAttribute('aria-label', `Enter number ${num}`);
        });
        
        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn, .diff-btn').forEach(btn => {
            const diff = btn.dataset.difficulty;
            if (diff) btn.setAttribute('aria-label', `Start ${diff} difficulty game`);
        });
        
        // Toggle switches
        document.querySelectorAll('.toggle-switch input').forEach(input => {
            const label = input.closest('.setting-row')?.querySelector('.setting-label')?.textContent;
            if (label) {
                input.setAttribute('aria-label', label);
            }
        });

        // Sudoku cells
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            if (row !== undefined && col !== undefined) {
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `Row ${parseInt(row) + 1}, Column ${parseInt(col) + 1}`);
            }
        });
    };

    const announceMove = (row, col, num, isCorrect) => {
        if (!announceToScreenReader) return;
        const message = isCorrect 
            ? `${num} placed correctly at row ${row + 1}, column ${col + 1}`
            : `${num} is incorrect at row ${row + 1}, column ${col + 1}`;
        announceToScreenReader(message);
    };

    const announceGameStart = (mode, difficulty) => {
        if (!announceToScreenReader) return;
        const message = mode === 'versus' 
            ? 'Versus game started. Race to fill the board!'
            : `New ${difficulty} game started. Good luck!`;
        announceToScreenReader(message);
    };

    const announceGameEnd = (won, score) => {
        if (!announceToScreenReader) return;
        const message = won 
            ? `Congratulations! You won with a score of ${score}!`
            : 'Game over. Better luck next time!';
        announceToScreenReader(message);
    };

    const announce = (message) => {
        if (announceToScreenReader) {
            announceToScreenReader(message);
        }
    };

    const init = () => {
        announceToScreenReader = createAnnouncer();
        // Delay ARIA labels to ensure DOM is ready
        if (document.readyState === 'complete') {
            addAriaLabels();
        } else {
            window.addEventListener('load', addAriaLabels);
        }
    };

    return {
        init,
        addAriaLabels,
        announceMove,
        announceGameStart,
        announceGameEnd,
        announce
    };
}

// Default singleton export
export const AccessibilityManager = createAccessibilityManager();
