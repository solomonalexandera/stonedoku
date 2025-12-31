import { AppState } from '../appState.js';

// Manages visual fracture/repair effects on the Sudoku board.
export const BoardIntegritySystem = {
    gridEl: null,
    boxCells: Array.from({ length: 9 }, () => []),
    boxRepair: Array(9).fill(0),

    clamp01(n) {
        return Math.max(0, Math.min(1, Number(n) || 0));
    },

    initGrid(gridEl) {
        this.gridEl = gridEl || document.getElementById('sudoku-grid');
        this.boxCells = Array.from({ length: 9 }, () => []);
        this.boxRepair = Array(9).fill(0);

        if (this.gridEl) {
            this.gridEl.classList.add('is-fractured');
        }
    },

    registerCell(cell, row, col) {
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        cell.dataset.box = String(box);
        this.boxCells[box].push(cell);

        const fx = (Math.random() - 0.5) * 4; // px
        const fy = (Math.random() - 0.5) * 4; // px
        const fr = (Math.random() - 0.5) * 0.8; // deg

        cell.style.setProperty('--repair', '0');
        cell.style.setProperty('--fracture-x0', `${fx.toFixed(2)}px`);
        cell.style.setProperty('--fracture-y0', `${fy.toFixed(2)}px`);
        cell.style.setProperty('--fracture-r0', `${fr.toFixed(3)}deg`);
        cell.style.setProperty('--fracture-x', `${fx.toFixed(2)}px`);
        cell.style.setProperty('--fracture-y', `${fy.toFixed(2)}px`);
        cell.style.setProperty('--fracture-r', `${fr.toFixed(3)}deg`);
    },

    setBoxRepair(box, repair) {
        const r = this.clamp01(repair);
        this.boxRepair[box] = r;
        const list = this.boxCells[box] || [];
        const scale = 1 - r;
        for (const cell of list) {
            cell.style.setProperty('--repair', r.toFixed(3));

            const baseX = parseFloat(cell.style.getPropertyValue('--fracture-x0')) || 0;
            const baseY = parseFloat(cell.style.getPropertyValue('--fracture-y0')) || 0;
            const baseR = parseFloat(cell.style.getPropertyValue('--fracture-r0')) || 0;

            cell.style.setProperty('--fracture-x', `${(baseX * scale).toFixed(2)}px`);
            cell.style.setProperty('--fracture-y', `${(baseY * scale).toFixed(2)}px`);
            cell.style.setProperty('--fracture-r', `${(baseR * scale).toFixed(3)}deg`);
        }
    },

    updateFromSingleState() {
        if (!AppState.puzzle || !AppState.solution || !AppState.originalPuzzle) return;

        const totals = Array(9).fill(0);
        const correct = Array(9).fill(0);

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (AppState.originalPuzzle[row][col] !== 0) continue;
                const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
                totals[box]++;
                if (AppState.puzzle[row][col] === AppState.solution[row][col]) {
                    correct[box]++;
                }
            }
        }

        for (let box = 0; box < 9; box++) {
            const r = totals[box] > 0 ? correct[box] / totals[box] : 1;
            this.setBoxRepair(box, r);
        }
    },

    updateFromVersusBoard(board) {
        if (!board) return;

        const totals = Array(9).fill(0);
        const filled = Array(9).fill(0);

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cellData = board[`${row}_${col}`];
                if (!cellData || cellData.given) continue;
                const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
                totals[box]++;
                if (cellData.filledBy && cellData.value) {
                    filled[box]++;
                }
            }
        }

        for (let box = 0; box < 9; box++) {
            const r = totals[box] > 0 ? filled[box] / totals[box] : 1;
            this.setBoxRepair(box, r);
        }
    }
};
