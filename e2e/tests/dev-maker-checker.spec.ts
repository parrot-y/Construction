import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, authHeaders, unwrap, Session } from './helpers';

/**
 * DEV spec (not auditor-locked): maker-checker self-approval rule.
 *
 * The person who entered a cost / payment certificate / invoice cannot
 * approve or send it themselves — EXCEPT COMPANY_ADMIN/ADMIN, who may
 * self-approve only with a non-empty selfApprovalReason (stored on the row,
 * written to the audit log, flagged in the response).
 */

const RUN = Date.now();
const PASSWORD = 'MakerCheck#2026';
const today = () => new Date().toISOString().slice(0, 10);

const S: { admin?: Session; pm?: Session; projectId?: string } = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.mc.${RUN}@makercheck-e2e.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `MakerCheck Builders ${RUN}`, adminFullName: 'Wanjiru Kamau', email, phone: '+254712000777', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

test.describe.serial('Maker-checker — costs, certificates, invoices', () => {
  test('0. Setup: company, PM, one project', async ({ request }) => {
    S.admin = await register(request);
    const email = `pm.mc.${RUN}@makercheck-e2e.test`;
    const inv = await apiPost(request, S.admin, '/api/v1/invitations', { email, role: 'PM_QS' });
    expect(inv.status(), await inv.text()).toBe(201);
    const token = unwrap(await inv.json()).token;
    const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: 'Otieno Odhiambo', password: PASSWORD } });
    expect(acc.status(), await acc.text()).toBeLessThan(300);
    S.pm = await login(request, email, PASSWORD);

    const q = await apiPost(request, S.admin, '/api/v1/quotes', {
      title: `MakerCheck Tower ${RUN}`, clientName: 'Dr. Evans Kiprop', clientEmail: `c.${RUN}@mc-e2e.test`,
      siteLocation: 'Ngong Road, Nairobi', currency: 'KES', taxPct: 16, depositPct: 30,
      items: [{ description: 'Office block', unit: 'sum', quantity: 1, unitRate: 5000000 }],
    });
    expect(q.status(), await q.text()).toBe(201);
    const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
    const sent = await (await apiPost(request, S.admin, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
    await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
    const c = await apiPost(request, S.admin, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
    expect(c.status(), await c.text()).toBe(201);
    S.projectId = (await c.json()).project.id;
    expect(S.projectId).toBeTruthy();
    const member = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, {
      userId: S.pm!.user.id, role: 'PM_QS',
    });
    expect([200, 201, 409], await member.text()).toContain(member.status());
  });

  test('1. Costs: PM cannot self-approve; admin needs a reason; second decision refused', async ({ request }) => {
    const projectId = S.projectId!;

    // PM enters a cost, then tries to approve their own entry.
    const pmCost = await apiPost(request, S.pm!, `/api/v1/projects/${projectId}/costs`, {
      projectId, costCategory: 'MATERIAL', amount: '5000', description: 'PM-entered cement',
    });
    expect(pmCost.status(), await pmCost.text()).toBeLessThan(300);
    const pmCostId = unwrap(await pmCost.json()).id;
    const pmSelf = await apiPost(request, S.pm!, `/api/v1/projects/${projectId}/costs/${pmCostId}/approve`, { action: 'APPROVED' });
    expect(pmSelf.status(), 'PM must not approve a cost they entered').toBe(409);

    // Admin enters a cost, then approves without a reason -> 409.
    const adminCost = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/costs`, {
      projectId, costCategory: 'LABOR', amount: '8000', description: 'Admin-entered labour',
    });
    expect(adminCost.status(), await adminCost.text()).toBeLessThan(300);
    const adminCostId = unwrap(await adminCost.json()).id;
    const noReason = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/costs/${adminCostId}/approve`, { action: 'APPROVED' });
    expect(noReason.status(), 'admin self-approval without reason must be refused').toBe(409);

    // Admin self-approves WITH a reason -> succeeds, flagged and stored.
    const withReason = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/costs/${adminCostId}/approve`, {
      action: 'APPROVED', comments: 'Verified on site', selfApprovalReason: 'Emergency procurement — verified delivery note DN-99',
    });
    expect(withReason.status(), await withReason.text()).toBeLessThan(300);
    const approved = unwrap(await withReason.json());
    const updated = approved.updated || approved;
    expect(updated.selfApproved ?? updated.self_approved, 'response must flag self-approval').toBeTruthy();

    // The flag and reason persist on the cost record.
    const listed = rowsOf(await (await apiGet(request, S.admin!, `/api/v1/projects/${projectId}/costs`)).json());
    const mine = listed.find((c: any) => c.id === adminCostId);
    expect(mine?.self_approved, 'self_approved persisted on the cost').toBe(true);
    expect(mine?.self_approval_reason).toContain('DN-99');

    // A decided cost cannot be decided again.
    const again = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/costs/${adminCostId}/approve`, { action: 'APPROVED' });
    expect(again.status(), 'second decision on a decided cost must be refused').toBeGreaterThanOrEqual(400);
  });

  test('2. Certificates: creator cannot certify own; admin self-certifies only with reason', async ({ request }) => {
    const projectId = S.projectId!;
    const t = today();

    // PM creates + submits + reviews a certificate, then tries to certify it.
    const cert = await apiPost(request, S.pm!, `/api/v1/projects/${projectId}/payment-certificates`, {
      periodStart: t, periodEnd: t, thisPeriodAmount: '25000.00', retentionPct: '5.00',
    });
    expect(cert.status(), await cert.text()).toBe(201);
    const certId = unwrap(await cert.json()).id;
    for (const action of ['SUBMIT', 'REVIEW']) {
      const r = await apiPost(request, S.pm!, `/api/v1/projects/${projectId}/payment-certificates/${certId}/action`, { action });
      expect(r.status(), `${action}: ${await r.text()}`).toBeLessThan(300);
    }
    const pmCertify = await apiPost(request, S.pm!, `/api/v1/projects/${projectId}/payment-certificates/${certId}/action`, { action: 'CERTIFY' });
    expect(pmCertify.status(), 'PM must not certify a certificate they created').toBe(409);

    // Admin creates a certificate, submits+reviews it, certifies without reason -> 409.
    const cert2 = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/payment-certificates`, {
      periodStart: t, periodEnd: t, thisPeriodAmount: '10000.00', retentionPct: '5.00',
    });
    expect(cert2.status(), await cert2.text()).toBe(201);
    const cert2Id = unwrap(await cert2.json()).id;
    for (const action of ['SUBMIT', 'REVIEW']) {
      const r = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/payment-certificates/${cert2Id}/action`, { action });
      expect(r.status(), `${action}: ${await r.text()}`).toBeLessThan(300);
    }
    const noReason = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/payment-certificates/${cert2Id}/action`, { action: 'CERTIFY' });
    expect(noReason.status(), 'admin self-certification without reason must be refused').toBe(409);

    const withReason = await apiPost(request, S.admin!, `/api/v1/projects/${projectId}/payment-certificates/${cert2Id}/action`, {
      action: 'CERTIFY', selfApprovalReason: 'Client instructed immediate certification — call ref ABC123',
    });
    expect(withReason.status(), await withReason.text()).toBeLessThan(300);
    const done = unwrap(await withReason.json());
    expect(done.self_approved ?? done.selfApproved, 'certification response must flag self-approval').toBeTruthy();
  });

  test('3. Invoices: creator cannot send own; admin sends only with reason', async ({ request }) => {
    const projectId = S.projectId!;
    const invoiceBody = (title: string) => ({
      title, clientName: 'Dr. Evans Kiprop', projectId, currency: 'KES', taxPct: 16,
      items: [{ description: 'Stage work', unit: 'sum', quantity: 1, unitRate: 100000 }],
    });

    // PM creates an invoice, then tries to send it themselves.
    const inv1 = await apiPost(request, S.pm!, '/api/v1/invoices', invoiceBody(`PM Invoice ${RUN}`));
    expect(inv1.status(), await inv1.text()).toBeLessThan(300);
    const inv1Id = unwrap(await inv1.json()).invoice?.id || unwrap(await inv1.json()).id;
    const pmSend = await request.post(`${API}/api/v1/invoices/${inv1Id}/send`, { headers: authHeaders(S.pm!) });
    expect(pmSend.status(), 'PM must not send an invoice they created').toBe(409);

    // Admin creates an invoice, sends without reason -> 409, with reason -> 200.
    const inv2 = await apiPost(request, S.admin!, '/api/v1/invoices', invoiceBody(`Admin Invoice ${RUN}`));
    expect(inv2.status(), await inv2.text()).toBeLessThan(300);
    const inv2Id = unwrap(await inv2.json()).invoice?.id || unwrap(await inv2.json()).id;
    const noReason = await request.post(`${API}/api/v1/invoices/${inv2Id}/send`, {
      headers: { ...authHeaders(S.admin!), 'content-type': 'application/json' }, data: {},
    });
    expect(noReason.status(), 'admin send without reason must be refused').toBe(409);
    const withReason = await request.post(`${API}/api/v1/invoices/${inv2Id}/send`, {
      headers: { ...authHeaders(S.admin!), 'content-type': 'application/json' },
      data: { selfApprovalReason: 'Client paid deposit upfront — verified bank slip' },
    });
    expect(withReason.status(), await withReason.text()).toBeLessThan(300);
    const sent = unwrap(await withReason.json());
    const invoice = sent.invoice || sent;
    expect(invoice.selfApproved ?? invoice.self_approved, 'send response must flag self-approval').toBeTruthy();
  });
});

const rowsOf = (b: any): any[] => {
  const u = unwrap(b);
  return Array.isArray(u) ? u : u?.items || u?.rows || u?.data || Object.values(u || {}).find(Array.isArray) || [];
};
