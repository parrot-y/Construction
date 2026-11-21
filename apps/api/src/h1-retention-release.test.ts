import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Round H1 — one source of truth for retention money.
 *
 * A defects-liability certificate AUTHORIZES a release; the next payment
 * certificate EXECUTES it (retention_released is server-derived — the typed
 * path is refused). The ledger must reconcile to the cent at every step and
 * a release must never be counted twice.
 */
describe('H1 retention release — single money effect', () => {
  const server = buildServer();
  let adminCookie: string;
  let qsCookie: string;
  let tenantId: string;
  let adminUserId: string;
  let projectId: string;
  const RUN = Date.now() % 100000;

  const authed = (c: string) => ({ cookie: c });
  const money = (v: unknown) => Number(String(v ?? '0').replace(/,/g, ''));

  const login = async (email: string) => {
    const r = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
    expect(r.statusCode, `${email}: ${r.body}`).toBe(200);
    const b = JSON.parse(r.body);
    return { cookie: r.headers['set-cookie'] as string, tenantId: b.user.tenant.id as string, userId: b.user.id as string };
  };

  const createProject = async (name: string) => {
    const r = await server.inject({
      method: 'POST', url: '/api/v1/projects', headers: authed(adminCookie),
      payload: { name, code: `${name.slice(0, 12)}-${RUN}`, description: 'H1 retention ledger test', location: 'Nairobi', budget: 1000000 },
    });
    expect(r.statusCode, r.body).toBe(201);
    return JSON.parse(r.body).data.id as string;
  };

  const addMember = async (pid: string, userId: string, role: string) => {
    const r = await server.inject({
      method: 'POST', url: `/api/v1/projects/${pid}/members`, headers: authed(adminCookie),
      payload: { userId, role },
    });
    expect([200, 201, 409]).toContain(r.statusCode);
  };

  const newCert = (pid: string, thisPeriod: string, extra: Record<string, unknown> = {}) =>
    server.inject({
      method: 'POST', url: `/api/v1/projects/${pid}/payment-certificates`, headers: authed(adminCookie),
      payload: { periodStart: '2026-03-01', periodEnd: '2026-03-31', thisPeriodAmount: thisPeriod, ...extra },
    });

  const certify = async (pid: string, certId: string) => {
    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      const r = await server.inject({
        method: 'POST', url: `/api/v1/projects/${pid}/payment-certificates/${certId}/action`,
        headers: authed(qsCookie), payload: { action },
      });
      expect(r.statusCode, `${action}: ${r.body}`).toBeLessThan(300);
    }
  };

  const issueDlc = (pid: string, type: string, ref: string, amount?: string) =>
    server.inject({
      method: 'POST', url: `/api/v1/projects/${pid}/certificates`, headers: authed(adminCookie),
      payload: {
        certificateType: type, certificateReference: ref,
        issueDate: '2026-04-01', effectiveDate: '2026-04-01', dlpDurationMonths: 6,
        architectName: 'Arch. H1', architectBoraqsNo: 'A 700', qsName: 'QS H1', qsBoraqsNo: 'Q 700',
        ...(amount != null ? { retentionAmountReleased: amount } : {}),
      },
    });

  const retention = async (pid: string) => {
    const r = await server.inject({ method: 'GET', url: `/api/v1/projects/${pid}/closeout`, headers: authed(adminCookie) });
    expect(r.statusCode).toBe(200);
    return JSON.parse(r.body).data.checklist;
  };

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantId = admin.tenantId;
    adminUserId = admin.userId;
    const qs = await login('qs@apexbuilders.co.ke');
    qsCookie = qs.cookie;
    projectId = await createProject(`H1 Retention Ledger ${RUN}`);
    await addMember(projectId, qs.userId, 'PM_QS');
  });

  it('refuses a typed retentionReleased on a payment certificate', async () => {
    const r = await newCert(projectId, '100000.00', { retentionReleased: '100.00' });
    expect(r.statusCode).toBe(400);
    expect(r.body).toContain('derived from approved retention-release certificates');
  });

  it('PC release -> consuming IPC -> final release reconciles to the cent, once', async () => {
    const pid = projectId;

    // IPC-1: KES 100,000 work, 5% project rate -> KES 5,000 withheld.
    const c1 = await newCert(pid, '100000.00');
    expect(c1.statusCode, c1.body).toBe(201);
    const cert1 = JSON.parse(c1.body).data;
    expect(money(cert1.retention_deduction)).toBe(5000);
    expect(money(cert1.retention_held)).toBe(5000);
    expect(money(cert1.retention_released)).toBe(0);
    await certify(pid, cert1.id);

    // Practical completion authorizes the first moiety: 50% of 5,000.
    const pc = await issueDlc(pid, 'PRACTICAL_COMPLETION', `PC-H1-${RUN}`);
    expect(pc.statusCode, pc.body).toBe(201);
    expect(money(JSON.parse(pc.body).retention_amount_released)).toBe(2500);

    let cl = await retention(pid);
    expect(money(cl.retentionHeld)).toBe(5000);
    expect(money(cl.retentionReleased)).toBe(2500);
    expect(money(cl.retentionOutstanding)).toBe(2500);

    // IPC-2 EXECUTES the authorized release — derived, not typed.
    const c2 = await newCert(pid, '100000.00');
    expect(c2.statusCode, c2.body).toBe(201);
    const cert2 = JSON.parse(c2.body).data;
    expect(money(cert2.retention_released), 'auto-executed first moiety').toBe(2500);
    expect(money(cert2.retention_held)).toBe(7500); // 5000 + 5000 - 2500
    expect(money(cert2.net_payable)).toBe(97500); // 100000 - 5000 + 2500
    await certify(pid, cert2.id);

    cl = await retention(pid);
    expect(money(cl.retentionHeld)).toBe(7500);
    expect(money(cl.retentionReleased)).toBe(2500);
    // Outstanding is authorizable remainder: 7500 held, 0 pending payout.
    expect(money(cl.retentionOutstanding)).toBe(7500);

    // The client invoice shows the release exactly once.
    const inv = await server.inject({
      method: 'POST', url: `/api/v1/projects/${pid}/payment-certificates/${cert2.id}/create-invoice`,
      headers: authed(adminCookie), payload: {},
    });
    expect([200, 201]).toContain(inv.statusCode);
    const invoice = JSON.parse(inv.body).data.invoice;
    expect(money(invoice.subtotal)).toBe(97500);
    const relLines = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoiceLineItem.findMany({ where: { invoice_id: invoice.id, description: { contains: 'Retention released' } } }),
    );
    expect(relLines.length, 'release billed once').toBe(1);
    expect(money(relLines[0]!.total_amount)).toBe(2500);

    // Final certificate authorizes everything still outstanding: 7,500.
    const mgd = await issueDlc(pid, 'MAKING_GOOD_DEFECTS', `MGD-H1-${RUN}`);
    expect(mgd.statusCode, mgd.body).toBe(201);
    expect(money(JSON.parse(mgd.body).retention_amount_released)).toBe(7500);

    // IPC-3 executes the final moiety; a second draft cannot double-claim it.
    const c3 = await newCert(pid, '100000.00');
    const cert3 = JSON.parse(c3.body).data;
    expect(money(cert3.retention_released)).toBe(7500);
    expect(money(cert3.retention_held)).toBe(5000); // 7500 + 5000 - 7500
    const c4 = await newCert(pid, '50000.00');
    const cert4 = JSON.parse(c4.body).data;
    expect(money(cert4.retention_released), 'no authorized release left to commit').toBe(0);
    await certify(pid, cert3.id);
    await certify(pid, cert4.id);

    cl = await retention(pid);
    // Held = cert3+cert4 new withholding (5000 + 2500) still unauthorized.
    expect(money(cl.retentionHeld)).toBe(7500);
    expect(money(cl.retentionOutstanding)).toBe(7500);
  });

  it('reconciles odd-cent amounts to the cent (100.01 held -> 50.01 + 50.00)', async () => {
    const pid = await createProject(`H1 Odd Cents ${RUN}`);

    // Seed the ledger directly: KES 100.01 retention held on a CERTIFIED IPC.
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.paymentCertificate.create({
        data: {
          tenant_id: tenantId, project_id: pid, certificate_no: 1,
          period_start: new Date('2026-01-01'), period_end: new Date('2026-01-31'),
          this_period_amount: '2000.20', previous_certified: '0.00', cumulative_certified: '2000.20',
          retention_pct: '5.00', retention_deduction: '100.01', retention_held: '100.01',
          retention_released: '0.00', net_payable: '1900.19', status: 'CERTIFIED',
          submitted_by_id: adminUserId, certified_by_id: adminUserId, certified_at: new Date(),
        },
      }),
    );

    // First moiety: 50% of 100.01 = 50.005 -> 50.01 (half-up), never 50.00/50.02 drift.
    const pc = await issueDlc(pid, 'PRACTICAL_COMPLETION', `PC-ODD-${RUN}`);
    expect(pc.statusCode, pc.body).toBe(201);
    expect(JSON.parse(pc.body).retention_amount_released).toBe('50.01');

    let cl = await retention(pid);
    expect(cl.retentionHeld).toBe('100.01');
    expect(cl.retentionOutstanding).toBe('50.00');

    // Final release takes the exact remainder — outstanding hits zero to the cent.
    const fin = await issueDlc(pid, 'FINAL_PAYMENT_CERTIFICATE', `FIN-ODD-${RUN}`);
    expect(fin.statusCode, fin.body).toBe(201);
    expect(JSON.parse(fin.body).retention_amount_released).toBe('50.00');

    cl = await retention(pid);
    expect(cl.retentionOutstanding).toBe('0.00');
    expect(cl.retentionHeld).toBe('100.01');
    expect(cl.retentionReleased).toBe('100.01');
  });
});
