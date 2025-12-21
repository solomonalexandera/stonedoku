#!/usr/bin/env node
/**
 * Remove the owner/max-priv service account and its key used earlier.
 * Uses the owner key file at /tmp/stonedoku-sa.json to authenticate,
 * then deletes the key and the service account resource.
 *
 * WARNING: irreversible. Only run if you are sure.
 */

const fs = require('fs');
const admin = require('firebase-admin');

const OWNER_KEY_PATH = process.env.OWNER_KEY_PATH || '/tmp/stonedoku-sa.json';
if (!fs.existsSync(OWNER_KEY_PATH)) {
  console.error('Owner key not found at', OWNER_KEY_PATH);
  process.exit(1);
}

const ownerKey = JSON.parse(fs.readFileSync(OWNER_KEY_PATH, 'utf8'));
const project = ownerKey.project_id;
const ownerEmail = ownerKey.client_email;
const keyId = ownerKey.private_key_id;

async function getAccessToken() {
  const cred = admin.credential.cert(ownerKey);
  const tok = await cred.getAccessToken();
  if (!tok || !tok.access_token) throw new Error('failed to get access token');
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
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const keyName = `projects/${project}/serviceAccounts/${ownerEmail}/keys/${keyId}`;
  console.log('Deleting owner key', keyId);
  try {
    await fetchJson(`https://iam.googleapis.com/v1/${encodeURIComponent(keyName)}`, { method: 'DELETE', headers });
    console.log('Owner key deleted');
  } catch (e) {
    console.warn('Failed to delete owner key:', e.message);
  }

  // Delete the service account resource
  const saName = `projects/${project}/serviceAccounts/${ownerEmail}`;
  console.log('Deleting service account', ownerEmail);
  try {
    await fetchJson(`https://iam.googleapis.com/v1/${encodeURIComponent(saName)}`, { method: 'DELETE', headers });
    console.log('Service account deleted');
  } catch (e) {
    console.warn('Failed to delete service account:', e.message);
  }

  // Remove local owner key file
  try { fs.unlinkSync(OWNER_KEY_PATH); console.log('Removed local owner key file'); } catch (e) { /* ignore */ }
}

main().catch(err => { console.error(err); process.exit(1); });
