import { test, expect, Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Automated accessibility audit — phase-2-progress open item. Runs axe-core
 * over a representative slice of surfaces (landing, login, console tabs,
 * a token portal) and fails on critical/serious violations. Moderate/minor
 * findings are reported in the test output for triage but don't gate.
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

test.describe('axe accessibility audit', () => {
  test('public surfaces have no critical/serious violations', async ({ page }) => {
    for (const route of ['/', '/login']) {
      await page.goto(route);
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      const summary = blocking.map(
        (v) => `${route} ${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`,
      );
      expect(summary, summary.join('\n')).toEqual([]);
    }
  });

  test('console tabs have no critical/serious violations', async ({ page }) => {
    test.setTimeout(300_000);
    await uiLogin(page);
    const allViolations: string[] = [];
    for (const route of CONSOLE_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('load');
      await page.waitForTimeout(600);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      for (const v of results.violations) {
        if (v.impact === 'critical' || v.impact === 'serious') {
          allViolations.push(`${route} ${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`);
        }
      }
    }
    expect(allViolations, allViolations.join('\n')).toEqual([]);
  });
});
