// src/client/lib/sudokuGenerator.js

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function solveSudoku(board) {
    // ... implementation from app.js
    return false; // Or solved board
}

export const SudokuGenerator = {
    _grid: [],
    _counter: 0,

    createFullBoard() {
        this._grid = Array.from({ length: 9 }, () => Array(9).fill(0));
        this._counter = 0;
        this._fill(0, 0);
        return this._grid;
    },

    _fill(row, col) {
        if (this._counter > 2000000) return;
        this._counter++;

        if (row === 9) {
            return true;
        }

        const nextRow = col === 8 ? row + 1 : row;
        const nextCol = col === 8 ? 0 : col + 1;

        const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

        for (const num of nums) {
            if (this._isValid(row, col, num)) {
                this._grid[row][col] = num;
                if (this._fill(nextRow, nextCol)) {
                    return true;
                }
                this._grid[row][col] = 0;
            }
        }
        return false;
    },

    _isValid(row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (this._grid[row][i] === num || this._grid[i][col] === num) {
                return false;
            }
        }

        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this._grid[startRow + i][startCol + j] === num) {
                    return false;
                }
            }
        }
        return true;
    },

    createPuzzle(difficulty = 'medium') {
        const solution = this.createFullBoard();
        const puzzle = solution.map(row => [...row]);

        const cellsToRemove = {
            easy: 35,
            medium: 45,
            hard: 55
        };

        const removeCount = cellsToRemove[difficulty] || 45;
        let removed = 0;
        const positions = [];

        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }

        const shuffledPositions = shuffleArray(positions);

        for (const pos of shuffledPositions) {
            if (removed >= removeCount) break;

            const row = Math.floor(pos / 9);
            const col = pos % 9;

            if (puzzle[row][col] !== 0) {
                puzzle[row][col] = 0;
                removed++;
            }
        }

        return { puzzle, solution };
    }
};
