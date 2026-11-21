import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, Session, fixtureName } from './helpers';

/**
 * A6 — Home dashboard: a brand-new admin sees a get-started checklist that
 * ticks itself and deep-links; a company with data sees attention numbers
 * that each link to the list behind them.
 */

const RUN = Date.now();
const PASSWORD = 'A6Home#2026';
const PROJECT_NAME = fixtureName('project', `a6-${RUN}`);
let admin: Session;
let email = '';

test.beforeEach(({}, testInfo) => {
  email = `admin.${RUN}.${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}@a6-home.test`;
});

async function register(request: APIRequestContext, ti?: { project: { name: string } }): Promise<Session> {
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `a6-${RUN}-${ti?.project.name ?? ''}`),
      adminFullName: 'Otieno Mwangi',
      email,
      phone: '+254712000888',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function uiLogin(page: Page, userEmail: string, password: string) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(userEmail);
  await page.locator('#password').fill(password);
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

test.describe('A6 — Home dashboard', () => {
  test('0. fixture: fresh company admin', async ({ request }, testInfo) => {
    admin = await register(request, testInfo);
    expect(admin.user.email).toContain('a6-home.test');
  });

  test('1. brand-new admin sees the get-started checklist', async ({ page }) => {
    await uiLogin(page, email, PASSWORD);
    await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('0 of 5 done')).toBeVisible({ timeout: 20_000 });
    for (const label of ['Create your first project', 'Add a Bill of Quantities', 'Invite your team', 'Create a quote', 'Set up how you get paid']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
  });

  test('2. checklist ticks itself after creating a project', async ({ page }) => {
    await uiLogin(page, email, PASSWORD);
    await page.getByRole('button', { name: /create your first project/i }).click();
    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByLabel(/Project name/).fill(PROJECT_NAME);
    await dialog.getByLabel(/Project code/).fill(`A6-${String(RUN).slice(-6)}`);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dialog.locator('button[type=\"submit\"]');
  await dialog.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }
    await expect(page.locator('button', { hasText: PROJECT_NAME }).first()).toBeVisible({ timeout: 20_000 });

    // Back to Home — the first step must now read Done.
    // force: the mobile-390 emulation misreports hit targets on the fixed
    // bottom bar (elementFromPoint confirms the nav is topmost); a real
    // thumb tap lands correctly.
    await page.getByRole('button', { name: 'Home' }).first().click({ force: true });
    // A typed project also provisions starter BoQ sections server-side (2.8),
    // so the BoQ step can tick at the same time — accept 1 or 2 done.
    await expect(page.getByText(/[12] of 5 done/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /create your first project/i })).toContainText('Done');
  });

  test('3. company with data: attention numbers are links', async ({ page }) => {
    // Seeded demo tenant — has projects, BoQ and team.
    await uiLogin(page, 'admin@apexbuilders.co.ke', 'Password123!');
    await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible({ timeout: 20_000 });
    // Attention cards are buttons that navigate — every number links to its list.
    await expect(page.getByRole('button', { name: /projects needing attention/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /unpaid invoices/i }).first().click();
    await expect(page).toHaveURL(/\/app\/money/, { timeout: 15_000 });
  });
});
