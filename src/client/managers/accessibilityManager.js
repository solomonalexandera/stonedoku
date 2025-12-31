/**
 * Accessibility Manager
 * Handles keyboard navigation, ARIA labels, and screen reader announcements
 */

/**
 * Create Accessibility Manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.AppState - Application state
 * @param {Object} deps.GameUI - Game UI for cell selection
 * @returns {Object} Accessibility Manager instance
 */
export function createAccessibilityManager({ AppState, GameUI } = {}) {
    let announcer = null;
    let announceToScreenReader = null;

    const createAnnouncer = () => {
        const el = document.createElement('div');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.id = 'sr-announcer';
        document.body.appendChild(el);
        
        return (message) => {
            el.textContent = '';
            setTimeout(() => {
                el.textContent = message;
            }, 100);
        };
    };

    const setupKeyboardNavigation = () => {
        document.addEventListener('keydown', (e) => {
            if (!AppState?.selectedCell) return;
            
            const { row, col } = AppState.selectedCell;
            let newRow = row;
            let newCol = col;
            
            switch (e.key) {
                case 'ArrowUp':
                    newRow = Math.max(0, row - 1);
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    newRow = Math.min(8, row + 1);
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    newCol = Math.max(0, col - 1);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    newCol = Math.min(8, col + 1);
                    e.preventDefault();
                    break;
                case 'Tab':
                    // Allow normal tab behavior for accessibility
                    return;
                default:
                    return;
            }
            
            if (newRow !== row || newCol !== col) {
                GameUI?.selectCell(newRow, newCol);
                const cell = document.querySelector(`.sudoku-cell[data-row="${newRow}"][data-col="${newCol}"]`);
                cell?.focus();
            }
        });
    };

    const addAriaLabels = () => {
        // Add labels to game elements on load
        setTimeout(() => {
            // Number pad buttons
            document.querySelectorAll('.num-btn').forEach(btn => {
                const num = btn.dataset.num;
                btn.setAttribute('aria-label', `Enter number ${num}`);
            });
            
            // Difficulty buttons
            document.querySelectorAll('.difficulty-btn, .diff-btn').forEach(btn => {
                const diff = btn.dataset.difficulty;
                btn.setAttribute('aria-label', `Start ${diff} difficulty game`);
            });
            
            // Toggle switches
            document.querySelectorAll('.toggle-switch input').forEach(input => {
                const label = input.closest('.setting-row')?.querySelector('.setting-label')?.textContent;
                if (label) {
                    input.setAttribute('aria-label', label);
                }
            });
        }, 500);
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
        setupKeyboardNavigation();
        addAriaLabels();
        announceToScreenReader = createAnnouncer();
    };

    return {
        init,
        setupKeyboardNavigation,
        addAriaLabels,
        createAnnouncer,
        announceMove,
        announceGameStart,
        announceGameEnd,
        announce
    };
}

// Default singleton export for backwards compatibility
export const AccessibilityManager = createAccessibilityManager();
