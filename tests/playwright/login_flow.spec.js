const { test, expect } = require('@playwright/test');

// This test ensures a basic sign-in and onboarding flow works and surfaces
// catastrophic client-side errors that prevent progress past the front page.

test('basic signin and reach user-info', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Attach console/page error listeners early so we capture bootstrap messages
  const errors = [];
  const consoleMessages = [];
  page.on('pageerror', (err) => errors.push(err.message + '\n' + (err.stack || '')));
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Go to e2e runner and sign in using test helper
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const uid = await page.evaluate(async () => await window.e2e.signIn());
  expect(uid).toBeTruthy();

  // Open main app
  await page.goto('http://127.0.0.1:8000/');

  // Wait for initial UI to settle (listeners attached earlier)

  // Give the app a bit of time to initialize
  await page.waitForTimeout(1500);

  // Dismiss cookie banner if present
  try { await page.locator('#cookie-accept-all').click({ timeout: 1500 }); } catch (e) {}

  // Fail early if any page-level errors were emitted
    if (errors.length > 0) {
      // Save diagnostics
      const fs = require('fs');
      try { fs.writeFileSync('test-results/login_flow_console_early.txt', consoleMessages.join('\n')); } catch (e) {}
      try { const html = await page.content(); fs.writeFileSync('test-results/login_flow_page_early.html', html); } catch (e) {}
      try { await page.screenshot({ path: 'test-results/login_flow_screenshot_early.png', fullPage: true }); } catch (e) {}
      throw new Error('Console/page errors detected during app bootstrap:\n' + errors.join('\n'));
    }

  // Try to progress: click "Play as Guest" if present, else wait for user-info
  // Do not attempt to click 'Play as Guest' — rely on navigation and
  // authenticated shell / user-info selectors instead to avoid flakiness.

  // Wait for main game board or user-info to appear
  try {
    await Promise.race([
      page.waitForSelector('#sudoku-board', { timeout: 10000 }),
      page.waitForSelector('#user-info', { timeout: 10000 })
    ]);
  } catch (err) {
    // Capture diagnostics for debugging
    const fs = require('fs');
    const html = await page.content();
    try { fs.writeFileSync('test-results/login_flow_page.html', html); } catch (e) {}
    try {
      const startup = await page.evaluate(() => window.__startupErrors || []);
      fs.writeFileSync('test-results/login_flow_startup_errors.json', JSON.stringify(startup, null, 2));
    } catch (e) {}
    try { fs.writeFileSync('test-results/login_flow_console.txt', consoleMessages.join('\n')); } catch (e) {}
    try { await page.screenshot({ path: 'test-results/login_flow_screenshot.png', fullPage: true }); } catch (e) {}
    throw err;
  }

  await context.close();
});
