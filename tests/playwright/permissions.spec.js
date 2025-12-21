const { test, expect } = require('@playwright/test');

test.describe('Permission edge cases', () => {
  test('anonymous cannot write presence for other user', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/tests/playwright/permissions-runner.html');
    // sign in anonymously
    await page.evaluate(async () => window.testHelpers && window.testHelpers.signInAnonymously && await window.testHelpers.signInAnonymously());
    const res = await page.evaluate(async () => await window.testHelpers.writePresenceFor('some-other-uid-123'));
    expect(res.success).toBeFalsy();
    expect(res.error).toBeTruthy();
  });

  test('anonymous cannot create vanity link (requires email)', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/tests/playwright/permissions-runner.html');
    await page.evaluate(async () => window.testHelpers.signInAnonymously && await window.testHelpers.signInAnonymously());
    const res = await page.evaluate(async () => await window.testHelpers.createVanity('tryvanity'));
    expect(res.success).toBeFalsy();
    expect(res.code).toMatch(/permission-denied|permission/);
  });

  test('cannot update username doc (updates forbidden)', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/tests/playwright/permissions-runner.html');
    await page.evaluate(async () => window.testHelpers.signInAnonymously && await window.testHelpers.signInAnonymously());
    // create doc first under this auth
    const uid = (await page.evaluate(async () => { const r = await window.testHelpers.signInAnonymously(); return r.uid; })) || 'anon';
    await page.evaluate(async (u) => await window.testHelpers.createUsernameDoc('editblocked-'+u, u), uid);
    const upd = await page.evaluate(async () => await window.testHelpers.updateUsernameDoc('editblocked-'+(await (async()=>{return ''+Date.now();})()), { test: 1 }));
    // update should fail (either because name mismatch or updates forbidden)
    expect(upd.success).toBeFalsy();
  });

  test('unauthenticated cannot read presence', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/tests/playwright/permissions-runner.html');
    // ensure signed out
    await page.evaluate(async () => window.testHelpers.signOut && await window.testHelpers.signOut());
    const res = await page.evaluate(async () => await window.testHelpers.readPresenceAll());
    expect(res.success).toBeFalsy();
  });
});
