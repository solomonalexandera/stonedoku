import { test, expect } from '@playwright/test';

test('full 1v1 gameplay and cleanup', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await page2.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  // Sign in both users
  const uid1 = await page1.evaluate(async () => await window.e2e.signIn());
  const uid2 = await page2.evaluate(async () => await window.e2e.signIn());
  expect(uid1).toBeTruthy();
  expect(uid2).toBeTruthy();

  const roomCode = 'room_' + Date.now();
  // Create lobby with both players
  await page1.evaluate(async (args) => await window.e2e.createLobby(args.roomCode, args.u1, args.u2), { roomCode, u1: uid1, u2: uid2 });

  // Verify page2 can read lobby
  const lobby = await page2.evaluate(async (args) => await window.e2e.readLobby(args.roomCode), { roomCode });
  expect(lobby).toBeTruthy();
  expect(Object.keys(lobby.players)).toContain(uid1);
  expect(Object.keys(lobby.players)).toContain(uid2);

  // Create match
  const matchId = 'e2e_match_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createMatch(args.matchId, args.roomCode, args.uids), { matchId, roomCode, uids: [uid1, uid2] });

  // Make a move from player1
  await page1.evaluate(async (args) => await window.e2e.makeMove(args.matchId, args.uid, 0, 1, 7), { matchId, uid: uid1 });

  // Read cell on player2
  const cell = await page2.evaluate(async (args) => await window.e2e.readCell(args.matchId, 0, 1), { matchId });
  expect(cell).toBeTruthy();
  expect(cell.value).toBe(7);
  expect(cell.filledBy).toBe(uid1);

  // Finish match and perform cleanup: each player removes themselves from lobby
  await page1.evaluate(async (args) => await window.e2e.finishMatch(args.matchId), { matchId });
  const rem1 = await page1.evaluate(async (args) => await window.e2e.removePlayerFromLobby(args.roomCode, args.uid), { roomCode, uid: uid1 });
  expect(rem1.success).toBeTruthy();
  const rem2 = await page2.evaluate(async (args) => await window.e2e.removePlayerFromLobby(args.roomCode, args.uid), { roomCode, uid: uid2 });
  expect(rem2.success).toBeTruthy();

  await context1.close();
  await context2.close();
});
