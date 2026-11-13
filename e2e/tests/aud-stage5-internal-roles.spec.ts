import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, authHeaders, unwrap, Session } from './helpers';

/**
 * STAGE 5 — THE REMAINING INTERNAL ROLES (auditor-written acceptance test)
 *
 * Personas inside one contractor company: an executive, a superintendent, a site engineer,
 * a trade lead, an architect, a QA/QC officer, a site supervisor and a read-only viewer.
 * The questions: does each role get exactly the access its job needs, does project
 * scoping hold, is maker-checker real, and does changing or removing a person take
 * effect immediately (not when their token happens to expire)?
 *
 * Real API + real DB, no stubs. Do not weaken an assertion; change the feature. If a
 * route name differs, change CONTRACT below and say so in the PR, but keep the behaviour.
 */

const CONTRACT = {
  members: '/api/v1/company/members',
  memberRole: (id: string) => `/api/v1/company/members/${id}/role`,
  memberRemove: (id: string) => `/api/v1/company/members/${id}`,
};

const RUN = Date.now();
const PASSWORD = 'Stage5#2026pass';
const rowsOf = (b: any): any[] => {
  const u = unwrap(b);
  return Array.isArray(u) ? u : u?.items || u?.rows || u?.data || u?.members || u?.projects || Object.values(u || {}).find(Array.isArray) || [];
};
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const ROLES = ['EXECUTIVE', 'SUPERINTENDENT', 'SITE_ENGINEER', 'TRADE_LEAD', 'ARCHITECT', 'QA_QC', 'SITE_SUPERVISOR', 'VIEWER'] as const;
type R = (typeof ROLES)[number];

const S: {
  admin?: Session; pm?: Session; other?: Session;
  u: Partial<Record<R, Session>>; projectId?: string; otherProjectId?: string;
  costId?: string; inspectionId?: string; itemId?: string;
} = { u: {} };

async function register(request: APIRequestContext, tag: string): Promise<Session> {
  const email = `admin.${tag}.${RUN}@stage5-e2e.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `Nairobi Builders ${tag} ${RUN}`, adminFullName: 'Wanjiru Kamau', email, phone: '+254712000555', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}
async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@stage5-e2e.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}
async function newProject(request: APIRequestContext, owner: Session, title: string): Promise<string> {
  const q = await apiPost(request, owner, '/api/v1/quotes', {
    title, clientName: 'Dr. Evans Kiprop', clientEmail: `c.${RUN}@stage5-e2e.test`, siteLocation: 'Ngong Road, Nairobi',
    currency: 'KES', taxPct: 16, depositPct: 30, items: [{ description: 'Office block', unit: 'sum', quantity: 1, unitRate: 8000000 }],
  });
  expect(q.status(), await q.text()).toBe(201);
  const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
  const sent = await (await apiPost(request, owner, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
  await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
  const c = await apiPost(request, owner, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
  expect(c.status(), await c.text()).toBe(201);
  return (await c.json()).project.id;
}
const denied = (status: number) => status === 401 || status === 403 || status === 404;

test.describe.serial('Stage 5 — internal roles', () => {
  // ---------------------------------------------------------------------------
  test('0. Setup: company, two projects, a PM and eight role holders on project A only', async ({ request }) => {
    S.admin = await register(request, 'a');
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Otieno Odhiambo');
    S.projectId = await newProject(request, S.admin, `Ngong Road Office ${RUN}`);
    S.otherProjectId = await newProject(request, S.admin, `Karen Villas ${RUN}`);
    for (const role of ROLES) {
      S.u[role] = await invite(request, S.admin, role.toLowerCase().replace('_', ''), role, `${role} Tester`);
      const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: S.u[role]!.user.id, role });
      expect([200, 201, 409], `${role} assign: ${await m.text()}`).toContain(m.status());
    }
    const pm = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: S.pm.user.id, role: 'PM_QS' });
    expect([200, 201, 409]).toContain(pm.status());
  });

  // ---------------------------------------------------------------------------
  test('1. Project scoping: assigned to A means A only — never B, never by guessing the id', async ({ request }) => {
    for (const role of ['SUPERINTENDENT', 'SITE_ENGINEER', 'TRADE_LEAD', 'ARCHITECT', 'QA_QC', 'SITE_SUPERVISOR', 'VIEWER'] as R[]) {
      const list = rowsOf(await (await apiGet(request, S.u[role]!, '/api/v1/projects')).json());
      const ids = list.map((p: any) => p.id);
      expect(ids, `${role} must see project A`).toContain(S.projectId);
      expect(ids, `${role} must NOT see project B`).not.toContain(S.otherProjectId);
      const direct = await apiGet(request, S.u[role]!, `/api/v1/projects/${S.otherProjectId}`);
      expect(denied(direct.status()), `${role} direct GET of project B -> ${direct.status()}`).toBe(true);
      const diaryB = await apiGet(request, S.u[role]!, `/api/v1/projects/${S.otherProjectId}/site-diaries`);
      expect(denied(diaryB.status()), `${role} diary of project B -> ${diaryB.status()}`).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  test('2. Viewer is genuinely read-only and sees no money', async ({ request }) => {
    const v = S.u.VIEWER!;
    expect((await apiGet(request, v, `/api/v1/projects/${S.projectId}`)).status()).toBe(200);
    const writes: Array<[string, string, any]> = [
      ['POST', `/api/v1/projects/${S.projectId}/costs`, { projectId: S.projectId, costCategory: 'MATERIAL', amount: 1000, description: 'viewer write' }],
      ['POST', `/api/v1/projects/${S.projectId}/site-diaries`, { projectId: S.projectId, entryDate: iso(0), weather: 'SUNNY_CLEAR', siteStatus: 'OPERATIONAL', generalNotes: 'viewer write', laborHeadcounts: [{ tradeType: 'MASON', headcount: 1 }] }],
      ['POST', '/api/v1/invitations', { email: `v.${RUN}@stage5-e2e.test`, role: 'VIEWER' }],
      ['POST', `/api/v1/projects/${S.projectId}/inspections`, { checklistType: 'PRE_POUR_CONCRETE', title: 'viewer', location: 'Block A', scheduledDate: iso(1) }],
      ['POST', '/api/v1/announcements', { title: 'Viewer notice', body: 'should not post' }],
    ];
    for (const [, path, body] of writes) {
      const r = await apiPost(request, v, path, body);
      expect(r.status(), `VIEWER POST ${path} must be refused, got ${r.status()}`).toBe(403);
    }
    const costs = await apiGet(request, v, `/api/v1/projects/${S.projectId}/costs`);
    expect(costs.status(), 'viewer has no COST_VIEW').toBe(403);
    const budget = await apiGet(request, v, `/api/v1/projects/${S.projectId}/budget/summary`);
    expect(denied(budget.status()), `viewer budget summary -> ${budget.status()}`).toBe(true);
  });

  // ---------------------------------------------------------------------------
  test('3. Maker-checker: the superintendent can log a cost but cannot approve their own', async ({ request }) => {
    const sup = S.u.SUPERINTENDENT!;
    const create = await apiPost(request, sup, `/api/v1/projects/${S.projectId}/costs`, {
      projectId: S.projectId, costCategory: 'MATERIAL', amount: 5000, vendorName: 'Bamburi Cement', invoiceRef: `INV-${RUN}`, description: 'Cement for slab',
    });
    expect(create.status(), await create.text()).toBeLessThan(300);
    const created = unwrap(await create.json());
    S.costId = created.id || created.cost?.id || created.costEntry?.id;
    expect(S.costId).toBeTruthy();

    const self = await apiPost(request, sup, `/api/v1/projects/${S.projectId}/costs/${S.costId}/approve`, { action: 'APPROVED' });
    expect(self.status(), 'a person must not approve a cost they entered').toBeGreaterThanOrEqual(400);

    // Roles without COST_APPROVE are refused outright.
    for (const role of ['SITE_ENGINEER', 'TRADE_LEAD', 'ARCHITECT', 'QA_QC', 'SITE_SUPERVISOR', 'VIEWER'] as R[]) {
      const r = await apiPost(request, S.u[role]!, `/api/v1/projects/${S.projectId}/costs/${S.costId}/approve`, { action: 'APPROVED' });
      expect(r.status(), `${role} must not approve costs`).toBe(403);
    }

    // A different authorised person can.
    const ok = await apiPost(request, S.u.EXECUTIVE!, `/api/v1/projects/${S.projectId}/costs/${S.costId}/approve`, { action: 'APPROVED' });
    expect(ok.status(), await ok.text()).toBeLessThan(300);
    // Deciding twice must not double-post.
    const again = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/costs/${S.costId}/approve`, { action: 'APPROVED' });
    expect(again.status(), 'second decision on a decided cost must be refused').toBeGreaterThanOrEqual(400);
  });

  // ---------------------------------------------------------------------------
  test('4. Field engineers and trade leads have a money wall', async ({ request }) => {
    for (const role of ['SITE_ENGINEER', 'TRADE_LEAD'] as R[]) {
      const s = S.u[role]!;
      expect((await apiGet(request, s, `/api/v1/projects/${S.projectId}/costs`)).status(), `${role} costs`).toBe(403);
      const entry = await apiPost(request, s, `/api/v1/projects/${S.projectId}/costs`, { projectId: S.projectId, costCategory: 'LABOR', amount: 2000, description: 'field cost' });
      expect(entry.status(), `${role} must not create cost entries`).toBe(403);
      const inv = await apiPost(request, s, '/api/v1/invoices', { projectId: S.projectId, items: [{ description: 'x', quantity: 1, unitRate: 1 }] });
      expect(denied(inv.status()) || inv.status() === 400 || inv.status() === 422, `${role} create invoice -> ${inv.status()}`).toBe(true);
      expect(inv.status(), `${role} must not create invoices`).not.toBeLessThan(300);
      const members = await apiPost(request, s, '/api/v1/invitations', { email: `x.${role}.${RUN}@stage5-e2e.test`, role: 'WORKER' });
      expect(members.status(), `${role} must not invite`).toBe(403);
    }
    // But their real job works.
    const diary = await apiPost(request, S.u.SITE_ENGINEER!, `/api/v1/projects/${S.projectId}/site-diaries`, {
      projectId: S.projectId, entryDate: iso(0), weather: 'SUNNY_CLEAR', siteStatus: 'OPERATIONAL',
      generalNotes: 'Slab shuttering complete', laborHeadcounts: [{ tradeType: 'MASON', headcount: 14 }],
    }, { 'idempotency-key': `s5-diary-${RUN}` });
    expect(diary.status(), await diary.text()).toBeLessThan(300);
  });

  // ---------------------------------------------------------------------------
  test('5. Invite hierarchy: nobody can invite above themselves, most roles cannot invite at all', async ({ request }) => {
    const ex = S.u.EXECUTIVE!;
    const ok = await apiPost(request, ex, '/api/v1/invitations', { email: `exec.pm.${RUN}@stage5-e2e.test`, role: 'PM_QS' });
    expect(ok.status(), await ok.text()).toBe(201);
    for (const role of ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE']) {
      const r = await apiPost(request, ex, '/api/v1/invitations', { email: `exec.${role}.${RUN}@stage5-e2e.test`, role });
      expect(r.status(), `EXECUTIVE inviting ${role} must be refused`).toBeGreaterThanOrEqual(400);
    }
    for (const role of ['SUPERINTENDENT', 'ARCHITECT', 'QA_QC', 'SITE_SUPERVISOR', 'VIEWER'] as R[]) {
      const r = await apiPost(request, S.u[role]!, '/api/v1/invitations', { email: `${role}.inv.${RUN}@stage5-e2e.test`, role: 'WORKER' });
      expect(r.status(), `${role} must not invite`).toBe(403);
    }
  });

  // ---------------------------------------------------------------------------
  test('6. Quality workflow: QA/QC raises and fails an inspection, field engineer cannot sign it off', async ({ request }) => {
    for (const role of ['SITE_ENGINEER', 'ARCHITECT', 'VIEWER'] as R[]) {
      const r = await apiPost(request, S.u[role]!, `/api/v1/projects/${S.projectId}/inspections`, {
        checklistType: 'PRE_POUR_CONCRETE', title: `${role} attempt`, location: 'Block A', scheduledDate: iso(1),
      });
      expect(r.status(), `${role} lacks INSPECTION_REQUEST`).toBe(403);
    }
    const create = await apiPost(request, S.u.QA_QC!, `/api/v1/projects/${S.projectId}/inspections`, {
      checklistType: 'REBAR_VERIFICATION', title: 'Level 1 slab rebar', location: 'Block A, Level 1', scheduledDate: iso(1),
      inspectorName: 'QA_QC Tester', inspectorRole: 'QA/QC Officer',
      items: [{ orderIdx: 0, checkPoint: 'Cover 25mm', isMandatory: true }, { orderIdx: 1, checkPoint: 'Lap length 40d', isMandatory: true }],
    });
    expect(create.status(), await create.text()).toBe(201);
    const created = unwrap(await create.json());
    const ins = created.checklist || created.inspection || created;
    S.inspectionId = ins.id;
    S.itemId = (ins.items || [])[0]?.id;
    expect(S.inspectionId).toBeTruthy();
    expect(S.itemId, 'created checklist must return its items with ids').toBeTruthy();

    const itemPath = `/api/v1/projects/${S.projectId}/inspections/${S.inspectionId}/items/${S.itemId}`;
    const engineer = await request.put(`${API}${itemPath}`, { headers: authHeaders(S.u.SITE_ENGINEER!), data: { result: 'PASS' } });
    expect(engineer.status(), 'SITE_ENGINEER lacks INSPECTION_SUBMIT').toBe(403);

    const fail = await request.put(`${API}${itemPath}`, { headers: authHeaders(S.u.QA_QC!), data: { result: 'FAIL', deficiencyNotes: 'Cover only 15mm at gridline C4' } });
    expect(fail.status(), await fail.text()).toBeLessThan(300);

    // Everybody on the project can read the outcome, including the viewer.
    const seen = rowsOf(await (await apiGet(request, S.u.VIEWER!, `/api/v1/projects/${S.projectId}/inspections`)).json());
    expect(seen.map((i: any) => i.id)).toContain(S.inspectionId);
    // And project B stays invisible to the same viewer.
    const seenB = await apiGet(request, S.u.VIEWER!, `/api/v1/projects/${S.otherProjectId}/inspections`);
    expect(denied(seenB.status())).toBe(true);
  });

  // ---------------------------------------------------------------------------
  test('7. Announcements: executive posts, field roles read, field roles cannot post', async ({ request }) => {
    const post = await apiPost(request, S.u.EXECUTIVE!, '/api/v1/announcements', { title: 'Safety stand-down Friday', body: 'All gangs on site 7am for toolbox talk.', priority: 'HIGH', audience: 'ALL' });
    expect(post.status(), await post.text()).toBeLessThan(300);
    const rows = rowsOf(await (await apiGet(request, S.u.SITE_ENGINEER!, '/api/v1/announcements')).json());
    expect(rows.some((a: any) => /Safety stand-down/.test(a.title))).toBe(true);
    for (const role of ['SITE_ENGINEER', 'SITE_SUPERVISOR', 'TRADE_LEAD'] as R[]) {
      const r = await apiPost(request, S.u[role]!, '/api/v1/announcements', { title: 'Fake notice', body: 'Pay is cancelled' });
      expect(r.status(), `${role} must not post company announcements`).toBe(403);
    }
  });

  // ---------------------------------------------------------------------------
  test('8. Demoting a person takes effect on their existing session immediately', async ({ request }) => {
    const members = rowsOf(await (await apiGet(request, S.admin!, CONTRACT.members)).json());
    const sup = members.find((m: any) => (m.email || m.user?.email || '').startsWith(`superintendent.${RUN}`) || m.userId === S.u.SUPERINTENDENT!.user.id || m.user_id === S.u.SUPERINTENDENT!.user.id);
    expect(sup, 'superintendent must be in the member list').toBeTruthy();
    const membershipId = sup.membershipId || sup.membership_id || sup.id;

    const before = await apiPost(request, S.u.SUPERINTENDENT!, `/api/v1/projects/${S.projectId}/costs`, {
      projectId: S.projectId, costCategory: 'LABOR', amount: 3000, description: 'Casual labour week 1',
    });
    expect(before.status(), await before.text()).toBeLessThan(300);

    const demote = await apiPatch(request, S.admin!, CONTRACT.memberRole(membershipId), { role: 'VIEWER' });
    expect(demote.status(), await demote.text()).toBeLessThan(300);

    // NEW CONTRACT: the SAME token (no re-login) must lose the old rights straight away.
    const after = await apiPost(request, S.u.SUPERINTENDENT!, `/api/v1/projects/${S.projectId}/costs`, {
      projectId: S.projectId, costCategory: 'LABOR', amount: 3000, description: 'Casual labour week 2',
    });
    expect(after.status(), 'demoted user keeps old permissions until token expiry').toBe(403);
  });

  // ---------------------------------------------------------------------------
  test('9. Removing a person locks them out immediately, token and refresh included', async ({ request }) => {
    const members = rowsOf(await (await apiGet(request, S.admin!, CONTRACT.members)).json());
    const eng = members.find((m: any) => m.userId === S.u.SITE_ENGINEER!.user.id || m.user_id === S.u.SITE_ENGINEER!.user.id || (m.email || m.user?.email || '').startsWith(`siteengineer.${RUN}`));
    expect(eng, 'site engineer must be in the member list').toBeTruthy();
    const membershipId = eng.membershipId || eng.membership_id || eng.id;

    expect((await apiGet(request, S.u.SITE_ENGINEER!, `/api/v1/projects/${S.projectId}`)).status()).toBe(200);
    const rm = await request.delete(`${API}${CONTRACT.memberRemove(membershipId)}`, { headers: authHeaders(S.admin!) });
    expect(rm.status(), await rm.text()).toBeLessThan(300);

    // NEW CONTRACT: an already-issued access token must stop working right away.
    const stale = await apiGet(request, S.u.SITE_ENGINEER!, `/api/v1/projects/${S.projectId}`);
    expect(denied(stale.status()) && stale.status() !== 404, `removed user still has access: ${stale.status()}`).toBe(true);
    const diary = await apiGet(request, S.u.SITE_ENGINEER!, `/api/v1/projects/${S.projectId}/site-diaries`);
    expect(diary.status()).toBeGreaterThanOrEqual(401);
    // A fresh login must fail too.
    const relog = await request.post(`${API}/api/v1/auth/login`, { data: { email: `siteengineer.${RUN}@stage5-e2e.test`, password: PASSWORD } });
    expect(relog.status(), 'removed user must not be able to log in to this company').toBeGreaterThanOrEqual(400);
  });

  // ---------------------------------------------------------------------------
  test('10. Another company sees none of it, whatever role they hold', async ({ request }) => {
    S.other = await register(request, 'b');
    const list = rowsOf(await (await apiGet(request, S.other, '/api/v1/projects')).json());
    expect(list.map((p: any) => p.id)).not.toContain(S.projectId);
    for (const path of [`/api/v1/projects/${S.projectId}`, `/api/v1/projects/${S.projectId}/costs`, `/api/v1/projects/${S.projectId}/inspections`, `/api/v1/projects/${S.projectId}/site-diaries`]) {
      const r = await apiGet(request, S.other, path);
      expect(denied(r.status()), `other company GET ${path} -> ${r.status()}`).toBe(true);
    }
    const members = rowsOf(await (await apiGet(request, S.other, CONTRACT.members)).json());
    expect(JSON.stringify(members)).not.toContain(`superintendent.${RUN}`);
    const approve = await apiPost(request, S.other, `/api/v1/projects/${S.projectId}/costs/${S.costId}/approve`, { action: 'REJECTED' });
    expect(denied(approve.status()), 'cross-tenant cost approval').toBe(true);
  });
});
