const { spawnSync } = require('child_process');
const path = require('path');

// This global teardown runs after the Playwright test suite to remove any
// test-created users. It prefers using Secret Manager if configured in CI.

module.exports = async () => {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.PLAYWRIGHT_PROJECT || '';
  const secretName = process.env.SECRET_NAME || (project ? `projects/${project}/secrets/e2e-cleaner-key` : null);

  const env = Object.assign({}, process.env);
  if (secretName) {
    env.USE_SECRET_MANAGER = '1';
    env.SECRET_NAME = secretName;
  } else if (process.env.CLEANER_KEY_PATH) {
    env.GOOGLE_APPLICATION_CREDENTIALS = process.env.CLEANER_KEY_PATH;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // already set
  } else {
    // fallback to the common temp path used by the setup script
    env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/stonedoku-e2e-cleaner-key.json';
  }

  console.log('Running e2e teardown (global) with env:', !!env.SECRET_NAME ? 'SECRET_MANAGER' : env.GOOGLE_APPLICATION_CREDENTIALS);
  const res = spawnSync('node', [path.join(__dirname, '..', '..', 'scripts', 'teardown-e2e.js')], { env, stdio: 'inherit' });
  if (res.error) {
    console.error('Failed to run teardown-e2e.js:', res.error);
    throw res.error;
  }
  if (res.status !== 0) {
    console.error('teardown-e2e.js exited with code', res.status);
    throw new Error(`teardown-e2e.js exited with code ${res.status}`);
  }
};
