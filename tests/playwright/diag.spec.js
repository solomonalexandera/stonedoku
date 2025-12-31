import { test, expect } from '@playwright/test';

test('diagnose window.e2e', async ({ page }) => {
  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  
  // Wait a moment for scripts to load
  await page.waitForTimeout(3000);
  
  // Check what exists on window
  const diag = await page.evaluate(() => {
    return {
      hasStonedoku: !!window.Stonedoku,
      hasFirebase: !!(window.Stonedoku?.firebase),
      hasE2e: !!window.e2e,
      stonedokuKeys: window.Stonedoku ? Object.keys(window.Stonedoku) : [],
      e2eKeys: window.e2e ? Object.keys(window.e2e) : [],
    };
  });
  
  console.log('Diagnostics:', JSON.stringify(diag, null, 2));
  console.log('Console errors:', errors);
  expect(diag.hasE2e).toBe(true);
});
