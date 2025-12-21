const { test, expect } = require('@playwright/test');

test('global chat interactions', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await page2.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  const uid1 = await page1.evaluate(async () => await window.e2e.signIn());
  const uid2 = await page2.evaluate(async () => await window.e2e.signIn());

  await page1.evaluate(async (args) => await window.e2e.sendGlobalChat(args.uid, 'Alice', 'Hello world'), { uid: uid1 });
  await page2.evaluate(async (args) => await window.e2e.sendGlobalChat(args.uid, 'Bob', 'Hi Alice'), { uid: uid2 });

  const messages = await page1.evaluate(async () => await window.e2e.readGlobalChat());
  const values = Object.values(messages || {});
  expect(values.some(m => m.text === 'Hello world')).toBeTruthy();
  expect(values.some(m => m.text === 'Hi Alice')).toBeTruthy();

  await context1.close();
  await context2.close();
});
