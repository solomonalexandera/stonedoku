import { AppState } from '../core/appState.js';
import { BoardIntegrityHelper } from './boardIntegrityUi.js';

export function createGameHelpers({ AppState: appState = AppState, BoardIntegrityHelper: boardIntegrity = BoardIntegrityHelper } = {}) {
    const helpers = {
        countNumbers() {
            const counts = {};
            for (let i = 1; i <= 9; i++) counts[i] = 0;

            if (!appState.puzzle) return counts;

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    const num = appState.puzzle[row][col];
                    if (num > 0) counts[num]++;
                }
            }
            return counts;
        },

        updateRemainingCounts() {
            const counts = this.countNumbers();
            for (let i = 1; i <= 9; i++) {
                const remaining = 9 - counts[i];
                const el = document.getElementById(`remaining-${i}`);
                const btn = document.querySelector(`.num-btn[data-num="${i}"]`);
                if (el) {
                    el.textContent = remaining > 0 ? `${remaining} left` : 'done';
                }
                if (btn) {
                    btn.classList.toggle('completed', remaining === 0);
                }
            }
        },

        updateProgress() {
            if (!appState.puzzle || !appState.solution || !appState.originalPuzzle) return;

            let filled = 0;
            let total = 0;

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (appState.originalPuzzle[row][col] === 0) {
                        total++;
                        if (appState.puzzle[row][col] === appState.solution[row][col]) {
                            filled++;
                        }
                    }
                }
            }

            const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
            const progressEl = document.getElementById('progress-percent');
            const fillEl = document.getElementById('progress-fill');

            if (progressEl) progressEl.textContent = `${percent}%`;
            if (fillEl) fillEl.style.width = `${percent}%`;

            boardIntegrity.updateFromSingleState();
        },

        updateMistakesDisplay() {
            const container = document.getElementById('mistakes-display');
            if (!container) return;

            container.innerHTML = '';
            for (let i = 0; i < appState.maxMistakes; i++) {
                const dot = document.createElement('span');
                dot.className = `mistake-dot${i >= appState.mistakes ? ' empty' : ''}`;
                container.appendChild(dot);
            }
            
            // Update hint text to show mistake count when a limit is set
            const hintEl = container.parentElement?.querySelector('.game-info-hint');
            if (hintEl) {
                if (appState.maxMistakes > 0) {
                    hintEl.textContent = `${appState.mistakes} of ${appState.maxMistakes} mistakes used`;
                } else {
                    hintEl.textContent = 'Mistakes are permanent.';
                }
            }
        },

        highlightSameNumbers(num) {
            document.querySelectorAll('.sudoku-cell').forEach(cell => {
                cell.classList.remove('same-number');
            });

            if (!appState.settings.highlightSameNumbers || num === 0) return;

            document.querySelectorAll('.sudoku-cell').forEach(cell => {
                const valueEl = cell.querySelector('.cell-value');
                const valueText = valueEl ? valueEl.textContent : cell.textContent;
                if (valueText === String(num)) {
                    cell.classList.add('same-number');
                }
            });
        },

        highlightConflicts(row, col, num) {
            if (!appState.settings.highlightConflicts || num === 0) return [];

            const conflicts = [];

            for (let c = 0; c < 9; c++) {
                if (c !== col && appState.puzzle[row][c] === num) {
                    conflicts.push({ row, col: c });
                }
            }

            for (let r = 0; r < 9; r++) {
                if (r !== row && appState.puzzle[r][col] === num) {
                    conflicts.push({ row: r, col });
                }
            }

            const boxRow = Math.floor(row / 3) * 3;
            const boxCol = Math.floor(col / 3) * 3;
            for (let r = boxRow; r < boxRow + 3; r++) {
                for (let c = boxCol; c < boxCol + 3; c++) {
                    if ((r !== row || c !== col) && appState.puzzle[r][c] === num) {
                        conflicts.push({ row: r, col: c });
                    }
                }
            }

            return conflicts;
        },

        toggleNotesMode() {
            appState.notesMode = !appState.notesMode;
            const btn = document.getElementById('notes-btn');
            if (btn) {
                btn.classList.toggle('active', appState.notesMode);
            }
            try {
                if (appState.tutorialActive && (appState.tutorialStep || 0) === 2) {
                    setTimeout(() => {
                        try { TutorialGame.next(); } catch (e) { console.warn('Tutorial next failed', e); }
                    }, 220);
                }
            } catch (e) {}
        },

        resetGameState() {
            appState.mistakes = 0;
            appState.moveHistory = [];
            appState.notes = {};
            appState.notesMode = false;
            appState.playerScore = 0;

            this.updateMistakesDisplay();
            this.updateProgress();
            this.updateRemainingCounts();

            const notesBtn = document.getElementById('notes-btn');
            if (notesBtn) notesBtn.classList.remove('active');
        }
    };

    return helpers;
}
