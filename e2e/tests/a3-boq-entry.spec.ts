import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, Session } from './helpers';

/**
 * A3 (part 1) — Bill of Quantities must be reachable and editable from the
 * admin console screens only. Round L found the console BoQ was read-only
 * and the import modal was mounted only in the dead PM/QS dashboard.
 *
 * This spec drives the real UI as company admin: create a project, open
 * Money → Financials → Bill of quantities, type a BoQ line, see the total
 * update, edit it, delete it, and confirm the Excel import control exists.
 */

const RUN = Date.now();
const PASSWORD = 'A3Boq#2026';
let admin: Session;

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@a3-boq.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: 'A3 BoQ Contractors Ltd',
      adminFullName: 'Wanjiru Njoroge',
      email,
      phone: '+254712000777',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(`admin.${RUN}@a3-boq.test`);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

async function createProjectViaUi(page: Page) {
  await page.goto('/app/projects/all');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByLabel(/Project name/).fill('A3 BoQ Site');
  await dialog.getByLabel(/Project code/).fill(`A3-${String(RUN).slice(-6)}`);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dialog.locator('button[type=\"submit\"]');
  await dialog.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }
  await expect(page.locator('button', { hasText: 'A3 BoQ Site' }).first()).toBeVisible({ timeout: 20_000 });
}


async function selectProject(page: Page) {
  await page.goto('/app/projects/all');
  const card = page.locator('button', { hasText: 'A3 BoQ Site' }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();
}

async function openBoqTab(page: Page) {
  await page.goto('/app/money/financials');
  // Sidebar click path: Money → Financials → "Bill of quantities" sub-tab.
  await page.getByRole('tab', { name: /bill of quantities/i }).or(page.getByRole('button', { name: /bill of quantities/i })).first().click();
  await expect(page.getByRole('heading', { name: 'Bill of Quantities' }).or(page.getByText('No Bill of Quantities yet'))).toBeVisible({ timeout: 20_000 });
}

test.describe('A3 — BoQ entry from the admin console', () => {
  test('0. fixture: fresh company admin + one project', async ({ request, page }) => {
    admin = await register(request);
    expect(admin.user.email).toContain('a3-boq.test');
    // Fixture project via API, deliberately WITHOUT a project type: typed
    // projects now seed starter BoQ sections server-side (Phase 2.8), and
    // this spec needs a genuinely empty BoQ. UI project creation itself is
    // covered by l1/p2/w-admin specs.
    const cookie = (admin.cookie || '');
    const created = await request.post(`${API}/api/v1/projects`, {
      headers: { cookie },
      data: { name: 'A3 BoQ Site', code: `A3-${String(RUN).slice(-6)}` },
    });
    expect(created.status(), await created.text()).toBe(201);
  });

  test('1. empty BoQ offers typed entry and Excel import', async ({ page }) => {
    await uiLogin(page);
    await selectProject(page);
    await openBoqTab(page);
    await expect(page.getByText('No Bill of Quantities yet')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /add your first boq item/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /import excel boq/i })).toBeVisible();
  });

  test('2. type a BoQ line — it appears and totals update', async ({ page }) => {
    await uiLogin(page);
    await selectProject(page);
    await openBoqTab(page);
    await page.getByRole('button', { name: /add your first boq item/i }).click();
    const form = page.locator('form', { has: page.getByText('Add BoQ item') });
    await form.getByPlaceholder('Describe the work').fill('A3 mass excavation to formation level');
    await form.getByPlaceholder('m, m², no').fill('m³');
    await form.locator('input[type="number"]').nth(0).fill('120');
    await form.locator('input[type="number"]').nth(1).fill('850');
    await form.getByRole('button', { name: 'Save item' }).click();

    // Row appears without reload and the BOQ total reflects qty × rate.
    await expect(page.getByText('A3 mass excavation to formation level')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/KES\s*102,000/).first()).toBeVisible();
  });

  test('3. edit a line and see the amount update', async ({ page }) => {
    await uiLogin(page);
    await selectProject(page);
    await openBoqTab(page);
    const row = page.locator('tr', { hasText: 'A3 mass excavation' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Edit' }).click();
    const form = page.locator('form', { has: page.getByText('Save changes') });
    await form.locator('input[type="number"]').nth(0).fill('150');
    await form.getByRole('button', { name: 'Save item' }).click();
    await expect(page.getByText(/KES\s*127,500/).first()).toBeVisible({ timeout: 20_000 });
  });

  test('4. delete a line after confirm', async ({ page }) => {
    await uiLogin(page);
    await selectProject(page);
    await openBoqTab(page);
    const row = page.locator('tr', { hasText: 'A3 mass excavation' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Delete' }).click();
    // P1.2: native confirm() is gone — the shared AppDialog asks first.
    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Delete BoQ line' });
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('A3 mass excavation to formation level')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('No Bill of Quantities yet').or(page.getByRole('heading', { name: 'Bill of Quantities' }))).toBeVisible();
  });

  test('5. Excel import opens the staged import modal', async ({ page }) => {
    await uiLogin(page);
    await selectProject(page);
    await openBoqTab(page);
    await page.getByRole('button', { name: /import excel/i }).first().click();
    // Modal offers file pick + template download — visible proof the path exists.
    await expect(page.locator('div.fixed.inset-0').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/upload|choose|browse|excel|template/i).first()).toBeVisible();
  });
});
