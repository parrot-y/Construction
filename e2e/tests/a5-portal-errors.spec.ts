import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * A5 — external-link failure screens for all five portals.
 * States: dead link (real API 404), rate limited (429 stub), offline (aborted fetch).
 * Screenshots committed under docs/evidence/a5-portal-errors/.
 */

const PORTALS = ['consultant', 'subcontractor', 'supplier', 'compliance', 'client'] as const;
const SHOTS = path.resolve(__dirname, '../../docs/evidence/a5-portal-errors');
const DEAD = 'a5-dead-token-0000000000000000000000000000';

test.describe('A5 portal failure screens', () => {
  for (const portal of PORTALS) {
    test(`${portal}: dead link shows plain-language expired state`, async ({ page }, testInfo) => {
      const vp = testInfo.project.name;
      await page.goto(`/?portal=${portal}&token=${DEAD}`);
      await expect(page.getByText('This link has expired or been switched off')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Ask the project team to send you a new link.')).toBeVisible();
      await expect(page.getByRole('button', { name: /back/i })).toHaveCount(0);
      await page.screenshot({ path: `${SHOTS}/${portal}-link-${vp}.png`, fullPage: true });
    });

    test(`${portal}: 429 shows wait-and-retry state`, async ({ page }, testInfo) => {
      const vp = testInfo.project.name;
      await page.route('**/api/v1/portals/**', (route) =>
        route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ message: 'Too many requests' }) }),
      );
      await page.goto(`/?portal=${portal}&token=${DEAD}`);
      await expect(page.getByText('Too many attempts')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Wait a minute and try again.')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/${portal}-rate-limited-${vp}.png`, fullPage: true });
    });

    test(`${portal}: network failure shows offline state with Retry`, async ({ page }, testInfo) => {
      const vp = testInfo.project.name;
      await page.route('**/api/v1/portals/**', (route) => route.abort());
      await page.goto(`/?portal=${portal}&token=${DEAD}`);
      await expect(page.getByText("Can't reach SiteSafi")).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/${portal}-offline-${vp}.png`, fullPage: true });
    });
  }
});
