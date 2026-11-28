import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * H2 — subcontractor retention request-to-paid, console side.
 *
 * The subcontractor requests a release through its portal link; the
 * contractor QS then reviews it in the console (Money → Financials →
 * Retention) at mobile width. Screenshot at each step, committed under
 * docs/evidence/visual/<commit>/h2-retention-console/.
 *
 * Real API + real DB + real browser. Fresh company per run.
 */

const RUN = Date.now();
const PASSWORD = 'H2Ret#2026';
const SHA = execSync('git rev-parse --short HEAD', { cwd: `${__dirname}/..` }).toString().trim();
const SHOTS = `../docs/evidence/visual/${SHA}/h2-retention-console`;
const TRADE = 'Nyota Electricals';

const S: {
  admin?: Session;
  pm?: Session;
  exec?: Session;
  projectId?: string;
  pkgId?: string;
  subToken?: string;
  releaseId?: string;
} = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@h2-retention.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: 'Kileleshwa Contractors Ltd', adminFullName: 'Peter Mwangi', email, phone: '+254712000888', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@h2-retention.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

async function newProject(request: APIRequestContext, owner: Session): Promise<string> {
  const q = await apiPost(request, owner, '/api/v1/quotes', {
    title: 'Kilimani Offices', clientName: 'Mr. Daniel Kiptoo', clientEmail: `c.${RUN}@h2-retention.test`, siteLocation: 'Kilimani, Nairobi',
    currency: 'KES', taxPct: 16, depositPct: 30, items: [{ description: 'Office fit-out', unit: 'sum', quantity: 1, unitRate: 6000000 }],
  });
  expect(q.status(), await q.text()).toBe(201);
  const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
  const sent = await (await apiPost(request, owner, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
  await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Mr. Daniel Kiptoo' } });
  const c = await apiPost(request, owner, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
  expect(c.status(), await c.text()).toBe(201);
  return (await c.json()).project.id;
}

async function uiLogin(page: Page, email: string) {
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
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe.serial('H2 — subcontractor retention console review', () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test('0. fixture: project, package, paid valuation, snag closed, release requested', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'qs', 'PM_QS', 'Jane Wanjiru');
    S.exec = await invite(request, S.admin, 'dir', 'EXECUTIVE', 'George Kamau');
    S.projectId = await newProject(request, S.admin);
    const member = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: S.pm.user.id, role: 'PM_QS' });
    expect([200, 201, 409]).toContain(member.status());
    const pid = S.projectId;

    const pkg = await apiPost(request, S.admin, `/api/v1/projects/${pid}/subcontractors`, {
      tradeCategory: TRADE, firmName: TRADE, subcontractSum: '400000.00', retentionRatePct: '10.00', status: 'ACTIVE',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
    const pkgBody = unwrap(await pkg.json());
    S.pkgId = pkgBody.id || pkgBody.package?.id || pkgBody.data?.id;

    // Package snag verified closed — release requests are gated on this.
    const snag = await apiPost(request, S.admin, `/api/v1/projects/${pid}/snags`, {
      locationFloor: 'Ground', locationRoom: 'LVL plant room', tradeCategory: TRADE,
      description: 'Contactor board earth bonding loose', severity: 'MINOR',
    });
    expect(snag.status(), await snag.text()).toBe(201);
    const snagBody = unwrap(await snag.json());
    const snagId = snagBody.id || snagBody.snag?.id || snagBody.data?.id;
    const chain: Record<string, string[]> = {
      VERIFIED_CLOSED: ['IN_PROGRESS', 'READY_FOR_REVIEW', 'VERIFIED_CLOSED'],
    };
    for (const s of chain.VERIFIED_CLOSED) {
      const r = await apiPatch(request, S.admin, `/api/v1/projects/${pid}/snags/${snagId}/status`, { status: s });
      expect(r.status(), `${s}: ${await r.text()}`).toBeLessThan(300);
    }

    // Portal link -> valuation -> approved for payment (retention held).
    const link = await apiPost(request, S.admin, `/api/v1/projects/${pid}/portals/links`, {
      portalType: 'SUBCONTRACTOR', stakeholderName: TRADE, subcontractorPackageId: S.pkgId, expiresInDays: 30,
    });
    expect(link.status(), await link.text()).toBe(201);
    S.subToken = unwrap(await link.json()).token;

    const submit = await request.post(`${API}/api/v1/portals/subcontractor/${S.subToken}/valuations`, {
      data: { grossWorkCertifiedKes: '200000.00', notes: 'First electrical claim' },
    });
    expect(submit.status(), await submit.text()).toBe(201);
    const valBody = unwrap(await submit.json());
    const valId = valBody.id || valBody.valuation?.id || valBody.data?.id;
    const valPath = `/api/v1/projects/${pid}/subcontractor-valuations/${valId}`;
    expect((await apiPatch(request, S.pm!, valPath, { paymentStatus: 'UNDER_REVIEW' })).status()).toBeLessThan(300);
    const appr = await apiPatch(request, S.admin, valPath, {
      paymentStatus: 'APPROVED_FOR_PAYMENT', tccOverrideReason: 'KRA TCC renewal in progress, client-approved for e2e',
    });
    expect(appr.status(), `approve valuation: ${await appr.text()}`).toBeLessThan(300);

    // The subcontractor requests its retention release.
    const rel = await request.post(`${API}/api/v1/portals/subcontractor/${S.subToken}/retention-release`);
    expect(rel.status(), await rel.text()).toBe(201);
    const relBody = unwrap(await rel.json());
    S.releaseId = relBody.id || relBody.release?.id || relBody.data?.id;
  });

  test('1. QS reviews the request in the console at 390px', async ({ page }) => {
    await uiLogin(page, `qs.${RUN}@h2-retention.test`);
    await page.goto('/app/money/financials');

    // Money → Financials → inner Retention tab.
    const retentionTab = page.getByRole('button', { name: 'retention' }).first();
    await expect(retentionTab).toBeVisible({ timeout: 30_000 });
    await retentionTab.click();

    // The pending release row with the QS recommend action.
    const row = page.locator('tr', { hasText: TRADE }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/01-qs-retention-pending-390.png`, fullPage: true });

    await row.getByRole('button', { name: 'QS Recommend' }).click();
    await expect(row).toContainText('Recommended by QS', { timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/02-qs-recommended-390.png`, fullPage: true });
  });

  test('2. director approves and pays; portal shows PAID', async ({ request }) => {
    const review = `/api/v1/projects/${S.projectId}/subcontractor-retention-releases/${S.releaseId}/review`;
    const appr = await apiPost(request, S.exec!, review, { action: 'APPROVE' });
    expect(appr.status(), await appr.text()).toBe(200);
    const paid = await apiPost(request, S.exec!, review, { action: 'MARK_PAID', disbursementRef: 'MPESA-B2C-4471902' });
    expect(paid.status(), await paid.text()).toBe(200);

    const get = await apiGet(request, S.admin!, `/api/v1/portals/subcontractor/${S.subToken}`);
    const d = unwrap(await get.json());
    const mine = (d.retentionReleases || []).find((r: any) => r.id === S.releaseId);
    expect(mine?.status).toBe('PAID');
    expect(d.retentionRelease.released).toBe('10000.00'); // 50% of KES 20,000 held at 10%
    expect(d.retentionRelease.outstanding).toBe('10000.00');
  });
});
