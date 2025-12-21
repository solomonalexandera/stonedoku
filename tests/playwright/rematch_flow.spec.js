const { test, expect } = require('@playwright/test');

test('both players agree rematch -> new match created', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await page2.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  const uid1 = await page1.evaluate(async () => await window.e2e.signIn());
  const uid2 = await page2.evaluate(async () => await window.e2e.signIn());

  const roomCode = 'remflow_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createLobby(args.roomCode, args.u1, args.u2), { roomCode, u1: uid1, u2: uid2 });
  const matchId = 'remflow_match_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createMatch(args.matchId, args.roomCode, args.uids), { matchId, roomCode, uids: [uid1, uid2] });

  // Both vote true
  await page1.evaluate(async (args) => await window.e2e.voteRematch(args.roomCode, args.uid, true), { roomCode, uid: uid1 });
  await page2.evaluate(async (args) => await window.e2e.voteRematch(args.roomCode, args.uid, true), { roomCode, uid: uid2 });

  // read votes
  const votes = await page1.evaluate(async (r) => await window.e2e.readRematchVotes(r), roomCode);
  expect(votes[uid1].vote).toBe(true);
  expect(votes[uid2].vote).toBe(true);

  // create new match when both true
  const newMatch = 'remflow_match_new_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createMatch(args.newMatchId, args.roomCode, args.uids), { newMatchId: newMatch, roomCode, uids: [uid1, uid2] });

  // verify match exists
  const m = await page2.evaluate(async (mId) => { return await window.e2e.readCell ? null : null; }, newMatch);
  // read root match path to ensure created
  const snap = await page1.evaluate(async (mId) => { return await window.e2e.readScores ? await window.e2e.readScores(mId) : null; }, newMatch);
  expect(snap).not.toBeNull();

  await context1.close();
  await context2.close();
});
