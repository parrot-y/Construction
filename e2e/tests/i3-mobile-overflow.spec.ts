import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * ROUND I3 — NO HORIZONTAL PAGE OVERFLOW AT 390px
 *
 * Visits every portal screen and the console screens named in the audit
 * (QS retention console, owner dashboard) against real seeded data and
 * asserts document.scrollWidth <= window.innerWidth. Runs on both
 * playwright projects; the mobile-390 project is the binding check.
 *
 * Fresh company per run — realistic fixtures, no timestamped names in
 * user-facing strings where avoidable.
 */

const RUN = Date.now();
const PASSWORD = 'I3Overflow#2026';
const TRADE = `I3 Electricals ${RUN}`;

const S: {
  admin?: Session;
  pm?: Session;
  owner?: Session;
  projectId?: string;
  pkgId?: string;
  releaseId?: string;
  tokens: Record<string, string>;
  quoteToken?: string;
} = { tokens: {} };

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@i3-overflow.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `I3 Build Contractors ${RUN}`, adminFullName: 'Anne Wanjiru', email, phone: '+254712000999', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@i3-overflow.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

async function newProject(request: APIRequestContext, owner: Session): Promise<string> {
  const q = await apiPost(request, owner, '/api/v1/quotes', {
    title: `Kileleshwa Office Fit-Out ${RUN}`, clientName: 'Delta Properties Ltd', clientEmail: `c.${RUN}@i3-overflow.test`, siteLocation: 'Kileleshwa, Nairobi',
    currency: 'KES', taxPct: 16, depositPct: 30, items: [{ description: 'Office fit-out works', unit: 'sum', quantity: 1, unitRate: 8000000 }],
  });
  expect(q.status(), await q.text()).toBe(201);
  const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
  const sent = await (await apiPost(request, owner, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
  await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Delta Properties Ltd' } });
  const c = await apiPost(request, owner, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
  expect(c.status(), await c.text()).toBe(201);
  return (await c.json()).project.id;
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

async function expectNoXOverflow(page: Page, label: string) {
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    bodyScrollW: document.body.scrollWidth,
  }));
  const widest = Math.max(m.scrollW, m.bodyScrollW);
  expect(
    widest,
    `${label}: horizontal page overflow — content ${widest}px wide in a ${m.innerW}px viewport`,
  ).toBeLessThanOrEqual(m.innerW + 1);
}

test.describe.serial('I3 — 390px overflow gate across portals and console', () => {
  test('0. fixture: tenant, project, supplier/PO/delivery, permit, sub retention, links, quote', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'qs', 'PM_QS', 'Jane Wambui');
    S.owner = await invite(request, S.admin, 'owner', 'OWNER', 'Peter Kamau');
    S.projectId = await newProject(request, S.admin);
    const pid = S.projectId!;

    for (const who of [S.pm!, S.owner!]) {
      const role = who === S.pm ? 'PM_QS' : 'OWNER';
      const m = await apiPost(request, S.admin, `/api/v1/projects/${pid}/members`, { userId: who.user.id, role });
      expect([200, 201, 409]).toContain(m.status());
    }

    // Supplier + issued PO + pending delivery (site diary channel).
    const sup = await apiPost(request, S.admin, '/api/v1/suppliers', {
      name: 'Savannah Hardware Ltd', contactPerson: 'Mary Atieno', phone: '+254733444555',
    });
    expect(sup.status(), await sup.text()).toBe(201);
    const supplierId = unwrap(await sup.json()).id;

    const po = await apiPost(request, S.admin, `/api/v1/projects/${pid}/purchase-orders`, {
      supplierId,
      notes: 'Electrical cable, fittings and distribution boards.',
      items: [
        { description: 'Copper cable 2.5mm', unit: 'METERS', quantity: 2000, unitRate: 95 },
        { description: 'DB board 12-way', unit: 'NOS', quantity: 8, unitRate: 14500 },
      ],
    });
    expect(po.status(), await po.text()).toBeLessThan(300);
    const poId = unwrap(await po.json()).id || unwrap(await po.json()).purchaseOrder?.id;
    expect((await apiPost(request, S.admin, `/api/v1/projects/${pid}/purchase-orders/${poId}/issue`, {})).status()).toBe(200);

    const diary = await apiPost(request, S.admin, `/api/v1/projects/${pid}/site-diaries`, {
      entryDate: today(),
      weather: 'SUNNY_CLEAR',
      siteStatus: 'OPERATIONAL',
      generalNotes: 'First-fix electrical containment underway on Level 1.',
      deliveries: [
        { materialName: 'Copper cable 2.5mm', quantity: '2000.0000', unit: 'METERS', supplierId, deliveryNote: 'SH-DN-2091' },
      ],
    });
    expect(diary.status(), `diary: ${await diary.text()}`).toBeLessThan(300);

    // Statutory permit so the compliance portal tables carry rows.
    const perm = await apiPost(request, S.admin, `/api/v1/projects/${pid}/permits`, {
      permitType: 'NEMA_LICENSE',
      permitNumber: 'NEMA/EIA/AL/2026/0788',
      issuer: 'National Environment Management Authority',
      issuedDate: iso(-45),
      expiryDate: iso(320),
      notes: 'EIA licence covering fit-out works and waste disposal.',
    });
    expect(perm.status(), `permit: ${await perm.text()}`).toBeLessThan(300);

    // Subcontractor package → closed snag → valuation approved → retention request.
    const pkg = await apiPost(request, S.admin, `/api/v1/projects/${pid}/subcontractors`, {
      tradeCategory: TRADE, firmName: TRADE, subcontractSum: '400000.00', retentionRatePct: '10.00', status: 'ACTIVE',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
    const pkgBody = unwrap(await pkg.json());
    S.pkgId = pkgBody.id || pkgBody.package?.id || pkgBody.data?.id;

    const snag = await apiPost(request, S.admin, `/api/v1/projects/${pid}/snags`, {
      locationFloor: 'Ground', locationRoom: 'Main incomer', tradeCategory: TRADE,
      description: 'DB incomer torque marks missing', severity: 'MINOR',
    });
    const snagId = unwrap(await snag.json()).id || unwrap(await snag.json()).snag?.id;
    for (const st of ['IN_PROGRESS', 'READY_FOR_REVIEW', 'VERIFIED_CLOSED']) {
      expect((await apiPatch(request, S.admin, `/api/v1/projects/${pid}/snags/${snagId}/status`, { status: st })).status()).toBeLessThan(300);
    }

    const mkLink = async (portalType: string, extra: Record<string, unknown> = {}) => {
      const r = await apiPost(request, S.admin!, `/api/v1/projects/${pid}/portals/links`, {
        portalType, stakeholderName: `${portalType} contact`, expiresInDays: 30, ...extra,
      });
      expect(r.status(), `${portalType} link: ${await r.text()}`).toBeLessThan(300);
      return unwrap(await r.json()).token as string;
    };

    S.tokens.SUBCONTRACTOR = await mkLink('SUBCONTRACTOR', { stakeholderName: TRADE, subcontractorPackageId: S.pkgId });
    S.tokens.SUPPLIER = await mkLink('SUPPLIER', { stakeholderName: 'Savannah Hardware Ltd', supplierId });
    S.tokens.COMPLIANCE = await mkLink('COMPLIANCE');
    S.tokens.CONSULTANT = await mkLink('CONSULTANT');
    S.tokens.CLIENT = await mkLink('CLIENT');

    // Valuation → approved → retention held → release request (pending row for console).
    const submit = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokens.SUBCONTRACTOR}/valuations`, {
      data: { grossWorkCertifiedKes: '200000.00', notes: 'First electrical claim' },
    });
    expect(submit.status(), await submit.text()).toBe(201);
    const valId = unwrap(await submit.json()).id || unwrap(await submit.json()).valuation?.id;
    const valPath = `/api/v1/projects/${pid}/subcontractor-valuations/${valId}`;
    expect((await apiPatch(request, S.pm!, valPath, { paymentStatus: 'UNDER_REVIEW' })).status()).toBeLessThan(300);
    expect((await apiPatch(request, S.admin, valPath, {
      paymentStatus: 'APPROVED_FOR_PAYMENT', tccOverrideReason: 'KRA TCC renewal in progress, client-approved for e2e',
    })).status()).toBeLessThan(300);

    const rel = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokens.SUBCONTRACTOR}/retention-release`);
    expect(rel.status(), await rel.text()).toBe(201);
    const relBody = unwrap(await rel.json());
    S.releaseId = relBody.id || relBody.release?.id || relBody.data?.id;

    // Public quote page fixture.
    const q = await apiPost(request, S.admin, '/api/v1/quotes', {
      title: 'Fit-out Phase 2 — Partitions', clientName: 'Delta Properties Ltd', clientEmail: `q.${RUN}@i3-overflow.test`,
      siteLocation: 'Kileleshwa, Nairobi', currency: 'KES', taxPct: 16, depositPct: 30,
      items: [{ description: 'Partition walls and ceilings', unit: 'sum', quantity: 1, unitRate: 1200000 }],
    });
    const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
    const sent = await (await apiPost(request, S.admin, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
    S.quoteToken = sent.shareToken || sent.share_token;
  });

  test('1. supplier portal has no horizontal overflow', async ({ page }) => {
    await page.goto(`/?portal=supplier&token=${S.tokens.SUPPLIER}`);
    await expect(page.getByTestId('supplier-portal-view')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('supplier-action-needed')).toBeVisible({ timeout: 15000 });
    await expectNoXOverflow(page, 'supplier portal');
  });

  test('2. compliance portal has no horizontal overflow', async ({ page }) => {
    await page.goto(`/?portal=compliance&token=${S.tokens.COMPLIANCE}`);
    await expect(page.getByTestId('compliance-visits-card')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('NEMA/EIA/AL/2026/0788')).toBeVisible({ timeout: 15000 });
    await expectNoXOverflow(page, 'compliance portal');
  });

  test('3. subcontractor portal has no horizontal overflow', async ({ page }) => {
    await page.goto(`/?portal=subcontractor&token=${S.tokens.SUBCONTRACTOR}`);
    await page.getByRole('button', { name: /Trade Valuations/ }).click();
    await expect(page.getByTestId('sub-retention-release-card')).toBeVisible({ timeout: 20000 });
    await expectNoXOverflow(page, 'subcontractor portal');
  });

  test('4. consultant portal has no horizontal overflow', async ({ page }) => {
    await page.goto(`/?portal=consultant&token=${S.tokens.CONSULTANT}`);
    await expect(page.getByTestId('consultant-portal-view')).toBeVisible({ timeout: 20000 });
    await expectNoXOverflow(page, 'consultant portal');
  });

  test('5. client portal has no horizontal overflow', async ({ page }) => {
    await page.goto(`/?portal=client&token=${S.tokens.CLIENT}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expectNoXOverflow(page, 'client portal');
  });

  test('6. public quote page has no horizontal overflow', async ({ page }) => {
    await page.goto(`/?portal=quote&token=${S.quoteToken}`);
    await expect(page.getByText('Quotation')).toBeVisible({ timeout: 20000 });
    await expectNoXOverflow(page, 'public quote');
  });

  test('7. QS retention console has no horizontal overflow', async ({ page }) => {
    await uiLogin(page, `admin.${RUN}@i3-overflow.test`, page.getByRole('button', { name: 'Projects' }).first());
    await page.goto('/app/money/financials');
    const retentionTab = page.getByRole('button', { name: 'retention' }).first();
    await expect(retentionTab).toBeVisible({ timeout: 30_000 });
    await retentionTab.click();
    await expect(page.locator('tr', { hasText: TRADE }).first()).toBeVisible({ timeout: 20_000 });
    await expectNoXOverflow(page, 'QS retention console');
  });

  test('8. owner dashboard has no horizontal overflow', async ({ page }) => {
    await uiLogin(page, `owner.${RUN}@i3-overflow.test`, page.getByText('Owner Portal'));
    await expect(page.getByText('Owner Portal')).toBeVisible({ timeout: 30_000 });
    await expectNoXOverflow(page, 'owner dashboard');
  });
});
