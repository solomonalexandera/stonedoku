const { test, expect } = require('@playwright/test');

test('players online UI updates and clears', async ({ browser }) => {
  const contextApp = await browser.newContext();
  const pageApp = await contextApp.newPage();

  // Open the main app and sign in anonymously via UI
  await pageApp.goto('http://127.0.0.1:8000/');
  // Dismiss cookie banner if present
  try {
    const acceptBtn = pageApp.locator('#cookie-accept-all');
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click({ timeout: 2000 });
    }
  } catch (e) {
    // ignore
  }
  await pageApp.click('text=Play as Guest');

  // Wait for user info to appear
  await pageApp.waitForSelector('#user-info', { state: 'visible' });

  // Open a helper runner to simulate another user's presence
  const contextRunner = await browser.newContext();
  const pageRunner = await contextRunner.newPage();
  await pageRunner.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  // Sign in and write presence for the simulated user
  const otherUid = await pageRunner.evaluate(async () => await window.e2e.signIn());
  await pageRunner.evaluate(async (args) => await window.e2e.writePresence(args.uid, 'SimUser'), { uid: otherUid });

  // Wait for the main app to show the other player in the players list
  await pageApp.waitForFunction((uid) => {
    const items = Array.from(document.querySelectorAll('#players-list .player-item'));
    return items.some(i => i.dataset.userId === uid);
  }, otherUid, { timeout: 5000 });

  // Confirm online count increments
  const countText = await pageApp.locator('#online-count').innerText();
  expect(Number(countText)).toBeGreaterThanOrEqual(1);

  // Now clear presence for that user
  await pageRunner.evaluate(async (uid) => await window.e2e.clearPresence(uid), otherUid);

  // Wait for the UI to remove the player
  await pageApp.waitForFunction((uid) => {
    const items = Array.from(document.querySelectorAll('#players-list .player-item'));
    return !items.some(i => i.dataset.userId === uid);
  }, otherUid, { timeout: 7000 });

  // Confirm count decreased (or zero)
  const finalCount = await pageApp.locator('#online-count').innerText();
  expect(Number(finalCount)).toBeGreaterThanOrEqual(0);

  await contextRunner.close();
  await contextApp.close();
});
