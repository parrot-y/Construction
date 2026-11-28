import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * STAGE 2 — CLIENT AND OWNER JOURNEY (auditor-written acceptance test)
 *
 * Persona: Dr. Evans Kiprop, a diaspora client paying for a house in Karen from
 * abroad, and his representative the project OWNER. They are NOT the contractor.
 * They must see progress, approve variations, follow certificates and invoices,
 * tell the contractor they paid, and must NEVER see anything the contractor has
 * not chosen to share.
 *
 * Real API + real DB + real browser. No stubs. Steps marked "NEW CONTRACT" test
 * behaviour that does not exist yet and are written to FAIL until it is built.
 * Do not weaken an assertion; change the feature. If a route name differs,
 * change CONTRACT below and say so in the PR, but keep the behaviour asserted.
 */

const CONTRACT = {
  // NEW CONTRACT: client tells the contractor "I paid" (does not change invoice status).
  paymentNotice: (invoiceId: string) => `/api/v1/client/invoices/${invoiceId}/payment-notice`,
  // NEW CONTRACT: items waiting on the logged-in user (variations, certificates, quotes).
  approvals: '/api/v1/me/approvals',
  // NEW CONTRACT: exchange rates with provenance, or the UI must not offer conversion.
  fxRates: '/api/v1/fx-rates',
  // NEW CONTRACT: company payment instructions shown to clients (paybill/till/bank).
  paymentInstructions: '/api/v1/company/payment-instructions',
};

const RUN = Date.now();
const PASSWORD = 'Stage2#2026pass';
const money = (v: unknown) => Number(String(v ?? '0').replace(/,/g, ''));
const rowsOf = (b: any): any[] => {
  const u = unwrap(b);
  return Array.isArray(u) ? u : u?.items || u?.rows || u?.data || Object.values(u || {}).find(Array.isArray) || [];
};

const S: {
  admin?: Session; pm?: Session; sup?: Session; client?: Session; owner?: Session;
  projectId?: string; otherProjectId?: string; invoiceId?: string; certId?: string;
  variationId?: string; hiddenPhotoKey?: string; visiblePhotoKey?: string; clientToken?: string; clientLinkId?: string;
  itemId?: string;
} = {};

async function register(request: APIRequestContext, key: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@stage2-e2e.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: name, adminFullName: 'Wanjiru Kamau', email, phone: '+254712000222', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function inviteAndAccept(request: APIRequestContext, admin: Session, key: string, role: string, fullName: string): Promise<Session> {
  const email = `${key}.${RUN}@stage2-e2e.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

test.describe.serial('Stage 2 — client and owner', () => {
  // ---------------------------------------------------------------------------
  test('0. Contractor prepares a project with progress, a certificate and an invoice', async ({ request }) => {
    S.admin = await register(request, 'admin', `Karen Builders ${RUN}`);
    S.pm = await inviteAndAccept(request, S.admin, 'pm', 'PM_QS', 'Otieno Odhiambo');
    S.sup = await inviteAndAccept(request, S.admin, 'sup', 'SITE_SUPERVISOR', 'Mwangi Njoroge');
    S.client = await inviteAndAccept(request, S.admin, 'client', 'CLIENT', 'Dr. Evans Kiprop');
    S.owner = await inviteAndAccept(request, S.admin, 'owner', 'OWNER', 'Grace Wambui');

    const mk = async (title: string) => {
      const q = await apiPost(request, S.admin!, '/api/v1/quotes', {
        title, clientName: 'Dr. Evans Kiprop', clientEmail: `client.${RUN}@stage2-e2e.test`, siteLocation: 'Karen, Nairobi',
        currency: 'KES', taxPct: 16, depositPct: 30,
        items: [{ description: 'Substructure', unit: 'm3', quantity: 100, unitRate: 20000 }],
      });
      expect(q.status(), await q.text()).toBe(201);
      const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
      const s = await (await apiPost(request, S.admin!, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
      const tok = s.shareToken || s.share_token;
      await request.post(`${API}/api/public/quotes/${tok}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
      const c = await apiPost(request, S.admin!, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: true });
      expect(c.status(), await c.text()).toBe(201);
      return (await c.json()).project.id as string;
    };
    S.projectId = await mk(`Karen Maisonette ${RUN}`);
    S.otherProjectId = await mk(`Runda Garage ${RUN}`); // client must NOT see this one

    // The client belongs to the first project only; the owner to both.
    for (const [sess, role] of [[S.pm!, 'PM_QS'], [S.sup!, 'SITE_SUPERVISOR'], [S.client!, 'CLIENT'], [S.owner!, 'OWNER']] as const) {
      const m = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/members`, { userId: sess.user.id, role });
      expect([200, 201, 409], await m.text()).toContain(m.status());
    }
    const mo = await apiPost(request, S.admin!, `/api/v1/projects/${S.otherProjectId}/members`, { userId: S.owner!.user.id, role: 'OWNER' });
    expect([200, 201, 409]).toContain(mo.status());

    // BoQ + progress + certified certificate + invoice
    const boq = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/boq/confirm`, {
      sourceFilename: 's2.xlsx',
      sections: [{ title: 'Substructure', orderIdx: 0, subtotal: '2000000.00', items: [
        { itemCode: 'A1', description: 'Reinforced concrete', unit: 'm3', quantity: '100', unitRate: '20000', totalAmount: '2000000.00', isProvisional: false, status: 'VALID' },
      ] }],
    });
    expect(boq.status(), await boq.text()).toBeLessThan(300);
    const items = rowsOf(await (await apiGet(request, S.pm!, `/api/v1/projects/${S.projectId}/boq/items`)).json());
    S.itemId = items[0]?.id;
    expect(S.itemId).toBeTruthy();
    const today = new Date().toISOString().slice(0, 10);
    expect((await apiPost(request, S.sup!, `/api/v1/projects/${S.projectId}/progress`, {
      projectId: S.projectId, recordDate: today, overallProgress: '0.5000',
      items: [{ boqItemId: S.itemId, completedQuantity: '50', completionPct: '0.5000' }],
    })).status()).toBeLessThan(300);

    const cert = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/payment-certificates`, { periodStart: today, periodEnd: today, retentionPct: '5.00' });
    expect(cert.status(), await cert.text()).toBe(201);
    S.certId = unwrap(await cert.json()).id;
    for (const [who, action] of [[S.pm!, 'SUBMIT'], [S.pm!, 'REVIEW'], [S.admin!, 'CERTIFY']] as const) {
      const r = await apiPost(request, who, `/api/v1/projects/${S.projectId}/payment-certificates/${S.certId}/action`, { action });
      expect(r.status(), await r.text()).toBeLessThan(300);
    }
    const inv = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/payment-certificates/${S.certId}/create-invoice`, { taxPct: 16 });
    expect(inv.status(), await inv.text()).toBe(201);
    const iv = unwrap(await inv.json());
    S.invoiceId = iv.invoice?.id || iv.id;
  });

  // ---------------------------------------------------------------------------
  test('1. Client sees only their own project', async ({ request }) => {
    const list = rowsOf(await (await apiGet(request, S.client!, '/api/v1/projects')).json());
    const ids = list.map((p: any) => p.id);
    expect(ids).toContain(S.projectId);
    expect(ids, 'client must not see the other project').not.toContain(S.otherProjectId);
    const direct = await apiGet(request, S.client!, `/api/v1/projects/${S.otherProjectId}`);
    expect([403, 404]).toContain(direct.status());
  });

  // ---------------------------------------------------------------------------
  test('2. Client never sees what the contractor did not share [NEW CONTRACT]', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10);
    S.hiddenPhotoKey = `uploads/s2-hidden-${RUN}.jpg`;
    S.visiblePhotoKey = `uploads/s2-visible-${RUN}.jpg`;
    const d = await apiPost(request, S.sup!, `/api/v1/projects/${S.projectId}/site-diaries`, {
      projectId: S.projectId, entryDate: today, weather: 'SUNNY_CLEAR', siteStatus: 'OPERATIONAL',
      generalNotes: `INTERNAL ${RUN}: subcontractor dispute, do not share`,
      laborHeadcounts: [{ tradeType: 'MASON', headcount: 9 }],
      photos: [
        { storageKey: S.hiddenPhotoKey, caption: 'internal photo', clientVisible: false },
        { storageKey: S.visiblePhotoKey, caption: 'slab poured', clientVisible: true },
      ],
    }, { 'idempotency-key': `s2-${RUN}` });
    expect(d.status(), await d.text()).toBe(201);

    // Every API a client can reach must hide internal notes and hidden photos.
    const paths = [
      `/api/v1/projects/${S.projectId}/site-diaries`,
      `/api/v1/projects/${S.projectId}/client-portal`,
    ];
    for (const p of paths) {
      const body = JSON.stringify(await (await apiGet(request, S.client!, p)).json());
      expect(body, `${p} leaked internal diary notes`).not.toContain(`INTERNAL ${RUN}`);
      expect(body, `${p} leaked a photo not marked client-visible`).not.toContain(S.hiddenPhotoKey!);
    }
    // The shared photo IS visible through the client-portal feed.
    const feed = JSON.stringify(await (await apiGet(request, S.client!, `/api/v1/projects/${S.projectId}/client-portal`)).json());
    expect(feed).toContain(S.visiblePhotoKey);

    // The client cannot fetch the hidden file directly either.
    const file = await request.get(`${API}/${S.hiddenPhotoKey}`, { headers: { Cookie: S.client!.cookie } });
    expect([401, 403, 404]).toContain(file.status());

    // Contractor-only data stays closed to the client.
    for (const p of ['costs', 'subcontractors', 'subcontractor-valuations', 'commitments', 'budget/summary']) {
      const r = await apiGet(request, S.client!, `/api/v1/projects/${S.projectId}/${p}`);
      expect([401, 403, 404], `client must not read ${p}`).toContain(r.status());
    }
    const users = await apiGet(request, S.client!, '/api/v1/company/members');
    expect([401, 403, 404]).toContain(users.status());
  });

  // ---------------------------------------------------------------------------
  test('3. Client dashboard shows true contract terms, certificates and invoices [NEW CONTRACT]', async ({ request, page }) => {
    const feed = unwrap(await (await apiGet(request, S.client!, `/api/v1/projects/${S.projectId}/client-portal`)).json());
    expect(money(feed.retention_terms?.retention_pct ?? feed.retention_terms?.retentionPct ?? feed.retention_terms?.rate), 'retention term is the tenant setting (5), not a hard-coded 10').toBe(5);
    expect(feed.payment_certificates?.length).toBeGreaterThan(0);
    expect(Array.isArray(feed.invoices), 'client must see invoices with balance').toBe(true);
    const inv = feed.invoices.find((i: any) => (i.id || i.invoice_id) === S.invoiceId);
    expect(inv, 'the certificate invoice must appear for the client').toBeTruthy();
    expect(money(inv.balance ?? inv.balance_due)).toBeGreaterThan(0);

    // UI: sign in as the client through the real form, at the project's dashboard.
    await page.goto('/');
    const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
    if (await signIn.isVisible().catch(() => false)) await signIn.click();
    else await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await page.locator('#email').fill(`client.${RUN}@stage2-e2e.test`);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await expect(page.getByText(/Karen Maisonette/).first()).toBeVisible({ timeout: 30_000 });
    const text = await page.locator('body').innerText();
    expect(text, 'UI must not state a 10% retention term when the contract says 5%').not.toMatch(/10%\s*(of Gross|Retention)/i);
    expect(text).toMatch(/5\s*%/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), 'no sideways scroll').toBe(false);
  });

  // ---------------------------------------------------------------------------
  test('4. Currency conversion is honest or absent [NEW CONTRACT]', async ({ request, page }) => {
    // Diaspora clients think in USD or GBP. Either offer conversion with a real,
    // dated, sourced rate, or do not offer it. Never use a hard-coded rate.
    const fx = await apiGet(request, S.client!, CONTRACT.fxRates);
    const offersConversion = await page.getByRole('combobox', { name: /currency/i }).count()
      + await page.getByText(/USD|GBP|EUR|AED/).count();
    if (fx.status() === 200) {
      const b = unwrap(await fx.json());
      expect(b.base).toBe('KES');
      expect(b.asOf, 'rates need an as-of date').toBeTruthy();
      expect(b.source, 'rates need a named source').toBeTruthy();
      expect(Date.now() - new Date(b.asOf).getTime(), 'rates must be under 3 days old').toBeLessThan(3 * 24 * 3600 * 1000);
      await expect(page.getByText(/rates? as of/i).first()).toBeVisible();
    } else {
      expect(offersConversion, 'no rate source exists, so the UI must not show USD/GBP/EUR/AED conversion').toBe(0);
    }
  });

  // ---------------------------------------------------------------------------
  test('5. Client tells the contractor "I paid" without changing the invoice [NEW CONTRACT]', async ({ request }) => {
    const pi = await apiGet(request, S.client!, CONTRACT.paymentInstructions);
    expect(pi.status(), 'client needs to know where to pay (paybill/till/bank)').toBe(200);

    const before = unwrap(await (await apiGet(request, S.admin!, `/api/v1/invoices/${S.invoiceId}`)).json());
    const statusBefore = (before.invoice || before).status;

    const notice = await apiPost(request, S.client!, CONTRACT.paymentNotice(S.invoiceId!), {
      amount: 100000, method: 'M_PESA', reference: `SJK9${RUN % 100000}ZZ`, note: 'Sent from UK',
    });
    expect(notice.status(), await notice.text()).toBe(201);

    // Invoice status and balance are unchanged until the contractor confirms.
    const after = unwrap(await (await apiGet(request, S.admin!, `/api/v1/invoices/${S.invoiceId}`)).json());
    expect((after.invoice || after).status).toBe(statusBefore);

    // The contractor is told, and the notice carries the M-Pesa reference.
    const inbox = JSON.stringify(await (await apiGet(request, S.admin!, '/api/v1/inbox')).json());
    expect(inbox).toContain(`SJK9${RUN % 100000}ZZ`);

    // A client can never record a real payment themselves.
    const direct = await apiPost(request, S.client!, `/api/v1/invoices/${S.invoiceId}/payments`, { amount: 1, method: 'CASH' });
    expect([401, 403]).toContain(direct.status());

    // Contractor confirms the notice by recording the payment; the client sees the balance fall.
    const pay = await apiPost(request, S.admin!, `/api/v1/invoices/${S.invoiceId}/payments`, { amount: 100000, method: 'M_PESA', reference: `SJK9${RUN % 100000}ZZ` });
    expect(pay.status(), await pay.text()).toBeLessThan(300);
    const feed = unwrap(await (await apiGet(request, S.client!, `/api/v1/projects/${S.projectId}/client-portal`)).json());
    const inv = feed.invoices.find((i: any) => (i.id || i.invoice_id) === S.invoiceId);
    expect(money(inv.paid ?? inv.amount_paid)).toBeGreaterThanOrEqual(100000);
  });

  // ---------------------------------------------------------------------------
  test('6. Client approves a variation once, with the right states', async ({ request }) => {
    const v = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/variations`, {
      title: 'Add borehole', reason: 'Client request after site visit for water supply',
      triggerType: 'CLIENT_REQUEST',
      items: [{ description: 'Borehole drilling 60m', unit: 'm', quantity: 60, unitRate: 5000 }],
    });
    expect(v.status(), await v.text()).toBeLessThan(300);
    S.variationId = unwrap(await v.json()).id;

    // A DRAFT variation must not be approvable by the client.
    const early = await apiPost(request, S.client!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}/review`, { action: 'APPROVE', comments: 'too early' });
    expect(early.status(), 'client cannot approve a DRAFT').toBeGreaterThanOrEqual(400);

    await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}/submit`, {});
    await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}/review`, { action: 'EVALUATE', comments: 'Priced' });

    // NEW CONTRACT: it appears in the client's own approvals queue.
    const q = await apiGet(request, S.client!, CONTRACT.approvals);
    expect(q.status(), 'approvals queue must exist').toBe(200);
    expect(JSON.stringify(await q.json())).toContain('Add borehole');

    // Rejection needs a reason.
    const noReason = await apiPost(request, S.client!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}/review`, { action: 'REJECT' });
    expect(noReason.status()).toBe(400);

    const before = money(unwrap(await (await apiGet(request, S.client!, `/api/v1/projects/${S.projectId}/client-portal`)).json()).current_approved_budget);
    const ok = await apiPost(request, S.client!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}/review`, { action: 'APPROVE', comments: 'Approved from London' });
    expect(ok.status(), await ok.text()).toBeLessThan(300);
    const after = money(unwrap(await (await apiGet(request, S.client!, `/api/v1/projects/${S.projectId}/client-portal`)).json()).current_approved_budget);
    expect(after - before, '60 x 5,000 = 300,000').toBe(300000);

    const again = await apiPost(request, S.client!, `/api/v1/projects/${S.projectId}/variations/${S.variationId}/review`, { action: 'REJECT', comments: 'changed my mind' });
    expect(again.status(), 'second decision refused').toBeGreaterThanOrEqual(400);
  });

  // ---------------------------------------------------------------------------
  test('7. Owner has a real view: approvals, certificates, invoices, read-only elsewhere [NEW CONTRACT]', async ({ request, page }) => {
    const owner = S.owner!;
    // Sees both projects, can read certificates and invoices.
    const ids = rowsOf(await (await apiGet(request, owner, '/api/v1/projects')).json()).map((p: any) => p.id);
    expect(ids).toEqual(expect.arrayContaining([S.projectId, S.otherProjectId]));
    expect((await apiGet(request, owner, `/api/v1/projects/${S.projectId}/payment-certificates`)).status()).toBe(200);
    expect((await apiGet(request, owner, `/api/v1/invoices/${S.invoiceId}`)).status()).toBe(200);

    // Cannot change the contractor's operational data.
    const boq = await apiPost(request, owner, `/api/v1/projects/${S.projectId}/boq/confirm`, { sections: [] });
    expect([400, 401, 403]).toContain(boq.status());
    const diary = await apiPost(request, owner, `/api/v1/projects/${S.projectId}/site-diaries`, { projectId: S.projectId });
    expect([400, 401, 403]).toContain(diary.status());
    const pay = await apiPost(request, owner, `/api/v1/invoices/${S.invoiceId}/payments`, { amount: 1, method: 'CASH' });
    expect([401, 403]).toContain(pay.status());

    // Approvals queue exists for the owner and is not the contractor's console.
    const q = await apiGet(request, owner, CONTRACT.approvals);
    expect(q.status()).toBe(200);

    // UI: the owner lands on an owner view, not an empty or contractor-only console.
    await page.goto('/');
    const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
    if (await signIn.isVisible().catch(() => false)) await signIn.click();
    else await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await page.locator('#email').fill(`owner.${RUN}@stage2-e2e.test`);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await expect(page.getByText(/Karen Maisonette/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/approval|awaiting|needs your/i).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/something went wrong|application error|forbidden/i);
    // No contractor-only actions are offered to the owner.
    await expect(page.getByRole('button', { name: /import boq|new diary|record payment/i })).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  test('8. Client link (no account): shared photos only, honest expiry and revoke', async ({ request, page, browser }) => {
    const link = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/portals/links`, {
      portalType: 'CLIENT', stakeholderName: 'Dr. Evans Kiprop', expiresInDays: 14,
    });
    expect(link.status(), await link.text()).toBe(201);
    const l = unwrap(await link.json());
    S.clientToken = l.token;
    S.clientLinkId = l.id || l.link?.id;

    const api = JSON.stringify(await (await request.get(`${API}/api/v1/portals/client/${S.clientToken}`)).json());
    expect(api).not.toContain(`INTERNAL ${RUN}`);
    expect(api).not.toContain(S.hiddenPhotoKey!);
    expect(api).toContain(S.visiblePhotoKey!);
    expect(api, 'link payload must not carry contractor cost data').not.toMatch(/commitment|subcontractor_sum|margin/i);

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`/?portal=client&token=${S.clientToken}`);
    await expect(p.getByText(/Karen Maisonette/).first()).toBeVisible({ timeout: 20_000 });
    expect(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)).toBe(false);

    // Revoke: the same link must now fail honestly, not show stale data.
    const rev = await request.delete(`${API}/api/v1/projects/${S.projectId}/portals/links/${S.clientLinkId}`, { headers: { Cookie: S.admin!.cookie } });
    expect(rev.status(), await rev.text()).toBeLessThan(300);
    await p.reload();
    await expect(p.getByText(/revoked|no longer valid|expired/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(p.getByText(/Karen Maisonette/)).toHaveCount(0);
    await ctx.close();
  });

  // ---------------------------------------------------------------------------
  test('9. Client project request reaches the contractor', async ({ request }) => {
    const reqRes = await apiPost(request, S.client!, '/api/v1/client/project-requests', {
      projectType: 'RESIDENTIAL', siteLocation: 'Kitengela', workDescription: `Four-bedroom extension ${RUN}`,
    });
    expect(reqRes.status(), await reqRes.text()).toBeLessThan(300);
    const mine = JSON.stringify(await (await apiGet(request, S.client!, '/api/v1/client/project-requests')).json());
    expect(mine).toContain(`Four-bedroom extension ${RUN}`);
    // NEW CONTRACT: the contractor is notified of the request.
    const inbox = JSON.stringify(await (await apiGet(request, S.admin!, '/api/v1/inbox')).json());
    expect(inbox, 'contractor must see the client request in the inbox').toContain('Kitengela');
  });
});
