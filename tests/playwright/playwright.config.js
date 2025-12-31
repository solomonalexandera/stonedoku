import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  testDir: '.',
  // Only run the global teardown when RUN_GLOBAL_TEARDOWN=1 is set.
  // This avoids teardown failures in local runs where service-account keys
  // are not available (CI enables teardown explicitly).
  globalTeardown: process.env.RUN_GLOBAL_TEARDOWN === '1' ? resolve(__dirname, './global-teardown.js') : undefined,
  use: { headless: true },
  webServer: {
    command: 'PORT=8000 node scripts/dev.mjs',
    port: 8000,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
