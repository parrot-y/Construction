import { describe, expect, it, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { parseBOQWorkbook } from './services/boq-parser';

// F3: real-document BoQ intake — messy Kenyan fixtures, dry-run mode,
// downloadable template. Nothing in this file writes a BOQ.

describe('F3: BoQ real-document intake (dry-run, template, messy fixtures)', () => {
  const server = buildServer();
  let adminCookie: string;
  let projectId: string;

  // Messy fixture: bill-by-bill worksheets, merged section headers,
  // rates in a separate column from amounts, trailing totals,
  // prime-cost item, missing unit.
  async function messyKenyanBoQ(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // Sheet 1 — Bill No.1 Preliminaries
    const s1 = wb.addWorksheet('Bill 1 Prelims');
    s1.addRow(['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']);
    s1.addRow(['1.1', 'Site establishment and accommodation', 'ITEM', 1, 450000, 450000]);
    // merged section header across B:F
    s1.mergeCells('B3:F3');
    s1.getCell('B3').value = 'BILL NO. 1 - PRELIMINARIES';
    // prime-cost item (no qty/rate, amount only)
    s1.addRow(['1.2', 'Prime Cost Sum for water meters and connections', 'SUM', '', '', 180000]);
    // missing unit
    s1.addRow(['1.3', 'Temporary fencing around site boundary', '', 120, 60, 7200]);
    // trailing total row (should be skipped as collection)
    s1.addRow(['', 'Total carried to Collection', '', '', '', 637200]);

    // Sheet 2 — Bill No.2 Earthworks (rates separate column)
    const s2 = wb.addWorksheet('Bill 2 Earthworks');
    s2.addRow(['No', 'Description of Work', 'Unit', 'Quantity', 'Unit Rate Ksh', 'Total Ksh']);
    s2.addRow(['2.1', 'Clear site vegetation and topsoil 150mm', 'M2', 2400, 95, 228000]);
    s2.addRow(['2.2', 'Excavate foundation trenches 1.5m deep', 'M3', 850, 780, 663000]);
    s2.addRow(['', 'Collection total', '', '', '', 891000]);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  beforeAll(async () => {
    await server.ready();
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = res.headers['set-cookie'] as string;
    const body = JSON.parse(res.body);
    const project = await withTenantTx(prisma, body.user.tenant.id, (tx) =>
      tx.project.create({
        data: { tenant_id: body.user.tenant.id, code: `F3-${Date.now().toString().slice(-6)}`, name: 'F3 Intake Test Project', status: 'ACTIVE' },
      }),
    );
    projectId = project.id;
  });

  it('parses a multi-sheet messy Kenyan BoQ: bills, merged headers, prime-cost, missing unit, trailing totals', async () => {
    const buffer = await messyKenyanBoQ();
    const preview = await parseBOQWorkbook(buffer, 'messy-kenyan-boq.xlsx');

    // both sheets contribute items
    expect(preview.totalItems).toBeGreaterThanOrEqual(5);
    const allItems = preview.sections.flatMap((s) => s.items);
    const descs = allItems.map((i) => i.description);
    expect(descs.some((d) => d.includes('Site establishment'))).toBe(true);
    expect(descs.some((d) => d.includes('Excavate foundation'))).toBe(true);

    // prime-cost flagged
    const pc = allItems.find((i) => i.description.includes('Prime Cost'));
    expect(pc).toBeTruthy();
    expect(pc!.status === 'WARNING' || pc!.isProvisional || (pc!.rejectionReason || '').length > 0).toBe(true);

    // missing-unit row flagged as WARNING
    const noUnit = allItems.find((i) => i.description.includes('Temporary fencing'));
    expect(noUnit).toBeTruthy();
    expect(noUnit!.status).toBe('WARNING');
    expect(noUnit!.rejectionReason).toContain('Missing unit');

    // trailing totals excluded
    expect(descs.some((d) => d.includes('Total carried') || d.includes('Collection total'))).toBe(false);
  });

  it('merged description cells are flagged row-by-row', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BoQ');
    ws.addRow(['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']);
    // merge description+unit over two rows — messy real-world pattern
    ws.mergeCells('B2:C3');
    ws.getCell('B2').value = 'Composite item spanning two rows';
    ws.getCell('D2').value = 10;
    ws.getCell('E2').value = 100;
    ws.getCell('F2').value = 1000;
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const preview = await parseBOQWorkbook(buffer, 'merged.xlsx');
    const item = preview.sections.flatMap((s) => s.items)[0];
    expect(item).toBeTruthy();
    expect(item!.rejectionReason || '').toContain('merged cell');
  });

  it('GET /api/v1/boq/template returns a valid xlsx workbook', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/boq/template',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.rawPayload as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    expect(ws.getCell('A1').value).toBe('Item No');
    expect(ws.getCell('B2').value).toContain('BILL NO. 1');
  });

  it('POST /boq/preview is a dry run — writes zero BOQ rows', async () => {
    const before = await prisma.bOQ.count();
    const buffer = await messyKenyanBoQ();
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/preview`,
      headers: { cookie: adminCookie },
      payload: { bufferBase64: buffer.toString('base64'), filename: 'messy.xlsx' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.problems ?? body.data.sections).toBeTruthy();
    expect(await prisma.bOQ.count()).toBe(before);
  });

  it('POST /boq/confirm dryRun=true reports problems and writes nothing', async () => {
    const before = await prisma.bOQ.count();
    const buffer = await messyKenyanBoQ();
    const preview = await parseBOQWorkbook(buffer, 'messy.xlsx');
    const sections = preview.sections.map((s) => ({
      title: s.title,
      items: s.items.map((it) => ({
        itemCode: it.itemCode,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitRate: it.unitRate,
        totalAmount: it.totalAmount,
        isProvisional: it.isProvisional,
        status: it.status,
        rejectionReason: it.rejectionReason,
      })),
    }));
    const res = await server.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/boq/confirm`,
      headers: { cookie: adminCookie },
      payload: { sections, dryRun: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.dryRun).toBe(true);
    expect(body.data.saved).toBe(false);
    expect(body.data.problems.length).toBeGreaterThan(0);
    expect(await prisma.bOQ.count()).toBe(before);
  });
});
