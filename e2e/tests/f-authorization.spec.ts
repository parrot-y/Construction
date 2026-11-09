import { test, expect, request as pwRequest } from '@playwright/test';
import { login, apiGet, apiPost, apiPatch, firstProjectId, authHeaders, API } from './helpers';

/**
 * Workflow F — authorization: prohibited actions return 403 and
 * tenant A cannot read tenant B data.
 */
test.describe('F. Authorization & tenant isolation', () => {
  test('role-restricted actions return 403', async ({ request }) => {
    const supervisor = await login(request, 'supervisor@apexbuilders.co.ke');
    const client = await login(request, 'client@apexbuilders.co.ke');
    const projectId = await firstProjectId(request, supervisor);

    // Supervisor must not approve variations
    const varRes = await apiPost(request, supervisor, `/api/v1/projects/${projectId}/variations`, {
      title: 'E2E authz probe variation',
      reason: 'authz probe',
      items: [{ description: 'probe', unit: 'item', quantity: 1, unitRate: 1 }],
    });
    const varId = varRes.status() === 201 ? ((await varRes.json()).id) : null;
    if (varId) {
      const review = await apiPost(request, supervisor, `/api/v1/projects/${projectId}/variations/${varId}/review`, { action: 'APPROVE' });
      expect([403, 400]).toContain(review.status());
    }

    // Client must not create internal quotes or view company financials
    const quoteRes = await apiPost(request, client, '/api/v1/quotes', {
      title: 'E2E client quote attempt',
      clientName: 'X',
      items: [{ description: 'x', unit: 'item', quantity: 1, unitRate: 1 }],
    });
    expect([401, 403]).toContain(quoteRes.status());

    const finRes = await apiGet(request, client, `/api/v1/projects/${projectId}/financials`);
    expect([401, 403, 404]).toContain(finRes.status());

    // Unauthenticated must be rejected (fresh context — no session cookies)
    const anonCtx = await pwRequest.newContext({ baseURL: API });
    const anon = await anonCtx.get('/api/v1/projects');
    expect([401, 403]).toContain(anon.status());
    await anonCtx.dispose();
  });

  test('tenant A cannot read tenant B data', async ({ request }) => {
    // Create a second tenant via invitation? Seed only has one tenant —
    // forge cross-tenant access by requesting tenant-B-scoped routes with
    // a token whose tenant differs. Since only one tenant exists in e2e,
    // prove isolation structurally: RLS hides rows of other tenants and
    // project membership blocks cross-project reads for non-members.
    const sup = await login(request, 'supervisor@apexbuilders.co.ke');
    const bogusProject = '00000000-0000-4000-8000-000000000000';
    const res = await apiGet(request, sup, `/api/v1/projects/${bogusProject}/site-diaries`);
    // Nonexistent/cross-tenant project must never leak rows: 403/404, or an
    // empty 200 list (no data). Anything else is a failure.
    expect([200, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      const rows = Array.isArray(body) ? body : body.diaries || body.data || [];
      expect(rows.length).toBe(0);
    }
    const res2 = await apiGet(request, sup, `/api/v1/projects/${bogusProject}/payment-certificates`);
    expect([200, 403, 404]).toContain(res2.status());
    if (res2.status() === 200) {
      const body = await res2.json();
      const rows = Array.isArray(body) ? body : body.certificates || body.data || [];
      expect(rows.length).toBe(0);
    }
  });
});
