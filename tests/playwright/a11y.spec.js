import { test, expect } from '@playwright/test';

const pagesToCheck = [
  '/',
  '/index.html',
  '/test-1v1.html',
  '/tests/playwright/e2e-runner.html'
];

test.describe('Accessibility (axe-core) checks', () => {
  for (const p of pagesToCheck) {
    test(`a11y: ${p}`, async ({ page }) => {
      const url = `http://127.0.0.1:8000${p}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      // inject axe-core from CDN
      await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.6.3/axe.min.js' });

      // Run axe with WCAG2A and WCAG2AA rules
      const results = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        return await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa']
          }
        });
      });

      const violations = results.violations || [];
      if (violations.length > 0) {
        console.log('Accessibility violations for', url);
        for (const v of violations) {
          console.log(`- ${v.id} (${v.impact}): ${v.description}`);
          for (const node of v.nodes) {
            console.log(`  Target: ${node.target.join(', ')}; HTML: ${node.html.slice(0,200).replace(/\n/g,'')}`);
          }
        }
      }

      // Expect no violations (will fail the test if issues found)
      expect(violations.length, `Accessibility issues detected on ${url}`).toBeLessThan(1);
    });
  }
});
