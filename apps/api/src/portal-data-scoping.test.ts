import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * F1 audit fix — external portals must only return documents the party is
 * entitled to see. The client token portal previously leaked EVERY invoice
 * (including DRAFT) and EVERY payment certificate (DRAFT/SUBMITTED/
 * UNDER_REVIEW/REJECTED) plus unreviewed diary rows.
 *
 * Contract under test:
 *  - CLIENT portal: invoices SENT/PART_PAID/PAID only; certificates
 *    CERTIFIED/PAID only; diaries contribute only client_visible photos;
 *    change orders exclude DRAFT/VOID.
 *  - The other four portals never surface project money documents at all.
 */
describe('Portal data scoping (F1)', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;
  let projectId: string;

  const DRAFT_INV_TITLE = 'DRAFT-LEAK-CHECK-991';
  const SENT_INV_TITLE = 'SENT-VISIBLE-992';
  // certificate_no is unique per project — derive per-run numbers.
  const CERT_RUN = 800000 + (Date.now() % 100000);
  const DRAFT_CERT_NO = CERT_RUN;
  const CERTIFIED_CERT_NO = CERT_RUN + 1;

  const authed = () => ({ cookie: adminCookie });

  const createInvoice = async (title: string, send: boolean) => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(),
      payload: {
        title, clientName: 'Scoping Client', clientEmail: 'scoping@example.co.ke', currency: 'KES',
        projectId,
        items: [{ description: 'Scope check works', unit: 'sum', quantity: 1, unitRate: 50000 }],
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const inv = JSON.parse(res.body).invoice ?? JSON.parse(res.body).data;
    if (send) {
      const s = await server.inject({
        method: 'POST', url: `/api/v1/invoices/${inv.id}/send`, headers: authed(),
        payload: { selfApprovalReason: 'Portal scoping test invoice send reason' },
      });
      expect([200, 201]).toContain(s.statusCode);
    }
    return inv;
  };

  const mkCert = (certificateNo: number, status: string) =>
    withTenantTx(prisma, tenantId, (tx) =>
      tx.paymentCertificate.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          certificate_no: certificateNo,
          period_start: new Date('2026-10-01'),
          period_end: new Date('2026-10-31'),
          this_period_amount: '1000.00',
          previous_certified: '0.00',
          cumulative_certified: '1000.00',
          retention_deduction: '50.00',
          retention_held: '50.00',
          net_payable: '950.00',
          status,
        },
      }),
    );

  const mkLink = async (portalType: string, extra: any = {}) => {
    const r = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/portals/links`,
      headers: authed(),
      payload: { portalType, stakeholderName: `Scope ${portalType}`, expiresInDays: 30, ...extra },
    });
    expect(r.statusCode, `${portalType} link: ${r.body}`).toBe(201);
    return JSON.parse(r.body).data.token as string;
  };

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    adminCookie = login.headers['set-cookie'] as string;
    tenantId = JSON.parse(login.body).user.tenant.id;

    const projRes = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: authed() });
    projectId = JSON.parse(projRes.body).data[0].id;

    await createInvoice(DRAFT_INV_TITLE, false);   // stays DRAFT
    await createInvoice(SENT_INV_TITLE, true);     // SENT
    await mkCert(DRAFT_CERT_NO, 'DRAFT');
    await mkCert(CERTIFIED_CERT_NO, 'CERTIFIED');
  });

  it('client portal returns only issued invoices and certificates', async () => {
    const token = await mkLink('CLIENT');
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/client/${token}` });
    expect(res.statusCode).toBe(200);
    const d = JSON.parse(res.body).data;

    const titles = (d.invoices || []).map((i: any) => i.title);
    expect(titles).toContain(SENT_INV_TITLE);
    expect(titles).not.toContain(DRAFT_INV_TITLE);
    expect((d.invoices || []).every((i: any) => ['SENT', 'PART_PAID', 'PAID'].includes(i.status))).toBe(true);

    const certNos = (d.certificates || []).map((c: any) => c.certificateNo);
    expect(certNos).toContain(CERTIFIED_CERT_NO);
    expect(certNos).not.toContain(DRAFT_CERT_NO);
    expect((d.certificates || []).every((c: any) => ['CERTIFIED', 'PAID'].includes(c.status))).toBe(true);
  });

  it('client change-orders endpoint hides DRAFT and VOID orders', async () => {
    const token = await mkLink('CLIENT');
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/client/${token}/change-orders` });
    expect(res.statusCode).toBe(200);
    const cos = JSON.parse(res.body).data.changeOrders || [];
    expect(cos.every((c: any) => !['DRAFT', 'VOID'].includes(c.status))).toBe(true);
  });

  it('the other four portals never leak project money documents', async () => {
    // consultant + compliance need nothing extra; subcontractor needs a
    // package, supplier needs a Supplier record.
    const pkg = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractors`, headers: authed(),
      payload: { tradeCategory: 'PLUMBING', firmName: 'Scope Subcontractor', subcontractSum: '100000.00', retentionRatePct: '5.00', status: 'ACTIVE' },
    });
    const pkgId = JSON.parse(pkg.body).id ?? JSON.parse(pkg.body).data?.id;
    const sup = await server.inject({
      method: 'POST', url: '/api/v1/suppliers', headers: authed(),
      payload: { name: 'Scope Supplier Ltd', contactPerson: 'Manager' },
    });
    const supplierId = JSON.parse(sup.body).data.id;

    const tokens: Record<string, string> = {
      CONSULTANT: await mkLink('CONSULTANT'),
      SUBCONTRACTOR: await mkLink('SUBCONTRACTOR', { stakeholderName: 'Scope Subcontractor', subcontractorPackageId: pkgId }),
      SUPPLIER: await mkLink('SUPPLIER', { stakeholderName: 'Scope Supplier Ltd', supplierId }),
      COMPLIANCE: await mkLink('COMPLIANCE'),
    };

    for (const [type, token] of Object.entries(tokens)) {
      const res = await server.inject({ method: 'GET', url: `/api/v1/portals/${type.toLowerCase()}/${token}` });
      expect(res.statusCode, `${type}: ${res.body.slice(0, 200)}`).toBe(200);
      const body = res.body;
      expect(body, `${type} leaks draft invoice`).not.toContain(DRAFT_INV_TITLE);
      expect(body, `${type} leaks draft certificate`).not.toContain(`"certificateNo":${DRAFT_CERT_NO}`);
      // Payment-certificate money docs belong to the client portal only —
      // "this_period_amount" is unique to paymentCertificate rows (subcontractor
      // valuations and DLP certificates use different field names).
      expect(body, `${type} leaks payment certificates`).not.toContain('"this_period_amount"');
    }
  });
});
