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
    },

    // Generate a seeded random number for daily puzzle
    seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    },

    // Create daily puzzle - same puzzle for all users on the same day
    createDailyPuzzle() {
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        
        // Use seeded random for shuffling to ensure same puzzle each day
        const seededShuffleArray = (array, rngSeed) => {
            const arr = [...array];
            let currentSeed = rngSeed;
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(this.seededRandom(currentSeed++) * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        // Generate a complete grid with seeded randomness
        const grid = Array(9).fill(null).map(() => Array(9).fill(0));
        
        // Simple deterministic approach: start with a base grid and permute
        const baseGrid = [
            [1,2,3,4,5,6,7,8,9],
            [4,5,6,7,8,9,1,2,3],
            [7,8,9,1,2,3,4,5,6],
            [2,3,4,5,6,7,8,9,1],
            [5,6,7,8,9,1,2,3,4],
            [8,9,1,2,3,4,5,6,7],
            [3,4,5,6,7,8,9,1,2],
            [6,7,8,9,1,2,3,4,5],
            [9,1,2,3,4,5,6,7,8]
        ];
        
        // Copy base grid
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                grid[i][j] = baseGrid[i][j];
            }
        }
        
        // Permute rows within bands and columns within stacks based on seed
        const rowPerms = [
            seededShuffleArray([0, 1, 2], seed),
            seededShuffleArray([3, 4, 5], seed + 1),
            seededShuffleArray([6, 7, 8], seed + 2)
        ];
        
        const colPerms = [
            seededShuffleArray([0, 1, 2], seed + 3),
            seededShuffleArray([3, 4, 5], seed + 4),
            seededShuffleArray([6, 7, 8], seed + 5)
        ];
        
        const tempGrid = grid.map(row => [...row]);
        for (let band = 0; band < 3; band++) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 9; j++) {
                    grid[band * 3 + i][j] = tempGrid[rowPerms[band][i]][j];
                }
            }
        }
        
        const tempGrid2 = grid.map(row => [...row]);
        for (let stack = 0; stack < 3; stack++) {
            for (let i = 0; i < 9; i++) {
                for (let j = 0; j < 3; j++) {
                    grid[i][stack * 3 + j] = tempGrid2[i][colPerms[stack][j]];
                }
            }
        }
        
        const solution = grid.map(row => [...row]);
        const puzzle = grid.map(row => [...row]);
        
        // Remove cells (medium difficulty for daily puzzle)
        const removeCount = 45;
        let removed = 0;
        const positions = [];
        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }
        
        const shuffledPositions = seededShuffleArray(positions, seed + 6);
        for (const pos of shuffledPositions) {
            if (removed >= removeCount) break;
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            if (puzzle[row][col] !== 0) {
                puzzle[row][col] = 0;
                removed++;
            }
        }
        
        return { puzzle, solution, seed };
    }
};
