import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenantTx } from '@construction/db';
import { buildServer } from './index';
import { enrollAllTenantUsers } from './test-members';

describe('Milestones M13, M14 & M15: Commercial Operations, Wastage Variance, S-Curve & Subcontractor Valuations', () => {
  const server = buildServer();
  let tenantId = 'e460c1cc-67a5-408c-841d-ed28280a44f2'; // Apex Builders Kenya Ltd
  let adminCookie: string;
  let supervisorCookie: string;
  let projectId: string;
  let subPackageId: string;
  let requisitionId: string;
  let valuationId: string;

  beforeAll(async () => {
    await server.ready();

    const apex = await prisma.tenant.findFirst({ where: { name: 'Apex Builders Kenya Ltd' } });
    if (apex) tenantId = apex.id;

    // 1. Authenticate as Company Admin (PM/QS authority)
    const adminLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(adminLogin.statusCode).toBe(200);
    adminCookie = adminLogin.headers['set-cookie'] as string;

    // 2. Authenticate as Site Supervisor
    const superLogin = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'supervisor@apexbuilders.co.ke',
        password: 'Password123!',
      },
    });
    expect(superLogin.statusCode).toBe(200);
    supervisorCookie = superLogin.headers['set-cookie'] as string;

    // 3. Create active test project
    const projectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Westlands Commercial Tower Commercial Ops Test',
        code: `WCT-${Date.now().toString().slice(-4)}`,
        location: 'Westlands, Nairobi',
        originalContractSum: 120000000,
      },
    });
    expect(projectRes.statusCode).toBe(201);
    projectId = JSON.parse(projectRes.body).data.id;
    await enrollAllTenantUsers(projectId);

    // 4. Create Subcontractor Work Package for Milestone M15
    const subRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractors`,
      headers: { cookie: adminCookie },
      payload: {
        tradeCategory: 'PLUMBING',
        firmName: 'Amani Mechanical & Plumbing Contractors Ltd',
        contactPerson: 'Eng. Francis Gitonga',
        phoneNumber: '+254722889900',
        subcontractSum: '8500000.00',
        retentionRatePct: '10.00',
        scopeDescription: 'Drainage stacks, PPR water supply lines, sanitary fittings',
      },
    });
    expect(subRes.statusCode).toBe(201);
    subPackageId = JSON.parse(subRes.body).id;
  });

  afterAll(async () => {
    await withTenantTx(prisma, tenantId, async (tx) => {
      await tx.project.deleteMany({ where: { id: projectId } });
    });
    await server.close();
  });

  // ---------------------------------------------------------------------------
  // MODULE 1: MATERIAL PURCHASE REQUISITIONS & REORDER PO WORKFLOW
  // ---------------------------------------------------------------------------
  describe('Module 1: Material Purchase Requisitions Workflow', () => {
    it('1.1 creates a material purchase requisition with accurate Decimal financial totals', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/material-requisitions`,
        headers: { cookie: supervisorCookie },
        payload: {
          requisitionNo: 'REQ-2026-001',
          itemDescription: 'Simba Power Portland Cement 42.5N',
          unitOfMeasure: 'BAGS',
          requestedQuantity: '300.00',
          estimatedUnitCostKes: '780.00',
          urgency: 'HIGH',
          requiredByDate: '2026-11-10',
          supplierName: 'Bamburi Special Products Nairobi',
          requestedBy: 'Site Foreman J. Mwangi',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('created successfully');
      expect(body.requisition.requisitionNo).toBe('REQ-2026-001');
      // 300 * 780 = 234,000.00
      expect(Number(body.requisition.estimatedTotalCostKes)).toBe(234000);
      expect(body.requisition.status).toBe('PENDING_APPROVAL');
      requisitionId = body.requisition.id;
    });

    it('1.2 lists material requisitions with summary aggregates', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/material-requisitions`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalCount).toBe(1);
      expect(body.summary.pendingCount).toBe(1);
      expect(Number(body.summary.totalEstimatedKes)).toBe(234000);
      expect(body.requisitions).toHaveLength(1);
      expect(body.requisitions[0].itemDescription).toBe('Simba Power Portland Cement 42.5N');
    });

    it('1.3 reviews and approves material requisition (PM/QS sign-off)', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${projectId}/material-requisitions/${requisitionId}`,
        headers: { cookie: adminCookie },
        payload: {
          status: 'APPROVED',
          approvedBy: 'Lead QS David Kiprono',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.requisition.status).toBe('APPROVED');
      expect(body.requisition.approvedBy).toBe('Lead QS David Kiprono');
      expect(body.requisition.approvedAt).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 2: MATERIAL WASTAGE VARIANCE ENGINE (THEORETICAL VS ACTUAL)
  // ---------------------------------------------------------------------------
  describe('Module 2: Material Wastage Variance Engine', () => {
    it('2.1 logs normal material consumption within allowable 5% tolerance', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/material-wastage`,
        headers: { cookie: adminCookie },
        payload: {
          periodName: 'Week 43 Ground Floor Slab Pour',
          materialName: 'Simba Portland Cement 42.5N',
          unitOfMeasure: 'BAGS',
          theoreticalQuantity: '500.00',
          actualConsumedQuantity: '515.00', // 15 bags extra = 3.00% wastage
          allowableWastagePct: '5.00',
          unitCostKes: '780.00',
          investigationNotes: 'Normal handling and batching tolerance per BS 8110',
          createdBy: 'Site QS D. Kiprono',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.reconciliation.materialName).toBe('Simba Portland Cement 42.5N');
      expect(Number(body.reconciliation.varianceQuantity)).toBe(15);
      expect(Number(body.reconciliation.actualWastagePct)).toBe(3);
      expect(Number(body.reconciliation.financialLossKes)).toBe(0); // within tolerance => 0 financial loss
      expect(body.reconciliation.status).toBe('WITHIN_TOLERANCE');
    });

    it('2.2 detects critical unexplained shrinkage (>10%) and flags financial loss', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/material-wastage`,
        headers: { cookie: adminCookie },
        payload: {
          periodName: 'First Floor Columns & Beams Steel Takeoff',
          materialName: 'D16 High-Yield Rebar (Y16)',
          unitOfMeasure: 'TONNES',
          theoreticalQuantity: '10.00',
          actualConsumedQuantity: '12.20', // 2.2 tonnes extra = 22.00% wastage
          allowableWastagePct: '5.00',
          unitCostKes: '140000.00',
          investigationNotes: 'Excessive offcuts observed on site scrap heap; investigate bar bending yard',
          createdBy: 'Project Manager O. Odhiambo',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.reconciliation.status).toBe('CRITICAL_UNEXPLAINED_LOSS');
      expect(Number(body.reconciliation.varianceQuantity)).toBe(2.2);
      expect(Number(body.reconciliation.actualWastagePct)).toBe(22);
      // Allowed: 10 * 1.05 = 10.5 tonnes. Excess: 12.2 - 10.5 = 1.7 tonnes.
      // Loss: 1.7 * 140,000 = 238,000.00 KES
      expect(Number(body.reconciliation.financialLossKes)).toBe(238000);
    });

    it('2.3 lists material wastage reconciliations with summary metrics', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/material-wastage`,
        headers: { cookie: supervisorCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalReconciliations).toBe(2);
      expect(body.summary.withinToleranceCount).toBe(1);
      expect(body.summary.criticalLossesCount).toBe(1);
      expect(Number(body.summary.totalFinancialLossKes)).toBe(238000);
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 3: CONTRACTOR CASH FLOW FORECASTING & S-CURVE (EVM METRICS)
  // ---------------------------------------------------------------------------
  describe('Module 3: Contractor Cash Flow & S-Curve Forecasting', () => {
    it('3.1 records monthly period cash flow with CPI, SPI and status classification', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/cash-flow`,
        headers: { cookie: adminCookie },
        payload: {
          periodMonth: '2026-10',
          plannedValueKes: '15000000.00',
          actualCostKes: '14200000.00',
          earnedValueKes: '14800000.00',
          clientBilledKes: '16000000.00',
          notes: 'Substructure and ground floor completed ahead of October schedule',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.forecast.periodMonth).toBe('2026-10');
      // CPI = EV / AC = 14.8M / 14.2M ≈ 1.0423
      expect(Number(body.forecast.cpi)).toBeGreaterThan(1.0);
      // SPI = EV / PV = 14.8M / 15.0M ≈ 0.9867
      expect(Number(body.forecast.spi)).toBeGreaterThan(0.95);
      // Net Cash Flow = 16M billed - 14.2M cost = 1.8M
      expect(Number(body.forecast.netCashFlowKes)).toBe(1800000);
      expect(body.forecast.status).toBe('ON_TRACK');
    });

    it('3.2 retrieves S-Curve time series data and project EAC calculations', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/cash-flow`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.projectId).toBe(projectId);
      expect(body.metrics.cumulativePlannedValueKes).toBe('15000000.00');
      expect(body.metrics.cumulativeActualCostKes).toBe('14200000.00');
      expect(body.metrics.cumulativeEarnedValueKes).toBe('14800000.00');
      expect(body.sCurveSeries).toHaveLength(1);
      expect(body.sCurveSeries[0].periodMonth).toBe('2026-10');
    });
  });

  // ---------------------------------------------------------------------------
  // MODULE 4: SUBCONTRACTOR VALUATIONS & BACK-TO-BACK JBC RETENTION
  // ---------------------------------------------------------------------------
  describe('Module 4: Subcontractor Valuations & Back-to-Back Retention', () => {
    it('4.1 creates a subcontractor valuation certificate with 10% retention and 3% WHT deductions', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/subcontractor-valuations`,
        headers: { cookie: adminCookie },
        payload: {
          subcontractorPackageId: subPackageId,
          certificateNo: 'SC-VAL-001',
          valuationDate: '2026-10-31',
          grossWorkCertifiedKes: '1500000.00',
          retentionRatePct: '10.00',
          previousPaymentsDeductedKes: '0.00',
          withholdingTaxPct: '3.00',
          notes: 'Valuation #1: First fix rough-in piping complete across basement and ground floor',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.valuation.certificateNo).toBe('SC-VAL-001');
      // Gross: 1,500,000.00
      // 10% Retention: 150,000.00
      // 3% WHT: 1,500,000 * 0.03 = 45,000.00
      // Net Payable: 1,500,000 - 150,000 - 45,000 = 1,305,000.00
      expect(Number(body.valuation.grossWorkCertifiedKes)).toBe(1500000);
      expect(Number(body.valuation.retentionDeductedKes)).toBe(150000);
      expect(Number(body.valuation.withholdingTaxDeductedKes)).toBe(45000);
      expect(Number(body.valuation.netPayableKes)).toBe(1305000);
      expect(body.valuation.paymentStatus).toBe('SUBMITTED');
      valuationId = body.valuation.id;
    });

    it('4.2 lists subcontractor valuations with financial summary', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/subcontractor-valuations`,
        headers: { cookie: adminCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.summary.totalValuations).toBe(1);
      expect(Number(body.summary.totalGrossCertifiedKes)).toBe(1500000);
      expect(Number(body.summary.totalRetentionHeldKes)).toBe(150000);
      expect(Number(body.summary.totalWhtDeductedKes)).toBe(45000);
      expect(Number(body.summary.totalNetPayableKes)).toBe(1305000);
      expect(body.valuations[0].subcontractorFirm).toContain('Amani Mechanical');
    });

    it('4.3 approves and pays subcontractor certificate via KCB RTGS / M-Pesa B2B reference', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${projectId}/subcontractor-valuations/${valuationId}`,
        headers: { cookie: adminCookie },
        payload: {
          paymentStatus: 'PAID',
          approvedBy: 'Director P. Kamau',
          paymentReference: 'KCB-RTGS-20261102-88192',
          paidAt: '2026-11-02T15:00:00Z',
          notes: 'Settled in full via KCB corporate online banking',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.valuation.paymentStatus).toBe('PAID');
      expect(body.valuation.paymentReference).toBe('KCB-RTGS-20261102-88192');
      expect(body.valuation.paidAt).not.toBeNull();
    });
  });
});
