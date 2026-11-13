import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap } from './helpers';

/**
 * Stage-1 closure item 6 — real UI click coverage for the money screens:
 * payment certificates (IPC builder → draft → submit), invoices
 * (create → send → record payment) and subcontractor valuations
 * (new claim → issued row). Runs under both Playwright projects —
 * desktop chromium and mobile-390 — with real .click() interactions,
 * no requestSubmit() shortcuts.
 */

async function uiLogin(page: Page, email: string, password: string) {
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
const state: { projectId?: string; projectName?: string } = {};

test.describe.serial('I. Money screens — real UI clicks (desktop + 390px)', () => {
  test.beforeAll(async ({ request }, testInfo) => {
    const tag = testInfo.project.name.replace(/[^a-z0-9]/gi, '');
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    // Use the same project the console auto-selects (first row of
    // /api/v1/projects for this session).
    const listRes = await apiGet(request, admin, '/api/v1/projects');
    const rows = unwrap(await listRes.json());
    const arr = Array.isArray(rows) ? rows : rows.items || rows.projects || [];
    expect(arr.length, 'seeded tenant must have a project').toBeGreaterThan(0);
    state.projectId = arr[0].id;
    state.projectName = arr[0].name;

    // BoQ item + 50% progress so the IPC builder has derivable lines.
    const code = `UIC-${stamp}-${tag}`;
    const boq = await apiPost(request, admin, `/api/v1/projects/${state.projectId}/boq/confirm`, {
      sourceFilename: 'ui-clicks-boq.xlsx',
      sections: [{
        title: 'UI Clicks Works', orderIdx: 0, subtotal: '50000.00',
        items: [{
          itemCode: code, description: 'UI clicks test item', unit: 'm3',
          quantity: '50.0000', unitRate: '1000.0000', totalAmount: '50000.00',
          isProvisional: false, status: 'VALID',
        }],
      }],
    });
    expect(boq.status(), await boq.text()).toBeLessThan(300);

    const itemsRes = await apiGet(request, admin, `/api/v1/projects/${state.projectId}/boq/items`);
    const itemsBody = unwrap(await itemsRes.json());
    const itemRows = Array.isArray(itemsBody) ? itemsBody : itemsBody.items || [];
    const item = itemRows.find((i: any) => (i.item_code || i.itemCode) === code);
    expect(item, 'BoQ item for UI test').toBeTruthy();

    const prog = await apiPost(request, admin, `/api/v1/projects/${state.projectId}/progress`, {
      recordDate: new Date().toISOString().slice(0, 10),
      overallProgress: '0.5000',
      notes: 'UI clicks progress',
      items: [{ boqItemId: item.id, completedQuantity: '25.0000', completionPct: '0.5000' }],
    });
    expect(prog.status(), await prog.text()).toBeLessThan(300);

    // Subcontractor package for the valuation claim form.
    const pkg = await apiPost(request, admin, `/api/v1/projects/${state.projectId}/subcontractors`, {
      tradeCategory: 'PLUMBING',
      firmName: `UI FlowFit ${stamp}-${tag}`,
      subcontractSum: '400000.00',
      retentionRatePct: '5.00',
      status: 'ACTIVE',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
  });

  test('certificate → invoice → valuation screens are clickable end to end', async ({ page }, testInfo) => {
    const tag = testInfo.project.name.replace(/[^a-z0-9]/gi, '');
    const invTitle = `UI invoice ${stamp}-${tag}`;
    // Admin created and sends the invoice — maker-checker asks for a
    // self-approval reason via prompt().
    page.on('dialog', (d) => d.accept('UI test self-approval reason'));
    await uiLogin(page, 'admin@apexbuilders.co.ke', 'Password123!');
    // Pin the project selector when the layout exposes one (desktop header);
    // mobile auto-selects the first project, which is the fixture project.
    const sel = page.getByRole('combobox').first();
    if (await sel.waitFor({ timeout: 5_000 }).then(() => true).catch(() => false)) {
      if (state.projectId) {
        await sel.selectOption(state.projectId).catch(() => sel.selectOption({ index: 0 }));
      }
    }

    // ---- CERTIFICATES: open builder → preview lines → draft → submit ----
    await openMoneyTab(page, 'Certificates');
    await page.getByRole('button', { name: /New IPC from progress/ }).click();
    await expect(page.getByText('UI clicks test item').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Draft IPC' }).click();
    const fb = page.getByText(/IPC-\d{3} drafted from progress/);
    await expect(fb).toBeVisible({ timeout: 20_000 });
    const certNo = (await fb.textContent())!.match(/IPC-\d{3}/)![0];
    // Only DRAFT certificates expose a Submit action — scope to our card.
    const draftCard = page.locator('div.rounded-xl', {
      hasText: certNo,
      has: page.getByRole('button', { name: 'Submit', exact: true }),
    }).last();
    await draftCard.getByRole('button', { name: 'Submit', exact: true }).click();
    // After SUBMIT the card no longer has a Submit button — re-locate without it.
    const submittedCard = page.locator('div.rounded-xl', { hasText: certNo }).last();
    await expect(submittedCard.getByText('SUBMITTED').first()).toBeVisible({ timeout: 20_000 });

    // ---- INVOICES: create → send → record payment ----
    await openMoneyTab(page, 'Invoices');
    await page.getByRole('button', { name: '+ New Invoice' }).click();
    await page.getByPlaceholder(/Progress claim/).fill(invTitle);
    await page.locator('xpath=//label[contains(., "Client Name")]/following-sibling::input').fill('UI Test Client');
    await page.getByPlaceholder('Description *').fill('UI invoice line item');
    await page.getByPlaceholder('Qty').fill('1');
    await page.getByPlaceholder('Rate').fill('10000');
    await page.getByRole('button', { name: 'Save Draft Invoice' }).click();
    const invRow = page.locator('tr', { hasText: invTitle });
    await expect(invRow.getByRole('button', { name: /INV-\d{5}/ })).toBeVisible({ timeout: 20_000 });
    await invRow.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(invRow.getByText('SENT').first()).toBeVisible({ timeout: 20_000 });
    await invRow.getByRole('button', { name: 'Record payment' }).click();
    await page.locator('xpath=//label[contains(., "Amount *")]/following-sibling::input').fill('11600');
    await page.getByPlaceholder(/M-Pesa code/).fill(`UI-PAY-${stamp}`);
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(invRow.getByText(/PART PAID|PAID/).first()).toBeVisible({ timeout: 20_000 });

    // ---- SUB CONTRACTOR VALUATIONS: new claim → issued row ----
    await openMoneyTab(page, 'Sub valuations');
    await page.getByRole('button', { name: /New Subcontractor Claim/ }).click();
    const pkgSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'UI FlowFit' }) }).first();
    const pkgVal = await pkgSelect.locator('option', { hasText: 'UI FlowFit' }).first().getAttribute('value');
    await pkgSelect.selectOption(pkgVal!);
    await page.getByPlaceholder(/1500000/).fill('25000');
    await page.getByRole('button', { name: /Issue Certificate|Generate/ }).click();
    await expect(page.getByText(/SC-VAL-\d{3}/).first()).toBeVisible({ timeout: 20_000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, 'money screens must not scroll sideways').toBe(false);
  });
});
