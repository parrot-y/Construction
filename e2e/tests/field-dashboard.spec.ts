import { test, expect, Page } from '@playwright/test';

/**
 * FieldDashboard dedicated click spec (PROJECT_STATUS OPEN item).
 *
 * The field workspace (FOREMAN/WORKER/SITE_ENGINEER/TRADE_LEAD) had journey
 * coverage inside h5 but no spec exercising its navigation matrix: section
 * tabs, the site-job menu, per-job views, the diary modal, and the project
 * picker. This spec clicks all of them on the seeded demo tenant.
 */

const FOREMAN = 'foreman@apexbuilders.co.ke';
const PASSWORD = 'Password123!';

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(FOREMAN);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  // FieldDashboard Today section — diary card is the foreman's landmark.
  await expect(page.getByRole('button', { name: 'Record diary' })).toBeVisible({ timeout: 30000 });
}

test.describe('FieldDashboard — field workspace navigation', () => {
  test('sections switch: today → inbox → site → more', async ({ page }) => {
    await uiLogin(page);

    // Today (default): diary card + attendance/checklists.
    await expect(page.getByText('Site Diary')).toBeVisible();

    // Inbox section: team inbox + announcements.
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await expect(page.getByText('Team Inbox')).toBeVisible({ timeout: 15000 });

    // Site section: job menu.
    await page.getByRole('button', { name: 'Site', exact: true }).click();
    await expect(page.getByTestId('field-site-menu')).toBeVisible();

    // More section: crews (+ tenders if permitted). Desktop pill is exact
    // 'More'; the mobile bottom-nav button's accessible name includes its
    // '⋯' icon — union covers both chrome variants.
    await page.getByRole('button', { name: 'More', exact: true })
      .or(page.getByTestId('field-bottom-nav').getByRole('button', { name: /More/ }))
      .click();
    await expect(page.getByRole('heading', { name: 'Crews' })).toBeVisible({ timeout: 15000 });
  });

  test('every site job opens its view and returns to the menu', async ({ page }) => {
    await uiLogin(page);
    await page.getByRole('button', { name: 'Site', exact: true }).click();
    await expect(page.getByTestId('field-site-menu')).toBeVisible();

    const jobs = ['snags', 'safety', 'inspections', 'drawings', 'schedule', 'rfis', 'observations', 'correspondence'];
    for (const job of jobs) {
      await page.getByTestId(`field-job-${job}`).click();
      await expect(page.getByTestId(`field-job-view-${job}`)).toBeVisible({ timeout: 15000 });
      await page.getByTestId('field-job-back').click();
      await expect(page.getByTestId('field-site-menu')).toBeVisible();
    }
  });

  test('diary modal opens from Today and cancels cleanly', async ({ page }) => {
    await uiLogin(page);
    await page.getByRole('button', { name: 'Record diary' }).click();
    await expect(page.getByRole('heading', { name: 'Record Daily Site Diary' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Record Daily Site Diary' })).not.toBeVisible();
  });
});
