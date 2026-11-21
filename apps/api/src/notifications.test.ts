import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsersTx } from './test-members';

/**
 * Item 7 — real in-app inbox notifications for lifecycle events:
 * diary filed, variation awaiting review, certificate ready,
 * valuation submitted, portal action taken.
 */
describe('In-app notifications', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let tenantId: string;
  let projectId: string;
  let packageId: string;

  const login = async (email: string) => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };
  const authed = (cookie: string) => ({ cookie });

  const inboxBodies = async (cookie: string) => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/inbox?projectId=${projectId}`,
      headers: authed(cookie),
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.payload).data as any[]).map((m) => m.body as string);
  };

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantId = admin.body.user.tenant.id;
    const qs = await login('qs@apexbuilders.co.ke');
    qsCookie = qs.cookie;

    await withTenantTx(prisma, tenantId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantId,
          code: `LC-NOTIFY-${Date.now().toString().slice(-6)}`,
          name: 'Lifecycle Notify Test Project',
          status: 'ACTIVE',
          original_contract_sum: '1000000.00',
          current_approved_budget: '1000000.00',
        },
      });
      projectId = proj.id;
      await enrollAllTenantUsersTx(tx, tenantId, projectId);

      const pkg = await tx.subcontractorPackage.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          trade_category: 'ELECTRICAL',
          firm_name: 'VoltLine Electricals',
          subcontract_sum: '300000.00',
          retention_rate_pct: '5.00',
          status: 'ACTIVE',
        },
      });
      packageId = pkg.id;
    });
  });

  it('notifies the team when a site diary is filed', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: authed(qsCookie),
      payload: {
        entryDate: '2026-04-01',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
        generalNotes: 'Foundation excavation progressing on grid C',
      },
    });
    expect(res.statusCode).toBe(201);

    const bodies = await inboxBodies(adminCookie);
    expect(bodies.some((b) => b.includes('Site diary filed'))).toBe(true);
  });

  it('notifies the team when a variation is submitted for review', async () => {
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations`,
      headers: authed(qsCookie),
      payload: {
        title: 'Additional foundation piles',
        reason: 'Geotechnical report required deeper piles than tendered',
        items: [{ description: 'Extra piles', unit: 'nr', quantity: '4', unitRate: '50000.00' }],
      },
    });
    expect(create.statusCode).toBe(201);
    const variation = JSON.parse(create.payload).data ?? JSON.parse(create.payload);

    const submit = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${variation.id}/submit`,
      headers: authed(qsCookie),
    });
    expect(submit.statusCode).toBe(200);

    const bodies = await inboxBodies(adminCookie);
    expect(bodies.some((b) => b.includes('awaiting review') && b.includes('CO-'))).toBe(true);
  });

  it('notifies the team when a payment certificate is certified', async () => {
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates`,
      headers: authed(qsCookie),
      payload: { periodStart: '2026-04-01', periodEnd: '2026-04-30', thisPeriodAmount: '25000.00' },
    });
    expect(create.statusCode).toBe(201);
    const cert = JSON.parse(create.payload).data;

    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      const r = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`,
        headers: authed(adminCookie),
        payload: { action },
      });
      expect(r.statusCode).toBe(200);
    }

    const bodies = await inboxBodies(adminCookie);
    expect(bodies.some((b) => b.includes('certified') && b.includes('IPC-'))).toBe(true);
  });

  it('notifies the team when a subcontractor valuation is submitted', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractor-valuations`,
      headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: packageId,
        certificateNo: 'SC-VAL-N1',
        valuationDate: '2026-04-30',
        grossWorkCertifiedKes: '40000.00',
        retentionRatePct: '5.00',
      },
    });
    expect(res.statusCode).toBe(201);

    const bodies = await inboxBodies(adminCookie);
    expect(bodies.some((b) => b.includes('valuation') && b.includes('submitted'))).toBe(true);
  });

  it('notifies the team when a portal action is taken (consultant RFI reply)', async () => {
    // Create a CONSULTANT portal link — token returned once at creation.
    const linkRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/portals/links`,
      headers: authed(adminCookie),
      payload: { portalType: 'CONSULTANT', stakeholderName: 'Eng. Portal Tester', expiresInDays: 30 },
    });
    expect(linkRes.statusCode).toBe(201);
    const token = JSON.parse(linkRes.payload).data.token;
    expect(token).toBeTruthy();

    const rfiRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rfis`,
      headers: authed(qsCookie),
      payload: {
        title: 'Clarification on pile cap reinforcement',
        question: 'Please confirm the cover requirements for pile caps on grid C.',
        assignedToRole: 'CONSULTANT',
      },
    });
    expect(rfiRes.statusCode).toBe(201);
    const rfi = JSON.parse(rfiRes.payload).data ?? JSON.parse(rfiRes.payload);

    const reply = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/consultant/${token}/rfis/${rfi.id}/reply`,
      payload: { officialAnswer: 'Cover shall be 75mm all round per structural drawing S-201.', consultantName: 'Eng. Portal Tester' },
    });
    expect(reply.statusCode).toBe(200);

    const bodies = await inboxBodies(adminCookie);
    expect(bodies.some((b) => b.includes('Consultant replied'))).toBe(true);
  });
});
