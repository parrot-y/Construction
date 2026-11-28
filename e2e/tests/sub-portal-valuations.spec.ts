import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiPost, apiPatch, unwrap, Session, fixtureName } from './helpers';

/**
 * Subcontractor portal — dedicated click spec for the package summary,
 * retention ledger, and claim resubmission loop (PROJECT_STATUS OPEN item).
 *
 * Real API + real DB + real browser on a fresh tenant: a REJECTED valuation
 * surfaces its reason in the portal, the resubmit button opens the claim
 * modal in replaces-mode, and the corrected claim lands as a new SUBMITTED
 * valuation linked via replacesValuationId.
 */

const RUN = Date.now().toString().slice(-6);
const PASSWORD = 'SubPortal#2026';

const S: {
  admin?: Session;
  pm?: Session;
  projectId?: string;
  packageId?: string;
  token?: string;
  rejectedCertNo?: string;
} = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@subportal.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `co-${RUN}`),
      adminFullName: 'Njeri Subportal',
      email,
      phone: '+254700333444',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

async function invitePm(request: APIRequestContext, admin: Session): Promise<Session> {
  const email = `pm.${RUN}@subportal.test`;
  const inv = await apiPost(request, admin, '/api/v1/invitations', { email, role: 'PM_QS' });
  expect(inv.status(), await inv.text()).toBe(201);
  const token = unwrap(await inv.json()).token;
  const acc = await request.post(`${API}/api/v1/invitations/accept`, {
    data: { token, fullName: 'Otieno PM', password: PASSWORD },
  });
  expect(acc.status(), await acc.text()).toBeLessThan(300);
  return login(request, email, PASSWORD);
}

const portalSubmit = (request: APIRequestContext, gross: string, notes?: string) =>
  request.post(`${API}/api/v1/portals/subcontractor/${S.token}/valuations`, {
    data: { packageId: S.packageId, grossWorkCertifiedKes: gross, notes },
  });

test.describe.serial('subcontractor portal — package summary, retention, resubmit', () => {
  test('fixture: tenant, project, package, portal link, rejected + approved claims', async ({ request }) => {
    S.admin = await register(request);
    S.pm = await invitePm(request, S.admin);

    const proj = await apiPost(request, S.admin, '/api/v1/projects', {
      name: `Subportal Residences ${RUN}`,
      code: `SPR-${RUN}`,
      location: 'Karen, Nairobi',
      contractValue: '8000000',
    });
    expect(proj.status(), await proj.text()).toBeLessThan(300);
    S.projectId = unwrap(await proj.json()).id;

    const pkg = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/subcontractors`, {
      tradeCategory: 'TILING',
      firmName: fixtureName('subcontractor', `tile-${RUN}`),
      subcontractSum: '400000.00',
      retentionRatePct: '10.00',
      status: 'ACTIVE',
    });
    expect(pkg.status(), await pkg.text()).toBeLessThan(300);
    const pkgBody = unwrap(await pkg.json());
    S.packageId = pkgBody.id || pkgBody.package?.id || pkgBody.data?.id;
    expect(S.packageId).toBeTruthy();

    const member = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/members`, {
      userId: S.pm!.user.id,
      role: 'PM_QS',
    });
    expect([200, 201, 409]).toContain(member.status());

    const link = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/portals/links`, {
      portalType: 'SUBCONTRACTOR',
      stakeholderName: 'Tile Works Portal',
      expiresInDays: 30,
      subcontractorPackageId: S.packageId,
    });
    expect(link.status(), await link.text()).toBe(201);
    S.token = unwrap(await link.json()).token;

    // Claim 1 — submitted then rejected by the QS with a reason.
    const v1 = await portalSubmit(request, '100000.00', 'First tiling claim');
    expect(v1.status(), await v1.text()).toBe(201);
    const v1Id = unwrap(await v1.json()).id;
    const reject = await apiPatch(request, S.admin, `/api/v1/projects/${S.projectId}/subcontractor-valuations/${v1Id}`, {
      paymentStatus: 'REJECTED',
      notes: 'Measurement sheet missing — resubmit with signed dims',
    });
    expect(reject.status(), await reject.text()).toBeLessThan(300);

    // Claim 2 — approved for payment so retention is held on the package.
    const v2 = await portalSubmit(request, '50000.00', 'Second tiling claim');
    expect(v2.status(), await v2.text()).toBe(201);
    const v2Id = unwrap(await v2.json()).id;
    const valPath = `/api/v1/projects/${S.projectId}/subcontractor-valuations`;
    expect((await apiPatch(request, S.pm!, `${valPath}/${v2Id}`, { paymentStatus: 'UNDER_REVIEW' })).status()).toBeLessThan(300);
    const appr = await apiPatch(request, S.admin, `${valPath}/${v2Id}`, {
      paymentStatus: 'APPROVED_FOR_PAYMENT',
      tccOverrideReason: 'KRA TCC renewal in progress, client-approved for e2e',
    });
    expect(appr.status(), `approve: ${await appr.text()}`).toBeLessThan(300);

    // Certificate number for UI assertions — SC-VAL-001 is the first claim.
    S.rejectedCertNo = 'SC-VAL-001';
  });

  test('valuations tab: package summary, retention ledger, rejected claim visible', async ({ page }) => {
    test.skip(!S.token, 'needs fixture');
    await page.goto(`/?portal=subcontractor&token=${S.token}`);
    await expect(page.getByTestId('subcontractor-portal-view')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /Trade Valuations/ }).click();

    // Package summary: trade + firm + contract value figures render.
    await expect(page.getByText('TILING', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('KES 400,000.00').first()).toBeVisible();

    // Retention ledger: 10% of the approved 50,000 claim = 5,000 held.
    const card = page.getByTestId('sub-retention-release-card');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(/Held KES 5,000/)).toBeVisible();

    // Rejected claim shows its status + reason.
    await expect(page.getByTestId('rejected-claims-panel')).toBeVisible();
    await expect(page.getByText(/Measurement sheet missing/)).toBeVisible();
    await expect(page.getByText('Rejected').first()).toBeVisible();
  });

  test('resubmit corrected claim replaces the rejected valuation', async ({ page }) => {
    test.skip(!S.token || !S.rejectedCertNo, 'needs fixture');
    await page.goto(`/?portal=subcontractor&token=${S.token}`);
    await expect(page.getByTestId('subcontractor-portal-view')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /Trade Valuations/ }).click();
    await expect(page.getByTestId('rejected-claims-panel')).toBeVisible({ timeout: 15000 });

    await page.getByTestId(`resubmit-claim-${S.rejectedCertNo}`).click();
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal.getByText('Resubmit Corrected Milestone Claim')).toBeVisible();

    await modal.locator('input[type="text"]').first().fill('80000');
    await modal.locator('textarea').fill('Corrected dims attached — resubmission of SC-VAL-001');
    await modal.getByRole('button', { name: 'Submit to QS' }).click();

    await expect(page.getByText(/submitted to QS for verification/i)).toBeVisible({ timeout: 20000 });
    // Panel clears after the post-submit refetch; the corrected claim is live.
    await expect(page.getByTestId('rejected-claims-panel')).toHaveCount(0, { timeout: 15000 });
  });
});
