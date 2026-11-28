import { test, expect, Page } from '@playwright/test';
import { login, apiGet, unwrap, fixtureName } from './helpers';

/**
 * CB2 — rate master UI: create/edit/delete a rate, bulk CSV upload with
 * upsert semantics, and rate lookup prefilling a BoQ line. Runs on
 * chromium and mobile-390.
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
const runTag = String(stamp).slice(-5);
const rateDesc = `${fixtureName('generic', `${stamp}-rate`)} — run ${runTag}`;
const bulkDesc = `${fixtureName('package', `${stamp}-bulk`)} — run ${runTag}`;
let createdRateId = '';

test.describe.serial('CB2 — rate master', () => {
  test('create a rate via the console', async ({ page, request }) => {
    await uiLogin(page);
    await page.goto('/app/money/rates');
    await expect(page.getByTestId('rate-master-view')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('rate-master-new').click();
    await page.getByTestId('rate-form-description').fill(rateDesc);
    await page.getByTestId('rate-form-unit').fill('bag');
    await page.getByTestId('rate-form-rate').fill('780');
    await page.getByTestId('rate-form-type').selectOption('MATERIAL');
    await page.getByTestId('rate-form-mat-type').fill('Cement');
    await page.getByTestId('rate-form-mat-subtype').fill('42.5N');
    await page.getByTestId('rate-form-state').fill('Nairobi');
    await page.getByTestId('rate-form-city').fill('Nairobi');
    await page.getByTestId('rate-form-save').click();
    await expect(page.getByText(rateDesc)).toBeVisible({ timeout: 15_000 });

    // API proof — the entry exists and lookup finds it.
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const list = await apiGet(request, admin, `/api/v1/rate-master?q=${encodeURIComponent(rateDesc)}`);
    const rows = unwrap(await list.json());
    const arr = rows.entries ?? rows;
    expect(arr.length).toBeGreaterThanOrEqual(1);
    createdRateId = arr[0].id;
    expect(createdRateId).toBeTruthy();

    const lookup = await apiGet(request, admin, `/api/v1/rate-master/lookup?q=${encodeURIComponent(rateDesc)}&unit=bag`);
    const matches = unwrap(await lookup.json());
    const mArr = matches.matches ?? matches;
    expect(mArr[0]?.description).toBe(rateDesc);
    expect(Number(mArr[0]?.unitRateKes)).toBe(780);
  });

  test('bulk upload upserts by natural key', async ({ page }) => {
    await uiLogin(page);
    await page.goto('/app/money/rates');
    await expect(page.getByTestId('rate-master-view')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('rate-master-bulk').click();
    // Row 1 duplicates the rate created above (same description/unit/rate →
    // should update, not duplicate). Row 2 is brand new.
    await page.getByTestId('rate-bulk-text').fill([
      `${rateDesc},bag,790,MATERIAL,Cement,42.5N,Kenya,Nairobi,Nairobi`,
      `${bulkDesc},hr,450,SERVICE,Labour,Skilled,Kenya,Nairobi,Nairobi`,
    ].join('\n'));
    await page.getByTestId('rate-bulk-run').click();
    await expect(page.getByText(/Imported: 1 created, 1 updated/)).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/Search description/).fill(bulkDesc);
    const bulkRow = page.locator('tr', { hasText: bulkDesc });
    await expect(bulkRow).toBeVisible({ timeout: 15_000 });
    await expect(bulkRow.getByText('450')).toBeVisible();

    // The updated original now shows the new rate.
    await page.getByPlaceholder(/Search description/).fill(rateDesc);
    const rateRow = page.locator('tr', { hasText: rateDesc });
    await expect(rateRow).toBeVisible({ timeout: 15_000 });
    await expect(rateRow.getByText('790')).toBeVisible();
  });

  test('rate lookup prefills a BoQ line rate', async ({ page }) => {
    test.skip(!createdRateId, 'needs the rate from test 1');
    await uiLogin(page);
    await page.goto('/app/money/financials');
    await page.getByRole('tab', { name: /bill of quantities/i }).or(page.getByRole('button', { name: /bill of quantities/i })).first().click();
    await expect(page.getByRole('heading', { name: 'Bill of Quantities' }).or(page.getByText('No Bill of Quantities yet'))).toBeVisible({ timeout: 20_000 });

    // Open the add-item form — either the empty-state CTA or the header button.
    const addBtn = page.getByRole('button', { name: /add your first boq item/i })
      .or(page.getByRole('button', { name: /^Add item$/i })).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    const form = page.locator('form', { has: page.getByText('Add BoQ item') });
    await form.getByPlaceholder('Describe the work').fill(rateDesc);
    await form.getByPlaceholder('m, m², no').fill('bag');

    // Click the inline Rate lookup and pick the seeded match.
    await form.getByRole('button', { name: 'Rate', exact: true }).click();
    const matchBtn = page.getByRole('button', { name: rateDesc }).last();
    await expect(matchBtn).toBeVisible({ timeout: 15_000 });
    await matchBtn.click();

    await expect(form.locator('input[type="number"]').nth(1)).toHaveValue('790', { timeout: 10_000 });
  });
});
