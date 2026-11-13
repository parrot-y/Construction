import { test, expect, APIRequestContext } from '@playwright/test';
import { API, Session, login, apiGet, apiPost, apiPatch, authHeaders, unwrap } from './helpers';

/**
 * dev-tcc-all-paths — regression spec for the TCC gate on EVERY transition
 * into APPROVED_FOR_PAYMENT (auditor review of 0d38faf).
 *
 * Covers SUBMITTED / UNDER_REVIEW / QS_VERIFIED pre-approval states against
 * missing, expired and valid Tax Compliance Certificates; proves PAID is
 * unreachable without a prior approval, and that a blocked claim posts
 * nothing to the cost ledger.
 */

const PASSWORD = 'Password123!';
const RUN = Date.now();

const S: {
  admin?: Session; pm?: Session; projectId?: string; packageId?: string;
  valSubmitted?: string; valUnderReview?: string; valQsVerified?: string;
} = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@tcc-paths-e2e.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `TCC Paths Builders ${RUN}`, adminFullName: 'Njeri Kamau', email, phone: '+254712000444', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}
async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@tcc-paths-e2e.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}
const valPath = (id: string) => `/api/v1/projects/${S.projectId}/subcontractor-valuations/${id}`;
const approve = (request: APIRequestContext, session: Session, id: string, extra: any = {}) =>
  apiPatch(request, session, valPath(id), { paymentStatus: 'APPROVED_FOR_PAYMENT', ...extra });
const approvedCost = async (request: APIRequestContext): Promise<number> => {
  const b = unwrap(await (await apiGet(request, S.pm!, `/api/v1/projects/${S.projectId}/budget/summary`)).json());
  const v = b?.approvedCost ?? b?.summary?.approvedCost ?? b?.totals?.approvedCost;
  return Number(String(v ?? '0').replace(/,/g, '')) || 0;
};

async function createValuation(request: APIRequestContext, certNo: string): Promise<string> {
  const r = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/subcontractor-valuations`, {
    subcontractorPackageId: S.packageId,
    certificateNo: certNo,
    valuationDate: '2026-11-01',
    grossWorkCertifiedKes: '120000.00',
    retentionRatePct: '5.00',
  });
  expect(r.status(), await r.text()).toBe(201);
  const body = unwrap(await r.json());
  return body.id || body.valuation?.id;
}
async function postTcc(request: APIRequestContext, expiryDate: string) {
  const r = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/subcontractor-tcc`, {
    subcontractorPackageId: S.packageId,
    pinNumber: 'P051234567T',
    taxpayerName: 'TCC Paths Electrical Ltd',
    tccNumber: `TCC-PATHS-${expiryDate}`,
    tccExpiryDate: expiryDate,
    complianceStatus: 'COMPLIANT',
  });
  expect(r.status(), await r.text()).toBeLessThan(300);
}

test.describe.serial('TCC gate — every approval path', () => {
  test('0. Setup: company, project, subcontractor package, three valuations', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Otieno Odhiambo');

    const q = await apiPost(request, S.admin, '/api/v1/quotes', {
      title: `TCC Paths ${RUN}`, clientName: 'Dr. Evans Kiprop', clientEmail: `c.${RUN}@tcc-e2e.test`,
      siteLocation: 'Kilimani, Nairobi', currency: 'KES', taxPct: 16, depositPct: 30,
      items: [{ description: 'Fit-out', unit: 'sum', quantity: 1, unitRate: 4000000 }],
    });
    expect(q.status(), await q.text()).toBe(201);
    const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
    const sent = await (await apiPost(request, S.admin, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
    await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
    const c = await apiPost(request, S.admin, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
    expect(c.status(), await c.text()).toBe(201);
    S.projectId = (await c.json()).project.id;
    const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: S.pm.user.id, role: 'PM_QS' });
    expect([200, 201, 409]).toContain(m.status());

    const pkg = await apiPost(request, S.pm, `/api/v1/projects/${S.projectId}/subcontractors`, {
      tradeCategory: 'Electrical', firmName: 'TCC Paths Electrical Ltd', subcontractSum: '800000.00', retentionRatePct: '5.00',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
    S.packageId = unwrap(await pkg.json()).id || unwrap(await pkg.json()).package?.id;

    S.valSubmitted = await createValuation(request, `SC-TCC-A-${RUN}`);
    S.valUnderReview = await createValuation(request, `SC-TCC-B-${RUN}`);
    S.valQsVerified = await createValuation(request, `SC-TCC-C-${RUN}`);

    // Move two of them into their pre-approval states (PM verifies; admin approves later).
    expect((await apiPatch(request, S.pm!, valPath(S.valUnderReview), { paymentStatus: 'UNDER_REVIEW' })).status()).toBe(200);
    expect((await apiPatch(request, S.pm!, valPath(S.valQsVerified), { paymentStatus: 'QS_VERIFIED' })).status()).toBe(200);
  });

  test('1. Missing TCC: every approval path is refused and posts nothing', async ({ request }) => {
    const before = await approvedCost(request);

    // SUBMITTED -> APPROVED_FOR_PAYMENT is not a legal transition at all.
    const fromSubmitted = await approve(request, S.admin!, S.valSubmitted!);
    expect(fromSubmitted.status(), 'SUBMITTED cannot jump to APPROVED').toBeGreaterThanOrEqual(400);

    for (const [label, id] of [['UNDER_REVIEW', S.valUnderReview], ['QS_VERIFIED', S.valQsVerified]] as const) {
      const res = await approve(request, S.admin!, id!);
      expect(res.status(), `${label} approve without TCC must be 409`).toBe(409);
      expect(JSON.stringify(await res.json()), `${label} must name the TCC block`).toMatch(/TCC|tax compliance/i);
    }

    expect(await approvedCost(request), 'blocked claims must not post to the cost ledger').toBe(before);
  });

  test('2. Expired TCC: still blocked on every path', async ({ request }) => {
    await postTcc(request, '2024-01-31');
    for (const [label, id] of [['UNDER_REVIEW', S.valUnderReview], ['QS_VERIFIED', S.valQsVerified]] as const) {
      const res = await approve(request, S.admin!, id!);
      expect(res.status(), `${label} approve with expired TCC must be 409`).toBe(409);
      expect(JSON.stringify(await res.json())).toMatch(/TCC|tax compliance/i);
    }
    // SUBMITTED path remains illegal regardless of TCC state.
    expect((await approve(request, S.admin!, S.valSubmitted!)).status()).toBeGreaterThanOrEqual(400);
  });

  test('3. Valid TCC: approval succeeds on every review track', async ({ request }) => {
    const next = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
    await postTcc(request, next);

    for (const [label, id] of [['UNDER_REVIEW', S.valUnderReview], ['QS_VERIFIED', S.valQsVerified]] as const) {
      const res = await approve(request, S.admin!, id!);
      expect(res.status(), `${label} approve with valid TCC must succeed`).toBeLessThan(300);
    }
  });

  test('4. PAID is unreachable without a prior valid approval', async ({ request }) => {
    // Fresh SUBMITTED valuation: direct PAID must be refused.
    const fresh = await createValuation(request, `SC-TCC-D-${RUN}`);
    const jump = await apiPatch(request, S.pm!, valPath(fresh), { paymentStatus: 'PAID', paymentReference: 'MPESA-FAKE', paidAt: '2026-11-11' });
    expect(jump.status(), 'SUBMITTED -> PAID must be rejected').toBeGreaterThanOrEqual(400);

    // UNDER_REVIEW -> PAID is likewise not a legal transition.
    const ur = await createValuation(request, `SC-TCC-E-${RUN}`);
    await apiPatch(request, S.pm!, valPath(ur), { paymentStatus: 'UNDER_REVIEW' });
    const jump2 = await apiPatch(request, S.pm!, valPath(ur), { paymentStatus: 'PAID', paymentReference: 'MPESA-FAKE', paidAt: '2026-11-11' });
    expect(jump2.status(), 'UNDER_REVIEW -> PAID must be rejected').toBeGreaterThanOrEqual(400);

    // An approved valuation CAN reach PAID with reference + date.
    const paid = await apiPatch(request, S.admin!, valPath(S.valUnderReview!), { paymentStatus: 'PAID', paymentReference: 'KCB-RTGS-TCC', paidAt: '2026-11-11' });
    expect(paid.status(), await paid.text()).toBeLessThan(300);
  });
});
