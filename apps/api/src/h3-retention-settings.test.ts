import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Round H3 — project-level retention terms.
 *
 * retention_rate_pct / retention_cap_pct / retention_first_moiety_pct on the
 * project are the single source of truth (defaults 5/5/50). They are editable
 * by admin/PM_QS only, locked once the first payment certificate exists, and
 * every change is audit-logged. A 10% project must withhold, cap, invoice and
 * release at 10% — never the old hard-coded 5%/50%.
 */
describe('H3 project retention settings', () => {
  const server = buildServer();
  let adminCookie: string;
  let execCookie: string;
  let qsCookie: string;
  let qsUserId: string;
  let tenantId: string;
  let projectId: string;
  const RUN = Date.now() % 100000;

  const authed = (c: string) => ({ cookie: c });

  const login = async (email: string) => {
    const r = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
    expect(r.statusCode, `${email}: ${r.body}`).toBe(200);
    return { cookie: r.headers['set-cookie'] as string, tenantId: JSON.parse(r.body).user.tenant.id as string, userId: JSON.parse(r.body).user.id as string };
  };

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantId = admin.tenantId;
    execCookie = (await login('executive@apexbuilders.co.ke')).cookie;
    const qs = await login('qs@apexbuilders.co.ke');
    qsCookie = qs.cookie;
    qsUserId = qs.userId;

    const created = await server.inject({
      method: 'POST', url: '/api/v1/projects', headers: authed(adminCookie),
      payload: {
        name: `H3 Retention Ten ${RUN}`,
        code: `H3-${RUN}`,
        description: 'Retention settings verification project',
        location: 'Nairobi',
        budget: 1000000,
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    projectId = JSON.parse(created.body).data.id;

    const member = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/members`, headers: authed(adminCookie),
      payload: { userId: qsUserId, role: 'PM_QS' },
    });
    expect([200, 201, 409]).toContain(member.statusCode);
  });

  it('rejects out-of-range and non-privileged retention edits', async () => {
    const bad = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: authed(adminCookie),
      payload: { retentionRatePct: '150.00' },
    });
    expect(bad.statusCode).toBe(400);

    // EXECUTIVE has PROJECT_EDIT but is not admin/PM_QS — retention terms are commercial data.
    const denied = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: authed(execCookie),
      payload: { retentionRatePct: '10.00' },
    });
    expect([403, 404]).toContain(denied.statusCode);
  });

  it('admin sets 10% rate/cap before the first certificate, audit-logged', async () => {
    const res = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: authed(adminCookie),
      payload: { retentionRatePct: '10.00', retentionCapPct: '10.00', retentionFirstMoietyPct: '50.00' },
    });
    expect(res.statusCode, res.body).toBe(200);
    const p = JSON.parse(res.body).data;
    expect(Number(p.retention_rate_pct)).toBe(10);
    expect(Number(p.retention_cap_pct)).toBe(10);
    expect(Number(p.retention_first_moiety_pct)).toBe(50);

    const audit = await withTenantTx(prisma, tenantId, (tx) =>
      tx.auditLog.findFirst({
        where: { project_id: projectId, action: 'PROJECT_UPDATED' },
        orderBy: { created_at: 'desc' },
      }),
    );
    expect(audit, 'PROJECT_UPDATED audit row').toBeTruthy();
    expect(JSON.stringify(audit?.changes)).toContain('retention');
  });

  it('a 10% project withholds 10% on the IPC and releases 50% at practical completion', async () => {
    // Payment certificate: KES 100,000 this period -> 10% = KES 10,000 held.
    const cert = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates`, headers: authed(adminCookie),
      payload: {
        periodStart: '2026-01-01', periodEnd: '2026-01-31',
        thisPeriodAmount: '100000.00',
      },
    });
    expect(cert.statusCode, cert.body).toBe(201);
    const c = JSON.parse(cert.body).data ?? JSON.parse(cert.body);
    expect(Number(c.retention_deduction)).toBe(10000);
    expect(Number(c.retention_held)).toBe(10000);

    // Certify so it enters the retention ledger — a different user than the
    // creator (maker-checker).
    const cid = c.id;
    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      const r = await server.inject({
        method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cid}/action`,
        headers: authed(qsCookie), payload: { action },
      });
      expect(r.statusCode, `${action}: ${r.body}`).toBeLessThan(300);
    }

    // Invoice from the certified certificate shows the retention deduction once.
    const inv = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cid}/create-invoice`,
      headers: authed(adminCookie), payload: {},
    });
    expect([200, 201]).toContain(inv.statusCode);
    const invoice = JSON.parse(inv.body).data.invoice;
    // Invoice bills net of the 10% retention deduction: 100,000 - 10,000.
    expect(Number(invoice.subtotal)).toBe(90000);
    const retentionLines = await withTenantTx(prisma, tenantId, (tx) =>
      tx.invoiceLineItem.findMany({
        where: { invoice_id: invoice.id, description: { contains: 'Retention held' } },
      }),
    );
    expect(retentionLines.length, 'exactly one retention deduction line').toBe(1);
    expect(Number(retentionLines[0]!.total_amount.toString())).toBe(-10000);

    // Practical completion: default release = first moiety (50%) of held.
    const pc = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/certificates`, headers: authed(adminCookie),
      payload: {
        certificateType: 'PRACTICAL_COMPLETION',
        certificateReference: `PC-H3-${RUN}`,
        issueDate: '2026-02-01', effectiveDate: '2026-02-01', dlpDurationMonths: 6,
        architectName: 'Arch. H3', architectBoraqsNo: 'A 900', qsName: 'QS H3', qsBoraqsNo: 'Q 900',
      },
    });
    expect(pc.statusCode, pc.body).toBe(201);
    const pcBody = JSON.parse(pc.body);
    const released = Number(pcBody.retention_amount_released ?? pcBody.data?.retention_amount_released);
    expect(released).toBe(5000); // 50% of KES 10,000 actually held — not 2.5% of contract sum

    // Retention terms are now locked — a payment certificate exists.
    const locked = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}`, headers: authed(adminCookie),
      payload: { retentionRatePct: '7.50' },
    });
    expect(locked.statusCode).toBe(409);
  });
});
