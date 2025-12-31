import { test, expect } from '@playwright/test';

test('signup/profile creation flow', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const uid = await page.evaluate(async () => await window.e2e.signIn());
  expect(uid).toBeTruthy();

  const profile = { displayName: 'TestUser', createdAt: Date.now(), username: 'testuser' };
  const res = await page.evaluate(async (args) => await window.e2e.createProfile(args.uid, args.profile), { uid, profile });
  expect(res.success).toBeTruthy();

  const got = await page.evaluate(async (u) => await window.e2e.getProfile(u), uid);
  expect(got.displayName).toBe('TestUser');

  await context.close();
});
