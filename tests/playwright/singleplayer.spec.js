import { test, expect } from '@playwright/test';

test('single player playthrough', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  const uid = await page.evaluate(async () => await window.e2e.signIn());
  const roomCode = 'single_' + Date.now();
  // create lobby with solo
  await page.evaluate(async (args) => await window.e2e.createLobby(args.roomCode, args.hostUid, args.otherUid), { roomCode, hostUid: uid, otherUid: uid });

  const matchId = 'single_match_' + Date.now();
  await page.evaluate(async (args) => await window.e2e.createSinglePlayerMatch(args.matchId, args.roomCode, args.uid), { matchId, roomCode, uid });

  // make moves
  await page.evaluate(async (args) => await window.e2e.makeMove(args.matchId, args.uid, 0, 0, 4), { matchId, uid });
  const cell = await page.evaluate(async (args) => await window.e2e.readCell(args.matchId, 0, 0), { matchId });
  expect(cell.value).toBe(4);

  // finish and cleanup
  await page.evaluate(async (args) => await window.e2e.finishMatch(args.matchId), { matchId });
  const rem = await page.evaluate(async (args) => await window.e2e.removePlayerFromLobby(args.roomCode, args.uid), { roomCode, uid });
  expect(rem.success).toBeTruthy();

  await context.close();
});
