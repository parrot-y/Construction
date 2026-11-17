import { test, expect, Page } from '@playwright/test';

/**
 * A8 — permission UX: the admin console must never present a control that
 * the API answers with 403. This spec walks every admin sidebar section
 * and tab on the seeded tenant and fails on ANY 403 API response — a 403
 * means either a visible control the role can't use (must be hidden or
 * disabled with a reason) or a hidden-by-flag tab reachable by URL.
 */

const ADMIN_TABS: Record<string, string[]> = {
  '/app': [],
  '/app/projects/all': [],
  '/app/projects/schedule': [],
  '/app/projects/drawings': [],
  '/app/projects/changeorders': [],
  '/app/projects/coordination': [],
  '/app/projects/correspondence': [],
  '/app/site/fieldview': [],
  '/app/site/dailylog': [],
  '/app/site/checklists': [],
  '/app/site/assignments': [],
  '/app/site/punch': [],
  '/app/site/inspections': [],
  '/app/site/observations': [],
  '/app/site/actionplans': [],
  '/app/site/safety': [],
  '/app/site/attendance': [],
  '/app/money/financials': [],
  '/app/money/commitments': [],
  '/app/money/procurement': [],
  '/app/money/quotes': [],
  '/app/money/invoices': [],
  '/app/money/inventory': [],
  '/app/money/certificates': [],
  '/app/money/subvaluations': [],
  '/app/money/billing': [],
  '/app/people/team': [],
  '/app/people/crews': [],
  '/app/people/subcontractors': [],
  '/app/people/directory': [],
  '/app/people/roles': [],
  '/app/files/reports': [],
  '/app/files/companydocs': [],
  '/app/files/unfiled': [],
};

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill('admin@apexbuilders.co.ke');
  await page.locator('#password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('A8 — no visible control may return 403', () => {
  test('admin walks every sidebar tab: zero 403 API responses', async ({ page }) => {
    test.setTimeout(300_000);
    const forbidden: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 403 && res.url().includes('/api/')) {
        forbidden.push(`${res.request().method()} ${res.url()}`);
      }
    });
    await uiLogin(page);
    for (const url of Object.keys(ADMIN_TABS)) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Let the section's data fetches settle.
      await page.waitForTimeout(1_200);
    }
    expect(forbidden, `403 responses seen by admin:\n${forbidden.join('\n')}`).toEqual([]);
  });
});
