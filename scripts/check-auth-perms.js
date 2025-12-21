const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.SA_PATH || '/home/codespace/.config/sa-stonedoku.json';
  if (!fs.existsSync(keyPath)) {
    console.error('Service account key not found at', keyPath);
    process.exit(2);
  }
  const key = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(key),
    projectId: key.project_id,
  });

  const auth = admin.auth();
  try {
    // try to get provider config for Google (if available)
    const providerId = 'google.com';
    if (auth.getProviderConfig) {
      const cfg = await auth.getProviderConfig(providerId);
      console.log('getProviderConfig OK:', cfg.providerId || cfg.name || 'ok');
    } else if (auth.listProviderConfigs) {
      const list = await auth.listProviderConfigs();
      console.log('listProviderConfigs OK, count=', list.providerConfigs ? list.providerConfigs.length : 'unknown');
    } else {
      console.log('Admin SDK does not support provider management in this version');
    }
  } catch (e) {
    console.error('Auth provider query failed:', e && e.code ? e.code : e.message || e);
    process.exit(3);
  }
}

main();
