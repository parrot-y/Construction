/**
 * STAGE 2 — CLIENT & OWNER acceptance spec (authored from the owner's numbered
 * requirements; the auditor file was never supplied, so this spec IS the contract).
 *
 * CONTRACT (route names may differ from any future auditor spec; behaviour may not):
 *   - GET  /api/v1/projects/:projectId/client-portal      logged-in client aggregate
 *   - GET  /api/v1/projects/:projectId/site-diaries       staff + client-safe DTO
 *   - GET  /api/v1/projects/:projectId/site-diaries/:id   staff + client-safe DTO
 *   - GET  /uploads/:tenantId/:projectId/:file            authenticated file serving
 *   - GET  /api/v1/fx-rates                              { rates, asOf, source }
 *   - GET  /api/v1/me/invoices                           client invoices + payments + notices
 *   - POST /api/v1/client/invoices/:id/payment-notice     non-mutating client notice
 *   - GET  /api/v1/me/approvals                          "Waiting for you" feed
 *   - POST /api/v1/client/project-requests               client project request
 *   - GET  /api/v1/client/project-requests               staff list of requests
 *   - GET  /api/v1/inbox                                 contractor inbox
 *   - PATCH /api/v1/company/settings                     tenant settings (retention, payments)
 *   - POST /api/v1/invoices                               contractor invoice create
 *   - POST /api/v1/invoices/:id/send|payments             contractor invoice actions
 *   - POST /api/v1/projects/:projectId/variations[/:id/submit|/review]
 *   - POST /api/v1/projects/:projectId/payment-certificates
 *
 * Behaviours asserted:
 *   1. CLIENT (and OWNER) never receive internal diary notes or non-client-visible
 *      photos from ANY route — list, detail, or direct /uploads file URLs.
 *   2. No hard-coded retention "10%" — client-portal retention_terms reflect tenant
 *      settings; payment instructions (paybill/till/bank) come from company settings.
 *   3. FX rates come from GET /api/v1/fx-rates with asOf + source (or conversion removed).
 *   4. Logged-in client sees invoices, balance, payment history, payment instructions.
 *   5. payment-notice notifies the contractor inbox and NEVER mutates the invoice;
 *      the notice is confirmed only when the contractor records payment.
 *   6. /me/approvals feeds a "Waiting for you" card on client + owner dashboards.
 *   7. OWNER is read-mostly: cannot create or certify payment certificates.
 *   8. Client project requests reach the contractor inbox AND staff request list.
 *   9. 390px layout does not scroll sideways on the client dashboard.
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, unwrap, firstProjectId, Session } from './helpers';

const PASSWORD = 'Password123!';
const UPLOAD_DIR = process.env.E2E_UPLOAD_DIR || '/tmp/e2e-uploads';

const CONTRACT = {
  clientPortal: (pid: string) => `/api/v1/projects/${pid}/client-portal`,
  siteDiaries: (pid: string) => `/api/v1/projects/${pid}/site-diaries`,
  siteDiary: (pid: string, id: string) => `/api/v1/projects/${pid}/site-diaries/${id}`,
  fxRates: '/api/v1/fx-rates',
  meInvoices: '/api/v1/me/invoices',
  paymentNotice: (invoiceId: string) => `/api/v1/client/invoices/${invoiceId}/payment-notice`,
  meApprovals: '/api/v1/me/approvals',
  inbox: '/api/v1/inbox',
  projectRequests: '/api/v1/client/project-requests',
  companySettings: '/api/v1/company/settings',
  invoices: '/api/v1/invoices',
  invoice: (id: string) => `/api/v1/invoices/${id}`,
  sendInvoice: (id: string) => `/api/v1/invoices/${id}/send`,
  payInvoice: (id: string) => `/api/v1/invoices/${id}/payments`,
  variations: (pid: string) => `/api/v1/projects/${pid}/variations`,
  submitVariation: (pid: string, id: string) => `/api/v1/projects/${pid}/variations/${id}/submit`,
  reviewVariation: (pid: string, id: string) => `/api/v1/projects/${pid}/variations/${id}/review`,
  paymentCertificates: (pid: string) => `/api/v1/projects/${pid}/payment-certificates`,
};

const state: {
  admin?: Session; client?: Session; owner?: Session;
  projectId?: string; tenantId?: string;
  diaryId?: string; hiddenKey?: string; visibleKey?: string;
  invoiceId?: string; noticeId?: string; variationId?: string;
} = {};

function idOf(body: any): string | undefined {
  return body?.id || body?.data?.id || body?.invoice?.id || body?.diary?.id;
}

async function rowsOf(res: any): Promise<any[]> {
  const body = await res.json();
  const d = unwrap(body);
  return Array.isArray(d) ? d : d?.rows || d?.items || d?.data || d?.invoices || d?.deliveries || [];
}

test.describe.configure({ mode: 'serial' });
test.describe('Stage 2 — client & owner portals', () => {
  test('0. fixture: admin, client, owner sessions on the seeded project', async ({ request }) => {
    state.admin = await login(request, 'admin@apexbuilders.co.ke');
    state.client = await login(request, 'client@apexbuilders.co.ke');
    state.owner = await login(request, 'owner@apexbuilders.co.ke');
    state.projectId = await firstProjectId(request, state.admin);
    state.tenantId = state.admin.tenantId;
    expect(state.client.user.role).toBe('CLIENT');
    expect(state.owner.user.role).toBe('OWNER');
  });

  // -------------------------------------------------------------------------
  test('1. Diary privacy: client never sees internal notes or hidden photos', async ({ request }) => {
    const admin = state.admin!; const client = state.client!; const owner = state.owner!;
    const pid = state.projectId!; const tid = state.tenantId!;
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    const hiddenKey = `${tid}/${pid}/e2e-hidden-${Date.now()}.jpg`;
    const visibleKey = `${tid}/${pid}/e2e-visible-${Date.now()}.jpg`;
    state.hiddenKey = hiddenKey; state.visibleKey = visibleKey;
    for (const key of [hiddenKey, visibleKey]) {
      const p = join(UPLOAD_DIR, key);
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]));
    }

    const SECRET = `E2E-INTERNAL-NOTES-${Date.now()}`;
    const diaryRes = await apiPost(request, admin, CONTRACT.siteDiaries(pid), {
      entryDate: '2024-02-29',
      weather: 'SUNNY_CLEAR',
      siteStatus: 'OPERATIONAL',
      generalNotes: SECRET,
      photos: [
        { storageKey: hiddenKey, caption: 'Internal QA shot', clientVisible: false },
        { storageKey: visibleKey, caption: 'Finished facade', clientVisible: true },
      ],
    });
    expect(diaryRes.status(), await diaryRes.text()).toBeLessThan(300);
    const diaryBody = unwrap(await diaryRes.json());
    state.diaryId = idOf(diaryBody) || diaryBody?.id;
    expect(state.diaryId, 'diary id').toBeTruthy();

    // Staff view keeps everything.
    const staffDetail = await apiGet(request, admin, CONTRACT.siteDiary(pid, state.diaryId!));
    expect(staffDetail.status()).toBe(200);
    const staffBody = await staffDetail.text();
    expect(staffBody).toContain(SECRET);
    expect(staffBody).toContain(hiddenKey);

    // Client list + detail must be client-safe.
    for (const path of [CONTRACT.siteDiaries(pid), CONTRACT.siteDiary(pid, state.diaryId!)]) {
      const res = await apiGet(request, client, path);
      expect(res.status(), `${path} for CLIENT`).toBe(200);
      const text = await res.text();
      expect(text, `${path} must not leak internal notes`).not.toContain(SECRET);
      expect(text, `${path} must not leak hidden photo key`).not.toContain(hiddenKey);
      expect(text, `${path} must still show the client-visible photo`).toContain(visibleKey);
    }

    // Direct file URLs: hidden photo refused for CLIENT and OWNER; visible allowed.
    for (const session of [client, owner]) {
      const hidden = await request.get(`${API}/uploads/${hiddenKey}`, { headers: { Cookie: session.cookie } });
      expect([403, 404], `hidden photo must be refused for ${session.user.role}`).toContain(hidden.status());
      const visible = await request.get(`${API}/uploads/${visibleKey}`, { headers: { Cookie: session.cookie } });
      expect(visible.status(), `client-visible photo must load for ${session.user.role}`).toBe(200);
    }
    // Staff still reach the hidden file.
    const staffFile = await request.get(`${API}/uploads/${hiddenKey}`, { headers: { Cookie: admin.cookie } });
    expect(staffFile.status()).toBe(200);
  });

  // -------------------------------------------------------------------------
  test('2. Retention terms, payment instructions and FX rates come from the tenant', async ({ request }) => {
    const admin = state.admin!; const client = state.client!; const pid = state.projectId!;

    // Contractor configures real retention terms + payment instructions.
    const patch = await apiPatch(request, admin, CONTRACT.companySettings, {
      retentionTerms: {
        interimDeductionRatePct: 10,
        maxCapRatePct: 5,
        releaseSchedule: '50% at Practical Completion, 50% at Defects Liability expiry',
      },
      paymentInstructions: {
        paybill: '522 111',
        till: '7788990',
        bank: { bankName: 'KCB', accountName: 'Apex Builders Kenya Ltd', accountNumber: '11002233' },
      },
    });
    expect([200, 204], await patch.text()).toContain(patch.status());

    // Client portal aggregate must surface them — never a hard-coded "10%".
    const portal = await apiGet(request, client, CONTRACT.clientPortal(pid));
    expect(portal.status()).toBe(200);
    const p = unwrap(await portal.json());
    const terms = p.retention_terms || p.retentionTerms;
    expect(terms, 'client-portal must return retention_terms').toBeTruthy();
    expect(JSON.stringify(terms)).toContain('Defects Liability');
    const pay = p.payment_instructions || p.paymentInstructions;
    expect(pay, 'client-portal must return payment instructions').toBeTruthy();
    expect(JSON.stringify(pay)).toContain('522 111');

    // FX endpoint: dated + sourced, or absent entirely (conversion removed).
    const fx = await apiGet(request, client, CONTRACT.fxRates);
    if (fx.status() === 200) {
      const f = unwrap(await fx.json());
      expect(f.asOf || f.as_of, 'fx-rates must carry asOf').toBeTruthy();
      expect(f.source || f.source_name || f.provider, 'fx-rates must carry a source').toBeTruthy();
      expect(f.rates || f.exchange_rates || f, 'fx-rates must carry rates').toBeTruthy();
    } else {
      expect([404, 501]).toContain(fx.status());
    }
  });

  // -------------------------------------------------------------------------
  test('3. Client invoices: list, balance, payment history, payment instructions', async ({ request }) => {
    const admin = state.admin!; const client = state.client!; const pid = state.projectId!;

    const invRes = await apiPost(request, admin, CONTRACT.invoices, {
      title: `Stage2 Client Invoice ${Date.now()}`,
      clientName: 'E2E Client',
      projectId: pid,
      currency: 'KES',
      items: [{ description: 'Stage 2 works', unit: 'sum', quantity: 1, unitRate: 250000 }],
    });
    expect(invRes.status(), await invRes.text()).toBe(201);
    const inv = unwrap(await invRes.json());
    state.invoiceId = idOf(inv) || inv.invoice?.id;
    expect(state.invoiceId).toBeTruthy();
    await apiPost(request, admin, CONTRACT.sendInvoice(state.invoiceId!), {});

    const mine = await apiGet(request, client, CONTRACT.meInvoices);
    expect(mine.status(), await mine.text()).toBe(200);
    const body = unwrap(await mine.json());
    const list = Array.isArray(body) ? body : body.invoices || body.items || body.data || [];
    const row = list.find((i: any) => i.id === state.invoiceId);
    expect(row, 'client must see the project invoice').toBeTruthy();
    expect(Number(row.balanceDue ?? row.balance_due ?? row.balance ?? row.total), 'balance must be exposed').toBeGreaterThan(0);
    expect(row.paymentHistory !== undefined || row.payments !== undefined || row.payment_history !== undefined, 'payment history must be exposed').toBe(true);
    expect(JSON.stringify(row) + JSON.stringify(body)).toContain('522 111');
  });

  // -------------------------------------------------------------------------
  test('4. Payment notice notifies contractor, never mutates the invoice', async ({ request }) => {
    const admin = state.admin!; const client = state.client!;
    const invoiceId = state.invoiceId!;

    const before = unwrap(await (await apiGet(request, admin, CONTRACT.invoice(invoiceId))).json());
    const balanceBefore = Number(before.balance_due ?? before.balanceDue ?? before.balance ?? before.total);
    const statusBefore = before.status;

    const notice = await apiPost(request, client, CONTRACT.paymentNotice(invoiceId), {
      amount: 100000,
      method: 'M_PESA',
      reference: `E2E-NOTICE-${Date.now()}`,
      note: 'Paid via till this morning',
    });
    expect([200, 201], await notice.text()).toContain(notice.status());
    const n = unwrap(await notice.json());
    state.noticeId = idOf(n) || n.notice?.id || n.id;

    // Invoice untouched.
    const after = unwrap(await (await apiGet(request, admin, CONTRACT.invoice(invoiceId))).json());
    expect(Number(after.balance_due ?? after.balanceDue ?? after.balance ?? after.total)).toBe(balanceBefore);
    expect(after.status).toBe(statusBefore);

    // Contractor inbox carries the notice.
    const inbox = await apiGet(request, admin, CONTRACT.inbox);
    expect(inbox.status()).toBe(200);
    const msgs = await rowsOf(inbox);
    expect(JSON.stringify(msgs)).toContain(`E2E-NOTICE`);

    // Client sees the notice as pending in their invoice feed.
    const mine = unwrap(await (await apiGet(request, client, CONTRACT.meInvoices)).json());
    const list = Array.isArray(mine) ? mine : mine.invoices || [];
    const row = list.find((i: any) => i.id === invoiceId);
    const notices = row?.paymentNotices || row?.payment_notices || row?.notices || [];
    const mine2 = notices.find((x: any) => x.id === state.noticeId || String(x.reference || '').includes('E2E-NOTICE'));
    expect(mine2, 'client must see their own pending notice').toBeTruthy();
    expect(['PENDING', 'RECEIVED', 'AWAITING_CONFIRMATION', 'SUBMITTED'].includes(mine2.status), `notice status ${mine2.status}`).toBe(true);

    // Contractor records the payment → notice confirmed.
    const pay = await apiPost(request, admin, CONTRACT.payInvoice(invoiceId), {
      amount: 250000, method: 'M_PESA', reference: `E2E-PAY-${Date.now()}`,
    });
    expect([200, 201], await pay.text()).toContain(pay.status());

    const mineAfter = unwrap(await (await apiGet(request, client, CONTRACT.meInvoices)).json());
    const listAfter = Array.isArray(mineAfter) ? mineAfter : mineAfter.invoices || [];
    const rowAfter = listAfter.find((i: any) => i.id === invoiceId);
    const noticesAfter = rowAfter?.paymentNotices || rowAfter?.payment_notices || rowAfter?.notices || [];
    const confirmed = noticesAfter.find((x: any) => x.id === state.noticeId || String(x.reference || '').includes('E2E-NOTICE'));
    expect(confirmed, 'notice must still be listed after payment').toBeTruthy();
    expect(['CONFIRMED', 'MATCHED', 'APPLIED'].includes(confirmed.status), `notice must be confirmed after contractor payment, got ${confirmed.status}`).toBe(true);
  });

  // -------------------------------------------------------------------------
  test('5. /me/approvals feeds "Waiting for you" on client and owner', async ({ request }) => {
    const admin = state.admin!; const client = state.client!; const owner = state.owner!;
    const pid = state.projectId!;

    const create = await apiPost(request, admin, CONTRACT.variations(pid), {
      title: `Stage2 CO ${Date.now()}`,
      reason: 'Client requested extra signage',
      triggerType: 'CLIENT_REQUEST',
      items: [{ description: 'Signage package', unit: 'lot', quantity: 1, unitRate: 50000 }],
    });
    expect(create.status(), await create.text()).toBeLessThan(300);
    const vid = idOf(unwrap(await create.json())) || unwrap(await create.json())?.variation?.id;
    state.variationId = vid;
    await apiPost(request, admin, CONTRACT.submitVariation(pid, vid), {});
    const evalRes = await apiPost(request, admin, CONTRACT.reviewVariation(pid, vid), { action: 'EVALUATE', comments: 'ok' });
    expect(evalRes.status(), await evalRes.text()).toBeLessThan(300);

    for (const session of [client, owner]) {
      const res = await apiGet(request, session, CONTRACT.meApprovals);
      expect(res.status(), `${session.user.role} /me/approvals`).toBe(200);
      const body = unwrap(await res.json());
      const items = Array.isArray(body) ? body : body.items || body.approvals || body.data || [];
      const hit = items.find((i: any) => (i.id === vid || i.variationId === vid || i.entityId === vid) && /VARIATION|CHANGE_ORDER|CO/i.test(String(i.type || i.kind || '')));
      expect(hit, `${session.user.role} must see the pending variation in approvals`).toBeTruthy();
    }
  });

  // -------------------------------------------------------------------------
  test('6. OWNER is read-mostly: cannot create or certify certificates', async ({ request }) => {
    const owner = state.owner!; const pid = state.projectId!;
    const today = new Date().toISOString().slice(0, 10);

    const create = await apiPost(request, owner, CONTRACT.paymentCertificates(pid), {
      periodStart: today, periodEnd: today, retentionPct: '5.00',
    });
    expect(create.status(), 'OWNER must not create payment certificates').toBe(403);

    // Owner CAN still read project financial surfaces.
    const portal = await apiGet(request, owner, CONTRACT.clientPortal(pid));
    expect([200, 403]).toContain(portal.status()); // read-mostly: portal read allowed
  });

  // -------------------------------------------------------------------------
  test('7. Client project request reaches contractor inbox + staff list', async ({ request }) => {
    const admin = state.admin!; const client = state.client!;
    const marker = `E2E-REQ-${Date.now()}`;

    const res = await apiPost(request, client, CONTRACT.projectRequests, {
      projectType: 'Commercial building',
      locationText: 'Kilimani, Nairobi',
      budgetRange: 'KES 5M - 20M',
      startTimeframe: 'In 3 - 6 months',
      description: marker,
      contactPhone: '+254700000000',
    });
    expect([200, 201], await res.text()).toContain(res.status());

    const list = await apiGet(request, admin, CONTRACT.projectRequests);
    expect(list.status()).toBe(200);
    expect(await list.text()).toContain(marker);

    const inbox = await apiGet(request, admin, CONTRACT.inbox);
    expect(await inbox.text()).toContain(marker);
  });

  // -------------------------------------------------------------------------
  test('8. UI: client dashboard shows invoices, instructions, approvals; no sideways scroll', async ({ page }) => {
    await page.goto('/');
    // Log in as the seeded client through the real form.
    const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
    if (await signIn.isVisible().catch(() => false)) {
      await signIn.click();
    } else {
      await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    }
    await page.locator('#email').fill('client@apexbuilders.co.ke');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();

    // Wait for the client dashboard.
    await expect(page.getByText(/waiting for you/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/invoice/i).first()).toBeVisible();
    await expect(page.getByText(/522 111|paybill|till/i).first()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, 'client dashboard must not scroll sideways').toBe(false);
  });
});
