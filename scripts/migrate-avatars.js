/**
 * Migration script to consolidate legacy profile images into avatars/{userId}/
 *
 * Usage:
 * 1) Install deps: npm install firebase-admin
 * 2) Run dry-run:
 *    node scripts/migrate-avatars.js --dry
 * 3) To execute, set RUN_MIGRATION=1 and provide a service account key via
 *    GOOGLE_APPLICATION_CREDENTIALS env var, then run:
 *    RUN_MIGRATION=1 node scripts/migrate-avatars.js
 *
 * The script looks for user documents in Firestore (collection `users`) and
 * ensures the `profilePicture` URL points to an object under `avatars/{uid}/`.
 * It will copy files if needed and update the user's document. By default it's
 * a dry-run.
 */

const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const url = require('url');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry') || process.env.RUN_MIGRATION !== '1';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS must point to a service account JSON');
  if (!DRY_RUN) process.exit(1);
}

admin.initializeApp();
const firestore = admin.firestore();
const storage = new Storage();

async function run() {
  console.log(DRY_RUN ? 'Running in dry-run mode' : 'Running migration (live)');

  const usersSnap = await firestore.collection('users').get();
  console.log(`Found ${usersSnap.size} user docs`);

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    const data = doc.data();
    const pic = data && data.profilePicture;
    if (!pic) continue;

    try {
      const parsed = new url.URL(pic);
      // Try to detect if it's already under avatars/{uid}/
      const pathname = decodeURIComponent(parsed.pathname || '');
      if (pathname.includes(`/avatars/${uid}/`)) {
        console.log(uid, 'already under avatars/ — skipping');
        continue;
      }

      // Otherwise attempt to copy the object into avatars/{uid}/
      // We expect the bucket to be the Firebase Storage default bucket
      const bucketName = admin.storage().bucket().name;
      const bucket = storage.bucket(bucketName);
      const srcPath = pathname.replace(/^\//, '');
      const filename = path.basename(srcPath);
      const targetPath = `avatars/${uid}/${Date.now()}_${filename}`;

      console.log(uid, 'will copy', srcPath, '->', targetPath);

      if (!DRY_RUN) {
        await bucket.file(srcPath).copy(bucket.file(targetPath));
        // make file publicly readable like other avatars (if desired)
        await bucket.file(targetPath).makePublic().catch(() => {});
        const newUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(targetPath)}`;
        await firestore.collection('users').doc(uid).update({ profilePicture: newUrl });
        console.log(uid, 'copied and profile updated');
      }
    } catch (err) {
      console.warn(uid, 'skipping — could not parse or copy:', err.message);
    }
  }

  console.log('Migration finished');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
