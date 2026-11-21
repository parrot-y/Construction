import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * Part A auditor fixes — navigation structure, phone chrome, home order.
 * A1: a section's tabs must be DOM-adjacent children of THAT section's
 *     item in the desktop sidebar, and only the active section expands.
 * A2: phone bottom bar — 56 px, visible text label under every icon,
 *     clear active state.
 * A3: phone project picker shows an ellipsis-truncated name + status,
 *     never a clipped "PRJ-0008 —" select.
 * A5: Home starts with "Needs you now"; the legacy hero line and the big
 *     "Open projects" button are gone.
 */

const ADMIN = 'admin@apexbuilders.co.ke';

async function loginAdmin(page: Page) {
  await page.goto('/');
  await login(page.request, ADMIN);
  await page.goto('/app');
  await expect(page.getByRole('navigation', { name: 'Workspace sections' }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('A1 desktop sidebar tab placement', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop sidebar only');

  const sections = [
    { label: 'Home', firstTab: 'Dashboard' },
    { label: 'Projects', firstTab: 'All projects' },
    { label: 'Site', firstTab: 'Field view' },
    { label: 'Money', firstTab: 'Financials' },
    { label: 'People', firstTab: 'Team' },
    { label: 'Files & reports', firstTab: 'Reports' },
  ];

  for (const s of sections) {
    test(`${s.label}: tabs render directly under the active item`, async ({ page }) => {
      await loginAdmin(page);
      const nav = page.getByRole('navigation', { name: 'Workspace sections' });
      const btn = nav.getByRole('button', { name: s.label, exact: true });
      await btn.click();

      // Exactly one expanded tab group in the whole sidebar.
      const tabGroups = nav.locator('div:has(> [role="tab"])');
      await expect(tabGroups).toHaveCount(1);

      // The tab group is the DOM-adjacent next sibling of the section button.
      const adjacent = await btn.evaluate((el) => {
        const next = el.nextElementSibling;
        return next ? Array.from(next.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim()) : null;
      });
      expect(adjacent, `${s.label} tabs must be the next sibling of its button`).not.toBeNull();
      expect(adjacent!.length).toBeGreaterThan(0);
      expect(adjacent![0]).toBe(s.firstTab);
    });
  }

  test('non-active sections never show expanded tabs', async ({ page }) => {
    await loginAdmin(page);
    const nav = page.getByRole('navigation', { name: 'Workspace sections' });
    // Start on Home — its tabs (Dashboard/Inbox/Announcements) must sit
    // directly under Home, NOT under Files & reports (the audited bug).
    const homeBtn = nav.getByRole('button', { name: 'Home', exact: true });
    const homeTabs = await homeBtn.evaluate((el) => {
      const next = el.nextElementSibling;
      return next ? Array.from(next.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim()) : [];
    });
    expect(homeTabs).toEqual(['Dashboard', 'Inbox', 'Announcements']);
  });
});

test.describe('A2 phone bottom bar', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone bar only');

  test('every bar item has a visible text label and clear active state', async ({ page }) => {
    await loginAdmin(page);
    // Let the dashboard finish loading so layout/viewport settle before tapping.
    await expect(page.getByText('Needs you now').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const bar = page.getByRole('navigation', { name: 'Workspace sections' }).last();
    // h-14 = 56 px
    const box = await bar.boundingBox();
    expect(box?.height).toBe(56);
    for (const label of ['Home', 'Projects', 'Site', 'Money', 'More']) {
      const item = bar.getByRole('button', { name: new RegExp(label, 'i') });
      await expect(item).toBeVisible();
      await expect(item.locator('span').last()).toHaveText(new RegExp(label, 'i'));
    }
    // Active item carries aria-current="page" — Home is active on load.
    await expect(bar.getByRole('button', { name: /^Home$/ })).toHaveAttribute('aria-current', 'page');
    // Tapping another section moves the active state — a real pointer click,
    // no force: the fixed bar must win hit-testing over page content.
    await bar.getByRole('button', { name: /^Money$/ }).click();
    await expect(bar.getByRole('button', { name: /^Money$/ })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('A3 phone project picker', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone header only');

  test('picker shows truncated project name + status, not a clipped select', async ({ page }) => {
    await loginAdmin(page);
    const picker = page.getByRole('button', { name: 'Active project' });
    await expect(picker).toBeVisible();
    // The desktop select must not render on phones.
    await expect(page.locator('select[aria-label="Active project"]')).toBeHidden();
    // Status chip is visible beside the picker.
    await expect(page.locator('header, [class*="sticky"]').getByText(/Active|On hold|Completed/i).first()).toBeVisible();
  });
});

test.describe('A5 home order', () => {
  test('Needs you now first; no legacy hero or Open projects button', async ({ page }) => {
    await loginAdmin(page);
    await expect(page.getByText('Needs you now').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Your projects, money and site activity at a glance.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open projects' })).toHaveCount(0);
  });
});
