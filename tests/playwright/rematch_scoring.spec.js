const { test, expect } = require('@playwright/test');

test('rematch voting and scoring flow', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');
  await page2.goto('http://127.0.0.1:8000/tests/playwright/e2e-runner.html');

  const uid1 = await page1.evaluate(async () => await window.e2e.signIn());
  const uid2 = await page2.evaluate(async () => await window.e2e.signIn());

  const roomCode = 'rematch_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createLobby(args.roomCode, args.u1, args.u2), { roomCode, u1: uid1, u2: uid2 });
  const matchId = 'rematch_match_' + Date.now();
  await page1.evaluate(async (args) => await window.e2e.createMatch(args.matchId, args.roomCode, args.uids), { matchId, roomCode, uids: [uid1, uid2] });

  // Update scores
  await page1.evaluate(async (args) => await window.e2e.updateScore(args.matchId, args.uid, 5), { matchId, uid: uid1 });
  await page2.evaluate(async (args) => await window.e2e.updateScore(args.matchId, args.uid, 3), { matchId, uid: uid2 });

  // Verify scores
  const s1 = await page1.evaluate(async (m,u) => { const snap = await window.e2e.readCell ? null : null; return (await window.e2e.readLobby) ? null : null; }, null);
  // We will read directly from RTDB via readCell workaround: read scores from match path
  const scores = await page1.evaluate(async (args) => {
    const snap = await window.fetch(`https://stonedoku-c0898-default-rtdb.europe-west1.firebasedatabase.app/matches/${args.matchId}/scores.json`);
    return await snap.json();
  }, { matchId });
  expect(scores[uid1]).toBe(5);
  expect(scores[uid2]).toBe(3);

  // Rematch votes
  await page1.evaluate(async (args) => await window.e2e.voteRematch(args.roomCode, args.uid, true), { roomCode, uid: uid1 });
  await page2.evaluate(async (args) => await window.e2e.voteRematch(args.roomCode, args.uid, false), { roomCode, uid: uid2 });

  const votes = await page1.evaluate(async (args) => {
    const snap = await window.fetch(`https://stonedoku-c0898-default-rtdb.europe-west1.firebasedatabase.app/lobbies/${args.roomCode}/rematchVotes.json`);
    return await snap.json();
  }, { roomCode });

  expect(votes[uid1].vote).toBe(true);
  expect(votes[uid2].vote).toBe(false);

  await context1.close();
  await context2.close();
});
