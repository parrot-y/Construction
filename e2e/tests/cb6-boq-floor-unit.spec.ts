import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, unwrap, API } from './helpers';

/**
 * CB6 — BOQ floor/unit takeoff mapping: items created via API are mapped
 * to a floor/unit through the console's bulk-map mode; filters and the
 * Location column reflect the mapping.
 * Runs on chromium and mobile-390.
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
const projectName = `CB6 Map Court ${stamp}`;
let projectId = '';
let itemIds: string[] = [];

test.describe.serial('CB6 — BOQ floor/unit takeoff mapping', () => {
  test('fixture: project + two unmapped BoQ items', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const created = await apiPost(request, admin, '/api/v1/projects', {
      name: projectName,
      code: `CB6-${stamp}`,
      location: 'Upper Hill, Nairobi',
      originalContractSum: 50000000,
    });
    expect(created.status(), await created.text()).toBe(201);
    const projBody = unwrap(await created.json());
    projectId = projBody.data?.id ?? projBody.id;
    expect(projectId).toBeTruthy();

    for (const [description, qty] of [['Suspended slab', 40], ['Blockwork partitions', 120]] as const) {
      const res = await apiPost(request, admin, `/api/v1/projects/${projectId}/boq/items`, {
        description,
        unit: 'm2',
        quantity: qty,
        unitRate: 4500,
      });
      expect(res.status(), await res.text()).toBe(201);
      const itemBody = unwrap(await res.json());
      itemIds.push(itemBody.id ?? itemBody.data?.id);
    }
    expect(itemIds).toHaveLength(2);
  });

  test('map floors/units via the console and filter by them', async ({ page, request }) => {
    test.skip(!projectId, 'needs the fixture project');
    await uiLogin(page);

    // Open the project workspace.
    await page.goto('/app/projects/all');
    const card = page.locator('main').locator('button', { hasText: projectName }).filter({ hasText: 'Open workspace' }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();

    // Money → Bill of quantities.
    await page.goto('/app/money/financials');
    await page.getByRole('tab', { name: /bill of quantities/i }).or(page.getByRole('button', { name: /bill of quantities/i })).first().click();
    await expect(page.getByRole('heading', { name: 'Bill of Quantities' })).toBeVisible({ timeout: 20_000 });

    // Enter takeoff mapping mode and select all items.
    await page.getByTestId('boq-map-toggle').click();
    await expect(page.getByTestId('boq-map-bar')).toBeVisible();
    await page.getByTestId('boq-map-all').check();
    await page.getByTestId('boq-map-floor').fill('First');
    await page.getByTestId('boq-map-unit').fill('A1');
    await page.getByTestId('boq-map-apply').click();

    // Both rows now show the location badge.
    for (const id of itemIds) {
      const loc = page.getByTestId(`boq-loc-${id}`);
      await expect(loc).toBeVisible({ timeout: 15_000 });
      await expect(loc).toContainText('First');
      await expect(loc).toContainText('A1');
    }

    // Floor filter narrows to the mapped items; unit filter agrees.
    await page.getByTestId('boq-floor-filter').selectOption('First');
    await expect(page.getByTestId(`boq-item-row-${itemIds[0]}`)).toBeVisible();
    await expect(page.getByTestId(`boq-item-row-${itemIds[1]}`)).toBeVisible();
    await page.getByTestId('boq-unit-filter').selectOption('A1');
    await expect(page.getByTestId(`boq-item-row-${itemIds[0]}`)).toBeVisible();

    // API proof.
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const list = await apiGet(request, admin, `/api/v1/projects/${projectId}/boq/items?floor=First&unitRef=A1`);
    const unwrapped = unwrap(await list.json());
    const rows = Array.isArray(unwrapped) ? unwrapped : (unwrapped.data ?? []);
    const found = rows.filter((r: any) => itemIds.includes(r.id));
    expect(found).toHaveLength(2);
  });
});
