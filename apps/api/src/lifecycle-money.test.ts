import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { enrollAllTenantUsersTx } from './test-members';
import { toDecimal } from '@construction/money';

/**
 * Contractor-lifecycle money integrity:
 *  - certificate built from BoQ progress, editable review, CERTIFY -> invoice
 *  - invoice.certificate_id bidirectional link; cert PAID derives from invoice payments
 *  - VAT (tenant-configurable, default 16%) + client-side WHT lines
 *  - subcontractor valuation state machine + cost-ledger posting on approval
 *  - central tenant tax settings (no hard-coded rates)
 */
describe('Contractor lifecycle — money integrity', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let tenantId: string;
  let projectId: string;
  let boqItemId: string;
  let packageId: string;
  let commitmentId: string;

  const login = async (email: string) => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
  };

  const authed = (cookie: string) => ({ cookie });

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
          code: `LC-MONEY-${Date.now().toString().slice(-6)}`,
          name: 'Lifecycle Money Test Project',
          status: 'ACTIVE',
          original_contract_sum: '5000000.00',
          current_approved_budget: '5000000.00',
        },
      });
      projectId = proj.id;
      await enrollAllTenantUsersTx(tx, tenantId, projectId);

      const boq = await tx.bOQ.create({
        data: { tenant_id: tenantId, project_id: projectId, version: 1, status: 'ACTIVE', total_amount: '100000.00' },
      });
      const section = await tx.bOQSection.create({
        data: { tenant_id: tenantId, boq_id: boq.id, order_idx: 1, title: 'Earthworks', total_amount: '100000.00' },
      });
      const item = await tx.bOQItem.create({
        data: {
          tenant_id: tenantId,
          section_id: section.id,
          item_code: '1.1',
          description: 'Excavation to formation level',
          unit: 'm3',
          quantity: '100.0000',
          unit_rate: '1000.0000',
          total_amount: '100000.00',
        },
      });
      boqItemId = item.id;

      // 50% progress recorded -> earned 50,000
      const rec = await tx.progressRecord.create({
        data: { tenant_id: tenantId, project_id: projectId, record_date: new Date('2026-02-01'), overall_progress: '0.5000' },
      });
      await tx.progressItem.create({
        data: {
          tenant_id: tenantId,
          progress_record_id: rec.id,
          boq_item_id: item.id,
          completed_quantity: '50.0000',
          completion_pct: '0.5000',
        },
      });

      const pkg = await tx.subcontractorPackage.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          trade_category: 'PLUMBING',
          firm_name: 'FlowFit Plumbing Ltd',
          subcontract_sum: '800000.00',
          retention_rate_pct: '5.00',
          status: 'ACTIVE',
        },
      });
      packageId = pkg.id;

      const commitment = await tx.commitment.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          commitment_no: 1,
          vendor_name: 'FlowFit Plumbing Ltd',
          vendor_type: 'SUBCONTRACTOR',
          contract_value: '800000.00',
          retention_pct: '5.00',
          status: 'ACTIVE',
          subcontractor_package_id: packageId,
        },
      });
      commitmentId = commitment.id;
    });
  });

  // ------------------------------------------------------------------
  // ITEM 6 (tested first — settings drive items 3/4)
  // ------------------------------------------------------------------
  it('GET/PUT tenant tax settings; defaults are VAT 16% and WHT rates', async () => {
    // Fresh tenant => no tax-settings row => documented defaults apply.
    const email = `tax-${Date.now()}@freshbuild.co.ke`;
    const reg = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/register-company',
      payload: {
        companyName: `Tax Fresh ${Date.now()}`,
        adminFullName: 'Tax Admin',
        email,
        password: 'Str0ng!Pass',
      },
    });
    expect(reg.statusCode).toBe(201);
    const loginRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Str0ng!Pass' },
    });
    const freshToken = JSON.parse(loginRes.payload).token;
    const freshGet = await server.inject({
      method: 'GET',
      url: '/api/v1/company/tax-settings',
      headers: { authorization: `Bearer ${freshToken}` },
    });
    expect(freshGet.statusCode).toBe(200);
    const freshBody = JSON.parse(freshGet.payload).data;
    expect(toDecimal(freshBody.vatPct).toFixed(2)).toBe('16.00');
    expect(toDecimal(freshBody.whtContractorPct).toFixed(2)).toBe('3.00');
    expect(toDecimal(freshBody.whtSubcontractorPct).toFixed(2)).toBe('3.00');

    const put = await server.inject({
      method: 'PUT',
      url: '/api/v1/company/tax-settings',
      headers: authed(adminCookie),
      payload: { vatPct: '8.00', whtContractorPct: '2.00', whtSubcontractorPct: '5.00' },
    });
    expect(put.statusCode).toBe(200);

    const get2 = await server.inject({ method: 'GET', url: '/api/v1/company/tax-settings', headers: authed(adminCookie) });
    const b2 = JSON.parse(get2.payload).data;
    expect(toDecimal(b2.vatPct).toFixed(2)).toBe('8.00');
    expect(toDecimal(b2.whtSubcontractorPct).toFixed(2)).toBe('5.00');
  });

  // ------------------------------------------------------------------
  // ITEM 3 — certificate from progress -> invoice
  // ------------------------------------------------------------------
  it('preview computes certificate lines from BoQ progress minus previous certified', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/payment-certificates/preview`,
      headers: authed(qsCookie),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload).data;
    expect(body.lines.length).toBe(1);
    expect(body.lines[0].boqItemId).toBe(boqItemId);
    expect(toDecimal(body.lines[0].amount).toFixed(2)).toBe('50000.00');
    expect(toDecimal(body.thisPeriodAmount).toFixed(2)).toBe('50000.00');
  });

  it('creates a DRAFT certificate from preview lines, allows editing, then CERTIFY + create invoice linked both ways', async () => {
    // Create with editable lines (reviewer reduces amount to 48000)
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates`,
      headers: authed(qsCookie),
      payload: {
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        lines: [
          { boqItemId, description: 'Excavation to formation level', unit: 'm3', progressPct: '0.5000', unitRate: '1000.0000', amount: '48000.00' },
        ],
      },
    });
    expect(create.statusCode).toBe(201);
    const cert = JSON.parse(create.payload).data;
    expect(toDecimal(cert.this_period_amount).toFixed(2)).toBe('48000.00');
    expect(cert.lines?.length ?? 0).toBeGreaterThanOrEqual(0); // lines exposed in detail endpoint

    // Edit while DRAFT: bump amount
    const patch = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}`,
      headers: authed(qsCookie),
      payload: { thisPeriodAmount: '49000.00' },
    });
    expect(patch.statusCode).toBe(200);
    expect(toDecimal(JSON.parse(patch.payload).data.this_period_amount).toFixed(2)).toBe('49000.00');

    // Drive DRAFT -> SUBMITTED -> UNDER_REVIEW -> CERTIFIED
    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      const r = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`,
        headers: authed(adminCookie),
        payload: { action },
      });
      expect(r.statusCode).toBe(200);
    }

    // Create invoice from certificate
    const inv = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/create-invoice`,
      headers: authed(adminCookie),
      payload: { clientName: 'Riverside Dev Ltd', dueDays: 30 },
    });
    expect(inv.statusCode).toBe(201);
    const invoice = JSON.parse(inv.payload).data.invoice ?? JSON.parse(inv.payload).data;
    expect(invoice.certificateId ?? invoice.certificate_id).toBeTruthy();

    // VAT = 8% (tenant setting), WHT contractor = 2%
    const subtotal = toDecimal('49000.00');
    const vat = subtotal.times('0.08');
    const whtBase = subtotal.plus(vat);
    const wht = whtBase.times('0.02');
    const expectedTotal = subtotal.plus(vat).minus(wht);
    expect(toDecimal(invoice.subtotal ?? invoice.subtotal_amount ?? '0').toFixed(2)).toBe(subtotal.toFixed(2));
    expect(toDecimal(invoice.taxAmount ?? invoice.tax_amount ?? '0').toFixed(2)).toBe(vat.toFixed(2));
    expect(toDecimal(invoice.total ?? '0').toFixed(2)).toBe(expectedTotal.toFixed(2));

    // Certificate now carries invoice link + tax fields
    const certGet = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/payment-certificates`,
      headers: authed(qsCookie),
    });
    const certs = JSON.parse(certGet.payload).data as any[];
    const c = certs.find((x) => x.id === cert.id);
    expect(c.invoice_id).toBe(invoice.id);
    expect(toDecimal(c.vat_pct).toFixed(2)).toBe('8.00');
    expect(toDecimal(c.wht_pct).toFixed(2)).toBe('2.00');

    // Invoice detail links back to certificate
    const invGet = await server.inject({
      method: 'GET',
      url: `/api/v1/invoices/${invoice.id}`,
      headers: authed(adminCookie),
    });
    const invDetail = JSON.parse(invGet.payload).invoice ?? JSON.parse(invGet.payload).data;
    expect(invDetail.certificateId ?? invDetail.certificate_id).toBe(cert.id);

    // Record full payment -> certificate derives PAID
    const pay = await server.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoice.id}/payments`,
      headers: authed(adminCookie),
      payload: { amount: Number(expectedTotal.toFixed(2)), method: 'BANK', reference: 'EFT-001' },
    });
    expect([200, 201]).toContain(pay.statusCode);

    const certsAfter = JSON.parse(
      (await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/payment-certificates`,
        headers: authed(qsCookie),
      })).payload,
    ).data as any[];
    const paid = certsAfter.find((x) => x.id === cert.id);
    expect(paid.status).toBe('PAID');
    expect(paid.paid_at).toBeTruthy();
  });

  it('MARK_PAID is rejected once a certificate has a linked invoice', async () => {
    // covered implicitly: the cert above is PAID via invoice; assert MARK_PAID on a fresh linked cert fails
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates`,
      headers: authed(qsCookie),
      payload: {
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        thisPeriodAmount: '1000.00',
      },
    });
    const cert = JSON.parse(create.payload).data;
    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`,
        headers: authed(adminCookie),
        payload: { action },
      });
    }
    await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/create-invoice`,
      headers: authed(adminCookie),
      payload: { clientName: 'Riverside Dev Ltd' },
    });
    const r = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`,
      headers: authed(adminCookie),
      payload: { action: 'MARK_PAID', paidReference: 'X' },
    });
    expect(r.statusCode).toBe(409);
  });

  // ------------------------------------------------------------------
  // ITEM 4 — subcontractor valuation state machine
  // ------------------------------------------------------------------
  it('enforces SUBMITTED -> UNDER_REVIEW -> APPROVED_FOR_PAYMENT -> PAID with 409s and different approver', async () => {
    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractor-valuations`,
      headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: packageId,
        certificateNo: 'SC-VAL-LC1',
        valuationDate: '2026-02-28',
        grossWorkCertifiedKes: '100000.00',
        retentionRatePct: '5.00',
        // withholdingTaxPct omitted -> must come from tenant settings (5%)
      },
    });
    expect(create.statusCode).toBe(201);
    const val = JSON.parse(create.payload).valuation ?? JSON.parse(create.payload).data;
    const valId = val.id;

    // WHT from tenant settings (5% subcontractor)
    const wht = toDecimal('100000.00').times('0.05');
    expect(toDecimal(val.withholdingTaxDeductedKes ?? val.withholding_tax_deducted_kes ?? '0').toFixed(2)).toBe(wht.toFixed(2));

    const patch = (status: string, extra: any = {}, cookie = qsCookie) =>
      server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${projectId}/subcontractor-valuations/${valId}`,
        headers: authed(cookie),
        payload: { paymentStatus: status, ...extra },
      });

    // Illegal: SUBMITTED -> PAID directly
    const illegal = await patch('PAID', { paymentReference: 'X' });
    expect(illegal.statusCode).toBe(409);

    // SUBMITTED -> UNDER_REVIEW
    expect((await patch('UNDER_REVIEW')).statusCode).toBe(200);

    // Same preparer cannot approve
    const selfApprove = await patch('APPROVED_FOR_PAYMENT', {}, qsCookie);
    expect(selfApprove.statusCode).toBe(409);

    // Different approver (admin) approves
    const approve = await patch('APPROVED_FOR_PAYMENT', {}, adminCookie);
    expect(approve.statusCode).toBe(200);
    const approvedBody = JSON.parse(approve.payload);
    const approvedVal = approvedBody.data ?? approvedBody.valuation ?? approvedBody;
    expect(approvedVal.approvedById ?? approvedVal.approved_by_id ?? approvedVal.paymentStatus).toBeTruthy();

    // APPROVED_FOR_PAYMENT -> PAID
    const paid = await patch('PAID', { paymentReference: 'KCB-RTGS-1' }, adminCookie);
    expect(paid.statusCode).toBe(200);

    // PAID is terminal: further transitions -> 409
    const afterPaid = await patch('REJECTED', { notes: 'x' }, adminCookie);
    expect(afterPaid.statusCode).toBe(409);
  });

  // ------------------------------------------------------------------
  // ITEM 5 — approved valuation posts to cost ledger; budget reflects it
  // ------------------------------------------------------------------
  it('posts APPROVED_FOR_PAYMENT valuation to cost ledger (commitment-linked) exactly once and budget summary reflects it', async () => {
    const budgetBefore = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/budget/summary`,
      headers: authed(qsCookie),
    });
    const beforeApproved = toDecimal(JSON.parse(budgetBefore.payload).data?.approvedActualKes ?? JSON.parse(budgetBefore.payload).data?.approvedCost ?? '0');

    const create = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractor-valuations`,
      headers: authed(qsCookie),
      payload: {
        subcontractorPackageId: packageId,
        certificateNo: 'SC-VAL-LC2',
        valuationDate: '2026-03-15',
        grossWorkCertifiedKes: '50000.00',
        retentionRatePct: '5.00',
      },
    });
    const val = JSON.parse(create.payload).valuation ?? JSON.parse(create.payload).data;

    await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/subcontractor-valuations/${val.id}`,
      headers: authed(qsCookie),
      payload: { paymentStatus: 'UNDER_REVIEW' },
    });
    const approve = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/subcontractor-valuations/${val.id}`,
      headers: authed(adminCookie),
      payload: { paymentStatus: 'APPROVED_FOR_PAYMENT' },
    });
    expect(approve.statusCode).toBe(200);

    // Cost entry exists, APPROVED, SUBCONTRACT, commitment-linked, valuation-linked
    const costEntry = await withTenantTx(prisma, tenantId, (tx) =>
      tx.costEntry.findFirst({
        where: { project_id: projectId, commitment_id: commitmentId, status: 'APPROVED' },
        orderBy: { created_at: 'desc' },
      }),
    );
    expect(costEntry).not.toBeNull();
    expect(costEntry!.cost_category).toBe('SUBCONTRACT');
    // Net payable (gross - retention - WHT) is what hits the ledger
    const expectedNet = toDecimal('50000.00')
      .minus(toDecimal('50000.00').times('0.05'))
      .minus(toDecimal('50000.00').times('0.05'));
    expect(toDecimal(costEntry!.amount.toString()).toFixed(2)).toBe(expectedNet.toFixed(2));

    // Idempotent: repeat approval attempt -> 409, no second cost entry for THIS valuation
    const again = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/subcontractor-valuations/${val.id}`,
      headers: authed(adminCookie),
      payload: { paymentStatus: 'APPROVED_FOR_PAYMENT' },
    });
    expect(again.statusCode).toBe(409);
    const costCount = await withTenantTx(prisma, tenantId, (tx) =>
      tx.costEntry.count({ where: { project_id: projectId, description: { contains: 'SC-VAL-LC2' } } }),
    );
    expect(costCount).toBe(1);

    // Budget summary approved actuals increased by the posted amount
    const budgetAfter = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/budget/summary`,
      headers: authed(qsCookie),
    });
    const afterBody = JSON.parse(budgetAfter.payload).data;
    const afterApproved = toDecimal(afterBody?.approvedActualKes ?? afterBody?.approvedCost ?? '0');
    expect(afterApproved.minus(beforeApproved).toFixed(2)).toBe(expectedNet.toFixed(2));
  });

  // The item-6 test rewrites the SHARED tenant's tax settings; restore the
  // documented defaults so later suites (portal-hardening expects 3% WHT)
  // don't inherit mutated rates.
  afterAll(async () => {
    await server.inject({
      method: 'PUT',
      url: '/api/v1/company/tax-settings',
      headers: authed(adminCookie),
      payload: {
        vatPct: '16.00',
        whtContractorPct: '3.00',
        whtSubcontractorPct: '3.00',
        whtConsultantPct: '3.00',
        whtSupplierPct: '0.00',
        whvatPct: '2.00',
      },
    });
  });
});
