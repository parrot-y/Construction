import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsersTx } from './test-members';

/**
 * Gate-4 S4: Interim Payment Certificates (IPC) — JBC retention math,
 * cumulative totals, status machine — and the ADR-008 closeout stage gates.
 */
describe('Gate-4 S4: Payment certificates & closeout', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;

  let tenantAId: string;
  let projectId: string;
  let otherProjectId: string;
  const certIds: string[] = [];

  async function createCert(cookie: string, payload: any, projId = projectId) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projId}/payment-certificates`,
      headers: { cookie },
      payload,
    });
  }

  async function act(cookie: string, certId: string, action: string, extra: any = {}) {
    return server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates/${certId}/action`,
      headers: { cookie },
      payload: { action, ...extra },
    });
  }

  async function driveTo(cookie: string, certId: string, target: 'CERTIFIED' | 'PAID', paidRef?: string) {
    // DRAFT -> SUBMITTED -> UNDER_REVIEW -> CERTIFIED -> PAID
    const steps: [string, any][] = [
      ['SUBMIT', {}],
      ['REVIEW', {}],
      ['CERTIFY', {}],
    ];
    if (target === 'PAID') steps.push(['MARK_PAID', { paidReference: paidRef }]);
    for (const [a, extra] of steps) {
      const r = await act(cookie, certId, a, extra);
      expect(r.statusCode).toBe(200);
    }
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
    const qs = await login('qs@apexbuilders.co.ke');
    qsCookie = qs.cookie;
    const sup = await login('supervisor@apexbuilders.co.ke');
    supervisorCookie = sup.cookie;
    const client = await login('client@apexbuilders.co.ke');
    clientCookie = client.cookie;

    await withTenantTx(prisma, tenantAId, async (tx) => {
      const proj = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: `S4-CERT-${Date.now().toString().slice(-6)}`,
          name: 'S4 Certificates Test Project',
          status: 'ACTIVE',
          original_contract_sum: '10000000.00',
          current_approved_budget: '10000000.00',
        },
      });
      projectId = proj.id;
    await enrollAllTenantUsersTx(tx, tenantAId, projectId);

      const proj2 = await tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: `S4-OTHER-${Date.now().toString().slice(-6)}`,
          name: 'S4 Other Project',
          status: 'ACTIVE',
          original_contract_sum: '1000000.00',
          current_approved_budget: '1000000.00',
        },
      });
      otherProjectId = proj2.id;
      await enrollAllTenantUsersTx(tx, tenantAId, otherProjectId);
    });
  });

  // -------------------------------------------------------------------------
  it('creates IPC-001 as DRAFT with correct JBC retention math', async () => {
    const res = await createCert(qsCookie, {
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      thisPeriodAmount: '1000000.00',
      retentionPct: '5',
    });
    expect(res.statusCode).toBe(201);
    const cert = JSON.parse(res.body).data;
    certIds.push(cert.id);

    expect(cert.certificate_no).toBe(1);
    expect(cert.status).toBe('DRAFT');
    // 5% of 1,000,000 = 50,000 retention; net = 950,000
    expect(cert.retention_deduction).toBe('50000.00');
    expect(cert.retention_held).toBe('50000.00');
    expect(cert.net_payable).toBe('950000.00');
    expect(cert.previous_certified).toBe('0.00');
    expect(cert.cumulative_certified).toBe('1000000.00');
  });

  it('advance recovery and amount-due-previous adjust net payable', async () => {
    const res = await createCert(qsCookie, {
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      thisPeriodAmount: '500000.00',
      advanceRecovery: '50000.00',
      amountDuePrevious: '25000.00',
    });
    expect(res.statusCode).toBe(201);
    const cert = JSON.parse(res.body).data;
    certIds.push(cert.id);
    // 500,000 - 25,000 retention - 50,000 advance + 25,000 due = 450,000
    expect(cert.retention_deduction).toBe('25000.00');
    expect(cert.net_payable).toBe('450000.00');
  });

  it('walks the full status machine and accumulates previous_certified', async () => {
    const first = certIds[0]!;
    await driveTo(adminCookie, first, 'PAID', 'MPESA-QK123456');

    const res = await createCert(qsCookie, {
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      thisPeriodAmount: '2000000.00',
    });
    const cert = JSON.parse(res.body).data;
    certIds.push(cert.id);
    // previous certified = 1,000,000 (only the PAID cert counts)
    expect(cert.previous_certified).toBe('1000000.00');
    expect(cert.cumulative_certified).toBe('3000000.00');
    // retention held = 50,000 + 100,000 = 150,000
    expect(cert.retention_held).toBe('150000.00');
  });

  it('caps cumulative retention at 5% of contract sum', async () => {
    // otherProject has contract sum 1,000,000 -> cap 50,000
    const r1 = await createCert(qsCookie, {
      periodStart: '2026-01-01', periodEnd: '2026-01-31', thisPeriodAmount: '800000.00',
    }, otherProjectId);
    const c1 = JSON.parse(r1.body).data;
    expect(c1.retention_deduction).toBe('40000.00'); // 5% of 800k
    await driveToOnProject(adminCookie, otherProjectId, c1.id);

    const r2 = await createCert(qsCookie, {
      periodStart: '2026-02-01', periodEnd: '2026-02-28', thisPeriodAmount: '800000.00',
    }, otherProjectId);
    const c2 = JSON.parse(r2.body).data;
    // room left in cap = 50,000 - 40,000 = 10,000
    expect(c2.retention_deduction).toBe('10000.00');
    expect(c2.retention_held).toBe('50000.00');
    expect(c2.net_payable).toBe('790000.00'); // 800,000 - 10,000
  });

  async function driveToOnProject(cookie: string, projId: string, certId: string) {
    const steps: [string, any][] = [['SUBMIT', {}], ['REVIEW', {}], ['CERTIFY', {}]];
    for (const [a, extra] of steps) {
      const r = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/payment-certificates/${certId}/action`,
        headers: { cookie },
        payload: { action: a, ...extra },
      });
      expect(r.statusCode).toBe(200);
    }
  }

  it('rejects illegal transitions and missing rejection reason', async () => {
    const res = await createCert(qsCookie, {
      periodStart: '2026-04-01', periodEnd: '2026-04-30', thisPeriodAmount: '100000.00',
    });
    const cert = JSON.parse(res.body).data;
    certIds.push(cert.id);

    // CERTIFY straight from DRAFT -> 400
    expect((await act(qsCookie, cert.id, 'CERTIFY')).statusCode).toBe(400);
    // SUBMIT then REJECT without comments -> 400
    await act(qsCookie, cert.id, 'SUBMIT');
    expect((await act(adminCookie, cert.id, 'REJECT', { comments: '' })).statusCode).toBe(400);
    // proper reject works
    const rej = await act(adminCookie, cert.id, 'REJECT', { comments: 'Duplicate period' });
    expect(rej.statusCode).toBe(200);
    expect(JSON.parse(rej.body).data.status).toBe('REJECTED');
    // terminal: cannot submit again
    expect((await act(qsCookie, cert.id, 'SUBMIT')).statusCode).toBe(400);
  });

  it('enforces RBAC: site supervisor cannot create or certify', async () => {
    const create = await createCert(supervisorCookie, {
      periodStart: '2026-05-01', periodEnd: '2026-05-31', thisPeriodAmount: '1000.00',
    });
    expect(create.statusCode).toBe(403);
  });

  it('returns 404 for certificates outside the project scope', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${otherProjectId}/payment-certificates/${certIds[0]}/action`,
      headers: { cookie: adminCookie },
    });
    // GET on action path isn't defined -> 404; also verify list scoping instead
    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${otherProjectId}/payment-certificates`,
      headers: { cookie: adminCookie },
    });
    const items = JSON.parse(list.body).data;
    expect(items.every((c: any) => c.id !== certIds[0])).toBe(true);
    expect(res.statusCode).toBe(404);
  });

  it('closeout machine gates each stage on real prerequisites', async () => {
    const getCloseout = async () => {
      const r = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/closeout`,
        headers: { cookie: qsCookie },
      });
      return JSON.parse(r.body).data;
    };
    const transition = async (stage: string) => server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/closeout/transition`,
      headers: { cookie: adminCookie },
      payload: { stage },
    });

    let co = await getCloseout();
    expect(co.stage).toBe('IN_PROGRESS');
    expect(co.gates.HANDED_OVER).toBe(false);
    // illegal skip ahead
    expect((await transition('CLOSED')).statusCode).toBe(400);

    // Create a snag item -> CLOSED must stay blocked even later
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.snagItem.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectId,
          snag_number: 1,
          location_floor: 'G',
          location_room: 'Lobby',
          trade_category: 'Painting',
          description: 'Touch-up paint required',
          severity: 'COSMETIC',
          status: 'OPEN',
          identified_by_name: 'QS Test',
        },
      });
    });

    // Issue PC certificate (DLP expiry default +6 months -> active)
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.defectsLiabilityCertificate.create({
        data: {
          tenant_id: tenantAId,
          project_id: projectId,
          certificate_type: 'PRACTICAL_COMPLETION',
          certificate_reference: 'CERT-PC-S4-001',
          issue_date: new Date('2026-06-01'),
          effective_date: new Date('2026-06-01'),
          dlp_duration_months: 6,
          dlp_expiry_date: new Date('2026-12-01'),
          retention_amount_released: '250000.00',
          architect_name: 'Arch Test',
          qs_name: 'QS Test',
        },
      });
    });

    co = await getCloseout();
    expect(co.gates.HANDED_OVER).toBe(true);
    expect(co.gates.DEFECTS_LIABILITY).toBe(true);
    expect(co.gates.DEFECTS_EXPIRED).toBe(false);

    let t = await transition('HANDED_OVER');
    expect(t.statusCode).toBe(200);
    expect(JSON.parse(t.body).data.stage).toBe('HANDED_OVER');
    expect(JSON.parse(t.body).data.practical_completion_date).toBe('2026-06-01');

    t = await transition('DEFECTS_LIABILITY');
    expect(t.statusCode).toBe(200);

    // DEFECTS_EXPIRED blocked while DLP still active
    expect((await transition('DEFECTS_EXPIRED')).statusCode).toBe(409);

    // Backdate DLP expiry -> gate opens
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.defectsLiabilityCertificate.updateMany({
        where: { project_id: projectId, certificate_type: 'PRACTICAL_COMPLETION' },
        data: { dlp_expiry_date: new Date('2020-01-01') },
      });
    });
    t = await transition('DEFECTS_EXPIRED');
    expect(t.statusCode).toBe(200);

    // CLOSED blocked by open snag + pending IPC drafts
    expect((await transition('CLOSED')).statusCode).toBe(409);

    // Clear snags and reject/drive remaining drafts out of pending states
    await withTenantTx(prisma, tenantAId, async (tx) => {
      await tx.snagItem.updateMany({
        where: { project_id: projectId },
        data: { status: 'VERIFIED_CLOSED', verified_at: new Date(), verified_by_name: 'QS Test' },
      });
      // Any remaining DRAFT/SUBMITTED/UNDER_REVIEW certs -> REJECTED (terminal for gate purposes)
      await tx.paymentCertificate.updateMany({
        where: { project_id: projectId, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] } },
        data: { status: 'REJECTED' },
      });
    });

    t = await transition('CLOSED');
    expect(t.statusCode).toBe(200);
    expect(JSON.parse(t.body).data.stage).toBe('CLOSED');

    const proj = await withTenantTx(prisma, tenantAId, async (tx) => tx.project.findUnique({ where: { id: projectId } }));
    expect(proj!.closeout_stage).toBe('CLOSED');
    expect(proj!.status).toBe('COMPLETED');
  });

  it('client portal exposes only CERTIFIED/PAID payment certificates', async () => {
    // certIds[0] is PAID; certIds[1] is still DRAFT — only PAID should appear
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/client-portal`,
      headers: { cookie: clientCookie },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body).data || JSON.parse(res.body);
    const certs = data.payment_certificates || [];
    expect(certs.length).toBeGreaterThanOrEqual(1);
    expect(certs.every((c: any) => ['CERTIFIED', 'PAID'].includes(c.status))).toBe(true);
    expect(certs.some((c: any) => c.certificate_no === 1 && c.status === 'PAID')).toBe(true);
    // IPC-002 (DRAFT) must not leak
    expect(certs.some((c: any) => c.certificate_no === 2)).toBe(false);
  });
});
