const { test, expect } = require('@playwright/test');

// UI-driven friends accept flow to reproduce toast/console errors
test('ui friend request accept shows no error toast', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const t = Date.now();
  const emailA = `ui_a_${t}@example.com`;
  const emailB = `ui_b_${t}@example.com`;
  const pass = 'TestPass123!';
  const usernameA = `ui_a_${t}`;
  const usernameB = `ui_b_${t}`;

  // Create accounts
  await pageA.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const uidA = await pageA.evaluate(async (opts) => await window.e2e.signInWithEmail(opts.email, opts.pass, opts.name), { email: emailA, pass, name: 'UserA' });
  await pageA.evaluate(async (opts) => await window.e2e.createProfile(opts.uid, { username: opts.username, displayName: opts.display, email: opts.email }), { uid: uidA, username: usernameA, display: 'User A', email: emailA }).catch(()=>{});

  await pageB.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const uidB = await pageB.evaluate(async (opts) => await window.e2e.signInWithEmail(opts.email, opts.pass, opts.name), { email: emailB, pass, name: 'UserB' });
  await pageB.evaluate(async (opts) => await window.e2e.createProfile(opts.uid, { username: opts.username, displayName: opts.display, email: opts.email }), { uid: uidB, username: usernameB, display: 'User B', email: emailB }).catch(()=>{});

  // Open main app in both pages (their auth state should persist in each context)
  await pageA.goto('http://127.0.0.1:8000/');
  await pageB.goto('http://127.0.0.1:8000/');

  // Wait for auth to be recognized
  await pageA.waitForFunction(() => window.AppState && window.AppState.currentUser && !window.AppState.currentUser.isAnonymous, { timeout: 10000 });
  await pageB.waitForFunction(() => window.AppState && window.AppState.currentUser && !window.AppState.currentUser.isAnonymous, { timeout: 10000 });

  // Ensure cookie banners cleared
  try { await pageA.locator('#cookie-accept-all').click({ timeout: 2000 }); } catch (e) {}
  try { await pageB.locator('#cookie-accept-all').click({ timeout: 2000 }); } catch (e) {}

  // Ensure pages are online so vanity/profile lookups work
  await pageA.evaluate(async () => { try { return await window.e2e.ensureOnline(); } catch (e) { return null; } });
  await pageB.evaluate(async () => { try { return await window.e2e.ensureOnline(); } catch (e) { return null; } });

  // Send friend request from A to B using profile UI
  await pageA.goto(`http://127.0.0.1:8000/u/${usernameB}`);
  try {
    await pageA.waitForSelector('#profile-friend-btn', { timeout: 15000 });
  } catch (e) {
    const fs = require('fs');
    try { fs.writeFileSync('tests/playwright/test-results/ui_pageA_profile.html', await pageA.content()); } catch (e) {}
    try { await pageA.screenshot({ path: 'tests/playwright/test-results/ui_pageA_profile.png', fullPage: true }); } catch (e) {}
    throw e;
  }
  await pageA.click('#profile-friend-btn', { force: true });

  // Accept on B via profile
  await pageB.goto(`http://127.0.0.1:8000/u/${usernameB}`);
  await pageB.waitForSelector('#profile-friend-btn', { timeout: 10000 });
  // Wait a moment for request to arrive
  await pageB.waitForTimeout(1500);
  // If button shows 'Accept Request', click it
  const label = await pageB.$eval('#profile-friend-btn', el => el.textContent.trim());
  if (label.toLowerCase().includes('accept')) {
    await pageB.click('#profile-friend-btn', { force: true });
  }

  // Capture toasts and console
  const toastsA = await pageA.evaluate(() => window._capturedToasts || []);
  const consoleA = await pageA.evaluate(() => window._capturedConsole || []);
  const toastsB = await pageB.evaluate(() => window._capturedToasts || []);
  const consoleB = await pageB.evaluate(() => window._capturedConsole || []);

  const fs = require('fs');
  try { fs.writeFileSync('tests/playwright/test-results/ui_pageA_toasts.json', JSON.stringify(toastsA, null, 2)); } catch (e) {}
  try { fs.writeFileSync('tests/playwright/test-results/ui_pageA_console.json', JSON.stringify(consoleA, null, 2)); } catch (e) {}
  try { fs.writeFileSync('tests/playwright/test-results/ui_pageB_toasts.json', JSON.stringify(toastsB, null, 2)); } catch (e) {}
  try { fs.writeFileSync('tests/playwright/test-results/ui_pageB_console.json', JSON.stringify(consoleB, null, 2)); } catch (e) {}

  // Assert no error toasts were captured on accept (if accept occurred)
  const errorToastB = toastsB.find(t => t.type === 'error' || (typeof t.message === 'string' && /permission|denied|failed/i.test(t.message)));
  expect(errorToastB).toBeFalsy();

  await ctxA.close();
  await ctxB.close();
});
