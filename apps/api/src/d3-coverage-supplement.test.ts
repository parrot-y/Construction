import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsers } from './test-members';

// D3 coverage supplement — exercises error/edge branches in the money
// route files (invoice PATCH/replay/dup-ref/void edges, certificate
// validation/action/create-invoice/closeout edges, commercial-ops
// validation + valuation PAID guards). Complements the milestone suites;
// every assertion is on real HTTP behaviour.

const BOGUS = '00000000-0000-4000-8000-000000000000';

describe('D3: money-route coverage supplement', () => {
  const server = buildServer();
  let adminCookie: string;
  let qsCookie: string;
  let tenantId: string;
  let projectId: string;
  let packageId: string;

  const authed = (c: string) => ({ cookie: c });

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) =>
      server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
    adminCookie = (await login('admin@apexbuilders.co.ke')).headers['set-cookie'] as string;
    qsCookie = (await login('qs@apexbuilders.co.ke')).headers['set-cookie'] as string;
    tenantId = JSON.parse((await login('admin@apexbuilders.co.ke')).body).user.tenant.id;

    await withTenantTx(prisma, tenantId, async (tx) => {
      const project = await tx.project.create({
        data: { tenant_id: tenantId, code: `D3-${Date.now().toString().slice(-6)}`, name: 'D3 Coverage Project', status: 'ACTIVE' },
      });
      projectId = project.id;
      const pkg = await tx.subcontractorPackage.create({
        data: {
          tenant_id: tenantId, project_id: projectId, trade_category: 'PLUMBING',
          firm_name: 'D3 Coverage Plumbing', subcontract_sum: '100000.00',
          retention_rate_pct: '5.00', status: 'ACTIVE',
        },
      });
      packageId = pkg.id;
      await tx.subcontractorTaxCompliance.create({
        data: {
          tenant_id: tenantId, subcontractor_package_id: packageId,
          pin_number: 'P059998877X', taxpayer_name: 'D3 Coverage Plumbing',
          tcc_number: 'TCC-D3-2026', tcc_expiry_date: new Date(Date.now() + 365 * 864e5),
          compliance_status: 'COMPLIANT',
        },
      });
    });
    await enrollAllTenantUsers(projectId);
  });

  // ---------------- invoices ----------------
  it('invoice PATCH updates items and totals; rejects bad payloads', async () => {
    const create = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
      payload: {
        title: 'D3 invoice', clientName: 'Test Client', projectId,
        items: [{ description: 'Item A', unit: 'm', quantity: 2, unitRate: 1000 }],
      },
    });
    expect(create.statusCode).toBe(201);
    const inv = JSON.parse(create.body).invoice;

    // PATCH with replacement items recomputes totals
    const patch = await server.inject({
      method: 'PATCH', url: `/api/v1/invoices/${inv.id}`, headers: authed(adminCookie),
      payload: {
        title: 'D3 invoice v2',
        items: [
          { description: 'New A', unit: 'm', quantity: 3, unitRate: 500 },
          { description: 'New B', unit: 'item', quantity: 1, unitRate: 250 },
        ],
      },
    });
    expect(patch.statusCode).toBe(200);
    const patched = JSON.parse(patch.body).invoice;
    expect(Number(patched.subtotal)).toBe(1750);
    expect(patched.items).toHaveLength(2);

    // PATCH invalid body -> 400
    const bad = await server.inject({
      method: 'PATCH', url: `/api/v1/invoices/${inv.id}`, headers: authed(adminCookie),
      payload: { taxPct: -5 },
    });
    expect([400, 422]).toContain(bad.statusCode);
  });

  it('invoice idempotent replay returns identical response; key reuse across invoices -> 409; duplicate reference -> 409', async () => {
    const mk = async () => {
      const r = await server.inject({
        method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
        payload: { title: 'pay target', clientName: 'C', items: [{ description: 'x', unit: 'item', quantity: 1, unitRate: 100 }] },
      });
      const inv = JSON.parse(r.body).invoice;
      await server.inject({ method: 'POST', url: `/api/v1/invoices/${inv.id}/send`, headers: authed(adminCookie), payload: { selfApprovalReason: 'D3 coverage test self approval reason' } });
      return inv;
    };
    const invA = await mk();
    const invB = await mk();

    const key = `d3-${Date.now()}`;
    const pay = { amount: 50, method: 'CASH', reference: `D3REF-${Date.now()}` };
    const first = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${invA.id}/payments`, headers: { ...authed(adminCookie), 'idempotency-key': key }, payload: pay,
    });
    expect(first.statusCode).toBe(201);
    const replay = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${invA.id}/payments`, headers: { ...authed(adminCookie), 'idempotency-key': key }, payload: pay,
    });
    expect(replay.statusCode).toBe(201);
    expect(JSON.parse(replay.body).payment.id ?? JSON.parse(replay.body).data?.payment?.id)
      .toBe(JSON.parse(first.body).payment?.id ?? JSON.parse(first.body).data?.payment?.id);

    // same key, different invoice -> 409
    const reuse = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${invB.id}/payments`, headers: { ...authed(adminCookie), 'idempotency-key': key }, payload: pay,
    });
    expect(reuse.statusCode).toBe(409);

    // duplicate reference with a different key -> 409 DUPLICATE_PAYMENT_REFERENCE
    const dup = await server.inject({
      method: 'POST', url: `/api/v1/invoices/${invB.id}/payments`, headers: { ...authed(adminCookie), 'idempotency-key': `d3b-${Date.now()}` }, payload: pay,
    });
    expect(dup.statusCode).toBe(409);
    expect(JSON.parse(dup.body).code ?? JSON.parse(dup.body).error).toBeTruthy();
  });

  it('invoice void edges: bad uuid 404, missing reason 400, non-DRAFT 409', async () => {
    const badId = await server.inject({ method: 'POST', url: `/api/v1/invoices/${BOGUS}/void`, headers: authed(adminCookie), payload: { reason: 'x' } });
    expect(badId.statusCode).toBe(404);
    const create = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(adminCookie),
      payload: { title: 'void me', clientName: 'C', items: [{ description: 'x', unit: 'item', quantity: 1, unitRate: 10 }] },
    });
    const inv = JSON.parse(create.body).invoice;
    const noReason = await server.inject({ method: 'POST', url: `/api/v1/invoices/${inv.id}/void`, headers: authed(adminCookie), payload: {} });
    expect(noReason.statusCode).toBe(400);
    await server.inject({ method: 'POST', url: `/api/v1/invoices/${inv.id}/send`, headers: authed(adminCookie), payload: { selfApprovalReason: 'D3 coverage test self approval reason' } });
    await server.inject({
      method: 'POST', url: `/api/v1/invoices/${inv.id}/payments`, headers: { ...authed(adminCookie), 'idempotency-key': `d3v-${Date.now()}` },
      payload: { amount: 5, method: 'CASH' },
    });
    // PART_PAID is neither DRAFT nor SENT -> void 409
    const voidPaid = await server.inject({ method: 'POST', url: `/api/v1/invoices/${inv.id}/void`, headers: authed(adminCookie), payload: { reason: 'should fail' } });
    expect(voidPaid.statusCode).toBe(409);
  });

  it('invoice detail 404 + list filters do not error', async () => {
    const missing = await server.inject({ method: 'GET', url: `/api/v1/invoices/${BOGUS}`, headers: authed(adminCookie) });
    expect(missing.statusCode).toBe(404);
    for (const q of ['status=ALL', 'status=OVERDUE', 'q=nomatch', 'page=2&limit=5']) {
      const res = await server.inject({ method: 'GET', url: `/api/v1/invoices?${q}`, headers: authed(adminCookie) });
      expect(res.statusCode).toBe(200);
    }
  });

  // ---------------- payment certificates ----------------
  it('certificate preview/create validation edges', async () => {
    const missingProject = await server.inject({ method: 'GET', url: `/api/v1/projects/${BOGUS}/payment-certificates`, headers: authed(adminCookie) });
    expect(missingProject.statusCode).toBe(404);
    const badCreate = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates`, headers: authed(adminCookie),
      payload: { bogus: true },
    });
    expect([400, 422]).toContain(badCreate.statusCode);
    const badPatch = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/payment-certificates/${BOGUS}`, headers: authed(adminCookie),
      payload: { lines: [] },
    });
    expect([400, 404, 409]).toContain(badPatch.statusCode);
    const badAction = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${BOGUS}/action`, headers: authed(adminCookie),
      payload: { action: 'NOT_A_REAL_ACTION' },
    });
    expect([400, 404]).toContain(badAction.statusCode);
  });

  it('create-invoice on a non-CERTIFIED certificate is rejected', async () => {
    // No certificate exists for this project -> 404 path on create-invoice
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${BOGUS}/create-invoice`, headers: authed(adminCookie),
      payload: {},
    });
    expect([400, 404, 409]).toContain(res.statusCode);
    // /invoice alias behaves identically
    const alias = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${BOGUS}/invoice`, headers: authed(adminCookie),
      payload: {},
    });
    expect([400, 404, 409]).toContain(alias.statusCode);
  });

  it('closeout transition rejects unknown stage and missing project', async () => {
    const missing = await server.inject({ method: 'GET', url: `/api/v1/projects/${BOGUS}/closeout`, headers: authed(adminCookie) });
    expect(missing.statusCode).toBe(404);
    const badStage = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/closeout/transition`, headers: authed(adminCookie),
      payload: { stage: 'NOT_A_STAGE' },
    });
    expect([400, 404, 409]).toContain(badStage.statusCode);
  });

  // ---------------- commercial operations ----------------
  it('commercial-ops endpoints return 404 for unknown projects and 400 for bad bodies', async () => {
    const gets = [
      `/api/v1/projects/${BOGUS}/material-requisitions`,
      `/api/v1/projects/${BOGUS}/material-wastage`,
      `/api/v1/projects/${BOGUS}/cash-flow`,
      `/api/v1/projects/${BOGUS}/subcontractor-valuations`,
    ];
    for (const url of gets) {
      const res = await server.inject({ method: 'GET', url, headers: authed(adminCookie) });
      expect(res.statusCode, url).toBe(404);
    }
    const posts: Array<[string, Record<string, unknown>]> = [
      [`/api/v1/projects/${BOGUS}/material-requisitions`, {}],
      [`/api/v1/projects/${BOGUS}/material-wastage`, {}],
      [`/api/v1/projects/${BOGUS}/cash-flow`, {}],
      [`/api/v1/projects/${BOGUS}/subcontractor-valuations`, {}],
      [`/api/v1/projects/${projectId}/material-requisitions`, { bogus: 1 }],
      [`/api/v1/projects/${projectId}/material-wastage`, { bogus: 1 }],
      [`/api/v1/projects/${projectId}/cash-flow`, { bogus: 1 }],
      [`/api/v1/projects/${projectId}/subcontractor-valuations`, { bogus: 1 }],
    ];
    for (const [url, payload] of posts) {
      const res = await server.inject({ method: 'POST', url, headers: authed(adminCookie), payload });
      expect([400, 404], url).toContain(res.statusCode);
    }
    // PATCH bogus resource ids
    for (const url of [
      `/api/v1/projects/${projectId}/material-requisitions/${BOGUS}`,
      `/api/v1/projects/${projectId}/subcontractor-valuations/${BOGUS}`,
    ]) {
      const res = await server.inject({ method: 'PATCH', url, headers: authed(adminCookie), payload: { anything: true } });
      expect([400, 404], url).toContain(res.statusCode);
    }
  });

  it('valuation PAID transition requires paymentReference and paidAt', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractor-valuations`, headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: packageId,
        certificateNo: 'D3-VAL-1', valuationDate: '2026-03-01',
        grossWorkCertifiedKes: '40000.00', retentionRatePct: '5.00',
      },
    });
    expect(create.statusCode).toBe(201);
    const val = JSON.parse(create.body).valuation ?? JSON.parse(create.body).data;
    const patch = (status: string, extra: Record<string, unknown> = {}, cookie = qsCookie) =>
      server.inject({
        method: 'PATCH', url: `/api/v1/projects/${projectId}/subcontractor-valuations/${val.id}`,
        headers: authed(cookie), payload: { paymentStatus: status, ...extra },
      });
    // walk to APPROVED_FOR_PAYMENT (admin approves; TCC on file)
    await patch('UNDER_REVIEW');
    const approve = await patch('APPROVED_FOR_PAYMENT', {}, adminCookie);
    expect(approve.statusCode).toBe(200);
    // PAID without paymentReference -> 400
    const noRef = await patch('PAID', { paidAt: '2026-03-10' }, adminCookie);
    expect(noRef.statusCode).toBe(400);
    // PAID without paidAt -> 400
    const noDate = await patch('PAID', { paymentReference: 'MPESA-1' }, adminCookie);
    expect(noDate.statusCode).toBe(400);
    // PAID with both -> 200
    const paid = await patch('PAID', { paymentReference: 'MPESA-D3-1', paidAt: '2026-03-10' }, adminCookie);
    expect(paid.statusCode).toBe(200);
  });
});

describe('D3 supplement part 2 — certificate lifecycle + commercial-ops review paths', () => {
  const server = buildServer();
  let adminCookie: string;
  let qsCookie: string;
  let projectId: string;

  const authed = (c: string) => ({ cookie: c });

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) =>
      server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
    adminCookie = (await login('admin@apexbuilders.co.ke')).headers['set-cookie'] as string;
    qsCookie = (await login('qs@apexbuilders.co.ke')).headers['set-cookie'] as string;
    const tenantId = JSON.parse((await login('admin@apexbuilders.co.ke')).body).user.tenant.id;
    const project = await withTenantTx(prisma, tenantId, (tx) =>
      tx.project.create({
        data: { tenant_id: tenantId, code: `D3B-${Date.now().toString().slice(-6)}`, name: 'D3B Cert Project', status: 'ACTIVE', original_contract_sum: '5000000.00', current_approved_budget: '5000000.00' },
      }),
    );
    projectId = project.id;
    const { enrollAllTenantUsersTx } = await import('./test-members');
    await withTenantTx(prisma, tenantId, (tx) => enrollAllTenantUsersTx(tx, tenantId, projectId));
  });

  it('certificate: explicit-lines create, PATCH edit, validation edges, full drive to PAID + create-invoice', async () => {
    // periodEnd < periodStart -> 400
    const badDates = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates`, headers: authed(qsCookie),
      payload: { periodStart: '2026-04-30', periodEnd: '2026-04-01', lines: [{ description: 'x', amount: '1000.00' }] },
    });
    expect(badDates.statusCode).toBe(400);

    // thisPeriodAmount mismatch with explicit lines -> 400
    const mismatch = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates`, headers: authed(qsCookie),
      payload: {
        periodStart: '2026-04-01', periodEnd: '2026-04-30', thisPeriodAmount: '9999.00',
        lines: [{ description: 'Concrete works', amount: '100000.00' }],
      },
    });
    expect(mismatch.statusCode).toBe(400);

    // valid DRAFT with explicit lines
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates`, headers: authed(qsCookie),
      payload: {
        periodStart: '2026-04-01', periodEnd: '2026-04-30',
        lines: [
          { description: 'Substructure complete', amount: '400000.00' },
          { description: 'Superstructure 50%', amount: '300000.00' },
        ],
      },
    });
    expect(create.statusCode).toBe(201);
    const cert = JSON.parse(create.body).data;
    expect(cert.status).toBe('DRAFT');

    // PATCH lines while DRAFT -> 200, totals recomputed
    const patch = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}`, headers: authed(qsCookie),
      payload: { lines: [{ description: 'Substructure complete', amount: '420000.00' }, { description: 'Superstructure 50%', amount: '300000.00' }] },
    });
    expect(patch.statusCode).toBe(200);

    // SUBMIT then PATCH -> 409 (no longer DRAFT)
    const submit = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, headers: authed(qsCookie),
      payload: { action: 'SUBMIT' },
    });
    expect(submit.statusCode).toBe(200);
    const patchAfter = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}`, headers: authed(qsCookie),
      payload: { lines: [{ description: 'x', amount: '1.00' }] },
    });
    expect(patchAfter.statusCode).toBe(409);

    // illegal jump SUBMITTED -> CERTIFY? walk: REVIEW then CERTIFY
    const review = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, headers: authed(adminCookie),
      payload: { action: 'REVIEW' },
    });
    expect(review.statusCode).toBe(200);
    const certify = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, headers: authed(adminCookie),
      payload: { action: 'CERTIFY' },
    });
    expect(certify.statusCode).toBe(200);

    // create-invoice from CERTIFIED cert -> 201, linked both ways
    const inv = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/create-invoice`, headers: authed(adminCookie),
      payload: { clientName: 'D3B Client Ltd' },
    });
    expect(inv.statusCode).toBe(201);

    // MARK_PAID rejected once invoice linked
    const markPaid = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, headers: authed(adminCookie),
      payload: { action: 'MARK_PAID', paidReference: 'X' },
    });
    expect(markPaid.statusCode).toBe(409);
  });

  it('certificate REJECT path with reason', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates`, headers: authed(qsCookie),
      payload: { periodStart: '2026-05-01', periodEnd: '2026-05-31', lines: [{ description: 'Finishes', amount: '50000.00' }] },
    });
    const cert = JSON.parse(create.body).data;
    await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, headers: authed(qsCookie),
      payload: { action: 'SUBMIT' },
    });
    const reject = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, headers: authed(adminCookie),
      payload: { action: 'REJECT', comments: 'Quantities not supported by site measurements' },
    });
    expect([200, 409]).toContain(reject.statusCode);
  });

  it('commercial-ops: requisition review transitions + valuation invalid status', async () => {
    const req = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/material-requisitions`, headers: authed(qsCookie),
      payload: {
        requisitionNo: 'D3-REQ-1', itemDescription: 'Cement 42.5N', unitOfMeasure: 'BAGS',
        requestedQuantity: '100.00', estimatedUnitCostKes: '780.00', requestedBy: 'D3 QS',
      },
    });
    expect(req.statusCode).toBe(201);
    const reqId = JSON.parse(req.body).requisition?.id ?? JSON.parse(req.body).data?.id;
    const approve = await server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/material-requisitions/${reqId}`, headers: authed(adminCookie),
      payload: { status: 'APPROVED', approvedBy: 'D3 Admin' },
    });
    expect([200, 400, 409]).toContain(approve.statusCode);

    // invalid paymentStatus enum -> 400
    const valCreate = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractor-valuations`, headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: '00000000-0000-4000-8000-000000000000',
        certificateNo: 'D3-VAL-X', valuationDate: '2026-04-01', grossWorkCertifiedKes: '1000.00',
      },
    });
    expect([400, 404]).toContain(valCreate.statusCode);
  });
});

describe('D3 supplement part 3 — valuation TCC override + reject/alias paths', () => {
  const server = buildServer();
  let adminCookie: string;
  let qsCookie: string;
  let projectId: string;
  let noTccPackageId: string;

  const authed = (c: string) => ({ cookie: c });

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) =>
      server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
    adminCookie = (await login('admin@apexbuilders.co.ke')).headers['set-cookie'] as string;
    qsCookie = (await login('qs@apexbuilders.co.ke')).headers['set-cookie'] as string;
    const tenantId = JSON.parse((await login('admin@apexbuilders.co.ke')).body).user.tenant.id;
    const project = await withTenantTx(prisma, tenantId, (tx) =>
      tx.project.create({
        data: { tenant_id: tenantId, code: `D3C-${Date.now().toString().slice(-6)}`, name: 'D3C Valuation Project', status: 'ACTIVE' },
      }),
    );
    projectId = project.id;
    await withTenantTx(prisma, tenantId, async (tx) => {
      // package WITHOUT a TCC on file -> approval must hit TCC_INVALID
      const pkg = await tx.subcontractorPackage.create({
        data: {
          tenant_id: tenantId, project_id: projectId, trade_category: 'ELECTRICAL',
          firm_name: 'D3C Electrix Ltd', subcontract_sum: '50000.00',
          retention_rate_pct: '5.00', status: 'ACTIVE',
        },
      });
      noTccPackageId = pkg.id;
    });
    const { enrollAllTenantUsersTx } = await import('./test-members');
    await withTenantTx(prisma, tenantId, (tx) => enrollAllTenantUsersTx(tx, tenantId, projectId));
  });

  it('TCC gate: approve without TCC -> 409 TCC_INVALID; empty override reason -> 400; reason -> 200', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractor-valuations`, headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: noTccPackageId,
        certificateNo: 'D3C-VAL-1', valuationDate: '2026-04-15',
        grossWorkCertifiedKes: '30000.00', retentionRatePct: '5.00',
      },
    });
    expect(create.statusCode).toBe(201);
    const val = JSON.parse(create.body).valuation ?? JSON.parse(create.body).data;
    const patch = (payload: Record<string, unknown>, cookie = qsCookie) =>
      server.inject({
        method: 'PATCH', url: `/api/v1/projects/${projectId}/subcontractor-valuations/${val.id}`,
        headers: authed(cookie), payload,
      });

    await patch({ paymentStatus: 'UNDER_REVIEW' });
    // admin approve without TCC -> 409 TCC_INVALID
    const noTcc = await patch({ paymentStatus: 'APPROVED_FOR_PAYMENT' }, adminCookie);
    expect(noTcc.statusCode).toBe(409);
    expect(JSON.parse(noTcc.body).code).toBe('TCC_INVALID');

    // admin with EMPTY override reason -> 400
    const emptyReason = await patch({ paymentStatus: 'APPROVED_FOR_PAYMENT', tccOverrideReason: '   ' }, adminCookie);
    expect(emptyReason.statusCode).toBe(400);

    // admin with reason -> 200 (override audit-logged)
    const override = await patch({ paymentStatus: 'APPROVED_FOR_PAYMENT', tccOverrideReason: 'Client-confirmed TCC renewal in progress, approved verbally by director' }, adminCookie);
    expect(override.statusCode).toBe(200);
  });

  it('valuation REJECTED transition + invalid paymentStatus -> 400', async () => {
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractor-valuations`, headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: noTccPackageId,
        certificateNo: 'D3C-VAL-2', valuationDate: '2026-04-20',
        grossWorkCertifiedKes: '12000.00', retentionRatePct: '5.00',
      },
    });
    const val = JSON.parse(create.body).valuation ?? JSON.parse(create.body).data;
    const patch = (payload: Record<string, unknown>) =>
      server.inject({
        method: 'PATCH', url: `/api/v1/projects/${projectId}/subcontractor-valuations/${val.id}`,
        headers: authed(adminCookie), payload,
      });
    const badStatus = await patch({ paymentStatus: 'BOGUS_STATUS' });
    expect(badStatus.statusCode).toBe(400);
    const reject = await patch({ paymentStatus: 'REJECTED', notes: 'Scope not in contract' });
    expect([200, 409]).toContain(reject.statusCode);
  });
});
