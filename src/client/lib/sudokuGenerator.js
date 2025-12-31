// src/client/lib/sudokuGenerator.js

// Ported from the legacy app.js implementation for parity during the refactor.
export const SudokuGenerator = {
    // Check if placing num at (row, col) is valid
    isValid(grid, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (grid[row][x] === num) return false;
        }
        for (let x = 0; x < 9; x++) {
            if (grid[x][col] === num) return false;
        }

        const startRow = row - (row % 3);
        const startCol = col - (col % 3);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[startRow + i][startCol + j] === num) return false;
            }
        }
        return true;
    },

    // Solve the grid using backtracking
    solve(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const nums = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (this.isValid(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (this.solve(grid)) return true;
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    },

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    // Generate a complete valid Sudoku grid
    generateComplete() {
        const grid = Array(9).fill(null).map(() => Array(9).fill(0));
        this.solve(grid);
        return grid;
    },

    // Create puzzle by removing cells based on difficulty
    createPuzzle(difficulty = 'medium') {
        const solution = this.generateComplete();
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

        const shuffledPositions = this.shuffleArray(positions);

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
