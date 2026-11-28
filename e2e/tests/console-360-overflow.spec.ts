import { test, expect, Page } from '@playwright/test';

/**
 * 360px console overflow gate — phase-2-progress open item: console pages
 * were verified at 390px (i3) but never at 360px, the narrowest common
 * Android width. Logs in as the seeded company admin, forces a 360px
 * viewport, and walks every console section tab asserting
 * scrollWidth <= innerWidth.
 */

const ADMIN = 'admin@apexbuilders.co.ke';
const PASSWORD = 'Password123!';

// Mirrors l2-click-sweep CONSOLE_TABS (admin role sees all sections).
const CONSOLE_TABS: Record<string, string[]> = {
  home: [],
  projects: ['all', 'schedule', 'drawings', 'changeorders', 'coordination', 'correspondence'],
  site: ['fieldview', 'map', 'dailylog', 'checklists', 'assignments', 'punch', 'inspections', 'observations', 'actionplans', 'safety', 'attendance'],
  money: ['financials', 'commitments', 'procurement', 'quotes', 'invoices', 'inventory', 'requisitions', 'rates', 'gatepass', 'certificates', 'subvaluations', 'billing'],
  people: ['team', 'crews', 'subcontractors', 'directory', 'roles'],
  files: ['reports', 'companydocs', 'unfiled'],
};

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(ADMIN);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30000 });
}

async function expectNoXOverflow(page: Page, label: string) {
  // Lazy sections can briefly render wide skeletons while data lands —
  // settle ~1.2s, then measure the final state.
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    bodyScrollW: document.body.scrollWidth,
  }));
  const widest = Math.max(m.scrollW, m.bodyScrollW);
  expect(
    widest,
    `${label}: horizontal overflow — content ${widest}px in a ${m.innerW}px viewport`,
  ).toBeLessThanOrEqual(m.innerW + 1);
}

test.describe('console 360px overflow sweep', () => {
  test('every console section tab fits a 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await uiLogin(page);

    const routes: { label: string; url: string }[] = [{ label: 'home', url: '/app' }];
    for (const [section, tabs] of Object.entries(CONSOLE_TABS)) {
      if (section === 'home') continue;
      for (const tab of tabs) routes.push({ label: `${section}/${tab}`, url: `/app/${section}/${tab}` });
    }

    const offenders: string[] = [];
    for (const r of routes) {
      await page.goto(r.url);
      // SSE/polling keeps the network busy — 'load' + a short settle is the
      // reliable signal that the tab chrome has rendered.
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(600);
      try {
        await expectNoXOverflow(page, r.label);
      } catch {
        offenders.push(r.label);
      }
    }
    expect(offenders, `360px horizontal overflow on: ${offenders.join(', ')}`).toEqual([]);
  });
});
