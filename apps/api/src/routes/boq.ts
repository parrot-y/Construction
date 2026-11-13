import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toCurrencyString, Decimal } from '@construction/money';
import { requirePermission } from '../plugins/rbac';
import { parseBOQWorkbook, ParsedBOQSection } from '../services/boq-parser';
import ExcelJS from 'exceljs';
import { PRODUCT_NAME } from '../lib/product';
import { listParams, listPage } from '../lib/pagination';

export const boqRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/boq/template - downloadable BOQ workbook template (F3).
  // Pre-formatted headers + one example row per problem class so importers
  // see the expected shape before uploading a real document.
  server.get(
    '/api/v1/boq/template',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.BOQ_IMPORT),
      ],
    },
    async (_request, reply) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Bills of Quantities');
      sheet.addRow(['Item No', 'Description', 'Unit', 'Qty', 'Rate (KES)', 'Amount (KES)']);
      sheet.addRow(['', 'BILL NO. 1 - PRELIMINARIES & GENERAL CONDITIONS', '', '', '', '']);
      sheet.addRow(['1.1', 'Example measured item — excavate in normal soil', 'M3', 100, 850, 85000]);
      sheet.addRow(['1.2', 'Example provisional sum item', 'SUM', '', '', 250000]);
      sheet.addRow(['', 'BILL NO. 2 - SUPERSTRUCTURE', '', '', '', '']);
      sheet.addRow(['2.1', 'Example prime-cost item (flagged for review)', 'ITEM', 1, 0, 0]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', 'attachment; filename="sitesafi-boq-template.xlsx"');
      return reply.send(buffer);
    },
  );

  // POST /api/v1/projects/:projectId/boq/preview - Staged Excel BOQ Parser & Validator
  server.post(
    '/api/v1/projects/:projectId/boq/preview',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.BOQ_IMPORT),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      // Verify project exists in active tenant
      const project = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.project.findFirst({
          where: { id: projectId, tenant_id: tenantId },
        });
      });

      if (!project) {
        return reply.status(404).send({ error: 'Project not found in current company workspace' });
      }

      let buffer: Buffer;
      let filename = 'boq-upload.xlsx';

      // Check if request is multipart/form-data
      if (request.isMultipart()) {
        const file = await request.file();
        if (!file) {
          return reply.status(400).send({ error: 'No Excel file uploaded in form data' });
        }
        filename = file.filename;
        buffer = await file.toBuffer();
      } else {
        // Support JSON base64 payload for testing & direct integrations
        const body = request.body as { bufferBase64?: string; filename?: string };
        if (!body || !body.bufferBase64) {
          return reply.status(400).send({ error: 'Invalid request: file multipart or bufferBase64 required' });
        }
        filename = body.filename || filename;
        buffer = Buffer.from(body.bufferBase64, 'base64');
      }

      try {
        const preview = await parseBOQWorkbook(buffer, filename);
        return reply.status(200).send({ data: preview });
      } catch (err) {
        return reply.status(400).send({
          error: `Failed to parse Excel BOQ workbook: ${(err as Error).message}`,
        });
      }
    },
  );

  // POST /api/v1/projects/:projectId/boq/confirm - Atomic Commit of Validated BOQ
  server.post(
    '/api/v1/projects/:projectId/boq/confirm',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.BOQ_IMPORT),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        sourceFilename?: string;
        sections: ParsedBOQSection[];
        excludeRejected?: boolean;
        dryRun?: boolean;
      };

      if (!body || !Array.isArray(body.sections) || body.sections.length === 0) {
        return reply.status(400).send({ error: 'No sections provided in BOQ confirmation payload' });
      }

      const excludeRejected = body.excludeRejected !== false;

      // F3 dry-run: report what WOULD be imported (row-by-row problems,
      // totals, version) without writing a single row.
      if ((body as { dryRun?: boolean }).dryRun === true) {
        const problems: Array<{ section: string; itemCode: string; description: string; problem: string }> = [];
        let dryItems = 0;
        let dryRejected = 0;
        let dryTotal = new Decimal(0);
        for (const sec of body.sections) {
          for (const item of sec.items) {
            dryItems++;
            if (excludeRejected && item.status === 'REJECTED') {
              dryRejected++;
              problems.push({ section: sec.title, itemCode: item.itemCode, description: item.description, problem: item.rejectionReason || 'REJECTED row excluded' });
              continue;
            }
            if (item.status === 'WARNING' || item.status === 'REJECTED') {
              problems.push({ section: sec.title, itemCode: item.itemCode, description: item.description, problem: item.rejectionReason || item.status });
            }
            if (item.isProvisional) {
              problems.push({ section: sec.title, itemCode: item.itemCode, description: item.description, problem: 'Provisional sum — confirm PC settlement before certification' });
            }
            if (!item.unit || item.unit === 'ITEM') {
              problems.push({ section: sec.title, itemCode: item.itemCode, description: item.description, problem: 'Missing or generic unit of measure' });
            }
            dryTotal = dryTotal.plus(item.totalAmount || '0');
          }
        }
        return reply.status(200).send({
          data: {
            dryRun: true,
            saved: false,
            sections: body.sections.length,
            items: dryItems,
            excludedRows: dryRejected,
            calculatedGrandTotal: toCurrencyString(dryTotal),
            problems,
          },
        });
      }

      const createdBOQ = await withTenantTx(prisma, tenantId, async (tx) => {
        // Verify project
        const project = await tx.project.findFirst({
          where: { id: projectId, tenant_id: tenantId },
        });

        if (!project) {
          throw new Error('Project not found in current company workspace');
        }

        // Deactivate previous active BOQ
        const activeBOQ = await tx.bOQ.findFirst({
          where: { project_id: projectId, tenant_id: tenantId, status: 'ACTIVE' },
          orderBy: { version: 'desc' },
        });

        const nextVersion = activeBOQ ? activeBOQ.version + 1 : 1;

        if (activeBOQ) {
          await tx.bOQ.update({
            where: { id: activeBOQ.id },
            data: { status: 'SUPERSEDED' },
          });
        }

        // Calculate Grand Total across all valid sections and items
        let grandTotalDec = new Decimal(0);
        let totalItemsCount = 0;

        const preparedSections = body.sections.map((sec, secIdx) => {
          let sectionSubtotal = new Decimal(0);
          const validItems = sec.items.filter((item) => {
            if (excludeRejected && item.status === 'REJECTED') {
              return false;
            }
            return true;
          });

          for (const item of validItems) {
            sectionSubtotal = sectionSubtotal.plus(item.totalAmount);
            totalItemsCount++;
          }

          grandTotalDec = grandTotalDec.plus(sectionSubtotal);

          return {
            title: sec.title,
            order_idx: secIdx + 1,
            total_amount: toCurrencyString(sectionSubtotal),
            items: validItems,
          };
        });

        const grandTotalStr = toCurrencyString(grandTotalDec);

        // Create BOQ header
        const boq = await tx.bOQ.create({
          data: {
            tenant_id: tenantId,
            project_id: projectId,
            version: nextVersion,
            status: 'ACTIVE',
            source_filename: body.sourceFilename || 'boq-import.xlsx',
            total_amount: grandTotalStr,
          },
        });

        // Insert Sections and Items
        for (const sec of preparedSections) {
          const sectionRecord = await tx.bOQSection.create({
            data: {
              tenant_id: tenantId,
              boq_id: boq.id,
              order_idx: sec.order_idx,
              title: sec.title,
              total_amount: sec.total_amount,
            },
          });

          for (const item of sec.items) {
            await tx.bOQItem.create({
              data: {
                tenant_id: tenantId,
                section_id: sectionRecord.id,
                item_code: item.itemCode,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unit_rate: item.unitRate,
                total_amount: item.totalAmount,
                is_provisional: item.isProvisional,
              },
            });
          }
        }

        // Core Loop Invariant: Update Project Current Approved Budget
        await tx.project.update({
          where: { id: projectId },
          data: {
            current_approved_budget: grandTotalStr,
            original_contract_sum:
              Number(project.original_contract_sum) === 0
                ? grandTotalStr
                : project.original_contract_sum,
          },
        });

        // Append-only Audit Log
        await tx.auditLog.create({
          data: {
            tenant_id: tenantId,
            actor_id: sub,
            project_id: projectId,
            action: 'boq.import',
            entity_type: 'BOQ',
            entity_id: boq.id,
            changes: {
              version: nextVersion,
              grandTotal: grandTotalStr,
              totalSections: preparedSections.length,
              totalItems: totalItemsCount,
              sourceFilename: boq.source_filename,
            },
          },
        });

        return tx.bOQ.findUnique({
          where: { id: boq.id },
          include: {
            sections: {
              include: { items: true },
              orderBy: { order_idx: 'asc' },
            },
          },
        });
      });

      return reply.status(201).send({ data: createdBOQ });
    },
  );

  // GET /api/v1/projects/:projectId/boq - Active BOQ with full hierarchy
  server.get(
    '/api/v1/projects/:projectId/boq',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.BOQ_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      const boq = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.bOQ.findFirst({
          where: {
            project_id: projectId,
            tenant_id: tenantId,
            status: 'ACTIVE',
          },
          include: {
            sections: {
              include: { items: true },
              orderBy: { order_idx: 'asc' },
            },
          },
        });
      });

      if (!boq) {
        return reply.status(404).send({ error: 'No active BOQ found for this project' });
      }

      return reply.status(200).send({ data: boq });
    },
  );

  // GET /api/v1/projects/:projectId/boq/export - Excel export of active BOQ
  server.get(
    '/api/v1/projects/:projectId/boq/export',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.BOQ_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      const boq = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.bOQ.findFirst({
          where: { project_id: projectId, tenant_id: tenantId, status: 'ACTIVE' },
          include: {
            sections: {
              include: { items: { orderBy: { created_at: 'asc' } } },
              orderBy: { order_idx: 'asc' },
            },
            project: { select: { name: true, code: true } },
          },
        });
      });

      if (!boq) {
        return reply.status(404).send({ error: 'No active BOQ found for this project' });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = PRODUCT_NAME;
      const sheet = workbook.addWorksheet('BOQ');

      sheet.columns = [
        { header: 'Item Code', key: 'code', width: 14 },
        { header: 'Description', key: 'desc', width: 60 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Quantity', key: 'qty', width: 12 },
        { header: 'Unit Rate (KES)', key: 'rate', width: 16 },
        { header: 'Amount (KES)', key: 'amount', width: 18 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      for (const section of boq.sections) {
        const sectionRow = sheet.addRow([section.title, '', '', '', '', '']);
        sectionRow.font = { bold: true };
        sectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        for (const item of section.items) {
          sheet.addRow([
            item.item_code,
            item.description,
            item.unit,
            Number(item.quantity),
            Number(item.unit_rate),
            Number(item.total_amount),
          ]);
        }
        const subRow = sheet.addRow(['', 'Section subtotal', '', '', '', Number(section.total_amount)]);
        subRow.font = { bold: true, italic: true };
      }

      const totalRow = sheet.addRow(['', 'GRAND TOTAL', '', '', '', Number(boq.total_amount)]);
      totalRow.font = { bold: true, size: 12 };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

      for (let r = 2; r <= sheet.rowCount; r++) {
        for (let c = 4; c <= 6; c++) {
          const cell = sheet.getRow(r).getCell(c);
          if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `BOQ-${boq.project?.code || projectId}-v${boq.version}.xlsx`;
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(Buffer.from(buffer));
    },
  );

  // GET /api/v1/projects/:projectId/boq/items - Searchable list of BOQ items
  server.get(
    '/api/v1/projects/:projectId/boq/items',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.BOQ_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { q, sectionId } = request.query as { q?: string; sectionId?: string };
      const pg = listParams(request);

      const items = await withTenantTx(prisma, tenantId, async (tx) => {
        const activeBOQ = await tx.bOQ.findFirst({
          where: { project_id: projectId, tenant_id: tenantId, status: 'ACTIVE' },
        });

        if (!activeBOQ) return [];

        return tx.bOQItem.findMany({
          where: {
            tenant_id: tenantId,
            section: {
              boq_id: activeBOQ.id,
              ...(sectionId ? { id: sectionId } : {}),
            },
            ...(q
              ? {
                  OR: [
                    { description: { contains: q, mode: 'insensitive' } },
                    { item_code: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: { section: { select: { title: true, order_idx: true } } },
          orderBy: { created_at: 'asc' },
          skip: pg.skip,
          take: pg.limit + 1,
        });
      });

      const paged = listPage(items, pg);
      return reply.status(200).send({ data: paged.data, page: paged.page });
    },
  );
};