/**
 * Creative Features Manager
 * Visual effects for gameplay: streaks, confetti, cell animations, group completion
 */

/**
 * Create Creative Features manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.MotionManager - Motion manager for reduced-motion checks
 * @returns {Object} Creative Features manager instance
 */
export function createCreativeFeatures({ MotionManager } = {}) {
    let streak = 0;

    const createStreakIndicator = () => {
        const indicator = document.createElement('div');
        indicator.className = 'streak-indicator';
        document.body.appendChild(indicator);
        return indicator;
    };

    const showStreak = () => {
        const indicator = document.querySelector('.streak-indicator') || createStreakIndicator();
        indicator.textContent = `Integrity: ${streak}`;
        indicator.classList.add('visible');
        
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    };

    const incrementStreak = () => {
        streak++;
        if (streak >= 3) {
            showStreak();
        }
    };

    const resetStreak = () => {
        streak = 0;
    };

    const showConfetti = () => {
        if (typeof MotionManager?.prefersReducedMotion === 'function' && MotionManager.prefersReducedMotion()) return;

        const colors = ['#d8d1c5', '#c6c1b6', '#9c7b45', '#3f5543', '#0e0f12'];

        for (let i = 0; i < 26; i++) {
            setTimeout(() => {
                const chip = document.createElement('div');
                const w = 3 + Math.random() * 5;
                const h = 3 + Math.random() * 10;
                const drift = (Math.random() - 0.5) * 120;

                chip.className = 'dust-chip';
                chip.style.left = `${Math.random() * 100}vw`;
                chip.style.width = `${w.toFixed(1)}px`;
                chip.style.height = `${h.toFixed(1)}px`;
                chip.style.background = colors[Math.floor(Math.random() * colors.length)];
                chip.style.opacity = `${0.2 + Math.random() * 0.35}`;
                chip.style.setProperty('--dust-drift', `${drift.toFixed(1)}px`);
                chip.style.animationDuration = `${3.6 + Math.random() * 2.2}s`;
                document.body.appendChild(chip);

                setTimeout(() => chip.remove(), 6500);
            }, i * 45);
        }
    };

    const animateCellComplete = (row, col) => {
        const cell = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('just-completed');
            setTimeout(() => cell.classList.remove('just-completed'), 400);
        }
    };

    const animateGroupComplete = (cells) => {
        cells.forEach(({ row, col }) => {
            const cell = document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('group-complete');
                setTimeout(() => cell.classList.remove('group-complete'), 600);
            }
        });
    };

    const checkGroupCompletion = (puzzle, row, col) => {
        // Check row completion
        const rowComplete = puzzle[row].every(v => v !== 0);
        if (rowComplete) {
            const cells = [];
            for (let c = 0; c < 9; c++) cells.push({ row, col: c });
            animateGroupComplete(cells);
        }
        
        // Check column completion
        let colComplete = true;
        for (let r = 0; r < 9; r++) {
            if (puzzle[r][col] === 0) colComplete = false;
        }
        if (colComplete) {
            const cells = [];
            for (let r = 0; r < 9; r++) cells.push({ row: r, col });
            animateGroupComplete(cells);
        }
        
        // Check box completion
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        let boxComplete = true;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (puzzle[r][c] === 0) boxComplete = false;
            }
        }
        if (boxComplete) {
            const cells = [];
            for (let r = boxRow; r < boxRow + 3; r++) {
                for (let c = boxCol; c < boxCol + 3; c++) {
                    cells.push({ row: r, col: c });
                }
            }
            animateGroupComplete(cells);
        }
    };

    return {
        streak: () => streak,
        showStreak,
        incrementStreak,
        resetStreak,
        showConfetti,
        animateCellComplete,
        animateGroupComplete,
        checkGroupCompletion
    };
}

// Default singleton export for backwards compatibility
export const CreativeFeatures = createCreativeFeatures();
