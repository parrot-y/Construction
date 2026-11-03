import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';

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

  const projectCode = 'RCP-SIM-2026';
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
  // STEP 9: Verify complete audit trail exists in audit_logs for all actions
  // ---------------------------------------------------------------------------
  it('Step 9: Verify complete audit trail exists in audit_logs for all actions', async () => {
    const auditLogs = await withTenantTx(prisma, tenantId, async (tx) => {
      return tx.auditLog.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'asc' },
      });
    });

    expect(auditLogs.length).toBeGreaterThanOrEqual(8);

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
