/*
 * Safe script to delete all Firebase Auth users. Requires service account
 * credentials via GOOGLE_APPLICATION_CREDENTIALS and explicit RUN_DELETE=1
 * environment variable to actually perform deletions.
 *
 * Usage (dry-run):
 *   node scripts/delete-all-users.js
 *
 * To execute (DANGEROUS):
 *   RUN_DELETE=1 GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/delete-all-users.js
 */

const admin = require('firebase-admin');

const DRY_RUN = process.env.RUN_DELETE !== '1';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS must point to a service account JSON');
  if (!DRY_RUN) process.exit(1);
}

admin.initializeApp();

async function run() {
  console.log(DRY_RUN ? 'Dry-run: will list users only' : 'LIVE: will delete users');

  const auth = admin.auth();
  let nextPageToken;
  let total = 0;
  do {
    const list = await auth.listUsers(1000, nextPageToken);
    const users = list.users;
    if (users.length === 0) break;
    for (const u of users) {
      total++;
      if (DRY_RUN) {
        console.log('USER:', u.uid, u.email || '(no email)');
      } else {
        console.log('Deleting', u.uid);
        await auth.deleteUser(u.uid);
      }
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  console.log('Processed', total, 'users');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
