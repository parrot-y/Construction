import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, apiGet, apiPost, unwrap, Session } from './helpers';

/**
 * ROUND K2 — OWNER SCREEN + CONSOLE TABS AT 390px
 *
 * The audit found the owner approvals box squeezing a variation title
 * to one letter per line, and filter/console tabs clipped mid-word
 * ("Waiting for o"). Both now use the shared wrapping FilterTabs and a
 * full-width title row. These tests fail if either regresses:
 * titles must keep a usable width/height, and no tab strip may scroll
 * horizontally (wrap means scrollWidth == clientWidth).
 */

const RUN = Date.now();
const PASSWORD = 'K2Layout#2026';

const S: { admin?: Session; pm?: Session; owner?: Session; projectId?: string } = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@k2-layout.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: 'K2 Layout Contractors Ltd', adminFullName: 'Grace Wambui', email, phone: '+254712000777', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@k2-layout.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

async function uiLogin(page: Page, email: string, ready: import('@playwright/test').Locator) {
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
  await expect(ready).toBeVisible({ timeout: 30_000 });
}

/** Push a fresh variation to OWNER_REVIEW and leave it pending for the owner. */
async function variationToOwnerReview(request: APIRequestContext, title: string) {
  const vo = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/variations`, {
    title,
    reason: 'Client requested an upgrade after the site inspection — rates checked against the supplier schedule.',
    triggerType: 'CLIENT_REQUEST',
    timeExtensionDays: 4,
    items: [{ description: 'Upgrade works', unit: 'sum', quantity: 1, unitRate: 250000 }],
  });
  expect(vo.status(), `variation ${title}: ${await vo.text()}`).toBeLessThan(300);
  const id = unwrap(await vo.json()).id;
  expect((await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/variations/${id}/submit`, {})).status()).toBeLessThan(300);
  expect((await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/variations/${id}/review`, { action: 'EVALUATE', comments: 'Rates verified.' })).status()).toBeLessThan(300);
  // Above QS authority → escalate to the owner.
  const esc = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/variations/${id}/review`, {
    action: 'APPROVE', comments: 'Above my limit — needs owner sign-off.',
  });
  expect(esc.status(), `escalate ${title}: ${await esc.text()}`).toBeLessThan(300);
}

test.describe.serial('K2 — owner layout and shared tabs at phone width', () => {
  test('0. fixture: tenant, owner, PM, project, two pending owner-review variations', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Faith Njeri');
    S.owner = await invite(request, S.admin, 'owner', 'OWNER', 'Peter Karanja');

    const p = await apiPost(request, S.admin, '/api/v1/projects', {
      name: 'K2 Layout Offices', code: `K2-${RUN}`, location: 'Kilimani, Nairobi',
      description: 'Office refurbishment — layout review fixture.', contractValue: '12000000',
      startDate: '2026-11-01', targetEndDate: '2027-03-31',
    });
    expect(p.status(), await p.text()).toBeLessThan(300);
    const pb = unwrap(await p.json()); S.projectId = pb.id || pb.project?.id;
    // PM + owner must be project members for review/escalation and dashboard.
    for (const [who, role] of [[S.pm!, 'PM_QS'], [S.owner!, 'OWNER']] as const) {
      const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: who.user.id, role });
      expect([200, 201, 409]).toContain(m.status());
    }

    await variationToOwnerReview(request, 'Additional basement waterproofing membrane and protection board');
    await variationToOwnerReview(request, 'Upgrade to low-iron glazing on the north elevation');
  });

  test('1. owner approvals: titles keep full width, chips drop to their own line', async ({ page }) => {
    await uiLogin(page, `owner.${RUN}@k2-layout.test`, page.getByText('Owner Portal'));
    await expect(page.getByText('Owner Portal')).toBeVisible({ timeout: 30_000 });

    const titles = page.locator('[data-testid="owner-approval-title"]');
    await expect(titles.first()).toBeVisible({ timeout: 20_000 });
    const count = await titles.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const box = await titles.nth(i).boundingBox();
      expect(box, `approval title ${i} has no box`).toBeTruthy();
      // Letter-per-line collapse produced ~2px-wide, very tall titles.
      expect(box!.width, `approval title ${i} squeezed to ${box!.width}px`).toBeGreaterThanOrEqual(100);
      expect(box!.height, `approval title ${i} wraps ${Math.round(box!.height / 18)} lines`).toBeLessThanOrEqual(80);
    }
    // The actionable approve button is still there for OWNER_REVIEW items.
    await expect(page.getByRole('button', { name: 'Owner Approve' }).first()).toBeVisible();
  });

  test('2. change-order filter tabs wrap instead of clipping', async ({ page }) => {
    await uiLogin(page, `owner.${RUN}@k2-layout.test`, page.getByText('Owner Portal'));
    const tabs = page.getByTestId('variation-filter-tabs');
    await expect(tabs).toBeVisible({ timeout: 20_000 });
    const m = await tabs.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(m.scroll, `filter tabs need ${m.scroll - m.client}px of hidden scroll`).toBeLessThanOrEqual(m.client + 1);
    // Every tab label fully visible — no mid-word clipping.
    for (const label of ['All', 'Draft', 'With PM review', 'Waiting for owner approval', 'Approved', 'Rejected', 'Void']) {
      await expect(tabs.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('3. console tab strips wrap — no clipped console tabs', async ({ page }) => {
    await uiLogin(page, `admin.${RUN}@k2-layout.test`, page.getByRole('button', { name: 'Projects' }).first());
    // Every tablist on the console home must fit without horizontal scroll.
    const tablists = page.locator('[role="tablist"]');
    const n = await tablists.count();
    expect(n, 'expected at least one console tablist').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const m = await tablists.nth(i).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      expect(m.scroll, `console tablist ${i} clipped by ${m.scroll - m.client}px`).toBeLessThanOrEqual(m.client + 1);
    }
    // Money → financial tracker inner tabs use the same shared strip.
    await page.goto('/app/money/financials');
    const finTabs = page.getByTestId('money-fin-tabs');
    await expect(finTabs).toBeVisible({ timeout: 20_000 });
    const fm = await finTabs.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(fm.scroll).toBeLessThanOrEqual(fm.client + 1);
  });
});
