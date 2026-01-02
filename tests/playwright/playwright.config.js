import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use live deployment when LIVE_TEST=1 is set
const isLiveTest = process.env.LIVE_TEST === '1';
const baseURL = isLiveTest ? 'https://stone-doku.web.app' : 'http://localhost:8000';

export default defineConfig({
  testDir: '.',
  // Only run the global teardown when RUN_GLOBAL_TEARDOWN=1 is set.
  // This avoids teardown failures in local runs where service-account keys
  // are not available (CI enables teardown explicitly).
  globalTeardown: process.env.RUN_GLOBAL_TEARDOWN === '1' ? resolve(__dirname, './global-teardown.js') : undefined,
  use: { 
    headless: true,
    baseURL
  },
  // Skip local webServer when testing against live deployment
  ...(isLiveTest ? {} : {
    webServer: {
      command: 'PORT=8000 node scripts/dev.mjs',
      port: 8000,
      reuseExistingServer: true,
      timeout: 120_000
    }
  })
});
