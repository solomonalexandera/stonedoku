const { test, expect } = require('@playwright/test');

// Profile-level friends test (backend-only via e2e runner). This avoids flaky
// UI interactions by manipulating/verifying Firestore profiles directly.

test('create two users and make them friends (backend)', async ({ browser }) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  // Attach console/page error listeners early for diagnostics
  const errors = [];
  pageA.on('pageerror', (err) => errors.push('A:' + (err.message + '\n' + (err.stack || ''))));
  pageA.on('console', msg => { if (msg.type() === 'error') errors.push('A:' + msg.text()); });
  pageB.on('pageerror', (err) => errors.push('B:' + (err.message + '\n' + (err.stack || ''))));
  pageB.on('console', msg => { if (msg.type() === 'error') errors.push('B:' + msg.text()); });

  await pageA.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await pageB.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  // Create two test accounts with unique emails
  const t = Date.now();
  const emailA = `e2e_a_${t}@example.com`;
  const emailB = `e2e_b_${t}@example.com`;
  const pass = 'TestPass123!';
  const nameA = `E2E-A-${t}`;
  const nameB = `E2E-B-${t}`;
  const usernameA = `e2e_a_${t}`;
  const usernameB = `e2e_b_${t}`;

  const fs = require('fs');
  // Create first user on pageA
  const uidA = await pageA.evaluate(async (opts) => {
    try {
      return await window.e2e.signInWithEmail(opts.emailA, opts.pass, opts.nameA);
    } catch (e) { return { __error: e && e.message ? e.message : String(e) }; }
  }, { emailA, pass, nameA });

  if (!uidA || uidA.__error) {
    fs.writeFileSync('test-results/friends_debug.json', JSON.stringify({ step: 'uidA-failed', val: uidA }, null, 2));
    throw new Error('Failed to create/sign-in user A: ' + (uidA && uidA.__error ? uidA.__error : String(uidA)));
  }
  fs.writeFileSync('test-results/friends_debug.json', JSON.stringify({ step: 'uidA', uidA }, null, 2));

  await pageA.evaluate(async (d) => {
    try { return await window.e2e.createProfile(d.uid, { username: d.username, displayName: d.displayName, email: d.email }); }
    catch (e) { return { __error: e && e.message ? e.message : String(e) }; }
  }, { uid: uidA, username: usernameA, displayName: nameA, email: emailA });

  // Create second user on pageB
  // Ensure pageB is online before sign-up
  await pageB.evaluate(async () => { try { return await window.e2e.ensureOnline(); } catch (e) { return { __error: e && e.message ? e.message : String(e) }; } });
  const uidB = await pageB.evaluate(async (opts) => {
    try {
      return await window.e2e.signInWithEmail(opts.emailB, opts.pass, opts.nameB);
    } catch (e) { return { __error: e && e.message ? e.message : String(e) }; }
  }, { emailB, pass, nameB });

  if (!uidB || uidB.__error) {
    fs.writeFileSync('test-results/friends_debug.json', JSON.stringify({ step: 'uidB-failed', val: uidB }, null, 2));
    throw new Error('Failed to create/sign-in user B: ' + (uidB && uidB.__error ? uidB.__error : String(uidB)));
  }
  fs.writeFileSync('test-results/friends_debug.json', JSON.stringify({ step: 'uidB', uidB }, null, 2));

  await pageB.evaluate(async (d) => {
    try { return await window.e2e.createProfile(d.uid, { username: d.username, displayName: d.displayName, email: d.email }); }
    catch (e) { return { __error: e && e.message ? e.message : String(e) }; }
  }, { uid: uidB, username: usernameB, displayName: nameB, email: emailB });

  // Read back profiles
  // Ensure online before reading profiles (createProfile may quiet connections)
  // Ensure both pages are online
  await pageA.evaluate(async () => { try { return await window.e2e.ensureOnline(); } catch (e) { return { __error: e && e.message ? e.message : String(e) }; } });
  await pageB.evaluate(async () => { try { return await window.e2e.ensureOnline(); } catch (e) { return { __error: e && e.message ? e.message : String(e) }; } });

  // Update each user's friends list from their own authenticated page
  await pageA.evaluate(async (data) => {
    try { return await window.e2e.createProfile(data.uidA, { friends: [data.uidB] }); }
    catch (e) { return { __error: e && e.message ? e.message : String(e) }; }
  }, { uidA, uidB });

  await pageB.evaluate(async (data) => {
    try { return await window.e2e.createProfile(data.uidB, { friends: [data.uidA] }); }
    catch (e) { return { __error: e && e.message ? e.message : String(e) }; }
  }, { uidA, uidB });

  // Read back profiles from their respective pages
  const finalA = await pageA.evaluate(async (uid) => { try { return await window.e2e.getProfile(uid); } catch (e) { return { __error: e && e.message ? e.message : String(e) }; } }, uidA);
  const finalB = await pageB.evaluate(async (uid) => { try { return await window.e2e.getProfile(uid); } catch (e) { return { __error: e && e.message ? e.message : String(e) }; } }, uidB);

  const result = { uidA, uidB, a: finalA, b: finalB };
  try { fs.writeFileSync('test-results/friends_debug_final.json', JSON.stringify(result, null, 2)); } catch (e) {}
  console.log('FRIENDS_TEST_RESULT:', JSON.stringify(result));

  if (errors.length > 0) {
    const fs = require('fs');
    try { fs.writeFileSync('test-results/friends_console_early.txt', errors.join('\n')); } catch (e) {}
  }

  if (!result || result.error) {
    const fs = require('fs');
    try { fs.writeFileSync('test-results/friends_error.json', JSON.stringify(result || { error: 'no-result' }, null, 2)); } catch (e) {}
    throw new Error('E2E runner failed: ' + (result && result.error ? result.error : 'unknown'));
  }

  const a = result.a;
  const b = result.b;
  expect(uidA).toBeTruthy();
  expect(uidB).toBeTruthy();

  // Profiles returned from e2e.getProfile are plain objects (or null). Check friends arrays.
  const aData = a || {};
  const bData = b || {};
  const aFriends = Array.isArray(aData.friends) ? aData.friends : [];
  const bFriends = Array.isArray(bData.friends) ? bData.friends : [];

  expect(aFriends).toContain(uidB);
  expect(bFriends).toContain(uidA);

  try { await dumpCapturedLogs(pageA, 'pageA'); } catch (e) {}
  try { await dumpCapturedLogs(pageB, 'pageB'); } catch (e) {}
  await context.close();
});

// Persist in-browser captured toasts and console logs for debugging
test.afterEach(async ({}, testInfo) => {
  // No-op here; handled inline in the test to keep artifacts colocated.
});

// Helper to pull captured logs from pages if present — run as a standalone utility
async function dumpCapturedLogs(page, label) {
  try {
    const toasts = await page.evaluate(() => window._capturedToasts || []);
    const consoleBuf = await page.evaluate(() => window._capturedConsole || []);
    const fs = require('fs');
    try { fs.writeFileSync(`test-results/${label}_toasts.json`, JSON.stringify(toasts, null, 2)); } catch (e) {}
    try { fs.writeFileSync(`test-results/${label}_console.json`, JSON.stringify(consoleBuf, null, 2)); } catch (e) {}
  } catch (e) { /* ignore */ }
}
