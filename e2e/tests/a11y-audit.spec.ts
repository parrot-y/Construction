import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { API, login, apiPost, unwrap, firstProjectId, Session } from './helpers';

/**
 * Automated accessibility audit — phase-2-progress open item. Runs axe-core
 * (wcag2a/2aa/21a/21aa) over landing, login, console tabs and a live token
 * portal, gating on ANY violation — the audited surfaces are clean across
 * all impact levels, so the gate is deliberately strict.
 */

const ADMIN = 'admin@apexbuilders.co.ke';
const PASSWORD = 'Password123!';

const CONSOLE_ROUTES = [
  '/app',
  '/app/projects/all',
  '/app/site/dailylog',
  '/app/money/financials',
  '/app/money/gatepass',
  '/app/people/team',
  '/app/files/reports',
];

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

async function axeViolations(page: Page, url: string): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map(
    (v) => `${url} ${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`,
  );
}

test.describe('axe accessibility audit', () => {
  test('public surfaces have no violations', async ({ page }) => {
    const all: string[] = [];
    for (const route of ['/', '/login']) {
      await page.goto(route);
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
      all.push(...(await axeViolations(page, route)));
    }
    expect(all, all.join('\n')).toEqual([]);
  });

  test('console tabs have no violations', async ({ page }) => {
    test.setTimeout(300_000);
    await uiLogin(page);
    const allViolations: string[] = [];
    for (const route of CONSOLE_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('load');
      await page.waitForTimeout(600);
      allViolations.push(...(await axeViolations(page, route)));
    }
    expect(allViolations, allViolations.join('\n')).toEqual([]);
  });

  test('client portal has no violations', async ({ page, request }: { page: Page; request: APIRequestContext }) => {
    test.setTimeout(120_000);
    const session: Session = await login(request, ADMIN, PASSWORD);
    const pid = await firstProjectId(request, session);
    const link = await apiPost(request, session, `/api/v1/projects/${pid}/portals/links`, {
      portalType: 'CLIENT',
      stakeholderName: 'A11y Audit Client',
      expiresInDays: 1,
    });
    expect(link.status(), await link.text()).toBeLessThan(300);
    const token = unwrap(await link.json()).token as string;
    expect(token).toBeTruthy();

    await page.goto(`/?portal=client&token=${token}`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(800);
    const violations = await axeViolations(page, 'portal:client');
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
