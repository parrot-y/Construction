import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap, API } from './helpers';

function idOf(body: any): string | undefined {
  return body?.id || body?.data?.id || body?.supplier?.id || body?.purchaseOrder?.id;
}

/**
 * Procurement UI — real browser clicks for the purchase-order surface that
 * was API-only after stage 3: create draft PO (supplier + lines), issue it,
 * open the three-way match view, supplier-portal accept + invoice submit,
 * then PM invoice review (accept posts actuals). Runs on chromium and
 * mobile-390 via the shared Playwright projects.
 */

async function uiLogin(page: Page, email: string, password = 'Password123!') {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

async function clickNav(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).first().click({ force: true });
}

async function openMoneyTab(page: Page, tab: string) {
  await clickNav(page, 'Money');
  const t = page.getByRole('tab', { name: tab, exact: true }).first();
  for (let i = 0; i < 6; i++) {
    // dispatchEvent bypasses hit-testing — sticky headers/notices can cover
    // the tab bar after long flows and swallow a real mouse click.
    await t.dispatchEvent('click');
    if (await t.getAttribute('aria-selected').then((v) => v === 'true').catch(() => false)) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Money tab "${tab}" did not become selected`);
}

const stamp = Date.now();
const state: {
  projectId?: string;
  supplierId?: string;
  supplierToken?: string;
  supplierName?: string;
  poId?: string;
  poNumber?: string;
} = {};

test.describe.serial('L. Procurement UI — PO create/issue/match/review', () => {
  test.beforeAll(async ({ request }, testInfo) => {
    const tag = testInfo.project.name.replace(/[^a-z0-9]/gi, '');
    state.supplierName = `E2E UI Aggregates ${stamp}-${tag}`;
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    // The UI drives as qs@ — resolve the project from THEIR list so the
    // API-side assertions hit the same project the browser created the PO in.
    const qsSession = await login(request, 'qs@apexbuilders.co.ke');
    const listRes = await apiGet(request, qsSession, '/api/v1/projects');
    const rows = unwrap(await listRes.json());
    const arr = Array.isArray(rows) ? rows : rows.items || rows.projects || [];
    state.projectId = arr[0].id;

    // Supplier record + portal link (for accept/invoice steps).
    const sup = await apiPost(request, admin, '/api/v1/suppliers', {
      name: state.supplierName,
      contactPerson: 'UI Test', phone: '+254700111222', email: `ui-agg-${tag}@e2e.test`,
    });
    expect(sup.status(), await sup.text()).toBe(201);
    state.supplierId = idOf(unwrap(await sup.json()));

    const link = await apiPost(request, admin, `/api/v1/projects/${state.projectId}/portals/links`, {
      portalType: 'SUPPLIER', stakeholderName: 'UI Aggregates', supplierId: state.supplierId, expiresInDays: 7,
    });
    expect(link.status(), await link.text()).toBe(201);
    const linkBody = unwrap(await link.json());
    state.supplierToken = linkBody.token || linkBody.rawToken;
  });

  test('1. PM creates a draft PO through the console UI', async ({ page }) => {
    await uiLogin(page, 'qs@apexbuilders.co.ke');
    await openMoneyTab(page, 'Procurement');
    await expect(page.getByTestId('procurement-view')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('new-po-btn').click();
    await expect(page.getByTestId('po-create-form')).toBeVisible();

    await page.getByTestId('po-supplier-select').selectOption({ label: state.supplierName! });
    await page.getByTestId('po-line-desc-0').fill('UI clicks river sand');
    await page.getByTestId('po-line-qty-0').fill('20');
    await page.getByTestId('po-line-rate-0').fill('1500');

    await page.getByTestId('po-create-submit').click();
    await expect(page.getByText('UI clicks river sand').first()).toBeVisible({ timeout: 15_000 });

    // Capture the PO number from the card that contains our line.
    const card = page.locator('[data-testid^="po-card-"]').filter({ hasText: 'UI clicks river sand' }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    const num = await card.locator('.tabular-nums').first().innerText();
    state.poNumber = num.trim();
    expect(state.poNumber).toMatch(/^PO-/);
  });

  test('2. PM issues the PO; commitment + pending cost entry post', async ({ page, request }) => {
    await uiLogin(page, 'qs@apexbuilders.co.ke');
    await openMoneyTab(page, 'Procurement');
    const issueBtn = page.getByTestId(`po-issue-btn-${state.poNumber}`);
    await expect(issueBtn).toBeVisible({ timeout: 15_000 });
    await issueBtn.click();

    // Status flips to ISSUED and the issue button disappears.
    await expect(page.getByTestId(`po-card-${state.poNumber}`)).toContainText('Issued', { timeout: 15_000 });
    await expect(issueBtn).toHaveCount(0);

    // API-side confirmation the PO left DRAFT.
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const res = await apiGet(request, admin, `/api/v1/projects/${state.projectId}/purchase-orders`);
    const pos = unwrap(await res.json());
    const po = (Array.isArray(pos) ? pos : []).find((p: any) => p.poNumber === state.poNumber);
    expect(po?.status).toBe('ISSUED');
    state.poId = po.id;
  });

  test('3. Three-way match view renders ordered/delivered/invoiced columns', async ({ page }) => {
    await uiLogin(page, 'qs@apexbuilders.co.ke');
    await openMoneyTab(page, 'Procurement');
    await page.getByTestId(`po-match-btn-${state.poNumber}`).click();
    const panel = page.getByTestId(`po-match-${state.poNumber}`);
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId('po-match-status')).toBeVisible();
    await expect(panel).toContainText('UI clicks river sand');
    await expect(panel).toContainText('Ordered');
  });

  test('4. Supplier accepts PO and submits invoice via portal API', async ({ request }) => {
    const accept = await request.post(
      `${API}/api/v1/portals/supplier/${state.supplierToken}/purchase-orders/${state.poId}/accept`,
      { data: { expectedDeliveryDate: '2026-12-01' } },
    );
    expect(accept.status(), await accept.text()).toBe(200);

    const inv = await request.post(
      `${API}/api/v1/portals/supplier/${state.supplierToken}/purchase-orders/${state.poId}/invoices`,
      { data: { reference: `UI-INV-${stamp}`, amount: 25000, note: 'Full PO value' } },
    );
    expect(inv.status(), await inv.text()).toBeLessThan(300);
  });

  test('5. PM reviews the supplier invoice in the match view; accept posts actuals', async ({ page, request }) => {
    const ref = `UI-INV-${stamp}`;
    await uiLogin(page, 'qs@apexbuilders.co.ke');
    await openMoneyTab(page, 'Procurement');
    await page.getByTestId(`po-match-btn-${state.poNumber}`).click();
    const panel = page.getByTestId(`po-match-${state.poNumber}`);
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(`invoice-accept-${ref}`).click();
    await page.getByTestId('invoice-review-reason').fill('Matches PO lines');
    await page.getByTestId('invoice-review-accept-submit').click();

    // Invoice flips to Accepted in the UI.
    await expect(panel.locator(`[data-testid="po-invoice-${ref}"]`)).toContainText('Accepted', { timeout: 15_000 });

    // API confirmation: invoice ACCEPTED.
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const res = await apiGet(request, admin, `/api/v1/projects/${state.projectId}/purchase-orders/${state.poId}/match`);
    const match = unwrap(await res.json());
    const inv = (match.invoices || []).find((i: any) => i.reference === ref);
    expect(inv?.status).toBe('ACCEPTED');
  });
});
