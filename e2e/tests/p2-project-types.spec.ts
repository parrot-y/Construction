import { test, expect, Page, APIRequestContext, TestInfo } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { fixtureName } from './helpers';

const EVIDENCE_DIR = process.env.E2E_EVIDENCE_DIR || '';
async function shot(page: Page, ti: TestInfo, name: string) {
  if (!EVIDENCE_DIR || ti.project.name !== 'mobile-390') return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`), fullPage: false });
}

/**
 * Phase 2.8 — project types end-to-end through the UI.
 * One project of every configured type is created via the four-step wizard
 * (type cards → subtype → details → terms). Also proves: type badge on the
 * card, type filter, subtype selection, NCA hint from the editable rules
 * table, and that a legacy untyped project still loads.
 */

const API = process.env.E2E_API_URL || 'http://localhost:4199';
const PASSWORD = 'PTypes#2026';
const RUN = Date.now();
let email = '';

const TYPES: { type: string; subtype?: string }[] = [
  { type: 'Residential', subtype: 'Single home / bungalow' },
  { type: 'Commercial', subtype: 'Offices' },
  { type: 'Industrial', subtype: 'Warehouse' },
  { type: 'Institutional and public', subtype: 'School / college' },
  { type: 'Civil and infrastructure', subtype: 'Roads and earthworks' },
  { type: 'Specialist', subtype: 'Solar / energy' },
  { type: 'Renovation and fit-out', subtype: 'Fit-out / refurbishment' },
  { type: 'Other' },
];

test.beforeEach(({}, ti) => {
  email = `admin.${RUN}.${ti.project.name.replace(/[^a-z0-9]/gi, '')}@ptypes.test`;
});

async function register(request: APIRequestContext) {
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `${RUN}-${email}`),
      adminFullName: 'Achieng Admin',
      email,
      phone: `+2547${String(RUN).slice(-8)}`,
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
}

async function uiLogin(page: Page, request: APIRequestContext) {
  const res = await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.status(), 'login').toBe(200);
  const setCookie = res.headers()['set-cookie'] || '';
  const pairs = setCookie.split(/,(?=[^;]+=)/).map((c) => {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: 'localhost', path: '/' };
  });
  await page.context().addCookies(pairs);
  await page.goto('/app');
  await expect(page.locator('nav[aria-label="Workspace sections"]:visible').first()).toBeVisible({ timeout: 60_000 });
}

async function createTypedProject(page: Page, name: string, code: string, type: string, subtype?: string, contractValue?: string, alreadyThere = false) {
  // Vite dev serves unbundled modules — a full page load costs minutes on a
  // loaded box. Only navigate once; later iterations reopen the modal in place.
  if (!alreadyThere) await page.goto('/app/projects/all');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
  await expect(dialog).toBeVisible();
  // Step 1 — type card + subtype chips (same step)
  await dialog.getByRole('button', { name: type, exact: true }).click();
  if (subtype) {
    await dialog.getByRole('button', { name: subtype, exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Continue' }).click();
  // Step 2 — basics
  await dialog.getByLabel(/Project name/).fill(name);
  await dialog.getByLabel(/Project code/).fill(code);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  // Step 3 — commercial
  if (contractValue) await dialog.getByLabel(/Contract value/).fill(contractValue);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  // Step 4 — team → create
  // Footer primary swaps Continue→submit at the same spot; a fast click can
  // submit early — click submit only if the modal is still open.
  const npSubmit = dialog.locator('button[type=\"submit\"]');
  await dialog.page().waitForTimeout(400);
  if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
    await npSubmit.click({ timeout: 10_000 }).catch(() => {});
  }
  await expect(dialog).not.toBeVisible({ timeout: 25_000 });
}

// Eight distinct realistic project names — all eight show on one Projects
// list, so fixtureName()'s small pool can't guarantee uniqueness here.
const PROJECT_NAMES = [
  'Kilimani Apartments', 'Runda Residence', 'Lavington Court', 'Karen Bungalow',
  'Westlands Plaza', 'Ruaka Townhouses', 'Kileleshwa Villas', 'Embakasi Warehouse',
];

test.describe.configure({ mode: 'serial' });

test.describe('2.8 project types through the UI', () => {
  test('0. fixture: fresh company', async ({ request }) => {
    await register(request);
  });

  test('1. one project of each type via the wizard', async ({ page, request }, ti) => {
    test.setTimeout(1_200_000);
    await uiLogin(page, request);
    for (let i = 0; i < TYPES.length; i++) {
      const t = TYPES[i];
      const name = PROJECT_NAMES[i]!;
      await createTypedProject(page, name, `PT-${RUN.toString(36)}-${i}`, t.type, t.subtype, i === 0 ? '45000000' : undefined, i > 0);
      // Card appears with the type badge
      const card = page.locator('main').locator('button', { hasText: name }).filter({ hasText: 'Open workspace' }).first();
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toContainText(t.type);
      if (i === 0) await shot(page, ti, '01-project-card-type-badge');
    }
  });

  test('2. type filter narrows the project list', async ({ page, request }) => {
    await uiLogin(page, request);
    await page.goto('/app/projects/all');
    const filter = page.getByLabel('Filter by project type');
    await expect(filter).toBeVisible({ timeout: 20_000 });
    await filter.selectOption('RESIDENTIAL');
    await expect(page.locator('main').locator('button', { hasText: PROJECT_NAMES[0]! }).filter({ hasText: 'Open workspace' })).toBeVisible();
    await expect(page.locator('main').locator('button', { hasText: PROJECT_NAMES[2]! }).filter({ hasText: 'Open workspace' })).toHaveCount(0);
    await filter.selectOption('All');
    await expect(page.locator('main').locator('button', { hasText: PROJECT_NAMES[2]! }).filter({ hasText: 'Open workspace' })).toBeVisible();
  });

  test('3. NCA hint appears from the editable rules table', async ({ page, request }, ti) => {
    await uiLogin(page, request);
    await page.goto('/app/projects/all');
    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await dialog.getByLabel(/Project name/).fill(fixtureName('project', `${RUN}-${ti.project.name}-nca`));
    await dialog.getByLabel(/Project code/).fill(`NCA-${RUN.toString(36)}`);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    // 45M contract → Building NCA-3 band (20M–50M) per seeded rules
    await dialog.getByLabel(/Contract value/).fill('45000000');
    await expect(dialog.getByText(/NCA-3 likely needed/)).toBeVisible({ timeout: 15_000 });
    await shot(page, ti, '02-wizard-nca-hint');
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test('4. legacy untyped project still loads in the console', async ({ page, request }, ti) => {
    const legacyName = fixtureName('project', `${RUN}-${ti.project.name}-legacy`);
    // Fixture: a project created without a type (pre-2.8 row shape).
    const login = await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
    const setCookie = login.headers()['set-cookie'] || '';
    const cookie = setCookie.split(/,(?=[^;]+=)/).map((c) => c.split(';')[0].trim()).join('; ');
    const created = await request.post(`${API}/api/v1/projects`, {
      headers: { cookie },
      data: { name: legacyName, code: `LEG-${RUN.toString(36)}`, location: 'Nakuru' },
    });
    expect(created.status()).toBe(201);

    await uiLogin(page, request);
    await page.goto('/app/projects/all');
    const card = page.locator('main').locator('button', { hasText: legacyName }).filter({ hasText: 'Open workspace' }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    // Selecting it must not break the workspace
    await card.click();
    await expect(page.locator('[aria-label="Active project"]:visible')).toContainText(legacyName, { timeout: 15_000 });
  });
});
