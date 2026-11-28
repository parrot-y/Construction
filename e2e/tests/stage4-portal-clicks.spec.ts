import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiPost, unwrap, Session, fixtureName } from './helpers';

/**
 * Stage-4 portal click coverage (PROJECT_STATUS OPEN item):
 *  - consultant portal Drawings tab — per-revision acknowledgement
 *  - compliance portal — statutory permits register + record-visit flow
 *
 * Real API + real DB + real browser on a fresh tenant.
 */

const RUN = Date.now().toString().slice(-6);
const PASSWORD = 'Stage4#2026';
const S: { admin?: Session; projectId?: string; consultantToken?: string; complianceToken?: string } = {};

async function register(request: APIRequestContext): Promise<Session> {
  const email = `admin.${RUN}@stage4.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: fixtureName('company', `s4-${RUN}`),
      adminFullName: 'Wanjiru Stage4',
      email,
      phone: '+254700555666',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

const mkLink = async (request: APIRequestContext, portalType: string) => {
  const r = await apiPost(request, S.admin!, `/api/v1/projects/${S.projectId}/portals/links`, {
    portalType,
    stakeholderName: `Stage4 ${portalType}`,
    expiresInDays: 30,
  });
  expect(r.status(), `${portalType} link: ${await r.text()}`).toBe(201);
  return unwrap(await r.json()).token as string;
};

test.describe.serial('stage-4 portals — drawings ack + compliance visits', () => {
  test('fixture: tenant, project, drawing, permit, portal links', async ({ request }) => {
    S.admin = await register(request);

    const proj = await apiPost(request, S.admin, '/api/v1/projects', {
      name: `Stage4 Offices ${RUN}`,
      code: `S4-${RUN}`,
      location: 'Upper Hill, Nairobi',
      contractValue: '15000000',
    });
    expect(proj.status(), await proj.text()).toBeLessThan(300);
    S.projectId = unwrap(await proj.json()).id;
    expect(S.projectId).toBeTruthy();

    const drawing = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/drawings`, {
      title: 'Ground floor framing plan',
      drawingNo: `A-${RUN}-101`,
      revision: 'Rev C',
      storageKey: `drawings/${RUN}/a101.pdf`,
      status: 'APPROVED_FOR_CONSTRUCTION',
    });
    expect(drawing.status(), await drawing.text()).toBe(201);

    const permit = await apiPost(request, S.admin, `/api/v1/projects/${S.projectId}/permits`, {
      permitType: 'NEMA_LICENSE',
      permitNumber: `NEMA/EIA/${RUN}`,
      issuer: 'NEMA',
      issuedDate: '2026-01-15',
      expiryDate: '2027-01-15',
      notes: 'EIA certificate for Stage4 Offices',
    });
    expect(permit.status(), await permit.text()).toBe(201);

    S.consultantToken = await mkLink(request, 'CONSULTANT');
    S.complianceToken = await mkLink(request, 'COMPLIANCE');
  });

  test('consultant portal: drawings tab lists revision and acknowledges it', async ({ page }) => {
    test.skip(!S.consultantToken, 'needs fixture');
    await page.goto(`/?portal=consultant&token=${S.consultantToken}`);
    await expect(page.getByTestId('consultant-portal-view')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /Drawings/ }).click();
    const card = page.locator('[data-testid^="consultant-drawing-"]');
    await expect(card).toHaveCount(1, { timeout: 15000 });
    await expect(card.getByText(`A-${RUN}-101`)).toBeVisible();
    await expect(card.getByText(/Rev C/)).toBeVisible();
    await expect(card.getByText(/Awaiting acknowledgement/)).toBeVisible();

    await card.getByRole('button', { name: 'Acknowledge this revision' }).click();
    await expect(page.getByText(/acknowledged — the project team can see your sign-off/i)).toBeVisible({ timeout: 15000 });
    await expect(card.getByText('Acknowledged')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Acknowledge this revision' })).toHaveCount(0);
  });

  test('compliance portal: permits register + record a site visit', async ({ page }) => {
    test.skip(!S.complianceToken, 'needs fixture');
    await page.goto(`/?portal=compliance&token=${S.complianceToken}`);
    await expect(page.getByTestId('compliance-portal-view')).toBeVisible({ timeout: 30000 });

    // Statutory permits register shows the seeded NEMA licence.
    await expect(page.getByText(`NEMA/EIA/${RUN}`)).toBeVisible({ timeout: 15000 });

    // Record a site visit with a required action.
    const card = page.getByTestId('compliance-visits-card');
    await card.getByTestId('visit-notes-input').fill('Edge protection on level 3 incomplete');
    await card.getByTestId('visit-action-input').fill('Fix edge protection and resubmit photos');
    await card.getByTestId('record-visit-btn').click();
    await expect(page.getByText(/Visit recorded/i)).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(/Edge protection on level 3 incomplete/)).toBeVisible();
  });
});
