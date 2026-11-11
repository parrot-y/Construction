import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, authHeaders, unwrap, Session } from './helpers';

/**
 * STAGE 1 — CONTRACTOR JOURNEY (auditor-written acceptance test)
 *
 * One story, one brand-new company, nine steps, real API + real DB, no stubs.
 * Steps marked "NEW CONTRACT" test features that do NOT exist yet. They are
 * written to FAIL until Devin builds them. Do not weaken an assertion to make
 * it pass: change the feature. If a route name differs, change the constant in
 * CONTRACT below and say so in the PR, but keep the behaviour asserted.
 *
 * Existing request shapes are taken from packages/validation and the routes.
 */

const CONTRACT = {
  // NEW CONTRACT: self-service company sign-up (returns tenant + first admin).
  registerCompany: '/api/v1/auth/register-company',
  // NEW CONTRACT: create an invoice from a certified payment certificate.
  certificateToInvoice: (projectId: string, certId: string) =>
    `/api/v1/projects/${projectId}/payment-certificates/${certId}/invoice`,
  // NEW CONTRACT: in-app notifications for the logged-in user.
  notifications: '/api/v1/notifications',
  // NEW CONTRACT: project onboarding checklist computed from real data.
  checklist: (projectId: string) => `/api/v1/projects/${projectId}/checklist`,
};

const RUN = Date.now();
const PASSWORD = 'Journey#2026pass';
const company = {
  companyName: `Journey Builders ${RUN}`,
  adminName: 'Wanjiru Kamau',
  adminEmail: `admin.${RUN}@journey-e2e.test`,
  adminPhone: '+254712000111',
  password: PASSWORD,
};

const state: {
  admin?: Session;
  invites: Record<string, { token: string; email: string; role: string }>;
  sessions: Record<string, Session>;
  projectId?: string;
  quoteId?: string;
  depositInvoiceId?: string;
  boqItemIds: string[];
  packageId?: string;
  certId?: string;
  certInvoiceId?: string;
  valuationId?: string;
} = { invites: {}, sessions: {}, boqItemIds: [] };

const money = (v: unknown) => Number(String(v ?? '0').replace(/,/g, ''));
const rowsOf = (body: any): any[] => {
  const un = unwrap(body);
  return Array.isArray(un) ? un : un?.items || un?.rows || un?.data || Object.values(un || {}).find(Array.isArray) || [];
};
const idOf = (o: any) => o?.id || o?.project?.id || o?.invoice?.id || o?.quote?.id;

async function asUser(request: APIRequestContext, email: string): Promise<Session> {
  return login(request, email, PASSWORD);
}

test.describe.serial('Contractor journey — new company, start to finish', () => {
  // ---------------------------------------------------------------------------
  test('1. Company signs up and logs in to an empty workspace [NEW CONTRACT]', async ({ request }) => {
    const res = await request.post(`${API}${CONTRACT.registerCompany}`, { data: company });
    expect(res.status(), `register-company must exist and return 201. Body: ${await res.text()}`).toBe(201);

    // Duplicate sign-up with the same email must be refused (no tenant takeover).
    const dup = await request.post(`${API}${CONTRACT.registerCompany}`, { data: company });
    expect([400, 409]).toContain(dup.status());

    state.admin = await asUser(request, company.adminEmail);
    expect(state.admin.user.role).toMatch(/COMPANY_ADMIN|ADMIN/);

    const projects = await apiGet(request, state.admin, '/api/v1/projects');
    expect(projects.status()).toBe(200);
    expect(rowsOf(await projects.json()).length, 'a new company starts with zero projects').toBe(0);

    // Tenant isolation: the new company must not see the seeded tenant's data.
    const seeded = await login(request, 'admin@apexbuilders.co.ke');
    expect(seeded.tenantId).not.toBe(state.admin.tenantId);
  });

  // ---------------------------------------------------------------------------
  test('2. Admin invites PM, supervisor and foreman; each accepts and logs in', async ({ request, browser }) => {
    const admin = state.admin!;
    const team = [
      { key: 'pm', role: 'PM_QS', name: 'Otieno Odhiambo' },
      { key: 'sup', role: 'SITE_SUPERVISOR', name: 'Mwangi Njoroge' },
      { key: 'foreman', role: 'FOREMAN', name: 'Achieng Atieno' },
    ];

    for (const m of team) {
      const email = `${m.key}.${RUN}@journey-e2e.test`;
      const res = await apiPost(request, admin, '/api/v1/invitations', { email, role: m.role });
      expect(res.status(), await res.text()).toBe(201);
      const inv = unwrap(await res.json());
      expect(inv.token).toBeTruthy();
      state.invites[m.key] = { token: inv.token, email, role: m.role };
    }

    // Admin can see the pending invites.
    const list = await apiGet(request, admin, '/api/v1/invitations');
    expect(list.status()).toBe(200);
    expect(rowsOf(await list.json()).length).toBeGreaterThanOrEqual(3);

    // NEW CONTRACT: invitee opens the invite page ON A PHONE and sees company + role.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`/?invite=${state.invites.sup.token}`);
    await expect(page.getByText(company.companyName), 'invite page must show the company name').toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/site supervisor/i).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, 'invite page must not scroll sideways at 390px').toBe(false);
    await ctx.close();

    // Accept each invite and log in with the chosen password.
    for (const m of team) {
      const inv = state.invites[m.key];
      const acc = await request.post(`${API}/api/v1/invitations/accept`, {
        data: { token: inv.token, fullName: m.name, password: PASSWORD },
      });
      expect(acc.status(), await acc.text()).toBeLessThan(300);
      state.sessions[m.key] = await asUser(request, inv.email);
      expect(state.sessions[m.key].user.role).toBe(m.role);

      // A used invite token cannot be reused.
      const again = await request.post(`${API}/api/v1/invitations/accept`, {
        data: { token: inv.token, fullName: 'Someone Else', password: 'Another#Pass2026' },
      });
      expect([400, 404, 409, 410]).toContain(again.status());
    }
  });

  // ---------------------------------------------------------------------------
  test('3. Quote -> accepted -> project with deposit invoice', async ({ request }) => {
    const admin = state.admin!;
    const create = await apiPost(request, admin, '/api/v1/quotes', {
      title: `Karen Maisonette ${RUN}`,
      clientName: 'Dr. Evans Kiprop',
      clientEmail: `client.${RUN}@journey-e2e.test`,
      siteLocation: 'Karen, Nairobi',
      currency: 'KES',
      taxPct: 16,
      depositPct: 30,
      items: [
        { description: 'Substructure and slab', unit: 'm2', quantity: 180, unitRate: 9500 },
        { description: 'Walling and superstructure', unit: 'm2', quantity: 320, unitRate: 4200 },
      ],
    });
    expect(create.status(), await create.text()).toBe(201);
    state.quoteId = idOf(await create.json());

    const send = await apiPost(request, admin, `/api/v1/quotes/${state.quoteId}/send`, { channel: 'link' });
    expect(send.status(), await send.text()).toBe(200);
    const sent = await send.json();
    const shareToken = sent.shareToken || sent.share_token;
    expect(shareToken).toBeTruthy();

    const accept = await request.post(`${API}/api/public/quotes/${shareToken}/respond`, {
      data: { action: 'accept', typedName: 'Dr. Evans Kiprop' },
    });
    expect(accept.status(), await accept.text()).toBe(200);

    const convert = await apiPost(request, admin, `/api/v1/quotes/${state.quoteId}/convert`, { createDepositInvoice: true });
    expect(convert.status(), await convert.text()).toBe(201);
    const converted = await convert.json();
    state.projectId = converted.project?.id;
    state.depositInvoiceId = converted.depositInvoice?.id;
    expect(state.projectId).toBeTruthy();
    expect(state.depositInvoiceId, 'deposit invoice must be created and linked').toBeTruthy();

    // The quote total, not a default, must be the project budget.
    const proj = unwrap(await (await apiGet(request, admin, `/api/v1/projects/${state.projectId}`)).json());
    const budget = money(proj.current_approved_budget ?? proj.currentApprovedBudget ?? proj.project?.current_approved_budget);
    const expectedSubtotal = 180 * 9500 + 320 * 4200;
    expect(budget).toBeGreaterThanOrEqual(expectedSubtotal);

    // Deposit invoice: 30% of total including 16% VAT.
    const inv = unwrap(await (await apiGet(request, admin, `/api/v1/invoices/${state.depositInvoiceId}`)).json());
    const invoice = inv.invoice || inv;
    expect(money(invoice.tax_pct ?? invoice.taxPct)).toBe(16);

    // The PM and supervisor must be able to see the new project (team assigned).
    for (const key of ['pm', 'sup']) {
      const m = await apiPost(request, admin, `/api/v1/projects/${state.projectId}/members`, {
        userId: state.sessions[key].user.id,
        role: state.invites[key].role,
      });
      expect([200, 201, 409], `assign ${key}: ${await m.text()}`).toContain(m.status());
    }
  });

  // ---------------------------------------------------------------------------
  test('4. BoQ import sets budget lines', async ({ request }) => {
    const pm = state.sessions.pm;
    const projectId = state.projectId!;
    const sections = [
      {
        title: 'Substructure',
        orderIdx: 0,
        subtotal: '1710000.00',
        items: [
          { itemCode: 'A1', description: 'Excavate to reduce levels', unit: 'm3', quantity: '120', unitRate: '1500', totalAmount: '180000.00', isProvisional: false, status: 'VALID' },
          { itemCode: 'A2', description: 'Reinforced concrete slab C25', unit: 'm3', quantity: '60', unitRate: '25500', totalAmount: '1530000.00', isProvisional: false, status: 'VALID' },
        ],
      },
      {
        title: 'Superstructure',
        orderIdx: 1,
        subtotal: '1344000.00',
        items: [
          { itemCode: 'B1', description: 'Block walling 200mm', unit: 'm2', quantity: '320', unitRate: '4200', totalAmount: '1344000.00', isProvisional: false, status: 'VALID' },
        ],
      },
    ];
    const res = await apiPost(request, pm, `/api/v1/projects/${projectId}/boq/confirm`, {
      sourceFilename: 'journey-boq.xlsx',
      sections,
    });
    expect(res.status(), await res.text()).toBeLessThan(300);

    const boq = await apiGet(request, pm, `/api/v1/projects/${projectId}/boq`);
    expect(boq.status()).toBe(200);
    const text = JSON.stringify(await boq.json());
    expect(text).toContain('Reinforced concrete slab');
    // Collect BoQ item ids for progress and certificate steps.
    state.boqItemIds = Array.from(text.matchAll(/"id":"([0-9a-f-]{36})","[^"]*"?[^"]*?"item_code":"(A1|A2|B1)"/g)).map((m) => m[1]);
    if (state.boqItemIds.length === 0) {
      const itemsRes = await apiGet(request, pm, `/api/v1/projects/${projectId}/boq/items`);
      state.boqItemIds = rowsOf(await itemsRes.json()).map((i: any) => i.id).filter(Boolean);
    }
    expect(state.boqItemIds.length, 'BoQ items must be addressable by id').toBeGreaterThan(0);

    // A foreman must NOT be able to import a BoQ.
    const foreman = state.sessions.foreman;
    const denied = await apiPost(request, foreman, `/api/v1/projects/${projectId}/boq/confirm`, { sections });
    expect([401, 403]).toContain(denied.status());
  });

  // ---------------------------------------------------------------------------
  test('5. Supervisor files diary + progress offline-style; replay creates no duplicates', async ({ request, browser }) => {
    const sup = state.sessions.sup;
    const projectId = state.projectId!;
    const today = new Date().toISOString().slice(0, 10);

    const diary = {
      projectId,
      entryDate: today,
      weather: 'SUNNY_CLEAR',
      siteStatus: 'OPERATIONAL',
      generalNotes: `Journey diary ${RUN}`,
      laborHeadcounts: [{ tradeType: 'MASON', headcount: 12 }],
    };
    const key = `journey-diary-${RUN}`;
    const first = await apiPost(request, sup, `/api/v1/projects/${projectId}/site-diaries`, diary, { 'idempotency-key': key });
    expect(first.status(), await first.text()).toBe(201);
    const replay = await apiPost(request, sup, `/api/v1/projects/${projectId}/site-diaries`, diary, { 'idempotency-key': key });
    expect([200, 201]).toContain(replay.status());
    const list = rowsOf(await (await apiGet(request, sup, `/api/v1/projects/${projectId}/site-diaries`)).json());
    expect(list.filter((d: any) => JSON.stringify(d).includes(`Journey diary ${RUN}`)).length).toBe(1);

    // Physical progress against real BoQ items (45% of the first item).
    const prog = await apiPost(request, sup, `/api/v1/projects/${projectId}/progress`, {
      projectId,
      recordDate: today,
      overallProgress: '0.2500',
      notes: 'Slab poured to grid C',
      items: [{ boqItemId: state.boqItemIds[0], completedQuantity: '27', completionPct: '0.4500' }],
    });
    expect(prog.status(), await prog.text()).toBeLessThan(300);

    // Phone check: the supervisor view loads at 390px with no sideways scroll,
    // and goes offline without crashing.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await ctx.setOffline(true);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toContainText(/something went wrong|application error/i);
    await ctx.setOffline(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)).toBe(false);
    await ctx.close();
  });

  // ---------------------------------------------------------------------------
  test('6. Variation raised, client approves in portal, contract sum updates', async ({ request }) => {
    const pm = state.sessions.pm;
    const admin = state.admin!;
    const projectId = state.projectId!;

    const before = unwrap(await (await apiGet(request, admin, `/api/v1/projects/${projectId}`)).json());
    const budgetBefore = money(before.current_approved_budget ?? before.project?.current_approved_budget);

    const create = await apiPost(request, pm, `/api/v1/projects/${projectId}/variations`, {
      title: 'Additional retaining wall',
      reason: 'Client instruction after soil report showed unstable ground',
      triggerType: 'CLIENT_REQUEST',
      items: [{ description: 'Retaining wall 150mm RC', unit: 'm2', quantity: 25, unitRate: 12000 }],
    });
    expect(create.status(), await create.text()).toBeLessThan(300);
    const variationId = idOf(unwrap(await create.json())) || unwrap(await create.json()).variation?.id;

    expect((await apiPost(request, pm, `/api/v1/projects/${projectId}/variations/${variationId}/submit`, {})).status()).toBeLessThan(300);
    const evaluate = await apiPost(request, admin, `/api/v1/projects/${projectId}/variations/${variationId}/review`, { action: 'EVALUATE', comments: 'Priced and checked' });
    expect(evaluate.status(), await evaluate.text()).toBeLessThan(300);

    // Client token portal
    const link = await apiPost(request, admin, `/api/v1/projects/${projectId}/portals/links`, {
      portalType: 'CLIENT', stakeholderName: 'Dr. Evans Kiprop', expiresInDays: 14,
    });
    expect(link.status(), await link.text()).toBe(201);
    const token = unwrap(await link.json()).token;

    const respond = await request.post(`${API}/api/v1/portals/client/${token}/change-orders/${variationId}/respond`, {
      data: { action: 'APPROVE', signedName: 'Dr. Evans Kiprop', comments: 'Approved' },
    });
    expect(respond.status(), await respond.text()).toBe(200);

    const after = unwrap(await (await apiGet(request, admin, `/api/v1/projects/${projectId}`)).json());
    const budgetAfter = money(after.current_approved_budget ?? after.project?.current_approved_budget);
    expect(budgetAfter - budgetBefore, 'approved variation (25 x 12,000) must raise the contract sum').toBe(300000);

    // A second decision on the same variation must be refused.
    const again = await request.post(`${API}/api/v1/portals/client/${token}/change-orders/${variationId}/respond`, {
      data: { action: 'REJECT', signedName: 'Dr. Evans Kiprop', comments: 'changed my mind' },
    });
    expect([400, 409]).toContain(again.status());
  });

  // ---------------------------------------------------------------------------
  test('7. Subcontractor valuation: approval flow posts to costs and budget', async ({ request }) => {
    const pm = state.sessions.pm;
    const admin = state.admin!;
    const projectId = state.projectId!;

    const pkg = await apiPost(request, pm, `/api/v1/projects/${projectId}/subcontractors`, {
      tradeCategory: 'Electrical', firmName: 'Umeme Sparks Ltd', subcontractSum: '800000.00', retentionRatePct: '5.00',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
    state.packageId = idOf(unwrap(await pkg.json()));

    const link = await apiPost(request, admin, `/api/v1/projects/${projectId}/portals/links`, {
      portalType: 'SUBCONTRACTOR', stakeholderName: 'Umeme Sparks Ltd', stakeholderRole: 'Electrical',
      subcontractorPackageId: state.packageId, expiresInDays: 14,
    });
    expect(link.status(), await link.text()).toBe(201);
    const token = unwrap(await link.json()).token;

    const submit = await request.post(`${API}/api/v1/portals/subcontractor/${token}/valuations`, {
      data: { grossWorkCertifiedKes: '300000.00', notes: 'First fix complete' },
    });
    expect(submit.status(), await submit.text()).toBe(201);
    state.valuationId = unwrap(await submit.json()).id;

    // Over-claim beyond the package sum must be refused.
    const over = await request.post(`${API}/api/v1/portals/subcontractor/${token}/valuations`, {
      data: { grossWorkCertifiedKes: '900000.00' },
    });
    expect(over.status()).toBe(400);

    const summaryOf = async () => {
      const r = await apiGet(request, pm, `/api/v1/projects/${projectId}/budget/summary`);
      expect(r.status()).toBe(200);
      const b = unwrap(await r.json());
      return money(b?.approvedCost ?? b?.summary?.approvedCost ?? b?.totals?.approvedCost);
    };
    const costsBefore = await summaryOf();

    const valPath = `/api/v1/projects/${projectId}/subcontractor-valuations/${state.valuationId}`;

    // NEW CONTRACT: illegal jump SUBMITTED -> PAID must be refused.
    const jump = await apiPatch(request, pm, valPath, { paymentStatus: 'PAID', paymentReference: 'MPESA-FAKE' });
    expect(jump.status(), 'SUBMITTED -> PAID must be rejected (409/400)').toBeGreaterThanOrEqual(400);

    expect((await apiPatch(request, pm, valPath, { paymentStatus: 'QS_VERIFIED' })).status()).toBeLessThan(300);

    // NEW CONTRACT: the person who verified cannot also approve for payment.
    const selfApprove = await apiPatch(request, pm, valPath, { paymentStatus: 'APPROVED_FOR_PAYMENT' });
    expect(selfApprove.status(), 'same user must not verify and approve').toBeGreaterThanOrEqual(400);

    const approve = await apiPatch(request, admin, valPath, { paymentStatus: 'APPROVED_FOR_PAYMENT' });
    expect(approve.status(), await approve.text()).toBeLessThan(300);

    // NEW CONTRACT: approval posts a cost to the ledger so the budget moves.
    const costsAfter = await summaryOf();
    expect(costsAfter, 'approved valuation (net of retention and WHT) must increase approvedCost').toBeGreaterThan(costsBefore);
  });

  // ---------------------------------------------------------------------------
  test('8. Certificate from progress -> invoice -> payment -> retention [NEW CONTRACT]', async ({ request }) => {
    const pm = state.sessions.pm;
    const admin = state.admin!;
    const projectId = state.projectId!;
    const today = new Date().toISOString().slice(0, 10);

    // Certificate amount must be DERIVED from recorded progress, not typed.
    const draft = await apiPost(request, pm, `/api/v1/projects/${projectId}/payment-certificates`, {
      periodStart: today, periodEnd: today, retentionPct: '5.00',
      // no thisPeriodAmount on purpose
    });
    expect(draft.status(), await draft.text()).toBe(201);
    const cert = unwrap(await draft.json());
    state.certId = idOf(cert) || cert.data?.id;
    const gross = money(cert.this_period_amount ?? cert.thisPeriodAmount ?? cert.cumulative_certified);
    // 45% of item A1 (120 x 1,500 = 180,000) = 81,000 certified so far.
    expect(gross, 'certificate must be derived from progress (45% of A1 = 81,000)').toBe(81000);

    // Workflow: submit -> review -> certify (by a different approver)
    for (const action of ['SUBMIT', 'REVIEW']) {
      const r = await apiPost(request, pm, `/api/v1/projects/${projectId}/payment-certificates/${state.certId}/action`, { action });
      expect(r.status(), `${action}: ${await r.text()}`).toBeLessThan(300);
    }
    const certify = await apiPost(request, admin, `/api/v1/projects/${projectId}/payment-certificates/${state.certId}/action`, { action: 'CERTIFY' });
    expect(certify.status(), await certify.text()).toBeLessThan(300);

    // Certified certificate -> invoice, with VAT, linked both ways.
    const inv = await apiPost(request, admin, CONTRACT.certificateToInvoice(projectId, state.certId!), { taxPct: 16 });
    expect(inv.status(), `certificate-to-invoice must exist. Body: ${await inv.text()}`).toBe(201);
    const invoice = unwrap(await inv.json());
    state.certInvoiceId = invoice.invoice?.id || invoice.id;
    const retention = 81000 * 0.05;
    const net = 81000 - retention;
    expect(money(invoice.invoice?.subtotal ?? invoice.subtotal), 'invoice subtotal = certified amount less retention').toBeCloseTo(net, 2);
    expect(money(invoice.invoice?.tax_amount ?? invoice.tax_amount)).toBeCloseTo(net * 0.16, 2);

    // Record an M-Pesa payment against the invoice (reference only; M-Pesa itself is simulated).
    const total = money(invoice.invoice?.total ?? invoice.total);
    const pay = await apiPost(request, admin, `/api/v1/invoices/${state.certInvoiceId}/payments`, {
      amount: total, method: 'M_PESA', reference: `SJK4${RUN % 100000}XY`,
    });
    expect(pay.status(), await pay.text()).toBeLessThan(300);

    // Overpayment must be refused.
    const over = await apiPost(request, admin, `/api/v1/invoices/${state.certInvoiceId}/payments`, { amount: 1, method: 'CASH' });
    expect(over.status(), 'cannot pay a settled invoice').toBeGreaterThanOrEqual(400);

    // Certificate status must follow the invoice (no separate MARK_PAID).
    const certs = rowsOf(await (await apiGet(request, admin, `/api/v1/projects/${projectId}/payment-certificates`)).json());
    const mine = certs.find((c: any) => (c.id || c.certificate_id) === state.certId);
    expect(String(mine?.status), 'certificate becomes PAID when its invoice is fully paid').toBe('PAID');

    // Retention is held, not paid out.
    expect(money(mine?.retention_held ?? mine?.retentionHeld)).toBeCloseTo(retention, 2);
  });

  // ---------------------------------------------------------------------------
  test('9. Notifications, checklist and project closeout [NEW CONTRACT]', async ({ request }) => {
    const admin = state.admin!;
    const pm = state.sessions.pm;
    const projectId = state.projectId!;

    // Real notifications exist for the people involved.
    const n = await apiGet(request, pm, CONTRACT.notifications);
    expect(n.status(), 'notifications endpoint must exist').toBe(200);
    const kinds = JSON.stringify(await n.json()).toLowerCase();
    expect(kinds).toMatch(/diary|valuation|certificate|variation/);

    // Checklist reflects reality, not defaults.
    const cl = await apiGet(request, admin, CONTRACT.checklist(projectId));
    expect(cl.status(), 'project checklist endpoint must exist').toBe(200);
    const steps = rowsOf(await cl.json());
    const done = (name: RegExp) => steps.find((s: any) => name.test(JSON.stringify(s)))?.done ?? steps.find((s: any) => name.test(JSON.stringify(s)))?.completed;
    expect(done(/boq/i)).toBe(true);
    expect(done(/diary/i)).toBe(true);
    expect(done(/certificate/i)).toBe(true);
    expect(done(/closeout/i)).toBeFalsy();

    // Exports a contractor hands to a client or auditor.
    for (const p of ['reports/summary', 'reports/financials.xlsx', 'reports/cost.xlsx']) {
      const r = await apiGet(request, admin, `/api/v1/projects/${projectId}/${p}`);
      expect(r.status(), p).toBe(200);
    }

    // Tenant isolation, last check: another company cannot read this project.
    const other = await login(request, 'admin@apexbuilders.co.ke');
    const leak = await apiGet(request, other, `/api/v1/projects/${projectId}`);
    expect([403, 404]).toContain(leak.status());
  });
});
