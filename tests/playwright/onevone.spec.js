import { test, expect } from '@playwright/test';

test('1v1 flow smoke', async ({ page }) => {
  // Open the test page served by local server
  await page.goto('http://127.0.0.1:8000/test-1v1.html');
  // Click auth
  await page.click('text=1. Test Auth');
  await page.waitForTimeout(2000);
  // Click presence
  await page.click('text=2. Test Presence');
  await page.waitForTimeout(1000);
  // Create match
  await page.click('text=3. Create Test Match');
  await page.waitForTimeout(1000);
  // Make move
  await page.click('text=4. Test Make Move');
  await page.waitForTimeout(1000);
  // Start listener
  await page.click('text=5. Listen to Match');

  // Check output contains success messages
  const content = await page.locator('#output').innerText();
  expect(content).toContain('Auth successful');
});
