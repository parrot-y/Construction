import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap } from './helpers';

/**
 * CB7 — printable PO and GRN documents. Fixtures via API; print modals are
 * exercised in UI (modal content asserted; window.print not invoked).
 */

async function uiLogin(page: Page) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill('admin@apexbuilders.co.ke');
  await page.locator('#password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

const stamp = Date.now().toString().slice(-6);
const storeName = `Kitui Store ${stamp}`;
const supplierName = `Mombasa Builders ${stamp}`;
let projectId = '';
let poNumber = '';
let projectName = '';

test.describe.serial('CB7 — PO/GRN print views', () => {
  test('fixture: project, supplier, PO with store, diary GRN linked to PO', async ({ request }) => {
    test.setTimeout(120_000);
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const projects = unwrap(await (await apiGet(request, admin, '/api/v1/projects')).json());
    const arr = Array.isArray(projects) ? projects : projects.items || projects.projects || [];
    projectId = arr[0].id;
    projectName = arr[0].name;
    expect(projectId).toBeTruthy();

    const sup = await apiPost(request, admin, '/api/v1/suppliers', { name: supplierName, phone: '+254722334455' });
    expect(sup.status()).toBe(201);
    const supplierId = unwrap(await sup.json()).id;

    const po = await apiPost(request, admin, `/api/v1/projects/${projectId}/purchase-orders`, {
      supplierId,
      storeLocation: storeName,
      items: [
        { description: 'Ballast 6-12mm', unit: 'tonne', quantity: 15, rate: 4500 },
        { description: 'Cement 50kg', unit: 'bag', quantity: 200, rate: 820 },
      ],
    });
    expect(po.status()).toBe(201);
    const poBody = unwrap(await po.json());
    poNumber = poBody.poNumber;
    expect(poNumber).toMatch(/^PO-/);

    const diary = await apiPost(request, admin, `/api/v1/projects/${projectId}/site-diaries`, {
      projectId,
      entryDate: new Date().toISOString().slice(0, 10),
      weather: 'SUNNY_CLEAR',
      siteStatus: 'OPERATIONAL',
      deliveries: [{
        materialName: 'Ballast 6-12mm',
        quantity: '8',
        unit: 'tonne',
        supplierId,
        storeLocation: storeName,
        purchaseOrderId: poBody.id,
      }],
    });
    expect(diary.status()).toBeLessThan(300);
  });

  test('register rows open printable PO and GRN documents', async ({ page }) => {
    test.skip(!projectId, 'needs fixture');
    await uiLogin(page);
    await page.goto('/app/money/procurement');
    await expect(page.getByTestId('procurement-view')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('procurement-tab-register').click();
    await expect(page.getByTestId('purchase-register')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('register-store').fill(storeName);
    await page.waitForTimeout(800);

    // PO print — full item table + totals.
    const poRow = page.locator('tr[data-testid^="register-row-PO-"]', { hasText: poNumber });
    await expect(poRow).toBeVisible({ timeout: 15_000 });
    await poRow.getByRole('button', { name: 'Print' }).click();
    const modal = page.getByTestId('procurement-print-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(`PURCHASE ORDER — ${poNumber}`)).toBeVisible();
    await expect(modal.getByText(supplierName)).toBeVisible();
    await expect(modal.getByText(projectName)).toBeVisible();
    await expect(modal.getByText('Ballast 6-12mm')).toBeVisible();
    await expect(modal.getByText('Cement 50kg')).toBeVisible();
    await expect(modal.getByText(storeName)).toBeVisible();
    // 15×4500 + 200×820 = 67,500 + 164,000 = 231,500
    await expect(modal.getByText(/231,500|231500/).first()).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).not.toBeVisible();

    // GRN print — received material + supplier + linked PO.
    const grnRow = page.locator('tr[data-testid^="register-row-GRN-"]', { hasText: 'Ballast 6-12mm' });
    await expect(grnRow).toBeVisible({ timeout: 15_000 });
    await grnRow.getByRole('button', { name: 'Print' }).click();
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(/GOODS RECEIVED NOTE/)).toBeVisible();
    await expect(modal.getByText(supplierName)).toBeVisible();
    await expect(modal.getByText(projectName)).toBeVisible();
    await expect(modal.getByText('Ballast 6-12mm')).toBeVisible();
    await expect(modal.getByText(poNumber, { exact: true })).toBeVisible();
    await expect(modal.getByText(storeName)).toBeVisible();
  });

  test('PO card on procurement tab opens the same printable document', async ({ page }) => {
    test.skip(!projectId, 'needs fixture');
    await uiLogin(page);
    await page.goto('/app/money/procurement');
    await expect(page.getByTestId('procurement-view')).toBeVisible({ timeout: 30_000 });

    const card = page.getByTestId(`po-card-${poNumber}`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByTestId(`po-print-btn-${poNumber}`).click();
    const modal = page.getByTestId('procurement-print-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(`PURCHASE ORDER — ${poNumber}`)).toBeVisible();
    await expect(modal.getByText('Ballast 6-12mm')).toBeVisible();
  });
});
