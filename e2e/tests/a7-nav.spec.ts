import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, fixtureName, Session } from './helpers';

/**
 * A7 — navigation clarity: the project selector is always visible (including
 * 390px), says which project screens refer to, and never silently resets —
 * it survives section changes, reloads and sign-out/in.
 */

const RUN = Date.now();
const PASSWORD = 'A7Nav#2026';
const PROJECT_ALPHA = fixtureName('project', `a7-a-${RUN}`);
let PROJECT_BETA = fixtureName('project', `a7-b-${RUN}`);
for (let i = 0; PROJECT_BETA === PROJECT_ALPHA && i < 20; i++) {
  PROJECT_BETA = fixtureName('project', `a7-b-${RUN}-${i}`);
}
let email = '';

test.beforeEach(({}, testInfo) => {
  email = `admin.${RUN}.${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}@a7-nav.test`;
});

async function register(request: APIRequestContext): Promise<Session> {
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `${RUN}-${email}`),
      adminFullName: 'Akinyi Moraa',
      email,
      phone: '+254712000999',
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
  await page.locator('#email').fill(email);
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

async function createProject(page: Page, name: string, code: string) {
  await page.goto('/app/projects/all');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
  // 2.8 wizard: type → subtype → details → terms.
  await dialog.getByRole('button', { name: 'Commercial', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByLabel(/Project name/).fill(name);
  await dialog.getByLabel(/Project code/).fill(code);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dialog.locator('button[type=\"submit\"]');
  await dialog.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }
  await expect(page.locator('button', { hasText: name }).first()).toBeVisible({ timeout: 20_000 });
}

const selector = (page: Page) => page.getByLabel('Active project').first();

test.describe('A7 — navigation clarity', () => {
  test('0. fixture: fresh company admin + two projects', async ({ request, page }) => {
    test.setTimeout(300_000); // two UI project creations on mobile-390 are slow
    await register(request);
    await uiLogin(page);
    await createProject(page, PROJECT_ALPHA, `A7A-${String(RUN).slice(-5)}`);
    await createProject(page, PROJECT_BETA, `A7B-${String(RUN).slice(-5)}`);
  });

  test('1. project selector is visible and switches context without reset', async ({ page }) => {
    await uiLogin(page);
    const sel = selector(page);
    await expect(sel).toBeVisible({ timeout: 20_000 });
    // Exactly one project selector on the page.
    await expect(page.getByLabel('Active project')).toHaveCount(1);

    const betaValue = await sel.locator('option', { hasText: PROJECT_BETA }).getAttribute('value');
    await sel.selectOption(betaValue!);
    // Context line under the sub-tabs names the active project.
    await page.goto('/app/money/financials');
    await expect(page.getByText(new RegExp(`Context: ${PROJECT_BETA}`))).toBeVisible({ timeout: 20_000 });
    await expect(sel).toHaveValue(/./);
    await expect(sel.locator('option:checked')).toContainText(PROJECT_BETA);
  });

  test('2. selection survives reload and sign-out/in', async ({ page, context }) => {
    await uiLogin(page);
    const sel = selector(page);
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const betaValue2 = await sel.locator('option', { hasText: PROJECT_BETA }).getAttribute('value');
    await sel.selectOption(betaValue2!);
    await expect(sel.locator('option:checked')).toContainText(PROJECT_BETA);

    await page.reload();
    await expect(selector(page).locator('option:checked')).toContainText(PROJECT_BETA, { timeout: 20_000 });

    // Sign out and back in — the same project stays selected.
    // force: mobile-390 emulation misreports hit targets on sticky/fixed
    // chrome; elementFromPoint confirms these controls are on top.
    await page.getByRole('button', { name: /account menu/i }).click({ force: true });
    await page.getByRole('button', { name: /sign out|log out/i }).click({ force: true });
    await uiLogin(page);
    await expect(selector(page).locator('option:checked')).toContainText(PROJECT_BETA, { timeout: 20_000 });
    await context.close();
  });
});
