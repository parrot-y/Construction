import { test, expect, Page, APIRequestContext, TestInfo } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { fixtureName } from './helpers';

const EVIDENCE_DIR = process.env.E2E_EVIDENCE_DIR || '';
async function shot(page: Page, ti: TestInfo, name: string) {
  if (!EVIDENCE_DIR) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const vp = ti.project.name === 'mobile-390' ? 'mobile' : 'desktop';
  await page.screenshot({ path: join(EVIDENCE_DIR, `${vp}-${name}.png`), fullPage: false });
}

/**
 * Phase 3.1 design gate — Home dashboard, Projects list and the New project
 * wizard built to docs/design/DESIGN.md, proven by clicks at 390 px and
 * desktop width with committed screenshots.
 */

const API = process.env.E2E_API_URL || 'http://localhost:4199';
const PASSWORD = 'P3Gate#2026';
const RUN = Date.now();
let email = '';

test.beforeEach(({}, ti) => {
  email = `admin.${RUN}.${ti.project.name.replace(/[^a-z0-9]/gi, '')}@p3gate.test`;
});

async function register(request: APIRequestContext) {
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `${RUN}-${email}`),
      adminFullName: 'Wanjiru Admin',
      email,
      phone: `+2547${String(RUN).slice(-8)}`,
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
}

async function uiLogin(page: Page, request: APIRequestContext) {
  const res = await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}: ${await res.text()}`).toBe(200);
  const setCookie = res.headers()['set-cookie'] || '';
  const pairs = setCookie.split(/,(?=[^;]+=)/).map((c) => {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: 'localhost', path: '/' };
  });
  await page.context().addCookies(pairs);
  await page.goto('/app');
  await expect(page.locator('nav[aria-label="Workspace sections"]:visible, aside[aria-label="Workspace navigation"]:visible').first()).toBeVisible({ timeout: 60_000 });
}

test.describe('P3.1 design gate — three screens', () => {
  test('0. fixture: fresh company', async ({ request }) => {
    await register(request);
  });

  test('1. Home shows spec blocks and get-started checklist', async ({ page, request }, ti) => {
    await uiLogin(page, request);
    // New company → Get started checklist on top.
    await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible({ timeout: 20_000 });
    // Spec block order headings.
    await expect(page.getByRole('heading', { name: 'Needs you now' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Progress against plan/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Money per project' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Next milestones/ })).toBeVisible();
    // Client-view toggle exists.
    await expect(page.getByRole('button', { name: /Client view/ })).toBeVisible();
    await shot(page, ti, '01-home');
  });

  test('2. Projects list — cards, filters, new-project wizard', async ({ page, request }, ti) => {
    test.setTimeout(180_000);
    await uiLogin(page, request);
    await page.goto('/app/projects/all');
    await expect(page.getByRole('button', { name: 'New project' }).first()).toBeVisible({ timeout: 20_000 });
    // Empty state offers the one next action.
    await expect(page.getByText(/No projects yet|No projects in this view/)).toBeVisible();
    await shot(page, ti, '02-projects-empty');

    // Wizard: 4 spec steps — Type → Basics → Commercial → Team.
    await page.getByRole('button', { name: 'New project' }).first().click();
    const dialog = page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name: 'New project' }) });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Type', { exact: true }).first()).toBeVisible();
    await shot(page, ti, '03-wizard-type');
    await dialog.getByRole('button', { name: 'Residential', exact: true }).click();
    // Subtype chips live on the same step.
    await expect(dialog.getByRole('button', { name: 'Single home / bungalow', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog.getByLabel(/Project name/)).toBeVisible();
    await shot(page, ti, '04-wizard-basics');
    await dialog.getByLabel(/Project name/).fill('Mombasa Road Warehouse');
    await dialog.getByLabel(/Project code/).fill(`P3-${String(RUN).slice(-6)}`);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog.getByLabel(/Contract value/)).toBeVisible();
    await dialog.getByLabel(/Contract value/).fill('62000000');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await shot(page, ti, '05-wizard-team');
    const npSubmit = dialog.locator('button[type="submit"]');
    await dialog.page().waitForTimeout(300);
    if (await npSubmit.isVisible().catch(() => false) && !(await npSubmit.isDisabled().catch(() => true))) {
      await npSubmit.click({ timeout: 10_000 }).catch(() => {});
    }
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });
    // Card appears immediately with type badge + status word.
    const card = page.locator('main').locator('button', { hasText: 'Mombasa Road Warehouse' }).filter({ hasText: 'Open workspace' }).first();
    await expect(card).toBeVisible({ timeout: 25_000 });
    await expect(card).toContainText('Residential');
    await shot(page, ti, '06-project-card');
  });

  test('3. Navigation contract — sidebar/bottom bar, no theme toggle', async ({ page, request }, ti) => {
    await uiLogin(page, request);
    const mobile = ti.project.name === 'mobile-390';
    if (mobile) {
      // Bottom bar: Home, Projects, Site, Money, More — labels under icons.
      const bar = page.locator('nav[aria-label="Workspace sections"]:visible').last();
      for (const label of ['Home', 'Projects', 'Site', 'Money', 'More']) {
        await expect(bar.getByText(label, { exact: true })).toBeVisible();
      }
      // More opens the overflow sheet with remaining sections.
      await bar.getByRole('button', { name: 'More sections' }).click();
      await expect(page.getByRole('button', { name: 'People', exact: true }).last()).toBeVisible();
      await shot(page, ti, '07-mobile-more');
      await page.mouse.click(195, 120); // backdrop closes the sheet
    } else {
      // Desktop sidebar: labelled sections + collapsible to icons.
      const sidebar = page.locator('aside[aria-label="Workspace navigation"]');
      await expect(sidebar).toBeVisible();
      for (const label of ['Home', 'Projects', 'Site', 'Money', 'People', 'Files & reports']) {
        await expect(sidebar.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
      // Active section expands to its tabs — one tab level.
      await sidebar.getByRole('button', { name: 'Projects', exact: true }).click();
      await expect(sidebar.getByRole('tab', { name: 'Change orders' })).toBeVisible();
      await shot(page, ti, '08-sidebar-tabs');
      // Collapse to icons and remember.
      await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    }
    // Theme toggle removed — light theme only.
    await expect(page.getByRole('button', { name: /dark mode|light mode/i })).toHaveCount(0);
    // Project selector always visible with status.
    await expect(page.locator('[aria-label="Active project"]:visible')).toBeVisible();
  });
});
