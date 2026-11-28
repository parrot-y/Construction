import { test, expect, Page } from '@playwright/test';
import { login, apiGet, unwrap, fixtureName } from './helpers';

/**
 * CB1 — indent depth UI: service/material kind, store+floor+unit+work-order
 * targeting, delivery-schedule batches, fulfilment badges, amend-with-reason,
 * and the printable indent document. Runs on chromium and mobile-390.
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

const stamp = Date.now();
const itemName = fixtureName('quote', `${stamp}`);
const storeName = fixtureName('store', `${stamp}`);
let projectId = '';

test.describe.serial('CB1 — indent depth', () => {
  test.beforeAll(async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const listRes = await apiGet(request, admin, '/api/v1/projects');
    const rows = unwrap(await listRes.json());
    const arr = Array.isArray(rows) ? rows : rows.items || rows.projects || [];
    projectId = arr[0].id;
    expect(projectId).toBeTruthy();
  });

  test('create a service indent with targeting + delivery batches via UI', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/money/requisitions');
    await expect(page.getByRole('heading', { name: /Site Material Requisitions/ })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /New Material Request/ }).click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByText('New Material Purchase Request')).toBeVisible();

    await modal.getByLabel('Item description').fill(itemName);
    await modal.getByLabel('Indent kind').selectOption('SERVICE');
    await modal.getByLabel('Requested quantity').fill('6');
    await modal.getByLabel('Estimated unit cost').fill('5000');
    await modal.getByLabel('Store').fill(storeName);
    await modal.getByLabel('Floor / Level').fill('Level 3');
    await modal.getByLabel('Unit', { exact: true }).fill('Unit 12B');
    await modal.getByLabel('Work order').fill('WO-STR-014');
    await modal.getByLabel('Category').fill('STRUCTURAL');
    await modal.getByLabel('Material type').fill('Aggregate');
    await modal.getByLabel('Material subtype').fill('Ballast');
    await modal.getByLabel('Lead time (days)').fill('3');
    await modal.getByLabel('Expected delivery').fill('2026-12-15');
    await modal.getByLabel('Notes').fill('Crane offload required — gate B');

    await modal.getByRole('button', { name: '+ Add batch' }).click();
    await modal.getByLabel('Batch 1 date').fill('2026-12-01');
    await modal.getByLabel('Batch 1 quantity').fill('4');
    await modal.getByRole('button', { name: '+ Add batch' }).click();
    await modal.getByLabel('Batch 2 date').fill('2026-12-08');
    await modal.getByLabel('Batch 2 quantity').fill('2');

    await modal.getByRole('button', { name: 'Submit Requisition' }).click();
    await expect(modal).not.toBeVisible({ timeout: 15_000 });

    // Row shows SERVICE kind badge + UNFULFILLED fulfilment bucket.
    const row = page.locator('tr', { hasText: itemName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('SERVICE')).toBeVisible();
    await expect(row.getByText('UNFULFILLED')).toBeVisible();

    // Expanded detail shows targeting + schedule.
    await row.getByLabel('Show indent details').click();
    await expect(row.getByText(new RegExp(storeName))).toBeVisible();
    await expect(row.getByText(/Level 3 · Unit 12B · WO-STR-014/)).toBeVisible();
    await expect(row.getByText(/Delivery schedule: .*2026-12-01 ×4\.00.*2026-12-08 ×2\.00/)).toBeVisible();
  });

  test('amend the indent with a mandatory reason', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/money/requisitions');
    const row = page.locator('tr', { hasText: itemName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole('button', { name: 'Amend' }).click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByText(/Amend REQ-/)).toBeVisible();

    // Reason is mandatory — submit without it must be blocked client-side.
    await modal.getByRole('button', { name: 'Save amendment' }).click();
    await expect(modal.getByText('A reason is required for every amendment.')).toBeVisible();

    await modal.getByLabel('Reason for amendment').fill('Quantity revised after design change');
    await modal.getByLabel('Quantity', { exact: true }).fill('8');
    // Schedule replaces wholesale — drop batch 2, keep batch 1.
    await modal.getByLabel('Remove batch 2').click();
    await modal.getByLabel('Batch 1 quantity').fill('8');
    await modal.getByRole('button', { name: 'Save amendment' }).click();
    await expect(modal).not.toBeVisible({ timeout: 15_000 });

    await row.getByLabel('Show indent details').click();
    // Quantity column (3rd td) reflects the amended 8.00.
    await expect(row.locator('td').nth(2)).toContainText('8.00');
    await expect(row.getByText(/Delivery schedule: 2026-12-01 ×8\.00/)).toBeVisible();
    await expect(row.getByText(/2026-12-08/)).not.toBeVisible();
  });

  test('print view renders the indent document', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/money/requisitions');
    const row = page.locator('tr', { hasText: itemName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByLabel('Show indent details').click();
    await row.getByRole('button', { name: 'Print indent' }).click();

    const doc = page.locator('[data-print-root]');
    await expect(doc).toBeVisible();
    await expect(doc.getByText(/MATERIAL INDENT|SERVICE INDENT/)).toBeVisible();
    await expect(doc.getByText(itemName).first()).toBeVisible();
    await expect(doc.getByText('Delivery schedule')).toBeVisible();
    // Batch rows render the formatted date + qty/UOM.
    await expect(doc.locator('table').getByText('8.00')).toBeVisible();
    await expect(doc.locator('table').getByText(/Dec.*2026/)).toBeVisible();
    await expect(doc.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
    await doc.getByRole('button', { name: 'Close' }).click();
    await expect(doc).not.toBeVisible();
  });

  test('API returns fulfilment bucket + targeting fields on list', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const res = await apiGet(request, admin, `/api/v1/projects/${projectId}/material-requisitions`);
    expect(res.status()).toBe(200);
    const body = unwrap(await res.json());
    const reqs = body.requisitions || body.data || [];
    const mine = reqs.find((r: any) => r.itemDescription === itemName);
    expect(mine, 'UI-created indent missing from API list').toBeTruthy();
    expect(mine.fulfilment).toBe('UNFULFILLED');
    expect(mine.indentKind).toBe('SERVICE');
    expect(mine.storeLocation).toBe(storeName);
    expect(mine.floorRef).toBe('Level 3');
    expect(mine.deliverySchedule.length).toBe(1);
    expect(mine.deliverySchedule[0].quantity).toBe('8.00');
  });
});
