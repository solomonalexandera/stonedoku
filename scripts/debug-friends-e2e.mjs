import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  const t = Date.now();
  const email = `dbg_a_${t}@example.com`;
  const pass = 'TestPass123!';
  const name = `DBG-${t}`;
  try {
    const uid = await page.evaluate(async (opts) => {
      try { return await window.e2e.signInWithEmail(opts.email, opts.pass, opts.name); } catch (err) { return { __error: err && err.message ? err.message : String(err) }; }
    }, { email, pass, name });
    console.log('uid:', uid);
    const res = await page.evaluate(async (opts) => {
      try { return await window.e2e.createProfile(opts.uid, { username: opts.username, displayName: opts.displayName, email: opts.email }); } catch (err) { return { __error: err && err.message ? err.message : String(err) }; }
    }, { uid, username: `dbg_${t}`, displayName: `DBG-${t}`, email: `${`dbg_${t}`}@example.com` });
    console.log('createProfile res:', res);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
})();