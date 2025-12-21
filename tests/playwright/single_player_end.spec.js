const { test, expect } = require('@playwright/test');

test('single-player loss triggers game-over modal', async ({ page }) => {
  const base = process.env.E2E_BASE || 'http://127.0.0.1:8000/';
  await page.goto(base);

  // Wait for the app to expose the single-player starter
  await page.waitForFunction(() => window.startSinglePlayerGame !== undefined);

  // Start an easy single-player game and force 1 allowed mistake
  await page.evaluate(() => {
    startSinglePlayerGame('easy');
    window.AppState = window.AppState || {};
    window.AppState.settings = window.AppState.settings || {};
    window.AppState.settings.autoCheck = true;
    window.AppState.maxMistakes = 1;
  });

  // Wait for cells to render
  await page.waitForSelector('.sudoku-cell');

  // Pick a non-given cell and choose a deliberately wrong number
  const info = await page.evaluate(() => {
    const cell = document.querySelector('.sudoku-cell:not(.given)');
    if (!cell) return null;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    const solVal = (window.AppState && window.AppState.solution) ? window.AppState.solution[row][col] : null;
    return { row, col, solVal };
  });

  if (!info) throw new Error('No editable cell found');

  // choose a different number than the solution
  const wrongNum = ((info.solVal % 9) + 1) || 1;

  const cellSelector = `.sudoku-cell[data-row="${info.row}"][data-col="${info.col}"]`;
  await page.click(cellSelector);

  // Try clicking a number button, otherwise type the digit
  let btn = await page.$(`button[data-num="${wrongNum}"]`);
  if (!btn) btn = await page.$(`.num-btn[data-num="${wrongNum}"]`);
  if (btn) {
    await btn.click();
  } else {
    await page.keyboard.press(String(wrongNum));
  }

  // Expect game-over modal to appear after the mistake
  await page.waitForSelector('#game-over-modal', { state: 'visible', timeout: 7000 });
  expect(await page.isVisible('#game-over-modal')).toBeTruthy();
});
