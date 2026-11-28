import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap } from './helpers';

/**
 * CB4 — PO/GRN register: dedicated register screen with supplier + store +
 * value columns. Fixtures via API; the register itself is exercised in UI.
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
const storeName = `Thika Store ${stamp}`;
const supplierName = `Ramji & Sons ${stamp}`;
let projectId = '';
let poNumber = '';

test.describe.serial('CB4 — purchase register', () => {
  test('fixture: project, supplier, PO with store, diary GRN linked to PO', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const projects = unwrap(await (await apiGet(request, admin, '/api/v1/projects')).json());
    const arr = Array.isArray(projects) ? projects : projects.items || projects.projects || [];
    projectId = arr[0].id;
    expect(projectId).toBeTruthy();

    const sup = await apiPost(request, admin, '/api/v1/suppliers', { name: supplierName, phone: '+254711223344' });
    expect(sup.status()).toBe(201);
    const supplierId = unwrap(await sup.json()).id;

    const po = await apiPost(request, admin, `/api/v1/projects/${projectId}/purchase-orders`, {
      supplierId,
      storeLocation: storeName,
      items: [{ description: 'River sand (plaster grade)', unit: 'm3', quantity: 20, rate: 3200 }],
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
        materialName: 'River sand (plaster grade)',
        quantity: '10',
        unit: 'm3',
        supplierId,
        storeLocation: storeName,
        purchaseOrderId: poBody.id,
      }],
    });
    expect(diary.status()).toBeLessThan(300);
  });

  test('register shows PO + GRN rows with supplier, store and value', async ({ page }) => {
    test.skip(!projectId, 'needs fixture');
    await uiLogin(page);
    await page.goto('/app/money/procurement');
    await expect(page.getByTestId('procurement-view')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('procurement-tab-register').click();
    await expect(page.getByTestId('purchase-register')).toBeVisible({ timeout: 15_000 });

    // Filter by our store so only fixture rows show.
    await page.getByTestId('register-store').fill(storeName);
    await page.waitForTimeout(800);

    const poRow = page.locator('tr[data-testid^="register-row-PO-"]', { hasText: poNumber });
    await expect(poRow).toBeVisible({ timeout: 15_000 });
    await expect(poRow.getByText('PO', { exact: true })).toBeVisible();
    await expect(poRow.getByText(supplierName)).toBeVisible();
    await expect(poRow.getByText(storeName)).toBeVisible();
    await expect(poRow.getByText(/64,000|64000/)).toBeVisible();

    const grnRow = page.locator('tr[data-testid^="register-row-GRN-"]', { hasText: 'River sand' });
    await expect(grnRow).toBeVisible({ timeout: 15_000 });
    await expect(grnRow.getByText('GRN', { exact: true })).toBeVisible();
    await expect(grnRow.getByText(supplierName)).toBeVisible();
    await expect(grnRow.getByText(storeName)).toBeVisible();
    // 10 m3 × 3200 = 32,000
    await expect(grnRow.getByText(/32,000|32000/)).toBeVisible();
  });
});
