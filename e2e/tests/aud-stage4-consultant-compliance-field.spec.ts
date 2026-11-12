import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * STAGE 4 — CONSULTANT, COMPLIANCE OFFICER AND FIELD ROLES (auditor-written acceptance test)
 *
 * Personas: Arch. Njeri Mutua (structural consultant, link only), Mr. Hassan Abdi
 * (NCA/county inspector, link only), Achieng Atieno (foreman) and Baraka Mwangi
 * (casual worker with a basic phone and no email address).
 *
 * Real API + real DB + real browser, no stubs. "NEW CONTRACT" steps test behaviour
 * that does not exist yet and are written to FAIL until it is built. Do not weaken
 * an assertion; change the feature. If a route name differs, change CONTRACT below
 * and say so in the PR, but keep the behaviour asserted.
 */

const CONTRACT = {
  // NEW CONTRACT: drawings register the consultant can read and acknowledge.
  addDrawing: (p: string) => `/api/v1/projects/${p}/drawings`,
  ackDrawing: (t: string, d: string) => `/api/v1/portals/consultant/${t}/drawings/${d}/acknowledge`,
  // NEW CONTRACT: consultant attaches a file to an RFI reply (verified upload, same rules as site uploads).
  consultantUpload: (t: string) => `/api/v1/portals/consultant/${t}/uploads`,
  // NEW CONTRACT: statutory permits register (NEMA, county approval, NCA registration, ...).
  permits: (p: string) => `/api/v1/projects/${p}/permits`,
  // NEW CONTRACT: the inspector records a visit outcome from the compliance link.
  recordVisit: (t: string) => `/api/v1/portals/compliance/${t}/visits`,
};

const RUN = Date.now();
const PASSWORD = 'Stage4#2026pass';
const rowsOf = (b: any): any[] => {
  const u = unwrap(b);
  return Array.isArray(u) ? u : u?.items || u?.rows || u?.data || Object.values(u || {}).find(Array.isArray) || [];
};
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const S: {
  admin?: Session; pm?: Session; sup?: Session; foreman?: Session; worker?: Session; workerPhone?: string;
  projectId?: string; otherProjectId?: string; rfiId?: string; overdueRfiId?: string;
  conTok?: string; conRfiOnlyTok?: string; compTok?: string; drawingId?: string; today?: string;
} = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@stage4-e2e.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `Mombasa Road Builders ${RUN}`, adminFullName: 'Wanjiru Kamau', email, phone: '+254712000444', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}
async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@stage4-e2e.test`;
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
async function newProject(request: APIRequestContext, title: string): Promise<string> {
  const q = await apiPost(request, S.admin!, '/api/v1/quotes', {
    title, clientName: 'Dr. Evans Kiprop', clientEmail: `c.${RUN}@stage4-e2e.test`, siteLocation: 'Mombasa Road, Nairobi',
    currency: 'KES', taxPct: 16, depositPct: 30, items: [{ description: 'Warehouse', unit: 'sum', quantity: 1, unitRate: 9000000 }],
  });
  expect(q.status(), await q.text()).toBe(201);
  const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
  const sent = await (await apiPost(request, S.admin!, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
  await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
  const c = await apiPost(request, S.admin!, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
  expect(c.status(), await c.text()).toBe(201);
  return (await c.json()).project.id;
}

test.describe.serial('Stage 4 — consultant, compliance, field roles', () => {
  // ---------------------------------------------------------------------------
  test('0. Setup: company, two projects, PM, supervisor, foreman', async ({ request }) => {
    S.admin = await register(request);
    S.today = iso(0);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Otieno Odhiambo');
    S.sup = await invite(request, S.admin, 'sup', 'SITE_SUPERVISOR', 'Mwangi Njoroge');
    S.foreman = await invite(request, S.admin, 'foreman', 'FOREMAN', 'Achieng Atieno');
    S.projectId = await newProject(request, `Mombasa Road Warehouse ${RUN}`);
    S.otherProjectId = await newProject(request, `Thika Road Showroom ${RUN}`);
    for (const [u, role] of [[S.pm, 'PM_QS'], [S.sup, 'SITE_SUPERVISOR'], [S.foreman, 'FOREMAN']] as const) {
      const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: u!.user.id, role });
      expect([200, 201, 409]).toContain(m.status());
    }
  });

  // ---------------------------------------------------------------------------
  test('1. Consultant answers an RFI with an attachment, once, and the PM is told [NEW CONTRACT]', async ({ request }) => {
    const rfi = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/rfis`, {
      issueType: 'RFI', title: 'Column C4 rebar spacing', question: 'Drawing S-102 shows R10 at 150 but schedule says 200. Which governs?',
      drawingReference: 'S-102 Rev B', priority: 'HIGH', costImpact: false, scheduleImpactDays: 2, assignedToRole: 'CONSULTANT', dueDate: iso(3),
    });
    expect(rfi.status(), await rfi.text()).toBeLessThan(300);
    S.rfiId = unwrap(await rfi.json()).id || unwrap(await rfi.json()).rfi?.id;

    // An RFI already past its due date must be flagged as overdue to the consultant.
    const late = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/rfis`, {
      title: 'Slab thickness at grid E', question: 'Confirm 200mm or 225mm at the loading bay.', priority: 'MEDIUM',
      assignedToRole: 'CONSULTANT', dueDate: iso(-4), drawingReference: 'S-110',
    });
    expect(late.status(), await late.text()).toBeLessThan(300);
    S.overdueRfiId = unwrap(await late.json()).id || unwrap(await late.json()).rfi?.id;

    const L = await link(request, { portalType: 'CONSULTANT', stakeholderName: 'Arch. Njeri Mutua', stakeholderRole: 'Structural Engineer' });
    S.conTok = L.token;

    const feed = unwrap(await (await request.get(`${API}/api/v1/portals/consultant/${S.conTok}`)).json());
    const rfis = feed.rfis || feed.data?.rfis || [];
    const late1 = rfis.find((r: any) => r.id === S.overdueRfiId);
    expect(late1, 'consultant sees the overdue RFI').toBeTruthy();
    expect(late1.isOverdue ?? late1.overdue, 'overdue RFI must be flagged').toBe(true);

    // Attach a marked-up sketch through a verified upload, then reply.
    const up = await request.post(`${API}${CONTRACT.consultantUpload(S.conTok!)}`, {
      multipart: { file: { name: 'S-102-markup.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') } },
    });
    expect(up.status(), `consultant uploads must exist. Body: ${await up.text()}`).toBe(201);
    const key = unwrap(await up.json()).storageKey;

    // An HTML file posing as a PDF must be refused.
    const evil = await request.post(`${API}${CONTRACT.consultantUpload(S.conTok!)}`, {
      multipart: { file: { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') } },
    });
    expect(evil.status()).toBeGreaterThanOrEqual(400);

    const rep = await request.post(`${API}/api/v1/portals/consultant/${S.conTok}/rfis/${S.rfiId}/reply`, {
      data: { officialAnswer: 'R10 @ 150 governs at C4. Schedule is to be corrected. See markup.', attachments: [{ storageKey: key, caption: 'Markup S-102' }] },
    });
    expect(rep.status(), await rep.text()).toBeLessThan(300);

    // One answer only.
    const again = await request.post(`${API}/api/v1/portals/consultant/${S.conTok}/rfis/${S.rfiId}/reply`, { data: { officialAnswer: 'Actually 200 governs.' } });
    expect([400, 409]).toContain(again.status());

    // PM is told, sees the attachment, and the consultant cannot be impersonated by the PM.
    const inbox = JSON.stringify(await (await apiGet(request, S.pm!, '/api/v1/inbox')).json());
    expect(inbox).toMatch(/Njeri Mutua|Column C4/);
    const detail = JSON.stringify(await (await apiGet(request, S.pm!, `/api/v1/projects/${S.projectId}/rfis`)).json());
    expect(detail).toContain('Markup S-102');
    expect(detail, 'responder must show the consultant, not the PM').toContain('Njeri Mutua');

    // After the PM closes it, the consultant sees it closed.
    const close = await apiPost(request, S.pm!, `/api/v1/projects/${S.projectId}/rfis/${S.rfiId}/close`, {});
    expect(close.status(), await close.text()).toBeLessThan(300);
    const after = unwrap(await (await request.get(`${API}/api/v1/portals/consultant/${S.conTok}`)).json());
    expect((after.rfis || after.data?.rfis).find((r: any) => r.id === S.rfiId).status).toBe('CLOSED');
  });

  // ---------------------------------------------------------------------------
  test('2. Consultant sees only what the link scope allows, plus drawings [NEW CONTRACT]', async ({ request }) => {
    // An RFI-only link must not carry payment certificates or inspection data.
    const narrow = await link(request, { portalType: 'CONSULTANT', stakeholderName: 'Eng. Peter Otieno', stakeholderRole: 'MEP', scopes: ['RFI'] });
    S.conRfiOnlyTok = narrow.token;
    const body = JSON.stringify(await (await request.get(`${API}/api/v1/portals/consultant/${S.conRfiOnlyTok}`)).json());
    expect(body, 'RFI-only scope must not include payment certificates').not.toMatch(/certificate|thisPeriodAmount|cumulative/i);
    expect(body).not.toMatch(/cubeTest|inspection/i);

    // Drawings register: contractor issues a revision, consultant sees and acknowledges it.
    const dr = await apiPost(request, S.pm!, CONTRACT.addDrawing(S.projectId!), {
      drawingNo: 'S-102', title: 'Column layout level 1', revision: 'C', issuedAt: S.today, storageKey: `uploads/s4-drawing-${RUN}.pdf`,
    });
    expect(dr.status(), `drawings register must exist. Body: ${await dr.text()}`).toBe(201);
    S.drawingId = unwrap(await dr.json()).id;
    const feed = JSON.stringify(await (await request.get(`${API}/api/v1/portals/consultant/${S.conTok}`)).json());
    expect(feed).toContain('S-102');
    expect(feed).toContain('Column layout level 1');
    const ack = await request.post(`${API}${CONTRACT.ackDrawing(S.conTok!, S.drawingId!)}`, { data: { note: 'Received Rev C' } });
    expect(ack.status(), await ack.text()).toBeLessThan(300);
    // The contractor can see who has acknowledged which revision.
    const reg = JSON.stringify(await (await apiGet(request, S.pm!, CONTRACT.addDrawing(S.projectId!))).json());
    expect(reg).toMatch(/Njeri Mutua/);

    // The link is limited to its project.
    const other = JSON.stringify(await (await request.get(`${API}/api/v1/portals/consultant/${S.conTok}`)).json());
    expect(other).not.toContain('Thika Road Showroom');
  });

  // ---------------------------------------------------------------------------
  test('3. Compliance officer sees real permits and records a visit, with no invented indicators [NEW CONTRACT]', async ({ request }) => {
    for (const p of [
      { type: 'NCA_REGISTRATION', number: 'NCA/CAT-4/2025/1182', issuedBy: 'National Construction Authority', expiresOn: iso(300) },
      { type: 'NEMA_EIA_LICENCE', number: 'NEMA/EIA/PSL/20111', issuedBy: 'NEMA', expiresOn: iso(20) },
      { type: 'COUNTY_BUILDING_APPROVAL', number: 'NCC/BP/2026/0457', issuedBy: 'Nairobi City County', expiresOn: iso(-5) },
    ]) {
      const r = await apiPost(request, S.pm!, CONTRACT.permits(S.projectId!), p);
      expect(r.status(), `permits register must exist. Body: ${await r.text()}`).toBe(201);
    }
    const L = await link(request, { portalType: 'COMPLIANCE', stakeholderName: 'Mr. Hassan Abdi', stakeholderRole: 'NCA Inspector' });
    S.compTok = L.token;
    const feed = unwrap(await (await request.get(`${API}/api/v1/portals/compliance/${S.compTok}`)).json());
    const txt = JSON.stringify(feed);

    // Real permits with honest status: valid, expiring within 30 days, expired.
    expect(txt).toContain('NCA/CAT-4/2025/1182');
    const permits = feed.permits || feed.data?.permits || [];
    const st = (n: string) => String(permits.find((p: any) => JSON.stringify(p).includes(n))?.status).toUpperCase();
    expect(st('NCA/CAT-4')).toMatch(/VALID|ACTIVE/);
    expect(st('NEMA/EIA')).toMatch(/EXPIR(ING|ES_SOON)|DUE/);
    expect(st('NCC/BP')).toMatch(/EXPIRED/);

    // No derived "clearance" claims that are not real records.
    expect(txt, 'levy clearance must not be inferred from unrelated data').not.toMatch(/levyClearance|levy_clearance|statutoryLevy/i);
    expect(txt).not.toMatch(/ncaSiteRegistration":"NCA\/PRJ/);
    expect(feed.passRate ?? feed.data?.passRate, 'no tests, no pass rate').toBeNull();

    // The inspector records a visit outcome; the contractor is told and it lands on the project record.
    const visit = await request.post(`${API}${CONTRACT.recordVisit(S.compTok!)}`, {
      data: { visitDate: S.today, outcome: 'NON_COMPLIANT', notes: 'No fall-arrest at level 2 edge, NEMA licence expires in 20 days', requiredActions: [{ description: 'Install edge protection', dueDate: iso(3) }] },
    });
    expect(visit.status(), `record-visit must exist. Body: ${await visit.text()}`).toBe(201);
    const inbox = JSON.stringify(await (await apiGet(request, S.admin!, '/api/v1/inbox')).json());
    expect(inbox).toMatch(/Hassan Abdi|edge protection|fall-arrest/i);
    const sees = JSON.stringify(await (await request.get(`${API}/api/v1/portals/compliance/${S.compTok}`)).json());
    expect(sees).toContain('Install edge protection');

    // Read-only everywhere else: the link cannot touch other endpoints.
    const poke = await request.post(`${API}/api/v1/portals/compliance/${S.compTok}/visits`, { data: {} });
    expect(poke.status()).toBeGreaterThanOrEqual(400);
  });

  // ---------------------------------------------------------------------------
  test('4. Field roles see only what they need', async ({ request }) => {
    // Foreman sees their project only.
    const ids = rowsOf(await (await apiGet(request, S.foreman!, '/api/v1/projects')).json()).map((p: any) => p.id);
    expect(ids).toContain(S.projectId);
    expect(ids).not.toContain(S.otherProjectId);

    // No money, no commercial data.
    for (const p of ['costs', 'commitments', 'subcontractor-valuations', 'subcontractors', 'budget/summary', 'payment-certificates']) {
      const r = await apiGet(request, S.foreman!, `/api/v1/projects/${S.projectId}/${p}`);
      expect([401, 403, 404], `foreman must not read ${p}`).toContain(r.status());
    }
    expect([401, 403, 404]).toContain((await apiGet(request, S.foreman!, '/api/v1/company/members')).status());
    const inv = await apiGet(request, S.foreman!, '/api/v1/invoices');
    expect([401, 403, 404]).toContain(inv.status());

    // Can file a diary and progress.
    const d = await apiPost(request, S.foreman!, `/api/v1/projects/${S.projectId}/site-diaries`, {
      projectId: S.projectId, entryDate: S.today, weather: 'SUNNY_CLEAR', siteStatus: 'OPERATIONAL',
      generalNotes: `Foreman diary ${RUN}`, laborHeadcounts: [{ tradeType: 'MASON', headcount: 8 }],
    }, { 'idempotency-key': `s4-f-${RUN}` });
    expect(d.status(), await d.text()).toBe(201);
  });

  // ---------------------------------------------------------------------------
  test('5. A worker with no email joins by phone and only sees their own entries [NEW CONTRACT]', async ({ request }) => {
    S.workerPhone = `+2547${String(RUN).slice(-8)}`;
    const inv = await apiPost(request, S.admin!, '/api/v1/invitations', { phone: S.workerPhone, role: 'WORKER' });
    expect(inv.status(), `phone invitations must exist. Body: ${await inv.text()}`).toBe(201);
    const token = unwrap(await inv.json()).token;

    const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: 'Baraka Mwangi', pin: '482913' } });
    expect(acc.status(), await acc.text()).toBeLessThan(300);
    // Weak PINs are refused.
    const inv2 = await apiPost(request, S.admin!, '/api/v1/invitations', { phone: `+2547${String(RUN + 1).slice(-8)}`, role: 'WORKER' });
    const weak = await request.post(`${API}/api/v1/invitations/accept`, { data: { token: unwrap(await inv2.json()).token, fullName: 'Test Weak', pin: '111111' } });
    expect(weak.status(), 'repeated-digit PIN must be refused').toBe(400);

    const lg = await request.post(`${API}/api/v1/auth/login`, { data: { phone: S.workerPhone, pin: '482913' } });
    expect(lg.status(), await lg.text()).toBe(200);
    const setCookie = lg.headers()['set-cookie'] || '';
    const cookie = setCookie.split(/,(?=[^;]+=)/).map((c) => c.split(';')[0]).join('; ');
    S.worker = { cookie, user: (await lg.json()).user, tenantId: (await lg.json()).user.tenant.id } as Session;

    // PIN guessing is rate limited.
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      const bad = await request.post(`${API}/api/v1/auth/login`, { data: { phone: S.workerPhone, pin: String(100000 + i) } });
      if (bad.status() === 429) { blocked = true; break; }
    }
    expect(blocked, 'repeated wrong PINs must be rate limited').toBe(true);

    // Worker sees their own diary entries only, never the foreman's notes.
    const m = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/members`, { userId: S.worker.user.id, role: 'WORKER' });
    expect([200, 201, 409]).toContain(m.status());
    const list = JSON.stringify(await (await apiGet(request, S.worker, `/api/v1/projects/${S.projectId}/site-diaries`)).json());
    expect(list, 'worker must not read the foreman diary').not.toContain(`Foreman diary ${RUN}`);
  });

  // ---------------------------------------------------------------------------
  test('6. Safety incident logged on site survives bad network and is stored once [NEW CONTRACT]', async ({ request, browser }) => {
    const body = { incidentDate: S.today, incidentType: 'NEAR_MISS', severity: 'MINOR', location: 'Level 2 edge', description: `Plank slipped, no injury ${RUN}` };
    const key = `s4-inc-${RUN}`;
    const first = await apiPost(request, S.foreman!, `/api/v1/projects/${S.projectId}/safety-incidents`, body, { 'idempotency-key': key });
    expect(first.status(), await first.text()).toBeLessThan(300);
    const replay = await apiPost(request, S.foreman!, `/api/v1/projects/${S.projectId}/safety-incidents`, body, { 'idempotency-key': key });
    expect(replay.status()).toBeLessThan(300);
    const list = rowsOf(await (await apiGet(request, S.sup!, `/api/v1/projects/${S.projectId}/safety-incidents`)).json());
    expect(list.filter((i: any) => JSON.stringify(i).includes(`Plank slipped, no injury ${RUN}`)).length, 'replayed incident must not duplicate').toBe(1);

    // The supervisor and PM are told about an incident.
    const inbox = JSON.stringify(await (await apiGet(request, S.pm!, '/api/v1/inbox')).json());
    expect(inbox).toMatch(/incident|near miss/i);

    // A phone with no signal must not crash the field screen.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await ctx.setOffline(true);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toContainText(/something went wrong|application error/i);
    await ctx.setOffline(false);
    await ctx.close();
  });

  // ---------------------------------------------------------------------------
  test('7. The product shows one honest name (SiteSafi), not a competitor or leftover brand', async ({ request, page }) => {
    // AMENDED 2026-11-13 (auditor): the owner named the product SiteSafi. Leftovers to purge are
    // the benchmark competitor's name (BuildSasa / Sasa), the old placeholder Mjengo, and the
    // spaced variant "Site Safi" (one spelling only).
    const LEFTOVER = /BuildSasa|\bSasa\b|Mjengo|Site Safi/i;
    const inbox = JSON.stringify(await (await apiGet(request, S.admin!, '/api/v1/inbox')).json());
    expect(inbox, 'system messages must not be signed with a leftover brand').not.toMatch(LEFTOVER);
    await page.goto('/');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(LEFTOVER);
    const title = await page.title();
    expect(title).not.toMatch(LEFTOVER);
    expect(title, 'browser tab must carry the product name').toMatch(/SiteSafi/);
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
      if (!href) return '';
      try { return await (await fetch(href)).text(); } catch { return ''; }
    });
    expect(manifest, 'installed-app name must not be a leftover brand').not.toMatch(LEFTOVER);
  });
});
