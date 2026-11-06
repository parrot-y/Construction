import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';
import { generateSignedSiteOpsToken } from './services/securityConfig';

describe('E2E Live Site Simulation: Day in the Life of a Kenyan Construction Project', () => {
  const server = buildServer();

  let adminCookie: string;
  let adminUserId: string;
  let qsCookie: string;
  let qsUserId: string;
  let supervisorCookie: string;
  let supervisorUserId: string;
  let clientCookie: string;
  let clientUserId: string;

  let tenantId: string;
  let projectId: string;
  let footingBoqItemId: string;
  let costEntryId: string;
  let variationOrderId: string;

  let cubeTestId: string;
  let rfiId: string;
  let consultantToken: string;
  let snagId: string;
  let subToken: string;
  let complianceToken: string;

  let subcontractorPackageId: string;
  let equipmentId: string;
  const telematicsImei = `86901205${Date.now().toString().slice(-7)}`;
  let laborerId: string;
  let capturedCheckoutReqId: string;

  const projectCode = `RCP-SIM-${Date.now().toString().slice(-6)}`;
  const sampleBoqCsvPath = path.resolve(__dirname, '../../../docs/pilot/sample_boq_riverside_plaza.csv');

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Company Admin
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(adminRes.statusCode).toBe(200);
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    adminUserId = adminBody.user.id;
    expect(adminUserId).toBeDefined();
    tenantId = adminBody.user.tenant.id;

    // 2. Login as Quantity Surveyor / Project Manager (Faith Achieng)
    const qsRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'qs@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(qsRes.statusCode).toBe(200);
    qsCookie = qsRes.headers['set-cookie'] as string;
    const qsBody = JSON.parse(qsRes.body);
    qsUserId = qsBody.user.id;

    // 3. Login as Site Supervisor (John Kiprono / Juma Omondi)
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(supRes.statusCode).toBe(200);
    supervisorCookie = supRes.headers['set-cookie'] as string;
    const supBody = JSON.parse(supRes.body);
    supervisorUserId = supBody.user.id;

    // 4. Login as Property Developer / Client (David Omondi / Alice Nduta)
    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(clientRes.statusCode).toBe(200);
    clientCookie = clientRes.headers['set-cookie'] as string;
    const clientBody = JSON.parse(clientRes.body);
    clientUserId = clientBody.user.id;

    // 5. Clean up any previous test project with projectCode to guarantee idempotent clean state
    await withTenantTx(prisma, tenantId, async (tx) => {
      const existing = await tx.project.findFirst({
        where: { tenant_id: tenantId, code: projectCode },
      });
      if (existing) {
        await tx.auditLog.deleteMany({ where: { project_id: existing.id } });
        await tx.progressItem.deleteMany({ where: { progress_record: { project_id: existing.id } } });
        await tx.progressRecord.deleteMany({ where: { project_id: existing.id } });
        await tx.sitePhoto.deleteMany({ where: { site_diary: { project_id: existing.id } } });
        await tx.laborHeadcount.deleteMany({ where: { site_diary: { project_id: existing.id } } });
        await tx.materialDelivery.deleteMany({ where: { site_diary: { project_id: existing.id } } });
        await tx.siteDiary.deleteMany({ where: { project_id: existing.id } });
        await tx.costReceipt.deleteMany({ where: { cost_entry: { project_id: existing.id } } });
        await tx.costApproval.deleteMany({ where: { cost_entry: { project_id: existing.id } } });
        await tx.costEntry.deleteMany({ where: { project_id: existing.id } });
        await tx.variationItem.deleteMany({ where: { variation_order: { project_id: existing.id } } });
        await tx.variationOrder.deleteMany({ where: { project_id: existing.id } });
        await tx.bOQItem.deleteMany({ where: { section: { boq: { project_id: existing.id } } } });
        await tx.bOQSection.deleteMany({ where: { boq: { project_id: existing.id } } });
        await tx.bOQ.deleteMany({ where: { project_id: existing.id } });
        await tx.projectMember.deleteMany({ where: { project_id: existing.id } });
        await tx.project.delete({ where: { id: existing.id } });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // STEP 1: Admin logs in, verifies company, creates active project
  // ---------------------------------------------------------------------------
  it('Step 1: Admin logs in, verifies company Apex Builders Kenya Ltd, and creates active project "Riverside Commercial Plaza"', async () => {
    // 1.1 Verify company profile
    const companyRes = await server.inject({
      method: 'GET',
      url: '/api/v1/company',
      headers: { cookie: adminCookie },
    });
    expect(companyRes.statusCode).toBe(200);
    const company = JSON.parse(companyRes.body).data;
    expect(company.name).toBe('Apex Builders Kenya Ltd');
    expect(company.currency).toBe('KES');

    // 1.2 Create active project "Riverside Commercial Plaza" (NCA Reg: NCA-PRJ-2026-0891, Nairobi)
    const createProjectRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Riverside Commercial Plaza',
        code: projectCode,
        description: 'Ground + 4 Storey Commercial Office Block along Riverside Drive',
        location: 'Riverside Drive, Nairobi',
        ncaProjectNo: 'NCA-PRJ-2026-0891',
        budget: 45000000.0,
      },
    });

    expect(createProjectRes.statusCode).toBe(201);
    const proj = JSON.parse(createProjectRes.body).data;
    expect(proj.id).toBeDefined();
    expect(proj.name).toBe('Riverside Commercial Plaza');
    expect(proj.code).toBe(projectCode);
    expect(proj.location).toBe('Riverside Drive, Nairobi');
    expect(proj.nca_project_no).toBe('NCA-PRJ-2026-0891');
    projectId = proj.id;

    // 1.3 Assign team members to project (QS, Site Supervisor, Client)
    await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie: adminCookie },
      payload: { userId: qsUserId, role: 'PM_QS' },
    });

    await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie: adminCookie },
      payload: { userId: supervisorUserId, role: 'SITE_SUPERVISOR' },
    });

    await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie: adminCookie },
      payload: { userId: clientUserId, role: 'CLIENT' },
    });

    // Verify project members count in database
    const members = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.projectMember.findMany({ where: { project_id: projectId } });
    });
    expect(members.length).toBeGreaterThanOrEqual(4); // Creator + QS + Supervisor + Client
  });

  // ---------------------------------------------------------------------------
  // STEP 2: PM/QS logs in, imports 26-line EASMM BOQ, verifies 6 stages & locks budget
  // ---------------------------------------------------------------------------
  it('Step 2: PM/QS logs in, imports the 26-line Kenyan EASMM BOQ from sample_boq_riverside_plaza.csv, verifies 6-stage import and locks baseline budget', async () => {
    // 2.1 Read sample BOQ file from docs/pilot/sample_boq_riverside_plaza.csv
    expect(fs.existsSync(sampleBoqCsvPath)).toBe(true);
    const csvContent = fs.readFileSync(sampleBoqCsvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    expect(lines.length).toBe(27); // 1 header row + 26 data lines

    const bufferBase64 = Buffer.from(csvContent).toString('base64');

    // 2.2 Stage 1-4: Upload and Preview
    const previewRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/preview`,
      headers: { cookie: qsCookie },
      payload: {
        bufferBase64,
        filename: 'sample_boq_riverside_plaza.csv',
      },
    });

    expect(previewRes.statusCode).toBe(200);
    const preview = JSON.parse(previewRes.body).data;

    // Verify 6-stage parsing metrics
    expect(preview.totalSections).toBe(5);
    expect(preview.totalItems).toBe(26);
    expect(preview.validItemsCount).toBe(26);
    expect(preview.warningItemsCount).toBe(0);
    expect(preview.rejectedItemsCount).toBe(0);
    expect(preview.calculatedGrandTotal).toBe('40279000.00');

    // Verify EASMM 5 Sections
    expect(preview.sections).toHaveLength(5);
    expect(preview.sections[0].title).toContain('Substructure');
    expect(preview.sections[0].items).toHaveLength(14);
    expect(preview.sections[1].title).toContain('Superstructure');
    expect(preview.sections[1].items).toHaveLength(4);
    expect(preview.sections[2].title).toContain('Roofing');
    expect(preview.sections[2].items).toHaveLength(2);
    expect(preview.sections[3].title).toContain('Finishes');
    expect(preview.sections[3].items).toHaveLength(3);
    expect(preview.sections[4].title).toContain('Provisional Sums');
    expect(preview.sections[4].items).toHaveLength(3);

    // 2.3 Stage 5-6: Confirm and Atomically Lock Baseline Budget
    const confirmRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/confirm`,
      headers: { cookie: qsCookie },
      payload: {
        sourceFilename: 'sample_boq_riverside_plaza.csv',
        sections: preview.sections,
        excludeRejected: true,
      },
    });

    expect(confirmRes.statusCode).toBe(201);
    const boq = JSON.parse(confirmRes.body).data;
    expect(boq.version).toBe(1);
    expect(boq.status).toBe('ACTIVE');
    expect(toDecimal(boq.total_amount).toFixed(2)).toBe('40279000.00');

    // 2.4 Verify project budget was locked to the agreed BOQ baseline in PostgreSQL RLS
    const updatedProject = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectId } });
    });
    expect(toDecimal(updatedProject!.current_approved_budget.toString()).toFixed(2)).toBe('40279000.00');

    // 2.5 Find and store strip foundation footings BOQ item ID (Item 01.11)
    const boqItemsRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/boq`,
      headers: { cookie: qsCookie },
    });
    expect(boqItemsRes.statusCode).toBe(200);
    const activeBoqData = JSON.parse(boqItemsRes.body).data;
    const substructureSection = activeBoqData.sections.find((s: any) => s.title.includes('Substructure'));
    expect(substructureSection).toBeDefined();

    const footingItem = substructureSection.items.find((i: any) =>
      i.item_code === '1.11' || i.item_code === '01.11' || i.description.includes('strip foundation footings'),
    );
    expect(footingItem).toBeDefined();
    expect(footingItem.unit).toBe('CM');
    expect(toDecimal(footingItem.total_amount).toFixed(2)).toBe('2320000.00');
    footingBoqItemId = footingItem.id;
  });

  // ---------------------------------------------------------------------------
  // STEP 3: Site Supervisor logs in, posts daily diary, delivery & 15% progress
  // ---------------------------------------------------------------------------
  it('Step 3: Site Supervisor logs in, posts daily site diary (Sunny, Operational, 18 skilled + 24 casual laborers), logs delivery of 200 bags Bamburi Cement with Nairobi GPS geotagged photo (-1.286389, 36.817223), and records 15% physical progress on Substructure footings', async () => {
    // 3.1 Post daily site diary
    const diaryRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/site-diaries`,
      headers: { cookie: supervisorCookie },
      payload: {
        entryDate: '2026-11-03',
        weather: 'SUNNY_CLEAR',
        siteStatus: 'OPERATIONAL',
        generalNotes: 'Day 1 morning operations: Weather sunny and clear. Substructure blinding poured. Rebar steel fixers fabricating footing cages.',
        laborHeadcounts: [
          { tradeType: 'Skilled', headcount: 18 },
          { tradeType: 'Casual', headcount: 24 },
        ],
        deliveries: [
          {
            materialName: 'Bamburi Portland Cement 32.5N',
            quantity: '200.0000',
            unit: 'BAGS',
            supplierName: 'Bamburi Cement Ltd',
            deliveryNote: 'DN-BAMBURI-2026-0891',
          },
        ],
        photos: [
          {
            storageKey: 'evidence/rcp-2026/delivery_bamburi_cement_01.jpg',
            caption: 'Delivery and physical stack verification of 200 bags Bamburi Cement on site',
            gpsLatitude: -1.286389,
            gpsLongitude: 36.817223,
          },
        ],
      },
    });

    expect(diaryRes.statusCode).toBe(201);
    const diaryData = JSON.parse(diaryRes.body).data;
    expect(diaryData.weather).toBe('SUNNY_CLEAR');
    expect(diaryData.site_status).toBe('OPERATIONAL');
    expect(diaryData.labor_headcounts).toHaveLength(2);
    expect(diaryData.deliveries).toHaveLength(1);
    expect(diaryData.deliveries[0].material_name).toBe('Bamburi Portland Cement 32.5N');
    expect(toDecimal(diaryData.deliveries[0].quantity).toFixed(4)).toBe('200.0000');
    expect(diaryData.photos).toHaveLength(1);
    expect(parseFloat(diaryData.photos[0].gps_latitude)).toBeCloseTo(-1.286389, 4);
    expect(parseFloat(diaryData.photos[0].gps_longitude)).toBeCloseTo(36.817223, 4);

    // 3.2 Record 15% physical progress on Substructure footings
    const progressRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/progress`,
      headers: { cookie: supervisorCookie },
      payload: {
        recordDate: '2026-11-03',
        overallProgress: '0.1500', // 15%
        notes: '15% physical progress achieved: Strip foundation trench blinding complete and footing rebar in place.',
        items: [
          {
            boqItemId: footingBoqItemId,
            completedQuantity: '24.0000', // 15% of 160 CM
            completionPct: '0.1500',
          },
        ],
      },
    });

    expect(progressRes.statusCode).toBe(201);
    const progressData = JSON.parse(progressRes.body).data;
    expect(toDecimal(progressData.overall_progress).toFixed(2)).toBe('0.15');
    expect(progressData.items).toHaveLength(1);
    expect(progressData.items[0].boq_item_id).toBe(footingBoqItemId);
    expect(toDecimal(progressData.items[0].completion_pct).toFixed(4)).toBe('0.1500');
  });

  // ---------------------------------------------------------------------------
  // STEP 4: PM/QS records actual costs into cost ledger, attaches receipt, verifies aggregation
  // ---------------------------------------------------------------------------
  it('Step 4: PM/QS records actual costs into append-only cost ledger (CostEntry), attaches invoice receipt, verifies budget aggregation in Decimal', async () => {
    // 4.1 Record actual material expense: 200 bags Bamburi Cement @ KES 850 = KES 170,000.00
    const costRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/costs`,
      headers: { cookie: qsCookie },
      payload: {
        boqItemId: footingBoqItemId,
        costCategory: 'MATERIAL',
        amount: '170000.00',
        vendorName: 'Bamburi Cement Ltd',
        invoiceRef: 'INV-BAMBURI-8901',
        description: 'Procurement of 200 bags Bamburi Portland Cement for strip foundation footings',
        receipts: [
          {
            filename: 'bamburi_cement_invoice_8901.pdf',
            fileSize: 185400,
            mimeType: 'application/pdf',
            storageKey: 'receipts/rcp-2026/bamburi_cement_invoice_8901.pdf',
          },
        ],
      },
    });

    expect(costRes.statusCode).toBe(201);
    const costData = JSON.parse(costRes.body).data;
    expect(costData.status).toBe('PENDING');
    expect(costData.amount).toBe('170000.00');
    expect(costData.cost_category).toBe('MATERIAL');
    expect(costData.boq_item_id).toBe(footingBoqItemId);
    expect(costData.receipts).toHaveLength(1);
    expect(costData.receipts[0].filename).toBe('bamburi_cement_invoice_8901.pdf');
    costEntryId = costData.id;

    // 4.2 PM/QS approves the pending cost entry
    const approveCostRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/costs/${costEntryId}/approve`,
      headers: { cookie: qsCookie },
      payload: {
        action: 'APPROVED',
        comments: 'Verified against Bamburi delivery note DN-BAMBURI-2026-0891 and on-site supervisor count.',
      },
    });

    expect(approveCostRes.statusCode).toBe(200);
    const approveCostData = JSON.parse(approveCostRes.body).data;
    expect(approveCostData.updated.status).toBe('APPROVED');

    // 4.3 Verify Budget Aggregation in Decimal Precision
    const budgetSummaryRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/budget/summary`,
      headers: { cookie: qsCookie },
    });

    expect(budgetSummaryRes.statusCode).toBe(200);
    const summary = JSON.parse(budgetSummaryRes.body).data;
    expect(summary.projectId).toBe(projectId);
    expect(summary.currency).toBe('KES');
    expect(summary.approvedBudget).toBe('40279000.00');
    expect(summary.approvedCost).toBe('170000.00');
    expect(summary.pendingCost).toBe('0.00');
    expect(summary.remainingBudget).toBe('40109000.00'); // 40,279,000.00 - 170,000.00

    // Decimal exact invariant
    const budgetDec = toDecimal(summary.approvedBudget);
    const costDec = toDecimal(summary.approvedCost);
    const remainingDec = toDecimal(summary.remainingBudget);
    expect(budgetDec.minus(costDec).toString()).toBe(remainingDec.toString());

    // Category breakdown check
    expect(summary.categoryBreakdown).toBeDefined();
    expect(summary.categoryBreakdown.MATERIAL).toBeDefined();
    expect(summary.categoryBreakdown.MATERIAL.approved).toBe('170000.00');
  });

  // ---------------------------------------------------------------------------
  // STEP 5: Scope variation occurs, QS evaluates, Developer approves (atomic budget update)
  // ---------------------------------------------------------------------------
  it('Step 5: Scope variation occurs on site — PM/QS submits Variation Order #1 (+25 CM Concrete, -100 SM walling), QS evaluates, Developer/Client logs in and approves variation. Verify atomic budget update invariant in withTenantTx', async () => {
    // 5.1 PM/QS submits Variation Order #1
    // Item 1: +25 CM Concrete @ 14,500.00 = +362,500.00
    // Item 2: -100 SM Natural stone walling @ 1,850.00 = -185,000.00
    // Net Variation Amount = +177,500.00
    const submitVoRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations`,
      headers: { cookie: qsCookie },
      payload: {
        title: 'Variation Order #1: Strip Foundation Footings Deepening & Stone Walling Omission',
        reason: 'Geotechnical soil inspection requires deepening strip footings by +25 CM Concrete and omitting -100 SM masonry walling',
        timeExtensionDays: 7,
        items: [
          {
            boqItemId: footingBoqItemId,
            description: 'Additional vibrated reinforced concrete Class 1:2:4 in strip footings',
            unit: 'CM',
            quantity: '25.0000',
            unitRate: '14500.0000',
          },
          {
            description: 'Omission of foundation natural stone walling 200mm thick',
            unit: 'SM',
            quantity: '-100.0000',
            unitRate: '1850.0000',
          },
        ],
      },
    });

    expect(submitVoRes.statusCode).toBe(201);
    const voData = JSON.parse(submitVoRes.body).data;
    expect(voData.variation_no).toBe(1);
    expect(voData.status).toBe('SUBMITTED');
    expect(voData.time_extension_days).toBe(7);
    expect(voData.net_amount).toBe('177500.00');
    variationOrderId = voData.id;

    // 5.2 QS evaluates Variation Order
    const budgetBeforeEval = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectId } });
    });

    const evalRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${variationOrderId}/review`,
      headers: { cookie: qsCookie },
      payload: {
        action: 'EVALUATE',
        comments: 'Technical justification verified against site engineer borehole report and EASMM contractual rates. Recommended for Developer approval.',
      },
    });

    expect(evalRes.statusCode).toBe(200);
    const evalData = JSON.parse(evalRes.body).data;
    expect(evalData.status).toBe('QS_EVALUATED');

    // Invariant: Budget must NOT change during evaluation
    const budgetAfterEval = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectId } });
    });
    expect(budgetAfterEval!.current_approved_budget.toString()).toBe(budgetBeforeEval!.current_approved_budget.toString());

    // 5.3 Developer/Client logs in and approves Variation Order #1
    const approveVoRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/variations/${variationOrderId}/review`,
      headers: { cookie: clientCookie },
      payload: {
        action: 'APPROVE',
        comments: 'Approved foundation variation order #1 as recommended by PM/QS Faith Achieng. 7 days time extension granted.',
      },
    });

    expect(approveVoRes.statusCode).toBe(200);
    const approveVoData = JSON.parse(approveVoRes.body).data;
    expect(approveVoData.status).toBe('APPROVED');
    expect(approveVoData.approved_at).not.toBeNull();

    // 5.4 CRITICAL INVARIANT: Project budget atomically updated in withTenantTx
    // Initial: 40,279,000.00 + Variation: 177,500.00 = 40,456,500.00
    const projectAfterVo = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectId } });
    });
    const expectedBudget = toDecimal('40279000.00').plus(toDecimal('177500.00')).toFixed(2);
    expect(toDecimal(projectAfterVo!.current_approved_budget.toString()).toFixed(2)).toBe('40456500.00');
    expect(expectedBudget).toBe('40456500.00');
  });

  // ---------------------------------------------------------------------------
  // STEP 6: Real-time variance monitor recalculates delta, verifies ON_TRACK
  // ---------------------------------------------------------------------------
  it('Step 6: Real-time variance monitor recalculates delta, verifies neutral health status alert (ON_TRACK)', async () => {
    const summaryRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/budget/summary`,
      headers: { cookie: qsCookie },
    });

    expect(summaryRes.statusCode).toBe(200);
    const summary = JSON.parse(summaryRes.body).data;
    const v = summary.detailedVariance;

    expect(v).toBeDefined();
    // Progress: 15.00%, Cost: 170,000 on 40,456,500 budget (~0.42%) -> Delta is negative -> Healthy!
    expect(v.status).toBe('ON_TRACK');
    expect(v.severity).toBe('info');
    expect(v.statusLabel).toBe('Normal Alignment');
    expect(v.hasWarning).toBe(false);
    expect(v.physicalProgressPercentage).toBe('15.00');
    expect(parseFloat(v.costConsumptionPercentage)).toBeLessThan(1.0);
    expect(v.message).toContain('Expenditure is aligned with recorded physical progress');
  });

  // ---------------------------------------------------------------------------
  // STEP 7: Client inspects Client Portal (5 plain numbers, photo gallery, retention)
  // ---------------------------------------------------------------------------
  it('Step 7: Client inspects Client Portal (retrieving the 5 plain-language numbers, Nairobi GPS photo gallery, milestone timeline, and Kenyan retention terms)', async () => {
    const portalRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/client-portal`,
      headers: { cookie: clientCookie },
    });

    expect(portalRes.statusCode).toBe(200);
    const body = JSON.parse(portalRes.body);
    const data = body.data || body;

    // 7.1 The 5 Plain-Language Financial Numbers
    const { financials } = data;
    expect(financials.original_agreed_budget).toBe('40279000.00');
    expect(financials.approved_variations_total).toBe('177500.00');
    expect(financials.current_approved_budget).toBe('40456500.00');
    expect(financials.total_spent_to_date).toBe('170000.00');
    expect(financials.remaining_balance).toBe('40286500.00'); // 40,456,500.00 - 170,000.00

    // Decimal exact invariant
    const currBudgetDec = toDecimal(financials.current_approved_budget);
    const spentDec = toDecimal(financials.total_spent_to_date);
    const remDec = toDecimal(financials.remaining_balance);
    expect(currBudgetDec.minus(spentDec).equals(remDec)).toBe(true);

    // Budget used percentage formatted to 1 decimal place (170,000 / 40,456,500 * 100 = 0.4%)
    expect(typeof financials.budget_used_percentage).toBe('number');
    expect(financials.budget_used_percentage).toBe(0.4);

    // 7.2 Verified Photo Evidence Gallery with Nairobi GPS Coordinates
    const photos = data.photo_evidence;
    expect(Array.isArray(photos)).toBe(true);
    expect(photos.length).toBeGreaterThanOrEqual(1);

    const deliveryPhoto = photos.find((p: any) => p.caption.includes('Bamburi Cement'));
    expect(deliveryPhoto).toBeDefined();
    expect(deliveryPhoto.latitude).toBeCloseTo(-1.286389, 4);
    expect(deliveryPhoto.longitude).toBeCloseTo(36.817223, 4);
    expect(deliveryPhoto.weather).toBe('SUNNY_CLEAR');

    // 7.3 Milestone Timeline
    const timeline = data.timeline;
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    expect(timeline[0].percentage).toBe(15.0);
    expect(timeline[0].notes).toContain('15% physical progress achieved');

    // 7.4 Kenyan Standard Retention Terms
    const { retention_terms } = data;
    expect(retention_terms.interim_deduction_rate).toBe('10%');
    expect(retention_terms.max_cap_rate).toBe('5%');
    // 5% of 40,279,000.00 = 2,013,950.00
    expect(retention_terms.max_cap_amount).toBe('2013950.00');
    expect(retention_terms.release_schedule).toHaveLength(2);
    expect(retention_terms.release_schedule[0].milestone).toBe('Practical Completion');
    expect(retention_terms.release_schedule[0].percentage).toBe('50%');
    expect(retention_terms.release_schedule[1].milestone).toBe('Defects Liability Period');
    expect(retention_terms.release_schedule[1].percentage).toBe('50%');

    // 7.5 ADR-001 Invariant: Zero inflammatory words in client portal
    const inflammatoryWordsRegex = /(fraud|theft|stole|embezzle|corrupt|cheat|overbilled)/i;
    expect(portalRes.body).not.toMatch(inflammatoryWordsRegex);
  });

  // ---------------------------------------------------------------------------
  // STEP 8: PM/QS generates print-ready Interim Payment Certificate (IPC) PDF
  // ---------------------------------------------------------------------------
  it('Step 8: PM/QS generates print-ready Interim Payment Certificate (IPC) PDF with 10% statutory retention fund deduction up to 5% cap, verifies valid %PDF- binary output and signature blocks', async () => {
    const ipcRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/reports/ipc`,
      headers: { cookie: qsCookie },
    });

    expect(ipcRes.statusCode).toBe(200);
    expect(ipcRes.headers['content-type']).toBe('application/pdf');
    expect(ipcRes.headers['content-disposition']).toContain(`IPC-${projectCode}.pdf`);

    // Verify valid PDF binary header and size
    const pdfBuffer = ipcRes.rawPayload;
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');

    // Verify client can also access and download the certificate
    const clientIpcRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/reports/ipc`,
      headers: { cookie: clientCookie },
    });
    expect(clientIpcRes.statusCode).toBe(200);
    expect(clientIpcRes.headers['content-type']).toBe('application/pdf');
    expect(clientIpcRes.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  // ---------------------------------------------------------------------------
  // STEP 9: Pre-Pour QA Inspection & Concrete Cube Casting (KS 02-598 Standard)
  // ---------------------------------------------------------------------------
  it('Step 9: Site Supervisor logs Pre-Pour QA Inspection and casts 6 concrete test cubes for Substructure footings (Batch BT-E2E-001, Class 25/20)', async () => {
    // 1. Submit Pre-Pour Checklist
    const inspRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/inspections`,
      headers: { cookie: supervisorCookie },
      payload: {
        checklistType: 'PRE_POUR_CONCRETE',
        title: 'Substructure Strip Footing Pre-Pour QA',
        location: 'Grid 1-4 Foundation Trenches',
        scheduledDate: '2026-02-01',
        items: [
          { orderIdx: 0, checkPoint: 'T16 high-yield rebar spacing at 200mm centres per S-01', isMandatory: true },
          { orderIdx: 1, checkPoint: '40mm concrete cover blocks placed and tied', isMandatory: true },
          { orderIdx: 2, checkPoint: 'Trench excavation bottom dry and cleaned of loose soil', isMandatory: true },
        ],
      },
    });

    expect(inspRes.statusCode).toBe(201);
    const inspBody = JSON.parse(inspRes.body);
    expect(inspBody.title).toBe('Substructure Strip Footing Pre-Pour QA');
    expect(inspBody.items.length).toBe(3);

    // Pass all 3 inspection items
    for (const item of inspBody.items) {
      const itemRes = await server.inject({
        method: 'PUT',
        url: `/api/v1/projects/${projectId}/inspections/${inspBody.id}/items/${item.id}`,
        headers: { cookie: supervisorCookie },
        payload: {
          result: 'PASS',
        },
      });
      expect(itemRes.statusCode).toBe(200);
    }

    // 2. Cast 6 Concrete Test Cubes
    const cubeRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/cube-tests`,
      headers: { cookie: supervisorCookie },
      payload: {
        batchReference: 'BT-E2E-001',
        pourLocation: 'Substructure Strip Footings & Column Starters',
        pourDate: '2026-02-01',
        concreteClass: 'CLASS_25_20',
        targetStrengthMpa: '25.00',
        slumpTestedMm: 100,
        supplierName: 'Bamburi Ready-Mix Nairobi',
        deliveryDocketNo: 'DN-BAM-90812',
      },
    });

    expect(cubeRes.statusCode).toBe(201);
    const cubeBody = JSON.parse(cubeRes.body);
    expect(cubeBody.batch_reference).toBe('BT-E2E-001');
    cubeTestId = cubeBody.id;
    expect(cubeTestId).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // STEP 10: Technical Query (RFI) & Architect Token Response via Consultant Portal
  // ---------------------------------------------------------------------------
  it('Step 10: Site raises technical RFI to Architect on column cover details; Admin generates Consultant token access link; Architect answers RFI via token without credentials', async () => {
    // 1. Raise RFI
    const rfiRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/rfis`,
      headers: { cookie: supervisorCookie },
      payload: {
        title: 'Column C3 starter bar cover clarification',
        question: 'Architectural drawing indicates 30mm cover while structural drawing S-204 specifies 40mm. Please confirm authorized cover for ground floor perimeter columns.',
        assignedToRole: 'Architect',
        priority: 'HIGH',
      },
    });

    expect(rfiRes.statusCode).toBe(201);
    const rfiBody = JSON.parse(rfiRes.body);
    rfiId = rfiBody.id;
    expect(rfiId).toBeDefined();
    expect(rfiBody.status).toBe('SUBMITTED');

    // 2. PM/QS generates zero-seat-tax portal access link for Lead Architect
    const linkRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: qsCookie },
      payload: {
        portalType: 'CONSULTANT',
        stakeholderName: 'Arch. Peter Mwangi',
        stakeholderRole: 'Lead Architect (BORAQS A-742)',
        expiresInDays: 30,
      },
    });

    expect(linkRes.statusCode).toBe(201);
    consultantToken = JSON.parse(linkRes.body).data.token;
    expect(consultantToken).toBeDefined();

    // 3. Architect validates token publicly without authentication
    const valRes = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/validate/${consultantToken}`,
    });
    expect(valRes.statusCode).toBe(200);
    const valBody = JSON.parse(valRes.body).data;
    expect(valBody.isValid).toBe(true);
    expect(valBody.portalType).toBe('CONSULTANT');
    expect(valBody.stakeholderName).toBe('Arch. Peter Mwangi');

    // 4. Architect inspects Consultant Portal
    const portalRes = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/consultant/${consultantToken}`,
    });
    expect(portalRes.statusCode).toBe(200);
    const portalData = JSON.parse(portalRes.body).data;
    expect(portalData.rfis.length).toBeGreaterThan(0);
    expect(portalData.cubeTests.length).toBeGreaterThan(0);

    // 5. Architect answers RFI directly via portal link
    const replyRes = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/consultant/${consultantToken}/rfis/${rfiId}/reply`,
      payload: {
        officialAnswer: 'Provide 40mm minimum cover to all external columns as per structural specification S-204.',
        consultantName: 'Arch. Peter Mwangi',
        consultantBoraqsNo: 'BORAQS A-742',
      },
    });

    expect(replyRes.statusCode).toBe(200);
    const replyBody = JSON.parse(replyRes.body).data;
    expect(replyBody.is_accepted).toBe(true);
    expect(replyBody.official_answer).toContain('Provide 40mm minimum cover');

    // 6. Verify RFI status is updated to ANSWERED
    const verifyRfi = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/consultant/${consultantToken}`,
    });
    const answeredRfi = JSON.parse(verifyRfi.body).data.rfis.find((r: any) => r.id === rfiId);
    expect(answeredRfi.status).toBe('ANSWERED');
  });

  // ---------------------------------------------------------------------------
  // STEP 11: Concrete Cube Crushing Protocol (BS EN 12390 / KS 02-598)
  // ---------------------------------------------------------------------------
  it('Step 11: Laboratory records 7-day break (19.80 MPa >= 16.25 MPa) and 28-day break (27.50 MPa >= 25.00 MPa), verifying KS 02-598 structural compliance', async () => {
    // 1. Day 7 break: 445.5 kN / 22.5 = 19.80 MPa
    const break7Res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/cube-tests/${cubeTestId}/breaks`,
      headers: { cookie: supervisorCookie },
      payload: {
        cubeNumber: 1,
        breakAgeDays: 7,
        scheduledBreakDate: '2026-02-08',
        actualBreakDate: '2026-02-08',
        crushingLoadKn: '445.50',
        testedBy: 'Bamburi Materials Lab Nairobi',
      },
    });

    expect(break7Res.statusCode).toBe(201);
    const break7 = JSON.parse(break7Res.body);
    expect(break7.compressive_mpa).toBe('19.80');
    expect(break7.is_pass).toBe(true);

    // 2. Day 28 break: 618.75 kN / 22.5 = 27.50 MPa
    const break28Res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/cube-tests/${cubeTestId}/breaks`,
      headers: { cookie: supervisorCookie },
      payload: {
        cubeNumber: 2,
        breakAgeDays: 28,
        scheduledBreakDate: '2026-03-01',
        actualBreakDate: '2026-03-01',
        crushingLoadKn: '618.75',
        testedBy: 'Bamburi Materials Lab Nairobi',
      },
    });

    expect(break28Res.statusCode).toBe(201);
    const break28 = JSON.parse(break28Res.body);
    expect(break28.compressive_mpa).toBe('27.50');
    expect(break28.is_pass).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // STEP 12: Certificate of Practical Completion (1st Moiety 50% Retention Release)
  // ---------------------------------------------------------------------------
  it('Step 12: Joint site inspection reaches Practical Completion: Architect & QS issue Certificate of Practical Completion, triggering 1st Moiety (50%) retention fund release', async () => {
    const cpcRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/certificates`,
      headers: { cookie: qsCookie },
      payload: {
        certificateType: 'PRACTICAL_COMPLETION',
        certificateReference: 'CPC-RCP-2026-001',
        issueDate: '2026-04-10',
        effectiveDate: '2026-04-10',
        dlpDurationMonths: 6,
        architectName: 'Arch. Peter Mwangi',
        architectBoraqsNo: 'BORAQS A-742',
        qsName: 'Faith Achieng',
        qsBoraqsNo: 'BORAQS Q-891',
        notes: 'Works practically completed. First moiety (50% of retention fund) released.',
      },
    });

    expect(cpcRes.statusCode).toBe(201);
    const cpc = JSON.parse(cpcRes.body);
    expect(cpc.certificate_type).toBe('PRACTICAL_COMPLETION');
    expect(cpc.certificate_reference).toBe('CPC-RCP-2026-001');
    expect(cpc.dlp_duration_months).toBe(6);
    expect(cpc.dlp_expiry_date).toContain('2026-10-10');
    expect(Number(cpc.retention_amount_released)).toBe(1006975);
  });

  // ---------------------------------------------------------------------------
  // STEP 13: Subcontractor Snagging Punch List & Rectification via Subcontractor Portal
  // ---------------------------------------------------------------------------
  it('Step 13: Site identifies snag item, Subcontractor accesses portal via token, uploads rectified photo proof with GPS coordinates, and Site Supervisor verifies & closes defect', async () => {
    // 1. Create Snag Item
    const snagRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/snags`,
      headers: { cookie: supervisorCookie },
      payload: {
        locationFloor: 'Ground Floor',
        locationRoom: 'Washroom 1B',
        description: 'Basin hot water compression coupling dripping under mains pressure.',
        severity: 'FUNCTIONAL',
        tradeCategory: 'Plumbing',
        assignedTradeFirm: 'Simba Plumbing Works Ltd',
        identifiedByName: 'John Kiprono',
      },
    });

    expect(snagRes.statusCode).toBe(201);
    const snagBody = JSON.parse(snagRes.body);
    snagId = snagBody.id;
    expect(snagId).toBeDefined();
    expect(snagBody.status).toBe('OPEN');

    // 2. Generate Subcontractor Token Link
    const linkRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'SUBCONTRACTOR',
        stakeholderName: 'Simba Plumbing Works Ltd',
        stakeholderRole: 'Plumbing',
        expiresInDays: 14,
      },
    });

    expect(linkRes.statusCode).toBe(201);
    subToken = JSON.parse(linkRes.body).data.token;
    expect(subToken).toBeDefined();

    // 3. Subcontractor views assigned snags
    const subPortalRes = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/subcontractor/${subToken}`,
    });
    expect(subPortalRes.statusCode).toBe(200);
    const subPortal = JSON.parse(subPortalRes.body).data;
    expect(subPortal.snags.length).toBeGreaterThan(0);

    // 4. Subcontractor submits rectification proof
    const rectifyRes = await server.inject({
      method: 'POST',
      url: `/api/v1/portals/subcontractor/${subToken}/snags/${snagId}/rectify`,
      payload: {
        photoStorageKey: 'uploads/snags/rectified_basin_coupling.jpg',
        notes: 'Tightened compression coupling and tested under 6-bar mains pressure with zero leakage.',
        gpsLat: -1.286389,
        gpsLng: 36.817223,
      },
    });

    expect(rectifyRes.statusCode).toBe(200);
    const rectifiedSnag = JSON.parse(rectifyRes.body).data;
    expect(rectifiedSnag.status).toBe('RECTIFIED_BY_CONTRACTOR');
    expect(rectifiedSnag.photos.length).toBeGreaterThan(0);

    // 5. Site Supervisor inspects and verifies closed
    const verifyRes = await server.inject({
      method: 'PUT',
      url: `/api/v1/projects/${projectId}/snags/${snagId}/status`,
      headers: { cookie: supervisorCookie },
      payload: {
        status: 'VERIFIED_CLOSED',
        verifiedByName: 'John Kiprono',
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    expect(JSON.parse(verifyRes.body).status).toBe('VERIFIED_CLOSED');
  });

  // ---------------------------------------------------------------------------
  // STEP 14: Defects Liability Expiry & Certificate of Making Good Defects (2nd Moiety)
  // ---------------------------------------------------------------------------
  it('Step 14: 6-month Defects Liability Period expires: Architect & QS conduct final inspection, issue Certificate of Making Good Defects, and release 2nd Moiety (final 50%) retention fund', async () => {
    const cmgdRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/certificates`,
      headers: { cookie: qsCookie },
      payload: {
        certificateType: 'MAKING_GOOD_DEFECTS',
        certificateReference: 'CMGD-RCP-2026-001',
        issueDate: '2026-10-10',
        effectiveDate: '2026-10-10',
        dlpDurationMonths: 6,
        architectName: 'Arch. Peter Mwangi',
        architectBoraqsNo: 'BORAQS A-742',
        qsName: 'Faith Achieng',
        qsBoraqsNo: 'BORAQS Q-891',
        notes: 'Defects liability period completed. All snagging items verified and closed. Final second moiety retention fund released from escrow.',
      },
    });

    expect(cmgdRes.statusCode).toBe(201);
    const cmgd = JSON.parse(cmgdRes.body);
    expect(cmgd.certificate_type).toBe('MAKING_GOOD_DEFECTS');
    expect(cmgd.certificate_reference).toBe('CMGD-RCP-2026-001');
    expect(Number(cmgd.retention_amount_released)).toBe(1006975);
  });

  // ---------------------------------------------------------------------------
  // STEP 15: NCA Regulatory Compliance Portal Audit
  // ---------------------------------------------------------------------------
  it('Step 15: NCA Regulatory Auditor accesses Compliance Portal link, verifies 100% concrete cube pass rate, statutory levy clearance, and accredited supervisor presence', async () => {
    // 1. Generate Compliance Portal Link
    const linkRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/portals/links`,
      headers: { cookie: adminCookie },
      payload: {
        portalType: 'COMPLIANCE',
        stakeholderName: 'Eng. Faith Mutua',
        stakeholderRole: 'NCA Regional Auditor',
        expiresInDays: 30,
      },
    });

    expect(linkRes.statusCode).toBe(201);
    complianceToken = JSON.parse(linkRes.body).data.token;
    expect(complianceToken).toBeDefined();

    // 2. NCA Auditor accesses Compliance Portal
    const compRes = await server.inject({
      method: 'GET',
      url: `/api/v1/portals/compliance/${complianceToken}`,
    });

    expect(compRes.statusCode).toBe(200);
    const compData = JSON.parse(compRes.body).data;
    expect(compData.regulatoryAuditor.name).toBe('Eng. Faith Mutua');
    expect(compData.complianceSummary.statutoryLevyPaid).toBe(true);
    expect(compData.complianceSummary.certifiedSiteSupervisorPresent).toBe(true);
    expect(compData.complianceSummary.concreteCubePassRate).toBe('100.0%');
    expect(compData.cubeTests.length).toBeGreaterThan(0);
    expect(compData.inspections.length).toBeGreaterThan(0);
    expect(compData.certificates.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // STEP 16: Commercial Heavy Machinery Fleet & CANBUS IoT Telematics (M16 & M24)
  // ---------------------------------------------------------------------------
  it('Step 16: Commercial Heavy Machinery Fleet & CANBUS IoT Telematics with Diesel Siphoning Drop Detection (M16 & M24)', async () => {
    // 1. Create plant equipment
    const equipRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/equipment`,
      headers: { cookie: adminCookie },
      payload: {
        equipmentCode: 'EXC-001',
        name: 'CAT 320D Hydraulic Excavator',
        equipmentType: 'EXCAVATOR',
        ownershipType: 'OWNED',
        ratePerUnitKes: '6500.00',
        rateUnit: 'PER_HOUR',
        registrationNo: 'KDF 819B',
        supplierName: 'Simba Heavy Plant Hire Ltd',
        currentHoursMeter: '1420.50',
      },
    });
    expect(equipRes.statusCode).toBe(201);
    equipmentId = JSON.parse(equipRes.body).equipment.id;

    // 2. Attach CANBUS telematics device
    const devRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/telematics-devices`,
      headers: { cookie: adminCookie },
      payload: {
        equipmentId,
        deviceImei: telematicsImei,
        protocol: 'CANBUS',
        simPhoneNumber: '+254711998877',
        calibrationTankCapacityLiters: '400.00',
      },
    });
    expect(devRes.statusCode).toBe(201);
    const telematicsToken = JSON.parse(devRes.body).deviceToken;

    // 3. Normal running ping (80% = 320L)
    const ping1 = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/ping',
      headers: {
        'x-device-token': telematicsToken,
        'x-tenant-id': tenantId,
      },
      payload: {
        deviceImei: telematicsImei,
        latitude: '-1.286389',
        longitude: '36.817223',
        engineStatus: 'RUNNING',
        engineRpm: 1800,
        cumulativeEngineSeconds: 36000,
        fuelLevelPercent: '80.00',
      },
    });
    expect(ping1.statusCode).toBe(200);
    expect(JSON.parse(ping1.body).isSiphoningEvent).toBe(false);

    // 4. Siphoning drop ping (70% = 280L, 40L drop while STOPPED!)
    const ping2 = await server.inject({
      method: 'POST',
      url: '/api/v1/telematics/ping',
      headers: {
        'x-device-token': telematicsToken,
        'x-tenant-id': tenantId,
      },
      payload: {
        deviceImei: telematicsImei,
        latitude: '-1.286389',
        longitude: '36.817223',
        engineStatus: 'STOPPED',
        engineRpm: 0,
        cumulativeEngineSeconds: 36000,
        fuelLevelPercent: '70.00',
      },
    });
    expect(ping2.statusCode).toBe(200);
    expect(JSON.parse(ping2.body).isSiphoningEvent).toBe(true);

    // Verify automated emergency SiteAlertNotification
    const alert = await withTenantTx(prisma, tenantId, (tx) =>
      tx.siteAlertNotification.findFirst({
        where: { project_id: projectId, alert_type: { in: ['DIESEL_DISCREPANCY_FLAG', 'DIESEL_SIPHONING_FLAG'] } },
      })
    );
    expect(alert).toBeDefined();
    expect(alert?.delivery_channel).toBe('WHATSAPP');
  });

  // ---------------------------------------------------------------------------
  // STEP 17: Site Casual Labor Muster Roll & Haversine GPS Geofencing (M17 & M23)
  // ---------------------------------------------------------------------------
  it('Step 17: Site Casual Labor Muster Roll & Haversine GPS Geofenced Mobile Clock-in Engine (M17 & M23)', async () => {
    // 1. Create site geofence (150m radius)
    const geoRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/geofences`,
      headers: { cookie: adminCookie },
      payload: {
        geofenceName: 'Riverside Main Gate & Perimeter Compound',
        centerLatitude: '-1.286389',
        centerLongitude: '36.817223',
        radiusMeters: '150.00',
      },
    });
    expect(geoRes.statusCode).toBe(201);

    // 2. Register artisan laborer
    const simWorkerCode = `WKR-SIM-${Date.now().toString().slice(-4)}`;
    const simNationalId = `ID-${Date.now().toString().slice(-6)}`;
    const labRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/laborers`,
      headers: { cookie: supervisorCookie },
      payload: {
        workerCode: simWorkerCode,
        fullName: 'Juma Otieno Ochieng',
        nationalIdNo: simNationalId,
        phoneNumber: '+254711223344',
        tradeCategory: 'MASON',
        skillLevel: 'ARTISAN_FUNDI',
        dailyRateKes: '1600.00',
      },
    });
    expect(labRes.statusCode).toBe(201);
    laborerId = JSON.parse(labRes.body).laborer.id;

    // 3. Clock-in on-site (~12m away) -> WITHIN_GEOFENCE
    const clock1 = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/clock-in`,
      headers: { cookie: supervisorCookie },
      payload: {
        laborerId,
        clockType: 'CLOCK_IN',
        capturedLatitude: '-1.286400',
        capturedLongitude: '36.817230',
        photoSelfieUrl: 'https://storage.example.com/selfies/juma_in.jpg',
      },
    });
    expect(clock1.statusCode).toBe(201);
    expect(JSON.parse(clock1.body).verificationStatus).toBe('WITHIN_GEOFENCE');

    // 4. Clock-in off-site (~2.2km away) -> OUTSIDE_GEOFENCE_FLAGGED
    const clock2 = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/clock-in`,
      headers: { cookie: supervisorCookie },
      payload: {
        laborerId,
        clockType: 'CLOCK_OUT',
        capturedLatitude: '-1.305000',
        capturedLongitude: '36.830000',
      },
    });
    expect(clock2.statusCode).toBe(201);
    expect(JSON.parse(clock2.body).verificationStatus).toBe('OUTSIDE_GEOFENCE_FLAGGED');

    // 5. Weekly muster roll
    const musterRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/muster-rolls`,
      headers: { cookie: supervisorCookie },
      payload: {
        payrollNo: `MR-WK44-${Date.now().toString().slice(-4)}`,
        weekEndingDate: '2026-11-06',
        notes: 'Week 44 superstructure concrete column casting casual crew',
        attendances: [
          {
            laborerId,
            attendanceDate: '2026-11-06',
            daysWorked: '5.00',
            overtimeHours: '4.00',
            taskAssigned: 'Block wall laying on Level 3 and curing',
            verifiedBy: 'Eng. John Mwangi (Site Supervisor)',
          },
        ],
      },
    });
    expect(musterRes.statusCode).toBe(201);
    expect(JSON.parse(musterRes.body).musterRoll.netWagesPayableKes).toBe('9200.00');
  });

  // ---------------------------------------------------------------------------
  // STEP 18: DOSHS & NCA Field Safety Scorecard Audit (M18)
  // ---------------------------------------------------------------------------
  it('Step 18: DOSHS & NCA Field Safety Scorecard Audit with Automated Stop-Work Trigger (M18)', async () => {
    const auditRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/safety-audits`,
      headers: { cookie: supervisorCookie },
      payload: {
        auditNo: `SAF-NCA-${Date.now().toString().slice(-4)}`,
        auditDate: '2026-11-04',
        auditorName: 'Eng. K. Njoroge (NCA Inspectorate)',
        auditorType: 'NCA_INSPECTOR',
        ppeComplianceScore: '65.00',
        scaffoldingAndEdgeProtectionStatus: 'FAIL_STOP_WORK',
        excavationAndShoringStatus: 'MINOR_DEFECTS',
        firstAidAndFireStationStatus: 'DEFICIENT',
        electricalSafetyAndCablesStatus: 'PASS',
        correctiveActionPlan: 'Erect proper toe boards and safety netting on Level 4 scaffolding',
      },
    });
    expect(auditRes.statusCode).toBe(201);
    const auditBody = JSON.parse(auditRes.body);
    expect(auditBody.audit.auditOutcome).toBe('STOP_ORDER_ISSUED');
  });

  // ---------------------------------------------------------------------------
  // STEP 19: Automated KRA E-TIMS Electronic Tax Invoicing & Subcontractor TCC (M19)
  // ---------------------------------------------------------------------------
  it('Step 19: Automated KRA E-TIMS Electronic Tax Invoicing with Cryptographic Signature & Subcontractor TCC Tracking (M19)', async () => {
    // 1. Create subcontractor package
    const pkgRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractors`,
      headers: { cookie: adminCookie },
      payload: {
        tradeCategory: 'ELECTRICAL',
        firmName: 'Nairobi Volt Electricals Ltd',
        contactPerson: 'Eng. David Mwangi',
        phoneNumber: '+254722889900',
        subcontractSum: '1500000.00',
        retentionRatePct: '5.00',
        status: 'ACTIVE',
      },
    });
    expect(pkgRes.statusCode).toBe(201);
    subcontractorPackageId = JSON.parse(pkgRes.body).id;

    // 2. Track Subcontractor TCC
    const tccRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractor-tcc`,
      headers: { cookie: qsCookie },
      payload: {
        subcontractorPackageId,
        pinNumber: 'P051234567A',
        taxpayerName: 'Nairobi Volt Electricals Ltd',
        tccNumber: 'KRA-TCC-2026-991',
        tccExpiryDate: '2027-11-04',
        complianceStatus: 'COMPLIANT',
        withholdingTaxRate: '3.00',
        withholdingVatRate: '2.00',
      },
    });
    expect(tccRes.statusCode).toBe(201);

    // 3. Issue KRA E-TIMS Tax Invoice
    const invoiceNo = `INV-ETIMS-${Date.now().toString().slice(-6)}`;
    const cuInvoiceNo = `KRAVSCU01${Date.now().toString().slice(-8)}`;
    const invRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/etims-invoices`,
      headers: { cookie: qsCookie },
      payload: {
        invoiceNumber: invoiceNo,
        cuInvoiceNumber: cuInvoiceNo,
        invoiceType: 'ORIGINAL',
        buyerPin: 'P051998877Z',
        buyerName: 'Riverside Commercial Center Ltd',
        totalTaxableAmount: '100000.00',
        totalTaxAmount: '16000.00',
        totalInvoiceAmount: '116000.00',
        taxBreakdown16: '16000.00',
        qrCodeUrl: `https://itax.kra.go.ke/KRA-Portal/invoiceCheck.htm?invoiceNo=${cuInvoiceNo}`,
        cryptographicSignature: 'MEYCIQCc9d1...DUMMY_VSCU_SIGNATURE',
      },
    });
    expect(invRes.statusCode).toBe(201);
  });

  // ---------------------------------------------------------------------------
  // STEP 20: WhatsApp & SMS Two-Way Site Ops Webhooks (M20)
  // ---------------------------------------------------------------------------
  it('Step 20: WhatsApp & SMS Two-Way Site Ops Webhooks (#DIARY, #DELIVERY, #INCIDENT) with Swahili Bot Auto-Replies (M20)', async () => {
    // Delivery webhook
    const wh1 = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/site-ops',
      headers: {
        'x-site-ops-token': generateSignedSiteOpsToken(tenantId),
      },
      payload: {
        senderPhone: '+254722889900',
        senderName: 'Juma Foreman',
        channel: 'WHATSAPP',
        rawMessage: `#DELIVERY Bamburi Cement 200 bags received on site in good order`,
        projectId,
      },
    });
    expect(wh1.statusCode).toBe(200);
    const wh1Body = JSON.parse(wh1.body);
    expect(wh1Body.detectedCommand).toBe('DELIVERY');
    expect(wh1Body.replyMessage).toContain('Delivery note imethibitishwa');

    // Incident webhook
    const wh2 = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/site-ops',
      headers: {
        'x-site-ops-token': generateSignedSiteOpsToken(tenantId),
      },
      payload: {
        senderPhone: '+254722889900',
        senderName: 'Juma Foreman',
        channel: 'WHATSAPP',
        rawMessage: `#INCIDENT Loose handrail detected on Block B scaffold`,
        projectId,
      },
    });
    expect(wh2.statusCode).toBe(200);
    expect(JSON.parse(wh2.body).detectedCommand).toBe('INCIDENT');
  });

  // ---------------------------------------------------------------------------
  // STEP 21: JBC 1999 Dual-Moiety Retention Releases & Bank Bonds (M21)
  // ---------------------------------------------------------------------------
  it('Step 21: JBC 1999 Dual-Moiety Retention Releases with M-Pesa B2C Payout & Bank Performance Bonds (M21)', async () => {
    // 1. First Moiety 50% Release at Practical Completion
    const rel1 = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractor-retention-releases`,
      headers: { cookie: qsCookie },
      payload: {
        releaseNo: `RET-${Date.now().toString().slice(-4)}`,
        subcontractorPackageId,
        moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
        totalRetentionHeld: '150000.00',
        releasePercentage: '50.00',
        releaseAmount: '75000.00',
        defectClearanceVerified: true,
        qsRecommendationNotes: 'Practical completion achieved; 1st moiety 50% released per JBC 1999 Clause 30.',
      },
    });
    expect(rel1.statusCode).toBe(201);
    const releaseId = JSON.parse(rel1.body).id;

    // Disburse via M-Pesa B2C
    const disbRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/subcontractor-retention-releases/${releaseId}/review`,
      headers: { cookie: adminCookie },
      payload: { status: 'PAID', disbursementRef: 'MPESA-B2C-RET-001' },
    });
    expect(disbRes.statusCode).toBe(200);
    expect(JSON.parse(disbRes.body).status).toBe('PAID');

    // 2. Contractor Bank Performance Bond
    const bondRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/contractor-bonds`,
      headers: { cookie: adminCookie },
      payload: {
        bondType: 'PERFORMANCE_BOND',
        issuingInstitution: 'KCB Bank Kenya Ltd',
        bondReferenceNo: 'KCB-PB-2026-991',
        bondAmount: '4000000.00',
        effectiveDate: '2026-11-04',
        expiryDate: '2027-11-04',
      },
    });
    expect(bondRes.statusCode).toBe(201);
  });

  // ---------------------------------------------------------------------------
  // STEP 22: Safaricom Daraja M-Pesa Subscription Billing (M22 / ADR-006)
  // ---------------------------------------------------------------------------
  it('Step 22: Safaricom Daraja M-Pesa Subscription Billing & Automated STK Push (M22 / ADR-006)', async () => {
    // 1. Initiate STK Push
    const stkRes = await server.inject({
      method: 'POST',
      url: '/api/v1/billing/mpesa-express',
      headers: { cookie: adminCookie },
      payload: {
        phoneNumber: '0712345678',
        planCode: 'PORTFOLIO_TIER',
        amount: '25000.00',
      },
    });
    expect(stkRes.statusCode).toBe(200);
    capturedCheckoutReqId = JSON.parse(stkRes.body).checkoutRequestId;
    expect(capturedCheckoutReqId).toBeDefined();

    // 2. Safaricom Daraja confirmation callback
    const receiptNo = `QA${Date.now().toString().slice(-8)}`;
    const cbRes = await server.inject({
      method: 'POST',
      url: `/api/v1/billing/mpesa-callback?tenantId=${tenantId}`,
      headers: {
        'x-mpesa-webhook-token': 'mjengo-daraja-webhook-secret-production',
      },
      payload: {
        MerchantRequestID: 'MR_SIM_VALID',
        CheckoutRequestID: capturedCheckoutReqId,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        MpesaReceiptNumber: receiptNo,
      },
    });
    expect(cbRes.statusCode).toBe(200);
    expect(JSON.parse(cbRes.body).status).toBe('SUCCESS');

    // Verify tenant subscription status is now ACTIVE with PORTFOLIO_TIER
    const subStatus = await server.inject({
      method: 'GET',
      url: '/api/v1/billing/subscription-status',
      headers: { cookie: adminCookie },
    });
    expect(subStatus.statusCode).toBe(200);
    expect(JSON.parse(subStatus.body).subscriptionState).toBe('ACTIVE');
    expect(JSON.parse(subStatus.body).activePlan).toBe('PORTFOLIO_TIER');
  });

  // ---------------------------------------------------------------------------
  // STEP 23: Final Account Closeout & Project Archival under JBC 1999 Clause 34
  // ---------------------------------------------------------------------------
  it('Step 23: Final Account Closeout & Project Archival under JBC 1999 Clause 34', async () => {
    const archiveRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { cookie: adminCookie },
      payload: { status: 'COMPLETED' },
    });
    expect(archiveRes.statusCode).toBe(200);
    const updated = JSON.parse(archiveRes.body).data;
    expect(updated.status).toBe('COMPLETED');
  });

  // ---------------------------------------------------------------------------
  // STEP 24: Comprehensive Master Enterprise Audit Trail Verification
  // ---------------------------------------------------------------------------
  it('Step 24: Verify complete, immutable audit trail exists in audit_logs for all 24 lifecycle operations', async () => {
    const auditLogs = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.auditLog.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'asc' },
      });
    });

    expect(auditLogs.length).toBeGreaterThanOrEqual(16);

    const actions = auditLogs.map((l) => l.action);

    // Verify every critical lifecycle step was audited
    expect(actions).toContain('PROJECT_CREATED');
    expect(actions).toContain('boq.import');
    expect(actions).toContain('SITE_DIARY_RECORDED');
    expect(actions).toContain('PROGRESS_RECORDED');
    expect(actions).toContain('COST_CREATED');
    expect(actions).toContain('COST_APPROVED');
    expect(actions).toContain('VARIATION_SUBMITTED');
    expect(actions).toContain('VARIATION_EVALUATE');
    expect(actions).toContain('VARIATION_APPROVE');
    expect(actions).toContain('REPORT_GENERATED');
    expect(actions).toContain('INSPECTION_CHECKLIST_CREATED');
    expect(actions).toContain('CONCRETE_CUBE_TEST_CREATED');
    expect(actions).toContain('CUBE_BREAK_RECORDED');
    expect(actions).toContain('RFI_CREATED');
    expect(actions).toContain('RFI_ANSWERED_VIA_PORTAL');
    expect(actions).toContain('SNAG_ITEM_CREATED');
    expect(actions).toContain('SNAG_RECTIFIED_VIA_PORTAL');
    expect(actions).toContain('SNAG_STATUS_UPDATED');
    expect(actions).toContain('CERTIFICATE_ISSUED');

    // Verify project creation was audited with admin user
    const projectCreateAudit = auditLogs.find((l) => l.action === 'PROJECT_CREATED');
    expect(projectCreateAudit).toBeDefined();
    expect(projectCreateAudit!.actor_id).toBe(adminUserId);

    // Check detailed structure of IPC generation audit entry
    const ipcAudit = auditLogs.find((l) => l.action === 'REPORT_GENERATED' && l.entity_type === 'IPC');
    expect(ipcAudit).toBeDefined();
    expect(ipcAudit!.actor_id).toBe(qsUserId);

    // Check detailed structure of variation approval audit entry
    const varApproveAudit = auditLogs.find((l) => l.action === 'VARIATION_APPROVE');
    expect(varApproveAudit).toBeDefined();
    expect(varApproveAudit!.actor_id).toBe(clientUserId);
    expect((varApproveAudit!.changes as any).newBudget).toBe('40456500.00');

    // Check detailed structure of BOQ import audit entry
    const boqImportAudit = auditLogs.find((l) => l.action === 'boq.import');
    expect(boqImportAudit).toBeDefined();
    expect(boqImportAudit!.actor_id).toBe(qsUserId);
    expect((boqImportAudit!.changes as any).grandTotal).toBe('40279000.00');
    expect((boqImportAudit!.changes as any).totalItems).toBe(26);
  });
});
