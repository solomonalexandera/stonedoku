#!/usr/bin/env node
/*
 * Teardown helper for E2E tests.
 * - By default runs as dry-run and only lists candidate test users.
 * - To actually delete set RUN_DELETE=1.
 *
 * Supports fetching a service account key from Secret Manager by setting:
 *   USE_SECRET_MANAGER=1 SECRET_NAME=projects/<project>/secrets/<name>
 * The process running this script must already have permission to access the
 * secret (e.g. running with an owner/service account that created the secret).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
let SecretManagerServiceClient;
try {
  SecretManagerServiceClient = require('@google-cloud/secret-manager').SecretManagerServiceClient;
} catch (e) {
  SecretManagerServiceClient = null;
}

const DRY_RUN = process.env.RUN_DELETE !== '1';
const USE_SECRET_MANAGER = process.env.USE_SECRET_MANAGER === '1';
const SECRET_NAME = process.env.SECRET_NAME; // e.g. projects/myproj/secrets/e2e-cleaner-key

async function fetchKeyFromSecretManager() {
  if (!SECRET_NAME) throw new Error('SECRET_NAME is required when USE_SECRET_MANAGER=1');
  if (!SecretManagerServiceClient) throw new Error('Missing @google-cloud/secret-manager package; install it or provide GOOGLE_APPLICATION_CREDENTIALS');
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({name: `${SECRET_NAME}/versions/latest`});
  const payload = version.payload.data.toString('utf8');
  const tmp = path.join(os.tmpdir(), `stonedoku-e2e-cleaner-${Date.now()}.json`);
  fs.writeFileSync(tmp, payload, {mode: 0o600});
  return tmp;
}

async function ensureCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (USE_SECRET_MANAGER) {
    const p = await fetchKeyFromSecretManager();
    process.env.GOOGLE_APPLICATION_CREDENTIALS = p;
    return p;
  }
  throw new Error('No GOOGLE_APPLICATION_CREDENTIALS and USE_SECRET_MANAGER not enabled');
}

async function run() {
  try {
    await ensureCredentials();
  } catch (e) {
    console.error('Credential setup failed:', e.message);
    if (!DRY_RUN) process.exit(1);
  }

  admin.initializeApp();
  const auth = admin.auth();
  const firestore = admin.firestore();
  let rtdb = null;
  try {
    if (typeof admin.database === 'function') {
      rtdb = admin.database();
    }
  } catch (e) {
    rtdb = null;
  }

  console.log(DRY_RUN ? 'Dry-run: will list candidate test users' : 'LIVE: will delete matched test users');

  let nextPageToken;
  let total = 0;
  // Consider a user a test user if the Firestore users doc has `_e2e: true`
  // or if `createdAt` exists and is within the last 48 hours.
  const now = Date.now();
  const cutoff = now - (48 * 60 * 60 * 1000);

  do {
    const list = await auth.listUsers(1000, nextPageToken);
    const users = list.users;
    if (users.length === 0) break;
    for (const u of users) {
      total++;
      let isTest = false;
      try {
        const doc = await firestore.collection('users').doc(u.uid).get();
        if (doc.exists) {
          const data = doc.data();
          if (data && data._e2e === true) isTest = true;
          if (!isTest && data && data.createdAt) {
            const created = typeof data.createdAt === 'number' ? data.createdAt : (data.createdAt.toMillis ? data.createdAt.toMillis() : null);
            if (created && created >= cutoff) isTest = true;
          }
        }
      } catch (e) {
        // Firestore read errors should not abort the whole process
        console.warn('Firestore check failed for', u.uid, e.message);
      }

      if (isTest) {
        if (DRY_RUN) {
          console.log('CANDIDATE:', u.uid, u.email || '(no email)');
        } else {
          console.log('Deleting', u.uid);
          try {
            await auth.deleteUser(u.uid);
          } catch (e) {
            console.error('Failed to delete auth user', u.uid, e.message);
          }
          try {
            await firestore.collection('users').doc(u.uid).delete();
          } catch (e) {
            console.warn('Failed to delete users doc', u.uid, e.message);
          }
          if (rtdb) {
            try { await rtdb.ref(`presence/${u.uid}`).remove(); } catch (e) { /* ignore */ }
            try { await rtdb.ref(`lobbies`).child(u.uid).remove(); } catch (e) { /* ignore */ }
          }
        }
      }
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  console.log('Scanned', total, 'users');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
