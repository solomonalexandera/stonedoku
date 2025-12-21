/*
 * Export all Firebase Auth users to a timestamped JSON file.
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/export-users.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp();

async function run() {
  const auth = admin.auth();
  let nextPageToken;
  const users = [];
  do {
    const list = await auth.listUsers(1000, nextPageToken);
    for (const u of list.users) {
      users.push({ uid: u.uid, email: u.email || null, phoneNumber: u.phoneNumber || null, providerData: u.providerData });
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  const outDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const filename = `backups/auth-users-${new Date().toISOString().replace(/[:.]/g,'')}.json`;
  fs.writeFileSync(filename, JSON.stringify(users, null, 2));
  console.log('Exported', users.length, 'users to', filename);
}

run().catch(err => { console.error('Export failed:', err); process.exit(1); });
