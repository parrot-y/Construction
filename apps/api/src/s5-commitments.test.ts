import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Gate-4 S5: Commitments -> Claims -> Payment Applications.
 * Retention = min(cumulative*pct, contractValue*capPct); advance recovery
 * = min(outstanding advance, gross*recoverPct); WHT on gross.
 */
describe('Gate-4 S5: Commitments & payment applications', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let tenantAId: string;
  let projectId: string;
  let commitmentId: string;
  const appIds: string[] = [];

  async function createApp(cookie: string, payload: any, cid = commitmentId, projId = projectId) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projId}/commitments/${cid}/applications`,
      headers: { cookie },
      payload,
    });
  }

  async function act(cookie: string, appId: string, action: string, extra: any = {}, cid = commitmentId, projId = projectId) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projId}/commitments/${cid}/applications/${appId}/action`,
      headers: { cookie },
      payload: { action, ...extra },
    });
  }

  beforeAll(async () => {
    await server.ready();

    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantAId = admin.body.user.tenant.id;
    qsCookie = (await login('qs@apexbuilders.co.ke')).cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;

    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: `S5-COM-${Date.now().toString().slice(-6)}`,
          name: 'S5 Commitments Test Project',
          status: 'ACTIVE',
          original_contract_sum: '50000000.00',
          current_approved_budget: '50000000.00',
        },
      });
      projectId = proj.id;
    });

    // Commitment: KES 10M subcontract, 10% retention capped at 5% of contract,
    // KES 1M advance paid, recover 20% of each gross claim.
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
      payload: {
        vendorName: 'Mombasa Electrical Contractors Ltd',
        vendorType: 'SUBCONTRACTOR',
        scopeDescription: 'Full electrical fit-out, containment and lighting',
        contractValue: '10000000.00',
        retentionPct: '10',
        retentionCapPct: '5',
        advanceAmount: '1000000.00',
        advancePaid: '1000000.00',
        advanceRecoverPct: '20',
        costCode: 'ELE-01',
      },
    });
    expect(res.statusCode).toBe(201);
    commitmentId = JSON.parse(res.body).data.id;
  });

  it('creates commitment COM-001 as ACTIVE with derived fields', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
    });
    const list = JSON.parse(res.body).data;
    expect(list).toHaveLength(1);
    expect(list[0].commitment_no).toBe(1);
    expect(list[0].status).toBe('ACTIVE');
    expect(list[0].contract_value).toBe('10000000.00');
    expect(list[0].certified_to_date).toBe('0.00');
    expect(list[0].net_amount_owed).toBe('0.00');
  });

  it('application 1: retention, advance recovery and WHT math', async () => {
    const res = await createApp(qsCookie, {
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
      grossClaimed: '2000000.00', whtPct: '3',
    });
    expect(res.statusCode).toBe(201);
    const app = JSON.parse(res.body).data;
    appIds.push(app.id);
    expect(app.application_no).toBe(1);
    expect(app.status).toBe('DRAFT');
    // cumulative 2M * 10% = 200k < cap 500k -> withheld 200k
    expect(app.retention_withheld).toBe('200000.00');
    expect(app.retention_held).toBe('200000.00');
    // advance: min(1M outstanding, 2M*20%=400k) = 400k
    expect(app.advance_recovered).toBe('400000.00');
    expect(app.advance_outstanding).toBe('600000.00');
    // wht 3% of 2M = 60k; net = 2M - 200k - 400k - 60k = 1,340,000
    expect(app.wht_amount).toBe('60000.00');
    expect(app.net_payable).toBe('1340000.00');
  });

  it('drives app1 through SUBMIT -> APPROVE -> PAID and derives app2 retention at cap', async () => {
    await act(qsCookie, appIds[0]!, 'SUBMIT');
    await act(adminCookie, appIds[0]!, 'APPROVE');
    const paid = await act(adminCookie, appIds[0]!, 'MARK_PAID', { paidReference: 'MPESA-TX998877' });
    expect(JSON.parse(paid.body).data.status).toBe('PAID');

    const res = await createApp(qsCookie, {
      periodStart: '2026-02-01', periodEnd: '2026-02-28',
      grossClaimed: '3000000.00',
    });
    const app = JSON.parse(res.body).data;
    appIds.push(app.id);
    // cumulative 5M * 10% = 500k = cap exactly -> withheld 300k (500-200)
    expect(app.previous_certified).toBe('2000000.00');
    expect(app.cumulative_certified).toBe('5000000.00');
    expect(app.retention_withheld).toBe('300000.00');
    expect(app.retention_held).toBe('500000.00');
    // advance outstanding before = 600k; recovery = min(600k, 3M*20%=600k) = 600k -> fully recovered
    expect(app.advance_recovered).toBe('600000.00');
    expect(app.advance_outstanding).toBe('0.00');
    // net = 3M - 300k - 600k = 2,100,000
    expect(app.net_payable).toBe('2100000.00');
  });

  it('app3 hits retention cap: zero further withholding, zero advance recovery', async () => {
    // app2 must be certified (APPROVED) before app3 for cumulative math
    await act(qsCookie, appIds[1]!, 'SUBMIT');
    await act(adminCookie, appIds[1]!, 'APPROVE');

    const res = await createApp(qsCookie, {
      periodStart: '2026-03-01', periodEnd: '2026-03-31',
      grossClaimed: '1000000.00',
    });
    const app = JSON.parse(res.body).data;
    appIds.push(app.id);
    // cumulative 6M * 10% = 600k > cap 500k -> held stays 500k, withheld 0
    expect(app.retention_withheld).toBe('0.00');
    expect(app.retention_held).toBe('500000.00');
    expect(app.advance_recovered).toBe('0.00');
    expect(app.net_payable).toBe('1000000.00');
  });

  it('commitment stats: certified, retention held, advance outstanding, amount owed', async () => {
    // app2 already APPROVED from previous test; app3 stays DRAFT
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
    });
    const c = JSON.parse(res.body).data[0];
    expect(c.certified_to_date).toBe('5000000.00'); // app1 PAID 2M + app2 APPROVED 3M (app3 DRAFT excluded)
    expect(c.retention_held).toBe('500000.00');
    expect(c.advance_outstanding).toBe('0.00');
    expect(c.net_amount_owed).toBe('2100000.00'); // app2 APPROVED net_payable
  });

  it('rejects illegal transitions and missing rejection reason', async () => {
    // app3 DRAFT -> APPROVE illegal
    expect((await act(adminCookie, appIds[2]!, 'APPROVE')).statusCode).toBe(400);
    await act(qsCookie, appIds[2]!, 'SUBMIT');
    expect((await act(adminCookie, appIds[2]!, 'REJECT', { comments: '' })).statusCode).toBe(400);
    const rej = await act(adminCookie, appIds[2]!, 'REJECT', { comments: 'Scope not yet executed' });
    expect(rej.statusCode).toBe(200);
    expect(JSON.parse(rej.body).data.status).toBe('REJECTED');
    // REJECTED is terminal
    expect((await act(qsCookie, appIds[2]!, 'SUBMIT')).statusCode).toBe(400);
  });

  it('enforces RBAC: site supervisor cannot create commitments or submit applications', async () => {
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: supervisorCookie },
      payload: { vendorName: 'Test Vendor', contractValue: '1000.00' },
    });
    expect(create.statusCode).toBe(403);

    const appCreate = await createApp(supervisorCookie, {
      periodStart: '2026-04-01', periodEnd: '2026-04-30', grossClaimed: '1000.00',
    });
    expect(appCreate.statusCode).toBe(403);
  });

  it('validates commitment payload edge cases', async () => {
    // advancePaid > advanceAmount -> 400
    const bad = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
      payload: {
        vendorName: 'Bad Advance Vendor',
        contractValue: '100000.00',
        advanceAmount: '10000.00',
        advancePaid: '50000.00',
      },
    });
    expect(bad.statusCode).toBe(400);

    // negative/zero gross claim -> 400
    const zero = await createApp(qsCookie, {
      periodStart: '2026-04-01', periodEnd: '2026-04-30', grossClaimed: '0',
    });
    expect(zero.statusCode).toBe(400);
  });

  it('scopes applications to their commitment and project', async () => {
    // Create a second commitment, then try to act on app1 under it -> 404
    const c2 = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
      payload: { vendorName: 'Supplier Two', vendorType: 'SUPPLIER', contractValue: '500000.00' },
    });
    const c2Id = JSON.parse(c2.body).data.id;

    const wrongCommitment = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/commitments/${c2Id}/applications/${appIds[0]}/action`,
      headers: { cookie: adminCookie },
      payload: { action: 'SUBMIT' },
    });
    expect(wrongCommitment.statusCode).toBe(404);

    // List scoping: commitment list only contains project commitments
    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
    });
    const items = JSON.parse(list.body).data;
    expect(items).toHaveLength(2);
    expect(items[0].applications.length).toBe(3);
    expect(items[1].applications.length).toBe(0);
  });

  it('blocks claims on terminated commitments', async () => {
    const c2res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/commitments`,
      headers: { cookie: qsCookie },
    });
    const c2 = JSON.parse(c2res.body).data.find((c: any) => c.vendor_name === 'Supplier Two');
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/commitments/${c2.id}`,
      headers: { cookie: qsCookie },
      payload: { status: 'TERMINATED' },
    });
    const res = await createApp(qsCookie, {
      periodStart: '2026-04-01', periodEnd: '2026-04-30', grossClaimed: '10000.00',
    }, c2.id);
    expect(res.statusCode).toBe(400);
  });
});
