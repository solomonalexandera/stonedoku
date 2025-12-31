import { test, expect } from '@playwright/test';

test('1v1 playthrough with one leaving mid-game', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await page2.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  const uid1 = await page1.evaluate(async () => await window.e2e.signIn());
  const uid2 = await page2.evaluate(async () => await window.e2e.signIn());

  const roomCode = 'leave_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createLobby(args.roomCode, args.u1, args.u2), { roomCode, u1: uid1, u2: uid2 });

  const matchId = 'leave_match_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createMatch(args.matchId, args.roomCode, args.uids), { matchId, roomCode, uids: [uid1, uid2] });

  // uid2 leaves mid-game (removes their player entry)
  const rem = await page2.evaluate(async (args) => await window.e2e.removePlayerFromLobby(args.roomCode, args.uid), { roomCode, uid: uid2 });
  expect(rem.success).toBeTruthy();

  // ensure lobby players count decreases
  const lobby = await page1.evaluate(async (r) => await window.e2e.readLobby(r), roomCode);
  expect(lobby.players[uid2]).toBeUndefined();

  await context1.close();
  await context2.close();
});
