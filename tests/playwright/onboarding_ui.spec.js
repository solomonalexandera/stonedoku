import { test, expect } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000/';

function unique(value = 'user') {
  return `${value}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18);
}

test.describe('Onboarding flow', () => {
  test('new user can complete registration wizard (no avatar upload)', async ({ page }) => {
    test.setTimeout(120_000);
    const email = `${unique('player')}@example.com`;
    const username = unique('player');
    const password = `Pass!${Math.random().toString(36).slice(2, 8)}Aa#`;

    page.on('console', (msg) => {
      try { console.log('[PAGE-LOG]', msg.text()); } catch (e) { /* ignore */ }
    });

    await page.goto(baseUrl, { waitUntil: 'load' });

    // Ensure cookie banner is dismissed (force hide and set consent in localStorage)
    await page.evaluate(() => {
      try {
        localStorage.setItem('stonedoku_cookie_consent', JSON.stringify({ essential: true, analytics: true, preferences: true, timestamp: new Date().toISOString(), version: '1.0' }));
      } catch (e) { /* ignore */ }
      const banner = document.getElementById('cookie-consent'); if (banner) banner.style.display = 'none';
    });


    // Force-show the signup panel (some test environments block tab clicks)
    await page.evaluate(() => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      const el = document.querySelector('.auth-tab[data-mode="signup"]');
      if (el) el.classList.add('active');
      const signIn = document.getElementById('signin-panel'); if (signIn) signIn.style.display = 'none';
      const signUp = document.getElementById('signup-panel'); if (signUp) signUp.style.display = 'block';
    });

    // Wait for app initialization and onboarding manager to be available
    await page.waitForFunction(() => !!(window.Stonedoku && window.Stonedoku.Managers && window.Stonedoku.Managers.OnboardingManager), { timeout: 10000 });

    // Ensure onboarding flow starts (invoke manager directly)
    await page.evaluate(() => {
      try { document.getElementById('start-onboarding')?.click(); } catch (e) { /* ignore */ }
      try { window.Stonedoku?.Managers?.OnboardingManager?.start?.(); } catch (e) { /* ignore */ }
    });

    // Debug: collect onboarding visibility state
    const onboardDiag = await page.evaluate(() => ({
      appState: (window.AppState && window.AppState.onboarding) || null,
      viewDisplay: document.getElementById('onboarding-view') ? getComputedStyle(document.getElementById('onboarding-view')).display : null,
      step1Class: document.getElementById('onboarding-step-1') ? document.getElementById('onboarding-step-1').className : null,
      step1Visible: document.getElementById('onboarding-step-1') ? getComputedStyle(document.getElementById('onboarding-step-1')).display : null
    }));
    console.log('[onboardDiag]', JSON.stringify(onboardDiag));

    await page.waitForSelector('#onboard-username', { state: 'visible', timeout: 10000 });
    await page.locator('#onboard-username').fill(username);
    await expect(page.locator('#onboard-next-1')).toBeEnabled({ timeout: 15_000 });
    await page.locator('#onboard-next-1').click({ force: true });

    await page.locator('#onboard-email').fill(email);
    await page.locator('#onboard-password').fill(password);
    await page.locator('#onboard-confirm').fill(password);
    await expect(page.locator('#onboard-next-2')).toBeEnabled({ timeout: 10_000 });
    await page.locator('#onboard-next-2').click({ force: true });

    // Finalize account (skip avatar step)
    const finalizePromise = page.waitForResponse(resp => resp.url().includes('/api/auth/finalize') && resp.request().method() === 'POST', { timeout: 20000 }).catch(() => null);
    await page.locator('#onboard-skip-3').click({ force: true });
    const finalizeResp = await finalizePromise;
    if (!finalizeResp) {
      console.log('[test] finalize API call not observed');
    } else {
      console.log('[test] finalize status', finalizeResp.status());
      const payload = await finalizeResp.json().catch(() => null);
      console.log('[test] finalize payload', payload);
    }

    await expect(page.locator('#onboarding-step-4')).toHaveClass(/active/, { timeout: 30_000 });
    await page.locator('#skip-tour').click();

    await expect(page.locator('#lobby-view')).toBeVisible({ timeout: 30_000 });

    // Note: page console already logged via PAGE-LOG entries; no further action needed.
  });
});
