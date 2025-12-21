const { test, expect } = require('@playwright/test');

test('registered user profile playthrough (edit social links, vanity url)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Use the e2e runner in the same context so auth state is shared
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const uid = await page.evaluate(async () => await window.e2e.signIn());
  expect(uid).toBeTruthy();

  const profileData = {
    displayName: 'RegisteredUser',
    username: 'reguser' + Math.floor(Math.random()*10000),
    email: 'reg+' + Date.now() + '@example.com'
  };

  const res = await page.evaluate(async (args) => await window.e2e.createProfile(args.uid, args.profile), { uid, profile: profileData });
  expect(res).toBeTruthy();

  // Open main app in same context so auth persists
  await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });

  // Dismiss cookie banner early to avoid click interception
  try {
    const acceptBtn = page.locator('#cookie-accept-all');
    if (await acceptBtn.count() > 0) await acceptBtn.click({ timeout: 3000 });
  } catch (e) {}

  // Wait for UI to show signed-in user
  await page.waitForSelector('#user-info', { state: 'visible', timeout: 10000 });

  // Open profile page
  await page.click('#my-profile-btn');
  await page.waitForSelector('#profile-view', { state: 'visible' });

  // Click edit and update social links
  // Ensure cookie banner dismissed before interacting
  try {
    const acceptBtn = page.locator('#cookie-accept-all');
    if (await acceptBtn.count() > 0) await acceptBtn.click({ timeout: 3000 });
  } catch (e) {}

  await page.click('#edit-profile-btn', { timeout: 5000 });
  await page.waitForSelector('#profile-bio-input', { state: 'visible' });
  await page.fill('#profile-bio-input', 'Hello from Playwright');
  await page.waitForSelector('#profile-twitter', { state: 'visible' });
  await page.fill('#profile-twitter', 'https://twitter.com/example');
  await page.waitForSelector('#profile-discord', { state: 'visible' });
  await page.fill('#profile-discord', 'discord#1234');
  await page.click('#save-profile-btn');

  // Wait for success alert (app uses alert on save)
  // Dismiss alert
  try {
    await page.waitForEvent('dialog', { timeout: 2000 }).then(d => d.dismiss());
  } catch (e) {
    // ignore if not shown
  }

  // Navigate to vanity URL using hash and verify profile loads
  const username = profileData.username.toLowerCase();
  await page.goto(`http://127.0.0.1:8000/#profile/${encodeURIComponent(username)}`, { waitUntil: 'networkidle' });

  // Wait for profile page to show
  await page.waitForSelector('#profile-view', { state: 'visible', timeout: 10000 });
  const shownUsername = await page.locator('#profile-page-username').innerText({ timeout: 5000 });
  expect(shownUsername.toLowerCase()).toBe(username);

  await context.close();
});
