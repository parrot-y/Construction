import { test, expect } from '@playwright/test';
import { login, apiGet, apiPost, apiPatch, firstProjectId, unwrap, API } from './helpers';

/**
 * Workflow C — variation raised → submitted → client approves via portal
 * token link → contract sum (approved variations total) updates.
 */
test.describe('C. Variation → client approval', () => {
  test('raise, submit, portal approve, contract sum updates', async ({ request }) => {
    const qs = await login(request, 'qs@apexbuilders.co.ke');
    const projectId = await firstProjectId(request, qs);

    // Baseline approved-variations total via client portal payload
    const portalRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/client-portal`);
    expect(portalRes.status()).toBe(200);
    const portalBefore = unwrap(await portalRes.json());
    const finB = portalBefore.financials || portalBefore;
    const beforeTotal = Number(finB.approved_variations_total ?? finB.approvedVariationsTotal ?? 0);

    // 1. Raise variation
    const createRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/variations`, {
      title: `E2E Extra foundation depth ${Date.now()}`,
      reason: 'E2E test: rock excavation deeper than borehole indicated',
      items: [{ description: 'Additional excavation m3', unit: 'm3', quantity: '5000', unitRate: '45000' }],
    });
    expect(createRes.status(), await createRes.text()).toBe(201);
    const created = unwrap(await createRes.json());
    const variationId = created.id || created.variation?.id;
    expect(variationId).toBeTruthy();

    // 2. Submit for review
    const submitRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/variations/${variationId}/submit`, {});
    expect(submitRes.status(), await submitRes.text()).toBe(200);

    // 2b. Internal review — large amount escalates to OWNER_REVIEW
    const reviewRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/variations/${variationId}/review`, { action: 'APPROVE' });
    expect([200, 201], await reviewRes.text()).toContain(reviewRes.status());

    // 3. Issue a client portal link and approve the CO through it
    const linkRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/portals/links`, {
      portalType: 'CLIENT',
      stakeholderName: 'E2E Client',
      expiresInDays: 7,
    });
    expect(linkRes.status(), await linkRes.text()).toBe(201);
    const link = unwrap(await linkRes.json());
    const token = link.token || link.rawToken || link.accessToken;
    expect(token).toBeTruthy();

    const cosRes = await request.get(`${API}/api/v1/portals/client/${token}/change-orders`);
    expect(cosRes.status(), await cosRes.text()).toBe(200);
    const cos = unwrap(await cosRes.json());
    const rows = Array.isArray(cos) ? cos : cos.changeOrders || cos.data || cos.variations || [];
    const target = rows.find((c: any) => c.id === variationId);
    expect(target, 'variation must appear in client portal CO list').toBeTruthy();

    const respondRes = await request.post(
      `${API}/api/v1/portals/client/${token}/change-orders/${variationId}/respond`,
      { data: { action: 'APPROVE', signedName: 'E2E Client' } },
    );
    expect(respondRes.status(), await respondRes.text()).toBe(200);

    // 4. Contract sum updates
    const portalAfter = await apiGet(request, qs, `/api/v1/projects/${projectId}/client-portal`);
    const after = unwrap(await portalAfter.json());
    const fin = after.financials || after;
    const afterTotal = Number(fin.approved_variations_total ?? fin.approvedVariationsTotal ?? 0);
    expect(afterTotal).toBeGreaterThan(beforeTotal);
  });
});
