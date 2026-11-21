import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, Session, fixtureName } from './helpers';

/**
 * ROUND L1 — "New project" must actually create a project.
 *
 * The auditor found the console's orange button had no onClick at all;
 * 340 API-level tests never clicked it. This spec drives the real UI as
 * a company admin on a FRESH company (zero projects — the empty case is
 * the fixture) and asserts the new card appears without a reload.
 */

const RUN = Date.now();
const PASSWORD = 'L1Project#2026';
let admin: Session;

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@l1-project.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: 'L1 Projects Ltd', adminFullName: 'Njeri Kamau', email, phone: '+254712000555', password: PASSWORD },
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
  await page.locator('#email').fill(`admin.${RUN}@l1-project.test`);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const navBtn = page.getByRole('button', { name: 'Projects' }).first();
  // Rare infra flake: the e2e API occasionally answers a valid login with a
  // transient 401 under load. Retry the submit once before failing.
  const outcome = await Promise.race([
    navBtn.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'ok'),
    page.getByText('Invalid email or password').waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'err'),
  ]).catch(() => 'err');
  if (outcome === 'err') {
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await expect(navBtn).toBeVisible({ timeout: 30_000 });
  }
}

test.describe('L1 — New project from the console', () => {
  test('0. fixture: fresh company admin (empty project list)', async ({ request }) => {
    admin = await register(request);
    expect(admin.user.email).toContain('l1-project.test');
  });

  test('1. New project button opens the form and creates a selectable project', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/projects/all');

    // Empty state first — a brand-new company has no projects.
    await expect(page.getByText('No projects in this view')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    const officesName = fixtureName('project', `l1-a-${RUN}`);
    await dialog.getByLabel(/Project name/).fill(officesName);
    await dialog.getByLabel(/Project code/).fill(`L1-${String(RUN).slice(-6)}`);
    await dialog.getByLabel('Location').fill('Kileleshwa, Nairobi');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByLabel(/Contract value/).fill('12500000');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dialog.locator('button[type=\"submit\"]');
  await dialog.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }

    // The new card appears and is selected — no reload.
    const card = page.locator('button', { hasText: officesName }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toHaveClass(/border-orange-500/);
    await expect(page.getByText('No projects in this view')).toHaveCount(0);
  });

  test('2. creation failure shows an inline error, never silence', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/projects/all');
    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await expect(dialog).toBeVisible();

    // Duplicate code → API 409/400 → inline error must render.
    await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByLabel(/Project name/).fill(fixtureName('project', `l1-dup-${RUN}`));
    await dialog.getByLabel(/Project code/).fill(`L1-${String(RUN).slice(-6)}`);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dialog.locator('button[type=\"submit\"]');
  await dialog.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }
    await expect(dialog.getByText(/could not|failed|already|exist|invalid/i)).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toBeVisible(); // dialog stays open for retry
  });
});
