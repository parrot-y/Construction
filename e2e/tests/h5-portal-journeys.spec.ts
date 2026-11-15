import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * ROUND H5 — PORTAL SCREENSHOT JOURNEYS FOR THE REMAINING PORTALS
 *
 * Link-to-action Playwright journeys with a screenshot at each step, on both
 * chromium and mobile-390, committed under
 * docs/evidence/visual/<commit>/portal-flows/:
 *
 *   supplier     — accept PO → confirm delivery → submit invoice
 *   compliance   — review statutory permits → record an inspection visit
 *   field        — foreman: today's diary → safety incident logged offline,
 *                  then synced exactly once when connectivity returns
 *   owner        — read dashboard → approve a pending change order
 *   public quote — view → accept with typed signature → contractor converts
 *                  with a deposit invoice
 *
 * Fixture: the dedicated demo tenant "Nyota Construction Ltd" (same pattern
 * as e2e/capture-visual.mjs) — realistic Kenyan names, never timestamped.
 * The tenant persists between runs; every run creates FRESH fixtures
 * (new PO, quote, variation, portal links) so journeys are re-runnable and
 * never collide with API-suite data.
 */

const PASSWORD = 'Password123!';
const SHA = execSync('git rev-parse --short HEAD', { cwd: `${__dirname}/..` }).toString().trim();
// Playwright's cwd is e2e/ — evidence lives at the repo root.
const SHOTS = `../docs/evidence/visual/${SHA}/portal-flows`;

const TENANT = {
  adminEmail: 'admin@nyota-builders.co.ke',
  adminName: 'Brian Ochieng',
  companyName: 'Nyota Construction Ltd',
};
const PROJECT_NAME = 'Kileleshwa Residential Villas';
const SUPPLIER_NAME = 'East Africa Cement Suppliers';
const MEMBERS = [
  { key: 'foreman', role: 'FOREMAN', name: 'Joseph Mwangi', email: 'foreman@nyota-builders.co.ke' },
  { key: 'owner', role: 'OWNER', name: 'Peter Karanja', email: 'owner@nyota-builders.co.ke' },
];

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

const S: {
  admin?: Session;
  projectId?: string;
  supplierId?: string;
  poId?: string;
  poNumber?: string;
  supplierToken?: string;
  complianceToken?: string;
  quoteId?: string;
  quoteToken?: string;
  variationId?: string;
} = {};

// ---------- tenant provisioning (idempotent, capture-visual pattern) ----------

async function apiLoginRaw(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
  return res.ok() ? res : null;
}

async function ensureAdmin(request: APIRequestContext): Promise<Session> {
  const existing = await apiLoginRaw(request, TENANT.adminEmail);
  if (existing) return login(request, TENANT.adminEmail, PASSWORD);
  const reg = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: TENANT.companyName,
      adminFullName: TENANT.adminName,
      adminEmail: TENANT.adminEmail,
      adminPhone: '+254712345001',
      password: PASSWORD,
    },
  });
  expect(reg.status(), `register-company: ${await reg.text()}`).toBe(201);
  return login(request, TENANT.adminEmail, PASSWORD);
}

async function ensureMember(request: APIRequestContext, admin: Session, m: typeof MEMBERS[number]): Promise<Session> {
  const existing = await apiLoginRaw(request, m.email);
  if (existing) return login(request, m.email, PASSWORD);
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email: m.email, role: m.role, fullName: m.name });
  expect(inv.status(), `invite ${m.key}: ${await inv.text()}`).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, {
    data: { token, email: m.email, fullName: m.name, password: PASSWORD },
  });
  expect(acc.status(), `accept ${m.key}: ${await acc.text()}`).toBeLessThan(300);
  return login(request, m.email, PASSWORD);
}

async function ensureProject(request: APIRequestContext, admin: Session): Promise<string> {
  const res = await apiGet(request, admin, '/api/v1/projects');
  const body = await res.json();
  const rows = Array.isArray(body) ? body : body.data || body.projects || [];
  const found = rows.find((p: any) => p.name === PROJECT_NAME);
  if (found) return found.id;
  const created = await apiPost(request, admin, '/api/v1/projects', {
    name: PROJECT_NAME,
    code: 'KIL-RES-01',
    location: 'Kileleshwa, Nairobi',
    description: 'Eight high-end residential villas with basement parking and lift.',
    contractValue: '84500000',
    startDate: '2026-01-12',
    targetEndDate: '2027-06-30',
  });
  expect(created.status(), `project create: ${await created.text()}`).toBeLessThan(300);
  const b = unwrap(await created.json());
  return b.id || b.project?.id;
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

// ---------- journeys ----------

test.describe.serial('H5 — portal screenshot journeys (Nyota demo tenant)', () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test('0. fixture: tenant, members, project, supplier+PO+delivery, permits, links, quote, variation', async ({ request }) => {
    S.admin = await ensureAdmin(request);
    const sessions = new Map<string, Session>();
    for (const m of MEMBERS) sessions.set(m.role, await ensureMember(request, S.admin, m));
    S.projectId = await ensureProject(request, S.admin);
    const pid = S.projectId!;

    // Field + owner roles must be project members to see the project.
    for (const role of ['FOREMAN', 'OWNER'] as const) {
      const who = sessions.get(role)!;
      const m = await apiPost(request, S.admin, `/api/v1/projects/${pid}/members`, { userId: who.user.id, role });
      expect([200, 201, 409]).toContain(m.status());
    }

    // OWNER is not an owner-side unlimited role — admin grants a KES
    // co-approval limit so the owner can finally approve within authority.
    const membersRes = await apiGet(request, S.admin, '/api/v1/company/members');
    const membersBody = await membersRes.json();
    const memberRows = Array.isArray(membersBody) ? membersBody : membersBody.data || [];
    const ownerRow = memberRows.find((r: any) => r.user?.email === 'owner@nyota-builders.co.ke');
    expect(ownerRow?.membershipId, 'owner membership row').toBeTruthy();
    const lim = await apiPatch(request, S.admin, `/api/v1/company/members/${ownerRow.membershipId}/co-approval-limit`, { limit: 5000000 });
    expect(lim.status(), `co-approval-limit: ${await lim.text()}`).toBe(200);

    // Supplier record (reuse by name so re-runs stay clean).
    const supList = await apiGet(request, S.admin, '/api/v1/suppliers');
    const supBody = await supList.json();
    const supRows = Array.isArray(supBody) ? supBody : supBody.data || [];
    let supplier = supRows.find((s: any) => s.name === SUPPLIER_NAME);
    if (!supplier) {
      const created = await apiPost(request, S.admin, '/api/v1/suppliers', {
        name: SUPPLIER_NAME,
        contactPerson: 'Ann Wambui',
        phone: '+254722555210',
        email: 'sales@eastafricacement.co.ke',
      });
      expect(created.status(), `supplier: ${await created.text()}`).toBe(201);
      supplier = unwrap(await created.json());
    }
    S.supplierId = supplier.id;

    // Fresh PO each run → ISSUED, awaiting supplier acceptance.
    const po = await apiPost(request, S.admin, `/api/v1/projects/${pid}/purchase-orders`, {
      supplierId: S.supplierId,
      notes: 'Cement and aggregates for Kileleshwa villas superstructure.',
      items: [
        { description: 'Cement 50kg (Bamburi)', unit: 'BAGS', quantity: 400, unitRate: 820 },
        { description: 'Ballast 20mm', unit: 'm3', quantity: 60, unitRate: 1450 },
      ],
    });
    expect(po.status(), `PO create: ${await po.text()}`).toBeLessThan(300);
    const poBody = unwrap(await po.json());
    S.poId = poBody.id || poBody.purchaseOrder?.id;
    const poDetail = await apiGet(request, S.admin, `/api/v1/projects/${pid}/purchase-orders/${S.poId}`);
    const poData = unwrap(await poDetail.json());
    S.poNumber = poData.poNumber || poData.po_number;
    const issued = await apiPost(request, S.admin, `/api/v1/projects/${pid}/purchase-orders/${S.poId}/issue`, {});
    expect(issued.status(), `PO issue: ${await issued.text()}`).toBe(200);

    // A pending site delivery bound to the supplier (the site diary is the
    // real channel — the supplier confirms/disputes it in the portal).
    const diary = await apiPost(request, S.admin, `/api/v1/projects/${pid}/site-diaries`, {
      entryDate: today(),
      weather: 'SUNNY_CLEAR',
      siteStatus: 'OPERATIONAL',
      generalNotes: 'Superstructure blockwork progressing on Levels 1–2.',
      laborHeadcounts: [
        { tradeType: 'Mason', headcount: 14 },
        { tradeType: 'Carpenter', headcount: 6 },
        { tradeType: 'Casual', headcount: 20 },
      ],
      deliveries: [
        {
          materialName: 'Cement 50kg (Bamburi)',
          quantity: '400.0000',
          unit: 'BAGS',
          supplierId: S.supplierId,
          deliveryNote: 'EAC-DN-4471',
        },
      ],
    });
    expect(diary.status(), `diary: ${await diary.text()}`).toBeLessThan(300);

    // NEMA permit on file so the compliance portal shows real data.
    const permits = await apiGet(request, S.admin, `/api/v1/projects/${pid}/permits`);
    const permitBody = unwrap(await permits.json());
    const permitRows = Array.isArray(permitBody) ? permitBody : permitBody.data || permitBody.permits || [];
    const hasNema = permitRows.some((p: any) => (p.permit_type || p.permitType) === 'NEMA_LICENSE');
    if (!hasNema) {
      const perm = await apiPost(request, S.admin, `/api/v1/projects/${pid}/permits`, {
        permitType: 'NEMA_LICENSE',
        permitNumber: 'NEMA/EIA/AL/2026/0412',
        issuer: 'National Environment Management Authority',
        issuedDate: iso(-30),
        expiryDate: iso(300),
        notes: 'Environmental Impact Assessment licence for the Kileleshwa villas project.',
      });
      expect(perm.status(), `permit: ${await perm.text()}`).toBeLessThan(300);
    }

    // Fresh portal links each run.
    const mkLink = async (portalType: string, extra: Record<string, unknown> = {}) => {
      const r = await apiPost(request, S.admin!, `/api/v1/projects/${pid}/portals/links`, {
        portalType,
        stakeholderName: portalType === 'SUPPLIER' ? SUPPLIER_NAME : 'NCA Compliance Office',
        expiresInDays: 30,
        ...extra,
      });
      expect(r.status(), `${portalType} link: ${await r.text()}`).toBeLessThan(300);
      return unwrap(await r.json()).token as string;
    };
    S.supplierToken = await mkLink('SUPPLIER', { supplierId: S.supplierId });
    S.complianceToken = await mkLink('COMPLIANCE');

    // Fresh public quote → SENT with a share token.
    const q = await apiPost(request, S.admin, '/api/v1/quotes', {
      title: 'Kileleshwa Villas — Phase 2 External Works',
      clientName: 'Nyota Residential Holdings',
      clientEmail: 'accounts@nyota-holdings.co.ke',
      siteLocation: 'Kileleshwa, Nairobi',
      currency: 'KES',
      taxPct: 16,
      depositPct: 30,
      terms: '50% advance on commencement; balance on practical completion. Prices firm for 30 days.',
      items: [
        { description: 'Paving, landscaping and external drainage', unit: 'sum', quantity: 1, unitRate: 2400000 },
        { description: 'Perimeter wall, gates and guardhouse', unit: 'sum', quantity: 1, unitRate: 1800000 },
      ],
    });
    expect(q.status(), `quote: ${await q.text()}`).toBeLessThan(300);
    const qBody = unwrap(await q.json());
    S.quoteId = qBody.quote?.id || qBody.id;
    const sent = await apiPost(request, S.admin, `/api/v1/quotes/${S.quoteId}/send`, { channel: 'link' });
    expect(sent.status(), `quote send: ${await sent.text()}`).toBeLessThan(300);
    S.quoteToken = (await sent.json()).shareToken;
    expect(S.quoteToken, 'share token').toBeTruthy();

    // Fresh change order → submitted → evaluated → pending owner approval.
    const vo = await apiPost(request, S.admin, `/api/v1/projects/${pid}/variations`, {
      title: 'Additional basement waterproofing',
      reason: 'Client requested upgraded basement tanking after the geotechnical review.',
      triggerType: 'CLIENT_REQUEST',
      timeExtensionDays: 5,
      items: [
        { description: 'Extra basement tanking membrane and protection board', unit: 'm2', quantity: 850, unitRate: 1450 },
        { description: 'Additional site supervision for tanking works', unit: 'day', quantity: 10, unitRate: 8500 },
      ],
    });
    expect(vo.status(), `variation: ${await vo.text()}`).toBeLessThan(300);
    const voBody = unwrap(await vo.json());
    S.variationId = voBody.id || voBody.variation?.id || voBody.data?.id;
    expect(S.variationId, 'variation id').toBeTruthy();
    const sub = await apiPost(request, S.admin, `/api/v1/projects/${pid}/variations/${S.variationId}/submit`, {});
    expect(sub.status(), `submit: ${await sub.text()}`).toBeLessThan(300);
    const evalRes = await apiPost(request, S.admin, `/api/v1/projects/${pid}/variations/${S.variationId}/review`, {
      action: 'EVALUATE',
      comments: 'Rates verified against the 2026 supplier schedule.',
    });
    expect(evalRes.status(), `evaluate: ${await evalRes.text()}`).toBeLessThan(300);
  });

  // -------------------------------------------------------------------------
  test('1. supplier portal: accept PO → confirm delivery → submit invoice', async ({ page, request }) => {
    await page.goto(`/?portal=supplier&token=${S.supplierToken}`);
    await expect(page.getByTestId('supplier-portal-view')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `${SHOTS}/h5-01-supplier-portal.png`, fullPage: true });

    // Accept the issued PO with an expected delivery date.
    const poCard = page.getByTestId(`supplier-po-${S.poNumber}`);
    await expect(poCard).toBeVisible({ timeout: 15000 });
    await poCard.getByTestId(`po-accept-date-${S.poNumber}`).fill(iso(14));
    await poCard.getByTestId(`po-accept-submit-${S.poNumber}`).click();
    await expect(page.getByText(/Purchase order accepted/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-02-supplier-po-accepted.png`, fullPage: true });

    // Confirm the pending delivery (earlier runs may leave confirmed copies
    // of the same docket — pick the one still awaiting supplier action).
    const delivery = page
      .getByTestId('supplier-delivery-EAC-DN-4471')
      .filter({ hasText: 'Scheduled / Dispatched' })
      .first();
    await expect(delivery).toBeVisible({ timeout: 15000 });
    await delivery.locator('input[placeholder*="invoice ref" i]').fill('EAC/INV/2026/1187');
    await delivery.getByRole('button', { name: 'Confirm Delivery' }).click();
    await expect(page.getByText('Delivery confirmed.')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-03-supplier-delivery-confirmed.png`, fullPage: true });

    // Submit an invoice against the accepted PO.
    await poCard.getByTestId(`po-invoice-open-${S.poNumber}`).click();
    await poCard.getByTestId(`po-invoice-ref-${S.poNumber}`).fill('EAC/INV/2026/1187');
    await poCard.getByTestId(`po-invoice-amount-${S.poNumber}`).fill('328000');
    await poCard.getByTestId(`po-invoice-submit-${S.poNumber}`).click();
    await expect(page.getByText(/Invoice submitted/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-04-supplier-invoice-submitted.png`, fullPage: true });

    // Server truth: PO accepted, delivery confirmed, invoice registered.
    const poAfter = unwrap(await (await apiGet(request, S.admin!, `/api/v1/projects/${S.projectId}/purchase-orders/${S.poId}`)).json());
    expect(String(poAfter.status)).toBe('ACCEPTED');
    const invRefs = (poAfter.invoices || []).map((i: any) => i.reference);
    expect(invRefs).toContain('EAC/INV/2026/1187');
  });

  // -------------------------------------------------------------------------
  test('2. compliance portal: review permits → record inspection visit', async ({ page, request }) => {
    await page.goto(`/?portal=compliance&token=${S.complianceToken}`);
    await expect(page.getByTestId('compliance-visits-card')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('NEMA/EIA/AL/2026/0412')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-05-compliance-permits.png`, fullPage: true });

    await page.getByTestId('visit-outcome-select').selectOption('CONDITIONAL');
    await page.getByTestId('visit-notes-input').fill('Pre-pour inspection for Level 3 slab — reinforcement and cover verified.');
    await page.getByTestId('visit-action-input').fill('Submit revised edge-protection detail for the stairwell opening');
    await page.getByTestId('record-visit-btn').click();
    await expect(page.getByText(/Visit recorded/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-06-compliance-visit-recorded.png`, fullPage: true });

    // Server truth: the visit + required action landed on the project register.
    const visits = await apiGet(request, S.admin!, `/api/v1/projects/${S.projectId}/compliance-visits`);
    const vBody = unwrap(await visits.json());
    const vRows = Array.isArray(vBody) ? vBody : vBody.data || vBody.visits || [];
    const mine = vRows.find((v: any) => /Pre-pour inspection for Level 3/.test(v.notes || ''));
    expect(mine, 'compliance visit recorded').toBeTruthy();
    expect(mine.outcome || mine.Outcome).toBe('CONDITIONAL');
  });

  // -------------------------------------------------------------------------
  test('3. field: foreman diary + offline safety incident then sync', async ({ page, context, request }) => {
    await uiLogin(page, 'foreman@nyota-builders.co.ke', page.getByRole('button', { name: 'Record diary' }));
    await page.screenshot({ path: `${SHOTS}/h5-07-field-today.png`, fullPage: true });

    // Daily site diary (online).
    await page.getByRole('button', { name: 'Record diary' }).click();
    await page.getByPlaceholder(/Activities completed/).fill('Blockwork to Level 2 complete; slab pour for Level 3 programmed tomorrow.');
    await page.getByRole('button', { name: /Record Daily Site Diary/ }).click();
    await expect(page.getByText(/Level 2 complete/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-08-field-diary-saved.png`, fullPage: true });

    // Baseline count — each run adds exactly one incident with this location.
    const countIncidents = async () => {
      const res = await apiGet(request, S.admin!, `/api/v1/projects/${S.projectId}/safety-incidents`);
      const body = await res.json();
      const rows = body.incidents || body.data || [];
      return rows.filter((i: any) => /Scaffolding Grid B-4/.test(i.exact_location || '')).length;
    };
    const baseline = await countIncidents();

    // Go offline, then log a safety incident — it must queue locally.
    await context.setOffline(true);
    await page.locator('button:visible', { hasText: /^Site$/ }).click();
    await page.getByRole('button', { name: 'Log Safety Incident' }).click();
    await page.locator('input[placeholder*="Scaffolding"]').fill('Scaffolding Grid B-4, Level 2');
    await page.locator('textarea[placeholder*="Detailed narrative"]').fill('A scaffold board slipped during strike — no injury, area cordoned immediately.');
    await page.getByPlaceholder(/First aid applied/).fill('Area cordoned, board removed, supervisor notified');
    await page.getByPlaceholder(/Retraining/).fill('Re-inspect all boards on Grid B before next shift');
    await page.getByRole('button', { name: 'Save Incident Entry' }).click();
    await expect(page.getByText(/Scaffolding Grid B-4/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-09-field-offline-queued.png`, fullPage: true });

    // Back online — the queued mutation replays exactly once via Idempotency-Key.
    await context.setOffline(false);
    await expect.poll(countIncidents, { timeout: 30000 }).toBe(baseline + 1);
    // Exactly once: give any duplicate replay a chance to land, then re-check.
    await page.waitForTimeout(3000);
    expect(await countIncidents()).toBe(baseline + 1);
    await page.screenshot({ path: `${SHOTS}/h5-10-field-synced.png`, fullPage: true });
  });

  // -------------------------------------------------------------------------
  test('4. owner: dashboard → approve pending change order', async ({ page, request }) => {
    await uiLogin(page, 'owner@nyota-builders.co.ke', page.getByText('Owner Portal'));
    await expect(page.getByText('Owner Portal')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${SHOTS}/h5-11-owner-dashboard.png`, fullPage: true });

    // The pending CO card carries an Approve button (approved ones don't).
    const coCard = page
      .locator('div.rounded-xl.border', { hasText: 'Additional basement waterproofing' })
      .filter({ has: page.getByRole('button', { name: 'Approve', exact: true }) })
      .last();
    await expect(coCard).toBeVisible({ timeout: 15000 });
    await coCard.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.fill('#app-dialog-input', 'Approved — proceed with the upgraded tanking as quoted.');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText(/is now APPROVED/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-12-owner-co-approved.png`, fullPage: true });

    // Server truth.
    const vo = await apiGet(request, S.admin!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}`);
    const voBody = unwrap(await vo.json());
    expect(String(voBody.status || voBody.variation?.status)).toBe('APPROVED');
  });

  // -------------------------------------------------------------------------
  test('5. public quote: view → accept → deposit invoice on convert', async ({ page, request }) => {
    await page.goto(`/?portal=quote&token=${S.quoteToken}`);
    await expect(page.getByText('Quotation')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Nyota Residential Holdings')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/h5-13-quote-view.png`, fullPage: true });

    await page.getByRole('button', { name: 'Accept Quote' }).click();
    await page.getByPlaceholder(/full legal name/).fill('Nyota Residential Holdings Ltd');
    await page.getByRole('button', { name: 'Confirm Acceptance' }).click();
    await expect(page.getByText(/Quote accepted/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/h5-14-quote-accepted.png`, fullPage: true });

    // Contractor converts the accepted quote and drafts the deposit invoice.
    const conv = await apiPost(request, S.admin!, `/api/v1/quotes/${S.quoteId}/convert`, { createDepositInvoice: true });
    expect(conv.status(), `convert: ${await conv.text()}`).toBeLessThan(300);
    const convBody = await conv.json();
    const depositId = convBody.depositInvoice?.id || convBody.deposit_invoice?.id || convBody.data?.depositInvoice?.id;
    expect(depositId, 'deposit invoice drafted').toBeTruthy();

    // Deposit invoice is visible to staff with VAT semantics preserved.
    const invs = await apiGet(request, S.admin!, '/api/v1/invoices');
    const invBody = await invs.json();
    const invRows = Array.isArray(invBody) ? invBody : invBody.data || invBody.invoices || [];
    const deposit = invRows.find((i: any) => /Deposit 30%/.test(i.title || ''));
    expect(deposit, 'deposit invoice on the invoice register').toBeTruthy();
    expect(Number(deposit.balance_due ?? deposit.balanceDue)).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/h5-15-quote-converted.png`, fullPage: true });
  });
});
