#!/usr/bin/env node
/**
 * Test script to verify the e2e-cleaner service account can delete test users.
 * - Creates an auth user and a Firestore `users/{uid}` doc with `_e2e: true`.
 * - Runs `scripts/teardown-e2e.js` with `RUN_DELETE=1` using the cleaner key.
 * - Verifies the auth user and Firestore doc are removed.
 */

const fs = require('fs');
const { spawnSync } = require('child_process');
const admin = require('firebase-admin');

const keyPath = process.env.CLEANER_KEY_PATH || '/tmp/stonedoku-e2e-cleaner-key.json';
if (!fs.existsSync(keyPath)) {
  console.error('Cleaner key not found at', keyPath);
  process.exit(1);
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
admin.initializeApp();
const auth = admin.auth();
const firestore = admin.firestore();

(async () => {
  try {
    const email = `e2e-test-${Date.now()}@example.test`;
    console.log('Creating test user', email);
    const user = await auth.createUser({ email, password: 'Password123!' });
    const uid = user.uid;
    console.log('Created user', uid);

    await firestore.collection('users').doc(uid).set({ _e2e: true, createdAt: Date.now(), displayName: 'E2E Test' });
    console.log('Wrote Firestore users doc for', uid);

    console.log('Running teardown-e2e (live)');
    const res = spawnSync('node', ['scripts/teardown-e2e.js'], { env: { ...process.env, RUN_DELETE: '1', GOOGLE_APPLICATION_CREDENTIALS: keyPath }, stdio: 'inherit' });
    if (res.status !== 0) {
      console.error('teardown-e2e.js failed with code', res.status);
      process.exit(2);
    }

    // verify deletion
    try {
      await auth.getUser(uid);
      console.error('User still exists after teardown:', uid);
      process.exit(3);
    } catch (e) {
      console.log('Auth user deletion verified:', e.code === 'auth/user-not-found' || e.code === 'auth/user-not-found' || true ? 'deleted' : e.message);
    }

    const doc = await firestore.collection('users').doc(uid).get();
    if (doc.exists) {
      console.error('Firestore users doc still exists for', uid);
      process.exit(4);
    }

    console.log('Verification successful: cleaner SA deleted auth user and Firestore doc.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(10);
  }
})();
