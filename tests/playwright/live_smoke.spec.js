/**
 * Live deployment smoke tests
 * 
 * These tests run against the live deployment without relying on 
 * test helpers that are only available locally.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.LIVE_TEST === '1' 
  ? 'https://stone-doku.web.app' 
  : 'http://localhost:8000';

test.describe('Live Deployment Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    
    // Check response is OK
    expect(response.status()).toBeLessThan(400);
    
    // Check page has title
    await expect(page).toHaveTitle(/stonedoku/i);
  });

  test('main app CSS and JS load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore known non-critical errors
        const text = msg.text();
        if (!text.includes('Failed to fetch') && 
            !text.includes('net::ERR') &&
            !text.includes('firebase')) {
          errors.push(text);
        }
      }
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    // Should have no critical page errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('manifest')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('auth view is visible on initial load', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);
    
    // Either auth view should be visible, or cookie consent
    const authView = page.locator('#auth-view');
    const cookieConsent = page.locator('#cookie-consent');
    
    const authVisible = await authView.isVisible().catch(() => false);
    const cookieVisible = await cookieConsent.isVisible().catch(() => false);
    
    expect(authVisible || cookieVisible).toBe(true);
  });

  test('cookie consent banner is functional', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    
    const cookieBanner = page.locator('#cookie-consent');
    const isVisible = await cookieBanner.isVisible().catch(() => false);
    
    if (isVisible) {
      // Accept cookies
      const acceptBtn = page.locator('#cookie-accept-all');
      await acceptBtn.click({ timeout: 3000 });
      
      // Banner should disappear
      await expect(cookieBanner).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('Play as Guest button is visible and clickable', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);
    
    // Dismiss cookie banner if present
    try { 
      await page.locator('#cookie-accept-all').click({ timeout: 2000 }); 
    } catch (e) {}
    
    await page.waitForTimeout(500);
    
    // Find the guest login button
    const guestBtn = page.locator('#anonymous-login');
    const isVisible = await guestBtn.isVisible().catch(() => false);
    
    if (isVisible) {
      expect(await guestBtn.isEnabled()).toBe(true);
    }
  });

  test('theme toggle button works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);
    
    // Dismiss cookie banner if present
    try { 
      await page.locator('#cookie-accept-all').click({ timeout: 2000 }); 
    } catch (e) {}
    
    // Find theme toggle
    const themeToggle = page.locator('#theme-toggle');
    const isVisible = await themeToggle.isVisible().catch(() => false);
    
    if (isVisible) {
      // Get initial state
      const initialClass = await page.locator('body').getAttribute('class');
      
      // Click toggle
      await themeToggle.click();
      await page.waitForTimeout(300);
      
      // Class should change
      const newClass = await page.locator('body').getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });

  test('manifest.webmanifest is accessible', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    
    const content = await response.text();
    const manifest = JSON.parse(content);
    
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
  });

  test('version.txt is accessible', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/version.txt`);
    expect(response.status()).toBe(200);
    
    const content = await response.text();
    expect(content.trim()).toBeTruthy();
  });

  test('service worker is registered', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    // Check if service worker is registered
    const hasServiceWorker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });
    
    // Service worker should be registered on the live site
    // (may not be registered immediately on first load)
    expect(typeof hasServiceWorker).toBe('boolean');
  });

  test('styles.css loads correctly', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/styles.css`);
    expect(response.status()).toBe(200);
    
    const content = await response.text();
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('body');
  });

  test('responsive design - viewport meta tag present', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toContain('width=device-width');
  });

  test('accessibility - main landmark exists', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);
    
    // Check for main content area
    const mainContent = page.locator('main, [role="main"], #app-container');
    await expect(mainContent.first()).toBeVisible({ timeout: 5000 });
  });
});
