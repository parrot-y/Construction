import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * STAGE 6 — PRACTICAL COMPLETION, SNAGGING, RETENTION RELEASE AND CLOSEOUT
 * (auditor-written acceptance test)
 *
 * The end of a Kenyan building contract is where the money is released and where
 * disputes start: the architect certifies practical completion, snags must be
 * cleared and verified, half the retention is released at completion and the rest
 * after the defects liability period, and only then is the project closed.
 *
 * These tests describe the RIGHT behaviour. Tests marked [NEW CONTRACT] describe
 * behaviour that, from reading the code, does not exist yet; they are written to
 * FAIL until it does. Do not weaken an assertion; change the feature. If a route
 * name differs, change CONTRACT below and say so in the PR, keeping the behaviour.
 *
 * Real API + real DB, no stubs.
 */

const CONTRACT = {
  register: '/api/v1/auth/register-company',
  certificates: (pid: string) => `/api/v1/projects/${pid}/certificates`, // practical completion / DLP / final
  closeout: (pid: string) => `/api/v1/projects/${pid}/closeout`,
  closeoutTransition: (pid: string) => `/api/v1/projects/${pid}/closeout/transition`,
  snags: (pid: string) => `/api/v1/projects/${pid}/snags`,
  snagStatus: (pid: string, id: string) => `/api/v1/projects/${pid}/snags/${id}/status`,
};

const RUN = Date.now();
const PASSWORD = 'Stage6#2026pass';
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const money = (v: unknown) => Number(String(v ?? '0').replace(/,/g, ''));
const idOf = (o: any) => o?.id || o?.snag?.id || o?.data?.id || o?.project?.id;
const denied = (s: number) => s === 401 || s === 403 || s === 404;

const S: { admin?: Session; pm?: Session; sup?: Session; supt?: Session; projectId?: string; snagId?: string } = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@stage6-e2e.test`;
  const r = await request.post(`${API}${CONTRACT.register}`, {
    data: { companyName: `Closeout Builders ${RUN}`, adminFullName: 'Wanjiru Kamau', email, phone: '+254712000666', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}
async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@stage6-e2e.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}
async function newProject(request: APIRequestContext, owner: Session): Promise<string> {
  const q = await apiPost(request, owner, '/api/v1/quotes', {
    title: `Runda Residence ${RUN}`, clientName: 'Dr. Evans Kiprop', clientEmail: `c.${RUN}@stage6-e2e.test`, siteLocation: 'Runda, Nairobi',
    currency: 'KES', taxPct: 16, depositPct: 30, items: [{ description: 'Residence', unit: 'sum', quantity: 1, unitRate: 8000000 }],
  });
  expect(q.status(), await q.text()).toBe(201);
  const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
  const sent = await (await apiPost(request, owner, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
  await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Dr. Evans Kiprop' } });
  const c = await apiPost(request, owner, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
  expect(c.status(), await c.text()).toBe(201);
  return (await c.json()).project.id;
}
const pcBody = (over: Record<string, unknown> = {}) => ({
  certificateType: 'PRACTICAL_COMPLETION',
  certificateReference: `PC-${RUN}`,
  issueDate: iso(0),
  effectiveDate: iso(0),
  dlpDurationMonths: 6,
  architectName: 'Arch. Mwangi Kariuki',
  architectBoraqsNo: 'A 1234',
  qsName: 'QS Achieng Ouma',
  qsBoraqsNo: 'Q 5678',
  ...over,
});

test.describe.serial('Stage 6 — completion, snagging, retention release, closeout', () => {
  // ---------------------------------------------------------------------------
  test('0. Setup: company, project, PM, superintendent and site supervisor', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Otieno Odhiambo');
    S.supt = await invite(request, S.admin, 'supt', 'SUPERINTENDENT', 'Kamau Njoroge');
    S.sup = await invite(request, S.admin, 'sup', 'SITE_SUPERVISOR', 'Akinyi Otieno');
    S.projectId = await newProject(request, S.admin);
    for (const [s, role] of [[S.pm, 'PM_QS'], [S.supt, 'SUPERINTENDENT'], [S.sup, 'SITE_SUPERVISOR']] as const) {
      const m = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: s!.user.id, role });
      expect([200, 201, 409]).toContain(m.status());
    }
  });

  // ---------------------------------------------------------------------------
  test('1. [NEW CONTRACT] A snag waiting for verification still blocks closeout', async ({ request }) => {
    const pid = S.projectId!;
    const created = await apiPost(request, S.sup!, CONTRACT.snags(pid), {
      locationFloor: 'Ground', locationRoom: 'Living room', tradeCategory: 'Finishes',
      description: 'Cracked floor tile near the patio door', severity: 'MAJOR',
    });
    expect(created.status(), await created.text()).toBe(201);
    S.snagId = idOf(unwrap(await created.json())) || idOf(await created.json());
    expect(S.snagId, 'snag id returned').toBeTruthy();

    // Contractor says it is fixed and ready for the consultant to verify.
    for (const status of ['IN_PROGRESS', 'READY_FOR_REVIEW']) {
      const r = await apiPatch(request, S.sup!, CONTRACT.snagStatus(pid, S.snagId!), { status });
      expect(r.status(), `${status}: ${await r.text()}`).toBeLessThan(300);
    }
    const co = unwrap(await (await apiGet(request, S.admin!, CONTRACT.closeout(pid))).json());
    const open = Number(co?.checklist?.openSnagItems ?? co?.openSnagItems);
    expect(open, 'a snag in READY_FOR_REVIEW has NOT been verified, so it still counts as open').toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  test('2. [NEW CONTRACT] Only the right roles can certify completion or release retention', async ({ request }) => {
    const pid = S.projectId!;
    for (const [name, who] of [['site supervisor', S.sup!], ['superintendent', S.supt!]] as const) {
      const r = await apiPost(request, who, CONTRACT.certificates(pid), pcBody({ certificateReference: `PC-${name}-${RUN}` }));
      expect(denied(r.status()), `${name} must not issue a completion certificate -> ${r.status()}`).toBe(true);
    }
    // Nothing was created by the refused attempts.
    const co = unwrap(await (await apiGet(request, S.admin!, CONTRACT.closeout(pid))).json());
    expect(co?.checklist?.practicalCompletionCertificate ?? co?.practicalCompletionCertificate, 'no certificate exists yet').toBeFalsy();
  });

  // ---------------------------------------------------------------------------
  test('3. [NEW CONTRACT] Practical completion releases what was actually held, not a guess', async ({ request }) => {
    const pid = S.projectId!;
    // No payment certificate has ever withheld retention on this project, so nothing can be released.
    const pc = await apiPost(request, S.admin!, CONTRACT.certificates(pid), pcBody({ dlpDurationMonths: 6 }));
    expect(pc.status(), await pc.text()).toBe(201);
    const cert = await pc.json();
    expect(money(cert.retention_amount_released), 'default release must follow the retention actually held (none), not 2.5% of the contract sum').toBe(0);

    // A typed release larger than anything held must be refused.
    const over = await apiPost(request, S.admin!, CONTRACT.certificates(pid), pcBody({
      certificateType: 'MAKING_GOOD_DEFECTS', certificateReference: `MGD-${RUN}`, retentionAmountReleased: '5000000.00',
    }));
    expect(over.status(), 'cannot release KES 5,000,000 of retention that was never withheld').toBeGreaterThanOrEqual(400);
    expect(over.status()).toBeLessThan(500);
  });

  // ---------------------------------------------------------------------------
  test('4. [NEW CONTRACT] Completion with open snags does not mark the project completed; a second completion certificate is refused', async ({ request }) => {
    const pid = S.projectId!;
    const p = unwrap(await (await apiGet(request, S.admin!, `/api/v1/projects/${pid}`)).json());
    const status = String(p?.status ?? p?.project?.status);
    expect(status, 'project stays active while an unverified snag is open').not.toBe('COMPLETED');

    const again = await apiPost(request, S.admin!, CONTRACT.certificates(pid), pcBody({ certificateReference: `PC-DUP-${RUN}` }));
    expect(again.status(), 'a second practical completion certificate would release the first moiety twice').toBe(409);
  });

  // ---------------------------------------------------------------------------
  test('5. Closeout follows the order and cannot be skipped', async ({ request }) => {
    const pid = S.projectId!;
    // Skipping ahead is refused.
    const skip = await apiPost(request, S.admin!, CONTRACT.closeoutTransition(pid), { stage: 'CLOSED' });
    expect(skip.status()).toBeGreaterThanOrEqual(400);
    expect(skip.status()).toBeLessThan(500);

    const handed = await apiPost(request, S.admin!, CONTRACT.closeoutTransition(pid), { stage: 'HANDED_OVER' });
    expect(handed.status(), await handed.text()).toBe(200);
    const dlp = await apiPost(request, S.admin!, CONTRACT.closeoutTransition(pid), { stage: 'DEFECTS_LIABILITY' });
    expect(dlp.status(), await dlp.text()).toBe(200);

    // Closing now is refused: the defects period is still running.
    const early = await apiPost(request, S.admin!, CONTRACT.closeoutTransition(pid), { stage: 'CLOSED' });
    expect(early.status(), 'cannot close while the defects liability period is running').toBeGreaterThanOrEqual(400);
    expect(early.status()).toBeLessThan(500);

    // The closeout screen's people cannot advance it either.
    const sup = await apiPost(request, S.sup!, CONTRACT.closeoutTransition(pid), { stage: 'DEFECTS_EXPIRED' });
    expect(denied(sup.status()), `site supervisor must not advance closeout -> ${sup.status()}`).toBe(true);
  });
});
