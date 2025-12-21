#!/usr/bin/env node
/*
 * Create a minimal service account for E2E cleanup, create a key and store
 * the key in Secret Manager (e2e-cleaner-key). Uses the owner key at
 * /tmp/stonedoku-sa.json by default.
 *
 * Usage: node scripts/create-e2e-sa.js --project=stonedoku-c0898
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const OWNER_KEY_PATH = process.env.OWNER_KEY_PATH || '/tmp/stonedoku-sa.json';
const PROJECT = (() => {
  const arg = process.argv.find(a => a.startsWith('--project='));
  if (arg) return arg.split('=')[1];
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  throw new Error('project not specified; use --project=your-project');
})();

async function getAccessTokenFromOwner() {
  const key = JSON.parse(fs.readFileSync(OWNER_KEY_PATH, 'utf8'));
  const cred = admin.credential.cert(key);
  const tok = await cred.getAccessToken();
  if (!tok || !tok.access_token) throw new Error('failed to get access token from owner key');
  return tok.access_token;
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch (e) { json = txt; }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const token = await getAccessTokenFromOwner();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const saId = 'stonedoku-e2e-cleaner';
  const saEmail = `${saId}@${PROJECT}.iam.gserviceaccount.com`;

  console.log('Creating service account', saId);
  try {
    await fetchJson(`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts`, {
      method: 'POST', headers, body: JSON.stringify({ accountId: saId, serviceAccount: { displayName: 'Stonedoku E2E Cleaner' } })
    });
    console.log('Service account created');
  } catch (e) {
    const msg = String(e).toLowerCase();
    if (msg.includes('already exists') || msg.includes('already_exists') || msg.includes('alreadyexists') || msg.includes('alread_exists') || msg.includes('already_exists')) {
      console.log('Service account already exists, continuing');
    } else {
      throw e;
    }
  }
  // Ensure the service account is visible (propagation may be slightly delayed)
  console.log('Waiting for service account to be available');
  for (let i = 0; i < 10; i++) {
    try {
      await fetchJson(`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${encodeURIComponent(saEmail)}`, { method: 'GET', headers });
      break;
    } catch (e) {
      if (i === 9) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Roles to bind
  const roles = [
    'roles/firebaseauth.admin',
    'roles/datastore.user',
    'roles/firebasedatabase.admin',
    'roles/secretmanager.secretAccessor'
  ];

  console.log('Fetching current IAM policy for project');
  const getPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:getIamPolicy`;
  const policy = await fetchJson(getPolicyUrl, { method: 'POST', headers, body: JSON.stringify({}) });

  const member = `serviceAccount:${saEmail}`;
  policy.bindings = policy.bindings || [];
  for (const role of roles) {
    let b = policy.bindings.find(x => x.role === role);
    if (!b) {
      b = { role, members: [member] };
      policy.bindings.push(b);
    } else if (!b.members.includes(member)) {
      b.members.push(member);
    }
  }

  console.log('Setting updated IAM policy (adding required role bindings)');
  const setPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:setIamPolicy`;
  await fetchJson(setPolicyUrl, { method: 'POST', headers, body: JSON.stringify({ policy }) });
  console.log('IAM policy updated');

  // Create key
  console.log('Creating service account key');
  const keyRes = await fetchJson(`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${encodeURIComponent(saEmail)}/keys`, {
    method: 'POST', headers, body: JSON.stringify({ privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE', keyAlgorithm: 'KEY_ALG_RSA_2048' })
  });
  const keyData = Buffer.from(keyRes.privateKeyData, 'base64').toString('utf8');
  const keyPath = `/tmp/${saId}-key.json`;
  fs.writeFileSync(keyPath, keyData, { mode: 0o600 });
  console.log('Key written to', keyPath);

  // Create secret if needed
  const secretId = 'e2e-cleaner-key';
  try {
    console.log('Creating secret', secretId);
    await fetchJson(`https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets?secretId=${encodeURIComponent(secretId)}`, {
      method: 'POST', headers, body: JSON.stringify({ replication: { automatic: {} } })
    });
    console.log('Secret created');
  } catch (e) {
    const msg = String(e).toLowerCase();
    if (msg.includes('already exists') || msg.includes('already_exists') || msg.includes('alreadyexists')) console.log('Secret already exists');
    else throw e;
  }

  // Add secret version
  console.log('Adding secret version');
  const addVersionUrl = `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secretId}:addVersion`;
  const b64 = Buffer.from(keyData, 'utf8').toString('base64');
  await fetchJson(addVersionUrl, { method: 'POST', headers, body: JSON.stringify({ payload: { data: b64 } }) });
  console.log('Secret version added');

  // Verification: run teardown-e2e.js in dry-run using the new key
  console.log('Verifying the new key by running teardown-e2e.js (dry-run) with the new key');
  const { spawnSync } = require('child_process');
  const res = spawnSync('node', ['scripts/teardown-e2e.js'], { env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: keyPath }, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('Verification run failed with code', res.status);
    process.exit(1);
  }

  console.log('Verification completed successfully. You can now remove the owner key and rotate as needed.');
}

main().catch(err => { console.error(err); process.exit(1); });
