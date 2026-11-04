import { describe, expect, it, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

describe('Milestone M4: Staged Excel BOQ Import & Structure Suite', () => {
  const server = buildServer();

  let adminCookie: string;
  let qsCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;

  let tenantAId: string;
  let tenantBId: string;
  let projectAId: string;

  // Helper to generate in-memory Excel BOQ workbook
  async function generateTestWorkbook(options?: {
    includeArithmeticError?: boolean;
    includeNegativeItem?: boolean;
    includeMissingDescription?: boolean;
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bills of Quantities');

    // Headers
    sheet.addRow(['Item No', 'Description', 'Unit', 'Qty', 'Rate (KES)', 'Amount (KES)']);

    // Section 1: Preliminaries
    sheet.addRow(['', 'BILL NO. 1 - PRELIMINARIES & GENERAL CONDITIONS', '', '', '', '']);
    sheet.addRow(['1.1', 'Water for the works and clean drinking water for site staff', 'ITEM', 1, 250000, 250000]);
    sheet.addRow(['1.2', 'Provisional Sum for Electrical Installation & Transformers', 'SUM', 0, 0, 500000]);
    sheet.addRow(['', 'Total Carried to Collection - Preliminaries', '', '', '', 750000]);

    // Section 2: Substructure
    sheet.addRow(['', 'BILL NO. 2 - SUBSTRUCTURE & EXCAVATION', '', '', '', '']);
    sheet.addRow(['2.1', 'Excavate in normal soil not exceeding 2.0m depth', 'CM', 1500.5, 650, 975325]);
    sheet.addRow(['2.2', 'Hardcore bed 300mm thick compacted in layers', 'SM', 800, 1200, 960000]);

    if (options?.includeArithmeticError) {
      // 100 * 500 = 50,000, but amount says 60,000 (10,000 discrepancy)
      sheet.addRow(['2.3', 'Damp proof membrane 500 gauge polythene', 'SM', 100, 500, 60000]);
    }

    if (options?.includeNegativeItem) {
      sheet.addRow(['2.4', 'Invalid negative rate rebar', 'KG', 50, -150, -7500]);
    }

    if (options?.includeMissingDescription) {
      sheet.addRow(['2.5', '', 'NO', 10, 500, 5000]);
    }

    const uint8 = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8);
  }

  beforeAll(async () => {
    await server.ready();

    // 1. Login as Apex Builders Admin
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const adminBody = JSON.parse(adminRes.body);
    tenantAId = adminBody.user.tenant.id;

    // 2. Login as QS
    const qsRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'qs@apexbuilders.co.ke', password: 'Password123!' },
    });
    qsCookie = qsRes.headers['set-cookie'] as string;

    // 3. Login as Supervisor
    const supRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'supervisor@apexbuilders.co.ke', password: 'Password123!' },
    });
    supervisorCookie = supRes.headers['set-cookie'] as string;

    // 4. Login as Client
    const clientRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'client@apexbuilders.co.ke', password: 'Password123!' },
    });
    clientCookie = clientRes.headers['set-cookie'] as string;

    // Create dedicated active Project A for Apex Builders
    const testProjectCode = `M4-BOQ-${Date.now().toString().slice(-6)}`;
    const project = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.create({
        data: {
          tenant_id: tenantAId,
          code: testProjectCode,
          name: `Riverside Commercial Plaza ${testProjectCode}`,
          status: 'ACTIVE',
        },
      });
    });
    projectAId = project.id;

    // Create a Tenant B for multi-tenant cross-isolation checks
    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-b-m4' },
      update: {},
      create: {
        name: 'Kilimanjaro Contractors Ltd',
        slug: 'test-tenant-b-m4',
        currency: 'KES',
      },
    });
    tenantBId = tenantB.id;
  });

  it('Stage 1-4: parses realistic Kenyan BOQ Excel buffer and returns structured preview with EASMM sections', async () => {
    const buffer = await generateTestWorkbook();
    const bufferBase64 = buffer.toString('base64');

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/preview`,
      headers: { cookie: qsCookie },
      payload: {
        bufferBase64,
        filename: 'Riverside-Plaza-BOQ.xlsx',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const preview = body.data;

    expect(preview.sourceFilename).toBe('Riverside-Plaza-BOQ.xlsx');
    expect(preview.totalSections).toBe(2);
    expect(preview.totalItems).toBe(4);
    expect(preview.validItemsCount).toBe(4);
    expect(preview.warningItemsCount).toBe(0);
    expect(preview.rejectedItemsCount).toBe(0);

    // Section 1: Preliminaries
    const sec1 = preview.sections[0];
    expect(sec1.title).toContain('PRELIMINARIES');
    expect(sec1.items.length).toBe(2);
    expect(sec1.items[0].description).toContain('Water for the works');
    expect(sec1.items[0].totalAmount).toBe('250000.00');
    expect(sec1.items[0].status).toBe('VALID');

    // Provisional sum item
    expect(sec1.items[1].description).toContain('Provisional Sum');
    expect(sec1.items[1].isProvisional).toBe(true);
    expect(sec1.items[1].totalAmount).toBe('500000.00');
    expect(sec1.items[1].status).toBe('VALID');
    expect(sec1.subtotal).toBe('750000.00');

    // Section 2: Substructure
    const sec2 = preview.sections[1];
    expect(sec2.title).toContain('SUBSTRUCTURE');
    expect(sec2.items.length).toBe(2);
    expect(sec2.items[0].itemCode).toBe('2.1');
    expect(sec2.items[0].unit).toBe('CM');
    expect(sec2.items[0].totalAmount).toBe('975325.00');
    expect(sec2.items[1].totalAmount).toBe('960000.00');
    expect(sec2.subtotal).toBe('1935325.00');

    // Grand Total: 750,000 + 1,935,325 = 2,685,325.00
    expect(preview.calculatedGrandTotal).toBe('2685325.00');
  });

  it('Stage 3: flags arithmetic discrepancies (> 0.05 KES) as WARNING with descriptive reason', async () => {
    const buffer = await generateTestWorkbook({ includeArithmeticError: true });
    const bufferBase64 = buffer.toString('base64');

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/preview`,
      headers: { cookie: qsCookie },
      payload: { bufferBase64, filename: 'Discrepancy-BOQ.xlsx' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const preview = body.data;

    expect(preview.warningItemsCount).toBe(1);
    const sec2 = preview.sections[1];
    const warningItem = sec2.items.find((i: any) => i.itemCode === '2.3');
    expect(warningItem).toBeDefined();
    expect(warningItem.status).toBe('WARNING');
    expect(warningItem.rejectionReason).toContain('Arithmetic discrepancy');
    expect(warningItem.rejectionReason).toContain('50000.00');
    expect(warningItem.rejectionReason).toContain('60000.00');
  });

  it('Stage 3: rejects invalid rows (negative rates or missing descriptions) with REJECTED status', async () => {
    const buffer = await generateTestWorkbook({
      includeNegativeItem: true,
      includeMissingDescription: true,
    });
    const bufferBase64 = buffer.toString('base64');

    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/preview`,
      headers: { cookie: adminCookie },
      payload: { bufferBase64, filename: 'Invalid-BOQ.xlsx' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const preview = body.data;

    expect(preview.rejectedItemsCount).toBe(2);
    const sec2 = preview.sections[1];
    const negativeItem = sec2.items.find((i: any) => i.itemCode === '2.4');
    expect(negativeItem.status).toBe('REJECTED');
    expect(negativeItem.rejectionReason).toContain('Negative quantities or unit rates are forbidden');

    const missingDescItem = sec2.items.find((i: any) => i.itemCode === '2.5');
    expect(missingDescItem.status).toBe('REJECTED');
    expect(missingDescItem.rejectionReason).toContain('description is required');
  });

  it('Stage 5-6: confirms preview and atomically commits BOQ, updating project budget baseline', async () => {
    // 1. Generate preview
    const buffer = await generateTestWorkbook();
    const previewRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/preview`,
      headers: { cookie: qsCookie },
      payload: {
        bufferBase64: buffer.toString('base64'),
        filename: 'Apex-Riverside-Baseline.xlsx',
      },
    });
    const preview = JSON.parse(previewRes.body).data;

    // 2. Confirm import
    const confirmRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/confirm`,
      headers: { cookie: qsCookie },
      payload: {
        sourceFilename: preview.sourceFilename,
        sections: preview.sections,
        excludeRejected: true,
      },
    });

    expect(confirmRes.statusCode).toBe(201);
    const boq = JSON.parse(confirmRes.body).data;

    expect(boq.version).toBe(1);
    expect(boq.status).toBe('ACTIVE');
    expect(Number(boq.total_amount)).toBe(2685325);
    expect(boq.sections.length).toBe(2);
    expect(boq.sections[0].items.length).toBe(2);
    expect(boq.sections[1].items.length).toBe(2);

    // 3. Verify Project.current_approved_budget was updated to match BOQ Total
    const updatedProject = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.project.findUnique({ where: { id: projectAId } });
    });
    expect(Number(updatedProject!.current_approved_budget)).toBe(2685325.0);

    // 4. Verify Audit Log was recorded in the same transaction
    const audit = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.auditLog.findFirst({
        where: { project_id: projectAId, action: 'boq.import' },
        orderBy: { created_at: 'desc' },
      });
    });
    expect(audit).toBeDefined();
    expect(audit!.entity_type).toBe('BOQ');
    expect(audit!.entity_id).toBe(boq.id);
  });

  it('increments version and marks previous BOQ as SUPERSEDED on re-import', async () => {
    const buffer = await generateTestWorkbook();
    const previewRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/preview`,
      headers: { cookie: adminCookie },
      payload: {
        bufferBase64: buffer.toString('base64'),
        filename: 'Apex-Riverside-Revision-2.xlsx',
      },
    });
    const preview = JSON.parse(previewRes.body).data;

    const confirmRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/confirm`,
      headers: { cookie: adminCookie },
      payload: {
        sourceFilename: preview.sourceFilename,
        sections: preview.sections,
      },
    });

    expect(confirmRes.statusCode).toBe(201);
    const boqV2 = JSON.parse(confirmRes.body).data;
    expect(boqV2.version).toBe(2);
    expect(boqV2.status).toBe('ACTIVE');

    // Assert version 1 is now SUPERSEDED
    const boqV1 = await withTenantTx(prisma, tenantAId, async (tx) => {
      return tx.bOQ.findFirst({
        where: { project_id: projectAId, version: 1 },
      });
    });
    expect(boqV1!.status).toBe('SUPERSEDED');
  });

  it('fetches active BOQ hierarchy and allows searchable item lookups', async () => {
    // 1. Fetch active BOQ
    const boqRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/boq`,
      headers: { cookie: clientCookie },
    });
    expect(boqRes.statusCode).toBe(200);
    const activeBOQ = JSON.parse(boqRes.body).data;
    expect(activeBOQ.status).toBe('ACTIVE');
    expect(activeBOQ.sections.length).toBe(2);

    // 2. Search items
    const searchRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}/boq/items?q=excavate`,
      headers: { cookie: supervisorCookie },
    });
    expect(searchRes.statusCode).toBe(200);
    const items = JSON.parse(searchRes.body).data;
    expect(items.length).toBe(1);
    expect(items[0].description).toContain('Excavate in normal soil');
    expect(items[0].unit).toBe('CM');
  });

  it('enforces RBAC permissions: denies BOQ import to Site Supervisor and Client', async () => {
    const buffer = await generateTestWorkbook();
    const bufferBase64 = buffer.toString('base64');

    // Supervisor attempt
    const supRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/preview`,
      headers: { cookie: supervisorCookie },
      payload: { bufferBase64, filename: 'forbidden.xlsx' },
    });
    expect(supRes.statusCode).toBe(403);

    // Client attempt
    const clientRes = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectAId}/boq/confirm`,
      headers: { cookie: clientCookie },
      payload: { sections: [] },
    });
    expect(clientRes.statusCode).toBe(403);
  });

  it('enforces PostgreSQL RLS multi-tenant isolation: Tenant B cannot access Tenant A BOQ', async () => {
    // Attempting to access Project A using Tenant B context fails closed (404 Not Found)
    const crossRes = await withTenantTx(prisma, tenantBId, async (tx) => {
      return tx.bOQ.findMany({
        where: { project_id: projectAId },
      });
    });

    expect(crossRes.length).toBe(0);
  });
});