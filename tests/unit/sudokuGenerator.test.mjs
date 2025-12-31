import test from 'node:test';
import assert from 'node:assert/strict';
import { SudokuGenerator } from '../../src/client/lib/sudokuGenerator.js';

function isValidGrid(grid) {
  const digits = new Set([1,2,3,4,5,6,7,8,9]);
  for (let r = 0; r < 9; r++) {
    const row = new Set(grid[r]);
    if (row.size !== 9 || [...row].some(n => !digits.has(n))) return false;
  }
  for (let c = 0; c < 9; c++) {
    const col = new Set(grid.map(row => row[c]));
    if (col.size !== 9 || [...col].some(n => !digits.has(n))) return false;
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = new Set();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          box.add(grid[br * 3 + r][bc * 3 + c]);
        }
      }
      if (box.size !== 9 || [...box].some(n => !digits.has(n))) return false;
    }
  }
  return true;
}

test('generateComplete returns a solved 9x9 grid', () => {
  const grid = SudokuGenerator.generateComplete();
  assert.equal(grid.length, 9);
  grid.forEach(row => assert.equal(row.length, 9));
  assert.ok(isValidGrid(grid));
});

test('createPuzzle removes cells but retains a solvable solution grid shape', () => {
  const { puzzle, solution } = SudokuGenerator.createPuzzle('medium');
  assert.equal(puzzle.length, 9);
  assert.equal(solution.length, 9);
  puzzle.forEach(row => assert.equal(row.length, 9));
  solution.forEach(row => assert.equal(row.length, 9));

  const zeroCount = puzzle.flat().filter((n) => n === 0).length;
  assert.ok(zeroCount >= 35 && zeroCount <= 60, 'expected a reasonable number of blanks');
  assert.ok(isValidGrid(solution));
});
