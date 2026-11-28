import { test, expect, type Page } from '@playwright/test';
import { login, firstProjectId } from './helpers';

/** C1 — console URLs: section/tab deep links, back/forward, project links. */

async function uiLogin(page: Page, email: string, password = 'Password123!') {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) await signIn.click();
  else await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

test('console section/tab URLs, reload persistence, back button', async ({ page, request }) => {
  await uiLogin(page, 'admin@apexbuilders.co.ke');

  // Console migrates to /app/* once mounted.
  await expect(page).toHaveURL(/\/app/, { timeout: 15000 });

  // Navigate to Money → URL reflects section.
  await page.getByRole('button', { name: 'Money', exact: true }).first().dispatchEvent('click');
  await expect(page).toHaveURL(/\/app\/money/, { timeout: 10000 });

  // Pick a tab → URL gains the tab segment.
  const invoicesTab = page.getByRole('tab', { name: 'Invoices', exact: true }).first();
  await invoicesTab.dispatchEvent('click');
  await expect(page).toHaveURL(/\/app\/money\/invoices/, { timeout: 10000 });
  await expect(invoicesTab).toHaveAttribute('aria-selected', 'true');

  // Reload → deep link restores the same screen.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/\/app\/money\/invoices/);
  await expect(page.getByRole('tab', { name: 'Invoices', exact: true }).first()).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });

  // Back → previous console location.
  await page.goBack();
  await expect(page).not.toHaveURL(/invoices/);
});

test('/projects/:id deep link selects the project', async ({ page, request }) => {
  const admin = await login(request, 'admin@apexbuilders.co.ke');
  const pid = await firstProjectId(request, admin);

  await uiLogin(page, 'admin@apexbuilders.co.ke');
  await page.goto(`/projects/${pid}`);
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30000 });
  // Canonical console URL carries the project selection.
  await expect(page).toHaveURL(new RegExp(`project=${pid}`), { timeout: 15000 });
});
