const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  globalTeardown: require.resolve('./global-teardown.js'),
  use: { headless: true }
});
