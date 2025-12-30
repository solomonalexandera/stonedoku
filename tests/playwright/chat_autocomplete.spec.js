const { test, expect } = require('@playwright/test');

test.skip('chat autocomplete (whisper command removed)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to e2e runner and sign in
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const uid = await page.evaluate(async () => await window.e2e.signIn());
  expect(uid).toBeTruthy();

  const username = 'auto_test_' + Math.floor(Math.random()*10000);
  // Create profile with known username
  const profile = { displayName: 'AutoTester', username: username, email: `auto+${Date.now()}@example.com` };
  const res = await page.evaluate(async (args) => await window.e2e.createProfile(args.uid, args.profile), { uid, profile });
  expect(res).toBeTruthy();

  // Open main app and open chat widget
  await page.goto('http://127.0.0.1:8000/');
  // allow backend writes to propagate
  await page.waitForTimeout(1200);
  // Dismiss cookie banner if present
  try { await page.locator('#cookie-accept-all').click({ timeout: 2000 }); } catch (e) {}

  // Open chat widget FAB
  await page.click('#chat-fab');
  await page.waitForSelector('#chat-widget-input', { state: 'visible', timeout: 5000 });

  // Type a sample message (autocomplete command removed)
  await page.fill('#chat-widget-input', `hello ${username.substring(0,6)}`);

  // Ensure the input contains the typed message
  const val = await page.inputValue('#chat-widget-input');
  expect(val.startsWith(`hello ${username.substring(0,6)}`)).toBeTruthy();

  await context.close();
});
