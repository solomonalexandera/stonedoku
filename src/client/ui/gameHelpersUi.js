import { AppState } from '../core/appState.js';
import { BoardIntegrityHelper } from './boardIntegrityUi.js';

export function createGameHelpers({ AppState: appState = AppState, BoardIntegrityHelper: boardIntegrity = BoardIntegrityHelper } = {}) {
    const helpers = {
        toolLimitForDifficulty(difficulty) {
            const d = String(difficulty || '').toLowerCase();
            if (d === 'easy') return 4;
            if (d === 'medium') return 3;
            if (d === 'hard') return 0;
            return 3;
        },

        resetToolLimits(difficulty) {
            const max = this.toolLimitForDifficulty(difficulty);
            appState.toolLimits.undoMax = max;
            appState.toolLimits.eraseMax = max;
            appState.toolLimits.undoLeft = max;
            appState.toolLimits.eraseLeft = max;
            this.updateToolUi();
        },

        updateToolUi() {
            const el = document.getElementById('tool-uses-value');
            if (!el) return;
            const { undoLeft, eraseLeft, undoMax, eraseMax } = appState.toolLimits;
            if (undoMax === 0 && eraseMax === 0) {
                el.textContent = 'Locked';
            } else {
                el.textContent = `Undo ${undoLeft}/${undoMax} · Erase ${eraseLeft}/${eraseMax}`;
            }
            const undoBtn = document.getElementById('undo-btn');
            const eraseBtn = document.getElementById('erase-btn');
            if (undoBtn) undoBtn.disabled = (undoMax === 0) || (appState.gameMode === 'single' && undoLeft <= 0);
            if (eraseBtn) eraseBtn.disabled = (eraseMax === 0) || (appState.gameMode === 'single' && eraseLeft <= 0);
        },

        tryUndo() {
            if (appState.gameMode === 'single') {
                if (appState.toolLimits.undoLeft <= 0) return false;
                const did = this.undo();
                if (did) {
                    appState.toolLimits.undoLeft = Math.max(0, appState.toolLimits.undoLeft - 1);
                    this.updateToolUi();
                }
                return did;
            }
            return this.undo();
        },

        consumeEraseIfNeeded(changedSomething) {
            if (!changedSomething) return;
            if (appState.gameMode !== 'single') return;
            if (appState.toolLimits.eraseLeft <= 0) return;
            appState.toolLimits.eraseLeft = Math.max(0, appState.toolLimits.eraseLeft - 1);
            this.updateToolUi();
        },

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

        addToHistory(row, col, oldValue, newValue) {
            appState.moveHistory.push({ row, col, oldValue, newValue });
            if (appState.moveHistory.length > 100) {
                appState.moveHistory.shift();
            }
        },

        undo() {
            if (appState.moveHistory.length === 0) return false;

            const lastMove = appState.moveHistory.pop();
            const { row, col, oldValue } = lastMove;

            appState.puzzle[row][col] = oldValue;

            const cell = document.querySelector(
                `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
            );
            if (cell) {
                const valueEl = cell.querySelector('.cell-value');
                if (valueEl) valueEl.textContent = oldValue !== 0 ? oldValue : '';
                else cell.textContent = oldValue !== 0 ? oldValue : '';
            }

            this.updateRemainingCounts();
            this.updateProgress();

            return true;
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
            this.updateToolUi();
        }
    };

    return helpers;
}
