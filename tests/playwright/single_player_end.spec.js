import { test, expect } from '@playwright/test';

test('single-player loss triggers game-over modal', async ({ page }) => {
  // First sign in via e2e runner
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await page.evaluate(async () => await window.e2e.signIn());

  // Now go to main app
  const base = process.env.E2E_BASE || 'http://127.0.0.1:8000/';
  await page.goto(base);

  // Wait for the app to fully initialize and auth state to settle
  await page.waitForFunction(() => window.startSinglePlayerGame !== undefined && window.AppState?.authReady, { timeout: 15000 });

  // Dismiss cookie banner if present
  try { await page.locator('#cookie-accept-all').click({ timeout: 2000 }); } catch (e) {}

  // Wait for lobby view to be visible (indicates auth completed)
  await page.waitForSelector('#lobby-view', { state: 'visible', timeout: 10000 });

  // Start an easy single-player game and force 1 allowed mistake
  await page.evaluate(() => {
    startSinglePlayerGame('easy');
    window.AppState.settings.autoCheck = true;
    window.AppState.maxMistakes = 1;
  });

  // Wait for game view and cells to render
  await page.waitForSelector('#game-view', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('.sudoku-cell', { timeout: 10000 });

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
