/**
 * Creative Features Manager
 * Visual effects for gameplay: streaks, confetti, cell animations, group completion
 */

/**
 * Create Creative Features manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.MotionUtils - Motion manager for reduced-motion checks
 * @returns {Object} Creative Features manager instance
 */
export function createCreativeFeatures({ MotionUtils } = {}) {
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
        if (typeof MotionUtils?.prefersReducedMotion === 'function' && MotionUtils.prefersReducedMotion()) return;

        // Zen-inspired colors: earthy tones, stone, moss, brass
        const colors = ['#d8d1c5', '#c6c1b6', '#b08b4f', '#3f5543', '#2b4a36', '#9a9384'];

        // Create fewer, larger particles for zen aesthetic
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const chip = document.createElement('div');
                const w = 4 + Math.random() * 8;
                const h = 4 + Math.random() * 12;
                const drift = (Math.random() - 0.5) * 100; // Less horizontal drift

                chip.className = 'dust-chip';
                chip.style.left = `${Math.random() * 100}vw`;
                chip.style.width = `${w.toFixed(1)}px`;
                chip.style.height = `${h.toFixed(1)}px`;
                chip.style.background = colors[Math.floor(Math.random() * colors.length)];
                chip.style.opacity = `${0.3 + Math.random() * 0.35}`; // Slightly more visible
                chip.style.setProperty('--dust-drift', `${drift.toFixed(1)}px`);
                chip.style.animationDuration = `${4 + Math.random() * 2.5}s`; // Slower, more graceful
                chip.style.borderRadius = `${Math.random() * 3}px`; // Slight roundness
                document.body.appendChild(chip);

                setTimeout(() => chip.remove(), 7000);
            }, i * 60); // Slightly more staggered
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
