import { test, expect, APIRequestContext } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { API, login, apiGet, apiPost, apiPatch, unwrap, Session } from './helpers';

/**
 * STAGE 6 — PORTAL CLOSEOUT LOOP (S6.2 acceptance journeys)
 *
 * Walks the real hand-over journey through the external portals with a
 * screenshot at each step, committed under
 * docs/evidence/visual/<commit>/portal-flows/:
 *
 *   consultant  — sees snags awaiting verification, verifies one closed
 *   client      — sees practical completion + snag counts + retention,
 *                 acknowledges with a typed name (once)
 *   subcontractor — sees its retention position, requests a release once
 *                 its package snags are verified closed
 *   supplier / compliance — tokens stay valid through HANDED_OVER
 *
 * Real API + real DB + real browser. Fresh company per run — never touches
 * the seeded demo tenant.
 */

const RUN = Date.now();
const PASSWORD = 'S6Portal#2026';
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const SHA = execSync('git rev-parse --short HEAD', { cwd: `${__dirname}/..` }).toString().trim();
// Playwright's cwd is e2e/ — evidence lives at the repo root.
const SHOTS = `../docs/evidence/visual/${SHA}/portal-flows`;

const S: {
  admin?: Session;
  pm?: Session;
  projectId?: string;
  consultantToken?: string;
  clientToken?: string;
  subToken?: string;
  supplierToken?: string;
  complianceToken?: string;
  snagForConsultant?: string;
  packageSnag?: string;
} = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@s6-portal.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: { companyName: `S6 Portal Builders ${RUN}`, adminFullName: 'Wanjiru S6', email, phone: '+254712000777', password: PASSWORD },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function invite(request: APIRequestContext, admin: Session, key: string, role: string, name: string): Promise<Session> {
  const email = `${key}.${RUN}@s6-portal.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, { data: { token, fullName: name, password: PASSWORD } });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

async function newProject(request: APIRequestContext, owner: Session): Promise<string> {
  const q = await apiPost(request, owner, '/api/v1/quotes', {
    title: `Lavington Closeout ${RUN}`, clientName: 'Mrs. Achieng Otieno', clientEmail: `c.${RUN}@s6-portal.test`, siteLocation: 'Lavington, Nairobi',
    currency: 'KES', taxPct: 16, depositPct: 30, items: [{ description: 'Closeout residence', unit: 'sum', quantity: 1, unitRate: 5000000 }],
  });
  expect(q.status(), await q.text()).toBe(201);
  const qid = unwrap(await q.json()).quote?.id || unwrap(await q.json()).id;
  const sent = await (await apiPost(request, owner, `/api/v1/quotes/${qid}/send`, { channel: 'link' })).json();
  await request.post(`${API}/api/public/quotes/${sent.shareToken || sent.share_token}/respond`, { data: { action: 'accept', typedName: 'Mrs. Achieng Otieno' } });
  const c = await apiPost(request, owner, `/api/v1/quotes/${qid}/convert`, { createDepositInvoice: false });
  expect(c.status(), await c.text()).toBe(201);
  return (await c.json()).project.id;
}

const mkLink = async (request: APIRequestContext, portalType: string, extra: Record<string, unknown> = {}) => {
  const r = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/portals/links`, {
    portalType, stakeholderName: `S6 ${portalType} ${RUN}`, expiresInDays: 30, ...extra,
  });
  expect(r.status(), `${portalType} link: ${await r.text()}`).toBe(201);
  return unwrap(await r.json()).token as string;
};

const createSnag = async (request: APIRequestContext, tradeCategory: string, description: string) => {
  const r = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/snags`, {
    locationFloor: 'Ground', locationRoom: 'Closeout room', tradeCategory, description, severity: 'MINOR',
  });
  expect(r.status(), await r.text()).toBe(201);
  const b = unwrap(await r.json());
  return b.id || b.snag?.id || b.data?.id;
};

const snagStatus = (request: APIRequestContext, snagId: string, status: string) =>
  apiPatch(request, S.admin!, `/api/v1/projects/${S.projectId}/snags/${snagId}/status`, { status });

const walkTo = async (request: APIRequestContext, snagId: string, target: string) => {
  const chain: Record<string, string[]> = {
    READY_FOR_REVIEW: ['IN_PROGRESS', 'READY_FOR_REVIEW'],
    VERIFIED_CLOSED: ['IN_PROGRESS', 'READY_FOR_REVIEW', 'VERIFIED_CLOSED'],
  };
  for (const s of chain[target] ?? [target]) {
    const r = await snagStatus(request, snagId, s);
    expect(r.status(), `${s}: ${await r.text()}`).toBeLessThan(300);
  }
};

test.describe.serial('Stage 6 — portal closeout journeys', () => {
  test.beforeAll(() => {
    mkdirSync(`${__dirname}/../../docs/evidence/visual/${SHA}/portal-flows`, { recursive: true });
  });

  test('0. fixture: company, project, snags, PC cert, packages, links', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invite(request, S.admin, 'pm', 'PM_QS', 'Otieno S6');
    S.projectId = await newProject(request, S.admin);
    const member = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, { userId: S.pm.user.id, role: 'PM_QS' });
    expect([200, 201, 409]).toContain(member.status());
    const pid = S.projectId;

    // Snag 1 — awaiting consultant verification.
    S.snagForConsultant = await createSnag(request, 'GENERAL', `Grouting void beside patio door ${RUN}`);
    await walkTo(request, S.snagForConsultant!, 'READY_FOR_REVIEW');

    // Subcontractor package + its own snag (will be verified closed).
    const TRADE = `S6-TILING-${RUN}`;
    const pkg = await apiPost(request, S.admin, `/api/v1/projects/${pid}/subcontractors`, {
      tradeCategory: TRADE, firmName: `S6 Tile Works ${RUN}`, subcontractSum: '400000.00', retentionRatePct: '10.00', status: 'ACTIVE',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
    const pkgBody = unwrap(await pkg.json());
    const pkgId = pkgBody.id || pkgBody.package?.id || pkgBody.data?.id;

    S.packageSnag = await createSnag(request, TRADE, `Tiles chipped at stair nosing ${RUN}`);
    await walkTo(request, S.packageSnag!, 'VERIFIED_CLOSED');

    // Sub valuation approved for payment -> retention held on the package.
    S.subToken = await mkLink(request, 'SUBCONTRACTOR', { stakeholderName: `S6 Tile Works ${RUN}`, subcontractorPackageId: pkgId });
    const submit = await request.post(`${API}/api/v1/portals/subcontractor/${S.subToken}/valuations`, {
      data: { grossWorkCertifiedKes: '150000.00', notes: 'First tiling claim' },
    });
    expect(submit.status(), await submit.text()).toBe(201);
    const subBody = unwrap(await submit.json());
    const valId = subBody.id || subBody.valuation?.id || subBody.data?.id;
    const valPath = `/api/v1/projects/${pid}/subcontractor-valuations/${valId}`;
    // Maker-checker: PM reviews, admin approves — never the same person.
    expect((await apiPatch(request, S.pm!, valPath, { paymentStatus: 'UNDER_REVIEW' })).status()).toBeLessThan(300);
    const appr = await apiPatch(request, S.admin, valPath, {
      paymentStatus: 'APPROVED_FOR_PAYMENT', tccOverrideReason: 'KRA TCC renewal in progress, client-approved for e2e',
    });
    expect(appr.status(), `approve valuation: ${await appr.text()}`).toBeLessThan(300);

    // Practical completion certificate (admin/PM/QS authority).
    const pc = await apiPost(request, S.admin, `/api/v1/projects/${pid}/certificates`, {
      certificateType: 'PRACTICAL_COMPLETION', certificateReference: `PC-${RUN}`,
      issueDate: iso(0), effectiveDate: iso(0), dlpDurationMonths: 6,
      architectName: 'Arch. Wanjiru M', architectBoraqsNo: 'A 4321',
      qsName: 'QS Otieno K', qsBoraqsNo: 'Q 8765',
    });
    expect(pc.status(), `PC cert: ${await pc.text()}`).toBe(201);

    // Portal links for the remaining journeys.
    S.consultantToken = await mkLink(request, 'CONSULTANT');
    S.clientToken = await mkLink(request, 'CLIENT');

    const sup = await apiPost(request, S.admin, '/api/v1/suppliers', {
      name: `S6 Builders Merchants ${RUN}`, contactPerson: 'Supplier Contact',
    });
    expect(sup.status(), await sup.text()).toBe(201);
    const supplierId = unwrap(await sup.json()).id;
    S.supplierToken = await mkLink(request, 'SUPPLIER', { stakeholderName: `S6 Builders Merchants ${RUN}`, supplierId });
    S.complianceToken = await mkLink(request, 'COMPLIANCE');
  });

  // -------------------------------------------------------------------------
  test('1. consultant portal: verify a rectified snag', async ({ page }) => {
    await page.goto(`/?portal=consultant&token=${S.consultantToken}`);
    await expect(page.getByTestId('consultant-portal-view')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `${SHOTS}/01-consultant-landing.png`, fullPage: true });

    await page.getByRole('button', { name: /Snag Verification/ }).click();
    // snag_number desc order — pick the card for OUR snag by its description.
    const card = page.locator('[data-testid^="consultant-snag-"]', { hasText: `Grouting void beside patio door ${RUN}` });
    await expect(card).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-consultant-snags.png`, fullPage: true });

    await card.getByRole('button', { name: /Verify — defect fixed/ }).click();
    await expect(page.getByText(/Snag verified and closed/)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/03-consultant-verified.png`, fullPage: true });
  });

  // -------------------------------------------------------------------------
  test('2. client portal: closeout card + acknowledge practical completion', async ({ page }) => {
    await page.goto(`/?portal=client&token=${S.clientToken}`);
    await expect(page.getByText('Client Portal')).toBeVisible({ timeout: 20000 });
    const card = page.getByTestId('client-closeout-card');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(/Practical completion/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-client-closeout.png`, fullPage: true });

    await card.getByTestId('client-acknowledge-pc').click();
    await page.fill('#app-dialog-input', 'Mrs. Achieng Otieno');
    await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await expect(page.getByText(/acknowledged by Mrs. Achieng Otieno/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/05-client-acknowledged.png`, fullPage: true });

    // Second acknowledgement is refused server-side.
    const dup = await page.request.post(`${API}/api/v1/portals/client/${S.clientToken}/closeout/acknowledge`, {
      data: { typedName: 'Someone Else' },
    });
    expect(dup.status()).toBe(409);
  });

  // -------------------------------------------------------------------------
  test('3. subcontractor portal: retention position + release request', async ({ page }) => {
    await page.goto(`/?portal=subcontractor&token=${S.subToken}`);
    await expect(page.getByTestId('subcontractor-portal-view')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /Trade Valuations/ }).click();

    const card = page.getByTestId('sub-retention-release-card');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(/Held/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/06-sub-retention-held.png`, fullPage: true });

    await card.getByTestId('request-retention-release-btn').click();
    await expect(page.getByText(/retention release .* requested/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/07-sub-release-requested.png`, fullPage: true });

    // Single-use: second request refused.
    const dup = await page.request.post(`${API}/api/v1/portals/subcontractor/${S.subToken}/retention-release`);
    expect(dup.status()).toBe(409);
  });

  // -------------------------------------------------------------------------
  test('4. supplier & compliance portals survive HANDED_OVER', async ({ request }) => {
    const handed = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/closeout/transition`, { stage: 'HANDED_OVER' });
    expect(handed.status(), await handed.text()).toBe(200);

    for (const [name, token] of [['supplier', S.supplierToken!], ['compliance', S.complianceToken!]] as const) {
      const res = await request.get(`${API}/api/v1/portals/${name}/${token}`);
      expect(res.status(), `${name} portal after HANDED_OVER`).toBe(200);
    }

    // Client portal still serves the closeout block after hand-over.
    const client = await request.get(`${API}/api/v1/portals/client/${S.clientToken}`);
    expect(client.status()).toBe(200);
    expect(unwrap(await client.json()).closeout?.practicalCompletion).toBeTruthy();
  });
});
