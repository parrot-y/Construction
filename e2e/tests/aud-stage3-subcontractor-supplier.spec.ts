import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * STAGE 3 — SUBCONTRACTOR AND SUPPLIER JOURNEY (auditor-written acceptance test)
 *
 * Personas: Umeme Sparks Ltd (electrical subcontractor) and Bamburi Mart (cement
 * supplier). They use a phone and a link, no account. They need to know: what am
 * I owed, why was I short-paid, did you receive my invoice, what must I fix.
 * The contractor needs: nobody sees a competitor's money, nobody is paid without
 * a valid TCC, what was ordered matches what arrived matches what is billed.
 *
 * Real API + real DB + real browser, no stubs. "NEW CONTRACT" steps test behaviour
 * that does not exist yet and are written to FAIL until it is built. Do not weaken
 * an assertion; change the feature. If a route name differs, change CONTRACT below
 * and say so in the PR, but keep the behaviour asserted.
 */

const CONTRACT = {
  // NEW CONTRACT: purchase orders with lines, tied to a supplier.
  createPO: (p: string) => `/api/v1/projects/${p}/purchase-orders`,
  getPOMatch: (p: string, po: string) => `/api/v1/projects/${p}/purchase-orders/${po}/match`,
  supplierAcceptPO: (t: string, po: string) => `/api/v1/portals/supplier/${t}/purchase-orders/${po}/accept`,
  supplierInvoice: (t: string, po: string) => `/api/v1/portals/supplier/${t}/purchase-orders/${po}/invoices`,
};

const RUN = Date.now();
const PASSWORD = 'Stage3#2026pass';
const money = (v: unknown) => Number(String(v ?? '0').replace(/,/g, ''));
const rowsOf = (b: any): any[] => {
  const u = unwrap(b);
  return Array.isArray(u) ? u : u?.items || u?.rows || u?.data || Object.values(u || {}).find(Array.isArray) || [];
};

const S: {
  admin?: Session; pm?: Session; sup?: Session; projectId?: string; today?: string;
  pkgA?: string; pkgB?: string; tokA?: string; tokB?: string; linkA?: string;
  valA?: string; valA2?: string; supTokA?: string; supTokB?: string; poId?: string; poItemId?: string;
  snagId?: string; nullNameDelivery?: string; deliveryB?: string;
} = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@stage3-e2e.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `Nairobi Builders ${RUN}`, adminFullName: 'Wanjiru Kamau', email, phone: '+254712000333', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}
async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@stage3-e2e.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}
async function link(request: APIRequestContext, body: any) {
  const r = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/portals/links`, { expiresInDays: 14, ...body });
  expect(r.status(), await r.text()).toBe(201);
  return unwrap(await r.json());
}
const valPath = (id: string) => `/api/v1/projects/${S.projectId}/subcontractor-valuations/${id}`;

test.describe.serial('Stage 3 — subcontractor and supplier', () => {
  // ---------------------------------------------------------------------------
  test('0. Setup: company, project, two subcontractors, two suppliers', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Otieno Odhiambo');
    S.sup = await invite(request, S.admin, 'sup', 'SITE_SUPERVISOR', 'Mwangi Njoroge');
    S.today = new Date().toISOString().slice(0, 10);

    const q = await apiPost(request, S.admin, '/api/v1/quotes', {
      title: `Kilimani Offices ${RUN}`, clientName: 'Dr. Evans Kiprop', clientEmail: `c.${RUN}@stage3-e2e.test`,
      siteLocation: 'Kilimani, Nairobi', currency: 'KES', taxPct: 16, depositPct: 30,
      items: [{ description: 'Fit-out', unit: 'sum', quantity: 1, unitRate: 5000000 }],
    });
    expect(q.status(), await q.text()).toBe(201);
    const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
    const sent = await (await apiPost(request, S.admin, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
    await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
    const c = await apiPost(request, S.admin, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
    expect(c.status(), await c.text()).toBe(201);
    S.projectId = (await c.json()).project.id;
    for (const [u, role] of [[S.pm, 'PM_QS'], [S.sup, 'SITE_SUPERVISOR']] as const) {
      const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: u!.user.id, role });
      expect([200, 201, 409]).toContain(m.status());
    }
    const mk = async (trade: string, firm: string, sum: string) => {
      const r = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/subcontractors`, {
        tradeCategory: trade, firmName: firm, subcontractSum: sum, retentionRatePct: '5.00',
      });
      expect(r.status(), await r.text()).toBeLessThan(300);
      return unwrap(await r.json()).id || unwrap(await r.json()).package?.id;
    };
    S.pkgA = await mk('Electrical', 'Umeme Sparks Ltd', '800000.00');
    S.pkgB = await mk('Plumbing', 'Maji Safi Plumbers', '600000.00');
  });

  // ---------------------------------------------------------------------------
  test('1. Each subcontractor sees only their own money and snags', async ({ request }) => {
    // A subcontractor link must be tied to one package. No package, no link.
    const bad = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/portals/links`, {
      portalType: 'SUBCONTRACTOR', stakeholderName: 'Nobody Ltd', expiresInDays: 7,
    });
    expect(bad.status(), 'a subcontractor link without a package must be refused').toBeGreaterThanOrEqual(400);

    const A = await link(request, { portalType: 'SUBCONTRACTOR', stakeholderName: 'Umeme Sparks Ltd', stakeholderRole: 'Electrical', subcontractorPackageId: S.pkgA });
    const B = await link(request, { portalType: 'SUBCONTRACTOR', stakeholderName: 'Maji Safi Plumbers', stakeholderRole: 'Plumbing', subcontractorPackageId: S.pkgB });
    S.tokA = A.token; S.tokB = B.token; S.linkA = A.id || A.link?.id;

    const va = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokA}/valuations`, { data: { grossWorkCertifiedKes: '200000.00', notes: 'First fix' } });
    expect(va.status(), await va.text()).toBe(201);
    S.valA = unwrap(await va.json()).id;
    const vb = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokB}/valuations`, { data: { grossWorkCertifiedKes: '150000.00', notes: 'Rough-in' } });
    expect(vb.status(), await vb.text()).toBe(201);

    const aSees = JSON.stringify(await (await request.get(`${API}/api/v1/portals/subcontractor/${S.tokA}`)).json());
    expect(aSees).toContain('200000');
    expect(aSees, 'A must not see B money or firm').not.toMatch(/Maji Safi|150000/);
    const bSees = JSON.stringify(await (await request.get(`${API}/api/v1/portals/subcontractor/${S.tokB}`)).json());
    expect(bSees).not.toMatch(/Umeme Sparks|200000/);
  });

  // ---------------------------------------------------------------------------
  test('2. No payment without a valid tax compliance certificate [NEW CONTRACT]', async ({ request }) => {
    const verify = await apiPatch(request, S.pm!, valPath(S.valA!), { paymentStatus: 'UNDER_REVIEW' });
    expect(verify.status(), await verify.text()).toBeLessThan(300);

    // No TCC on file: approval for payment must be refused with a clear reason.
    const noTcc = await apiPatch(request, S.admin!, valPath(S.valA!), { paymentStatus: 'APPROVED_FOR_PAYMENT' });
    expect(noTcc.status(), 'no TCC on file must block approval').toBe(409);
    expect(JSON.stringify(await noTcc.json())).toMatch(/TCC|tax compliance/i);

    // Expired TCC: still blocked.
    const expired = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/subcontractor-tcc`, {
      subcontractorPackageId: S.pkgA, pinNumber: 'P051234567A', taxpayerName: 'Umeme Sparks Ltd', tccNumber: `TCC-${RUN}-OLD`,
      tccExpiryDate: '2024-01-31', complianceStatus: 'COMPLIANT',
    });
    expect(expired.status(), await expired.text()).toBeLessThan(300);
    const stillBlocked = await apiPatch(request, S.admin!, valPath(S.valA!), { paymentStatus: 'APPROVED_FOR_PAYMENT' });
    expect(stillBlocked.status(), 'expired TCC must block approval').toBe(409);

    // Valid TCC: allowed. (Record a current one.)
    const next = new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const ok = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/subcontractor-tcc`, {
      subcontractorPackageId: S.pkgA, pinNumber: 'P051234567A', taxpayerName: 'Umeme Sparks Ltd', tccNumber: `TCC-${RUN}-NEW`,
      tccExpiryDate: next, complianceStatus: 'COMPLIANT',
    });
    expect(ok.status(), await ok.text()).toBeLessThan(300);
    const approve = await apiPatch(request, S.admin!, valPath(S.valA!), { paymentStatus: 'APPROVED_FOR_PAYMENT' });
    expect(approve.status(), await approve.text()).toBeLessThan(300);
  });

  // ---------------------------------------------------------------------------
  test('3. Payment posts once and the subcontractor sees exactly what they got [NEW CONTRACT]', async ({ request }) => {
    const costOf = async () => {
      const b = unwrap(await (await apiGet(request, S.pm!, `/api/v1/projects/${S.projectId}/budget/summary`)).json());
      return money(b?.approvedCost ?? b?.summary?.approvedCost);
    };
    const afterApprove = await costOf();
    expect(afterApprove).toBeGreaterThan(0);

    const paid = await apiPatch(request, S.admin!, valPath(S.valA!), { paymentStatus: 'PAID', paymentReference: `MPESA-${RUN % 100000}`, paidAt: S.today });
    expect(paid.status(), await paid.text()).toBeLessThan(300);
    expect(await costOf(), 'PAID must not post the cost a second time').toBe(afterApprove);

    // Replaying the same transition must not double-post either.
    await apiPatch(request, S.admin!, valPath(S.valA!), { paymentStatus: 'PAID' });
    expect(await costOf()).toBe(afterApprove);

    // 200,000 gross, 5% retention, 3% WHT on the balance basis agreed in tax settings.
    const portal = unwrap(await (await request.get(`${API}/api/v1/portals/subcontractor/${S.tokA}`)).json());
    const v = JSON.stringify(portal);
    expect(v, 'subcontractor must see the payment reference').toContain(`MPESA-${RUN % 100000}`);
    expect(v, 'subcontractor must see the paid date').toContain(S.today!);
    const row = (portal.valuations || portal.data?.valuations || []).find((x: any) => x.id === S.valA);
    expect(money(row.retentionDeductedKes)).toBe(10000);
    expect(money(row.netPayableKes)).toBeGreaterThan(0);
    expect(money(row.netPayableKes)).toBeLessThan(200000);

    // NEW CONTRACT: package summary so the sub knows where they stand.
    const sum = portal.packageSummary || portal.data?.packageSummary;
    expect(sum, 'portal must show a package summary').toBeTruthy();
    expect(money(sum.contractSum)).toBe(800000);
    expect(money(sum.certifiedToDate)).toBe(200000);
    expect(money(sum.remaining)).toBe(600000);
    expect(money(sum.retentionHeld)).toBe(10000);
  });

  // ---------------------------------------------------------------------------
  test('4. Over-claim refused; rejected claim shows the reason and can be resubmitted [NEW CONTRACT]', async ({ request }) => {
    // Total claims may not exceed the package sum (200,000 certified + 700,000 > 800,000).
    const over = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokA}/valuations`, { data: { grossWorkCertifiedKes: '700000.00' } });
    expect(over.status()).toBe(400);

    const v2 = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokA}/valuations`, { data: { grossWorkCertifiedKes: '300000.00', notes: 'Second fix' } });
    expect(v2.status(), await v2.text()).toBe(201);
    S.valA2 = unwrap(await v2.json()).id;

    // Staff reject with a reason (reason is mandatory).
    const noReason = await apiPatch(request, S.pm!, valPath(S.valA2!), { paymentStatus: 'REJECTED' });
    expect(noReason.status(), 'a rejection without a reason must be refused').toBeGreaterThanOrEqual(400);
    const rej = await apiPatch(request, S.pm!, valPath(S.valA2!), { paymentStatus: 'REJECTED', notes: 'Second fix not inspected yet, resubmit after DB board test' });
    expect(rej.status(), await rej.text()).toBeLessThan(300);

    const portal = JSON.stringify(await (await request.get(`${API}/api/v1/portals/subcontractor/${S.tokA}`)).json());
    expect(portal, 'the sub must see why it was rejected').toContain('resubmit after DB board test');

    // A rejected claim does not count against the package cap: 300,000 can be claimed again.
    const again = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokA}/valuations`, { data: { grossWorkCertifiedKes: '300000.00', notes: 'Resubmitted after board test', replacesValuationId: S.valA2 } });
    expect(again.status(), await again.text()).toBe(201);
  });

  // ---------------------------------------------------------------------------
  test('5. Snags: only my trade, rectify with a real photo, supervisor closes', async ({ request }) => {
    const snag = await apiPost(request, S.sup!, `/api/v1/projects/${S.projectId}/snags`, {
      locationFloor: '2nd', locationRoom: 'Server room', tradeCategory: 'Electrical',
      description: 'DB board not labelled and earth not tested', severity: 'MAJOR',
    });
    expect(snag.status(), await snag.text()).toBeLessThan(300);
    S.snagId = unwrap(await snag.json()).id || unwrap(await snag.json()).snag?.id;

    const a = JSON.stringify(await (await request.get(`${API}/api/v1/portals/subcontractor/${S.tokA}`)).json());
    const b = JSON.stringify(await (await request.get(`${API}/api/v1/portals/subcontractor/${S.tokB}`)).json());
    expect(a).toContain('DB board not labelled');
    expect(b, 'plumber must not see the electrician snag').not.toContain('DB board not labelled');

    // Plumber cannot rectify the electrician's snag.
    const cross = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokB}/snags/${S.snagId}/rectify`, { data: { note: 'fixed' } });
    expect([403, 404]).toContain(cross.status());

    // Photo key not issued for this project is refused (no free-text storage keys).
    const fake = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokA}/snags/${S.snagId}/rectify`, { data: { note: 'fixed', photoStorageKey: 'uploads/other-tenant/secret.jpg' } });
    expect(fake.status()).toBeGreaterThanOrEqual(400);

    const ok = await request.post(`${API}/api/v1/portals/subcontractor/${S.tokA}/snags/${S.snagId}/rectify`, { data: { note: 'Labelled and earth tested, 0.3 ohms' } });
    expect(ok.status(), await ok.text()).toBeLessThan(300);

    // Supervisor is told and can close it; only then does it count as closed.
    const inbox = JSON.stringify(await (await apiGet(request, S.sup!, '/api/v1/inbox')).json());
    expect(inbox).toMatch(/rectif|Umeme Sparks/i);
    const close = await apiPatch(request, S.sup!, `/api/v1/projects/${S.projectId}/snags/${S.snagId}/status`, { status: 'VERIFIED_CLOSED', verifiedByName: 'Mwangi Njoroge' });
    expect(close.status(), await close.text()).toBeLessThan(300);
  });

  // ---------------------------------------------------------------------------
  test('6. Purchase order to supplier, accepted, delivered, invoiced, matched [NEW CONTRACT]', async ({ request }) => {
    const po = await apiPost(request, S.pm!, CONTRACT.createPO(S.projectId!), {
      supplierName: 'Bamburi Mart', notes: 'Delivery to Kilimani site gate B',
      items: [{ description: 'Cement 50kg bag', unit: 'bag', quantity: 200, unitRate: 780 }],
    });
    expect(po.status(), `purchase orders must exist. Body: ${await po.text()}`).toBe(201);
    const p = unwrap(await po.json());
    S.poId = p.id || p.purchaseOrder?.id;
    S.poItemId = (p.items || p.purchaseOrder?.items || [])[0]?.id;
    expect(S.poId).toBeTruthy();

    const A = await link(request, { portalType: 'SUPPLIER', stakeholderName: 'Bamburi Mart', stakeholderRole: 'Cement' });
    const B = await link(request, { portalType: 'SUPPLIER', stakeholderName: 'Chuma Steel', stakeholderRole: 'Steel' });
    S.supTokA = A.token; S.supTokB = B.token;

    // Supplier sees their own order, with the total, and nobody else's.
    const mine = JSON.stringify(await (await request.get(`${API}/api/v1/portals/supplier/${S.supTokA}`)).json());
    expect(mine).toContain('Cement 50kg bag');
    expect(mine).toContain('156000');
    const theirs = JSON.stringify(await (await request.get(`${API}/api/v1/portals/supplier/${S.supTokB}`)).json());
    expect(theirs, 'another supplier must not see this order').not.toContain('Cement 50kg bag');

    // Accept the order.
    const acc = await request.post(`${API}${CONTRACT.supplierAcceptPO(S.supTokA!, S.poId!)}`, { data: { expectedDeliveryDate: S.today } });
    expect(acc.status(), await acc.text()).toBeLessThan(300);
    const acc2 = await request.post(`${API}${CONTRACT.supplierAcceptPO(S.supTokB!, S.poId!)}`, { data: {} });
    expect([403, 404], 'a different supplier cannot accept').toContain(acc2.status());

    // Site records a delivery against the PO (150 of 200 bags).
    const d = await apiPost(request, S.sup!, `/api/v1/projects/${S.projectId}/site-diaries`, {
      projectId: S.projectId, entryDate: S.today, weather: 'SUNNY_CLEAR', siteStatus: 'OPERATIONAL',
      deliveries: [{ materialName: 'Cement 50kg bag', quantity: '150', unit: 'bag', supplierName: 'Bamburi Mart', deliveryNote: 'DN-4411', purchaseOrderId: S.poId, purchaseOrderItemId: S.poItemId }],
    }, { 'idempotency-key': `s3-d1-${RUN}` });
    expect(d.status(), await d.text()).toBe(201);

    const sp = unwrap(await (await request.get(`${API}/api/v1/portals/supplier/${S.supTokA}`)).json());
    const del = (sp.deliveries || sp.data?.deliveries || []).find((x: any) => x.deliveryNote === 'DN-4411');
    expect(del, 'supplier sees the delivery').toBeTruthy();
    const conf = await request.post(`${API}/api/v1/portals/supplier/${S.supTokA}/deliveries/${del.id}/confirm`, { data: { action: 'CONFIRM' } });
    expect(conf.status(), await conf.text()).toBeLessThan(300);

    // Invoice for more than was delivered is flagged, not silently accepted.
    const over = await request.post(`${API}${CONTRACT.supplierInvoice(S.supTokA!, S.poId!)}`, { data: { invoiceRef: 'BM-INV-901', amount: 156000 } });
    expect(over.status(), await over.text()).toBeLessThan(300);
    const match = unwrap(await (await apiGet(request, S.pm!, CONTRACT.getPOMatch(S.projectId!, S.poId!))).json());
    expect(money(match.ordered?.quantity ?? match.orderedQty)).toBe(200);
    expect(money(match.delivered?.quantity ?? match.deliveredQty)).toBe(150);
    expect(money(match.invoiced?.amount ?? match.invoicedAmount)).toBe(156000);
    expect(String(match.status), 'billed for 200 bags, only 150 delivered: must not read MATCHED').toMatch(/OVER_INVOICED|MISMATCH|REVIEW/i);

    // Correct invoice for what arrived: 150 x 780 = 117,000.
    const good = await request.post(`${API}${CONTRACT.supplierInvoice(S.supTokA!, S.poId!)}`, { data: { invoiceRef: 'BM-INV-902', amount: 117000, replacesInvoiceRef: 'BM-INV-901' } });
    expect(good.status(), await good.text()).toBeLessThan(300);
    const m2 = unwrap(await (await apiGet(request, S.pm!, CONTRACT.getPOMatch(S.projectId!, S.poId!))).json());
    expect(String(m2.status)).toMatch(/MATCHED|PARTIALLY_DELIVERED/i);
    expect(String(m2.status)).not.toMatch(/OVER_INVOICED|MISMATCH/i);
  });

  // ---------------------------------------------------------------------------
  test('7. A supplier can never see or touch another supplier\'s deliveries', async ({ request }) => {
    // A delivery recorded with NO supplier name must not be visible to every supplier.
    const noName = await apiPost(request, S.sup!, `/api/v1/projects/${S.projectId}/site-diaries`, {
      projectId: S.projectId, entryDate: S.today, weather: 'SUNNY_CLEAR', siteStatus: 'OPERATIONAL',
      deliveries: [{ materialName: 'Mystery sand lorry', quantity: '10', unit: 't', deliveryNote: 'DN-NONAME' }],
    }, { 'idempotency-key': `s3-d2-${RUN}` });
    expect([200, 201], await noName.text()).toContain(noName.status());
    const bView = JSON.stringify(await (await request.get(`${API}/api/v1/portals/supplier/${S.supTokB}`)).json());
    expect(bView, 'unnamed deliveries must not appear on every supplier link').not.toContain('DN-NONAME');
    const aView = JSON.stringify(await (await request.get(`${API}/api/v1/portals/supplier/${S.supTokA}`)).json());
    expect(aView).not.toContain('DN-NONAME');
    expect(aView, 'supplier A must not see supplier B items').not.toContain('Chuma');

    // A supplier link must carry a supplier name, otherwise it would see everything.
    const nameless = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/portals/links`, { portalType: 'SUPPLIER', expiresInDays: 7 });
    expect(nameless.status(), 'supplier link without a name must be refused').toBeGreaterThanOrEqual(400);

    // Supplier B cannot confirm or dispute supplier A's delivery even with its id.
    const sp = unwrap(await (await request.get(`${API}/api/v1/portals/supplier/${S.supTokA}`)).json());
    const del = (sp.deliveries || sp.data?.deliveries || []).find((x: any) => x.deliveryNote === 'DN-4411');
    const steal = await request.post(`${API}/api/v1/portals/supplier/${S.supTokB}/deliveries/${del.id}/confirm`, { data: { action: 'DISPUTE', note: 'fake dispute' } });
    expect([403, 404], 'cross-supplier action must be refused').toContain(steal.status());
  });

  // ---------------------------------------------------------------------------
  test('8. Links on a phone: honest expiry and revoke for both portals', async ({ request, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    for (const [type, tok] of [['subcontractor', S.tokA], ['supplier', S.supTokA]] as const) {
      await page.goto(`/?portal=${type}&token=${tok}`);
      await expect(page.getByText(type === 'subcontractor' ? /Umeme Sparks/ : /Bamburi Mart/).first()).toBeVisible({ timeout: 20_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), `${type} portal scrolls sideways`).toBe(false);
      // The sub must see statuses in plain words, not enum names.
      await expect(page.locator('body')).not.toContainText(/APPROVED_FOR_PAYMENT|UNDER_REVIEW|RECTIFIED_BY_CONTRACTOR/);
    }

    // Revoke the subcontractor link: it must fail honestly, not show stale money.
    const rev = await request.delete(`${API}/api/v1/projects/${S.projectId}/portals/links/${S.linkA}`, { headers: { Cookie: S.admin!.cookie } });
    expect(rev.status(), await rev.text()).toBeLessThan(300);
    await page.goto(`/?portal=subcontractor&token=${S.tokA}`);
    await expect(page.getByText(/revoked|no longer valid|expired/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/200,?000/)).toHaveCount(0);
    await ctx.close();
  });
});
