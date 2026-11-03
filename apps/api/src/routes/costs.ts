import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  calculateBudgetConsumptionRatio,
  calculateDetailedVariance,
  calculateSectionVariance,
  evaluateProgressVariance,
  toCurrencyString,
  toDecimal,
  Decimal,
} from '@construction/money';
import {
  CreateCostEntrySchema,
  ApproveCostEntrySchema,
  VoidCostEntrySchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

export const costRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ---------------------------------------------------------------------------
  // 1. POST /api/v1/projects/:projectId/costs - Create Cost Entry (PENDING)
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/costs',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.COST_CREATE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      const bodyParse = CreateCostEntrySchema.safeParse({
        ...request.body as Record<string, unknown>,
        projectId,
      });

      if (!bodyParse.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid cost entry data',
          details: bodyParse.error.errors,
        });
      }

      const data = bodyParse.data;
      const amountDec = toDecimal(data.amount);

      if (amountDec.lessThanOrEqualTo(0)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cost amount must be strictly greater than zero KES',
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          // Verify project exists
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // If linked to BOQ item, verify item belongs to this project
          if (data.boqItemId) {
            const boqItem = await tx.bOQItem.findFirst({
              where: {
                id: data.boqItemId,
                section: {
                  boq: {
                    project_id: projectId,
                  },
                },
              },
            });

            if (!boqItem) {
              throw { status: 400, message: 'Linked BOQ item does not exist or does not belong to this project' };
            }
          }

          // Create Cost Entry (Append-only)
          const costEntry = await tx.costEntry.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              boq_item_id: data.boqItemId || null,
              cost_category: data.costCategory,
              amount: amountDec.toFixed(2),
              vendor_name: data.vendorName || null,
              invoice_ref: data.invoiceRef || null,
              description: data.description,
              status: 'PENDING',
              created_by_id: sub,
            },
          });

          // Create attached receipts if provided
          if (data.receipts && data.receipts.length > 0) {
            await tx.costReceipt.createMany({
              data: data.receipts.map((r) => ({
                tenant_id: tenantId,
                cost_entry_id: costEntry.id,
                storage_key: r.storageKey,
                filename: r.filename,
                file_size: r.fileSize,
                mime_type: r.mimeType,
              })),
            });
          }

          // Record immutable audit log
          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'COST_CREATED',
            entityType: 'CostEntry',
            entityId: costEntry.id,
            changes: {
              amount: amountDec.toFixed(2),
              costCategory: data.costCategory,
              status: 'PENDING',
              vendorName: data.vendorName || null,
              receiptCount: data.receipts ? data.receipts.length : 0,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          const created = await tx.costEntry.findUnique({
            where: { id: costEntry.id },
            include: {
              receipts: true,
              boq_item: {
                select: { id: true, item_code: true, description: true },
              },
              created_by: {
                select: { id: true, full_name: true, email: true },
              },
            },
          });

          return created
            ? { ...created, amount: toCurrencyString(created.amount.toString()) }
            : null;
        });

        return reply.status(201).send({
          message: 'Cost entry logged successfully in PENDING status',
          data: result,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to log cost entry');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to log cost entry',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/projects/:projectId/costs - List Cost Entries
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/costs',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.COST_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const query = request.query as {
        status?: string;
        category?: string;
        boqItemId?: string;
      };

      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const whereClause: any = {
          project_id: projectId,
        };

        if (query.status && query.status !== 'ALL') {
          whereClause.status = query.status;
        }

        if (query.category) {
          whereClause.cost_category = query.category;
        }

        if (query.boqItemId) {
          whereClause.boq_item_id = query.boqItemId;
        }

        const entries = await tx.costEntry.findMany({
          where: whereClause,
          include: {
            receipts: true,
            approvals: {
              include: {
                reviewer: {
                  select: { id: true, full_name: true, email: true },
                },
              },
              orderBy: { created_at: 'desc' },
            },
            created_by: {
              select: { id: true, full_name: true, email: true },
            },
            boq_item: {
              select: { id: true, item_code: true, description: true, total_amount: true },
            },
          },
          orderBy: { created_at: 'desc' },
        });

        return entries.map((e) => ({
          ...e,
          amount: toCurrencyString(e.amount.toString()),
        }));
      });

      return reply.status(200).send({
        data: result,
        count: result.length,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/projects/:projectId/costs/:costId - Cost Entry Detail
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/costs/:costId',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.COST_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, costId } = request.params as { projectId: string; costId: string };

      const entry = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.costEntry.findFirst({
          where: {
            id: costId,
            project_id: projectId,
          },
          include: {
            receipts: true,
            approvals: {
              include: {
                reviewer: {
                  select: { id: true, full_name: true, email: true },
                },
              },
              orderBy: { created_at: 'desc' },
            },
            created_by: {
              select: { id: true, full_name: true, email: true },
            },
            boq_item: {
              select: { id: true, item_code: true, description: true, total_amount: true },
            },
          },
        });
      });

      if (!entry) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Cost entry not found',
        });
      }

      return reply.status(200).send({
        data: {
          ...entry,
          amount: toCurrencyString(entry.amount.toString()),
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/projects/:projectId/costs/:costId/approve - Multi-Step Approval
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/costs/:costId/approve',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.COST_APPROVE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, costId } = request.params as { projectId: string; costId: string };

      const bodyParse = ApproveCostEntrySchema.safeParse(request.body);
      if (!bodyParse.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid approval payload',
          details: bodyParse.error.errors,
        });
      }

      const { action, comments } = bodyParse.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const entry = await tx.costEntry.findFirst({
            where: { id: costId, project_id: projectId },
          });

          if (!entry) {
            throw { status: 404, message: 'Cost entry not found' };
          }

          if (entry.status === 'VOIDED') {
            throw { status: 400, message: 'Cannot approve or reject a voided cost entry' };
          }

          // Update cost entry status
          const updated = await tx.costEntry.update({
            where: { id: costId },
            data: { status: action },
          });

          // Create approval record
          const approval = await tx.costApproval.create({
            data: {
              tenant_id: tenantId,
              cost_entry_id: costId,
              reviewer_id: sub,
              action,
              comments: comments || null,
            },
          });

          // Record atomic audit log
          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: action === 'APPROVED' ? 'COST_APPROVED' : 'COST_REJECTED',
            entityType: 'CostEntry',
            entityId: costId,
            changes: {
              previousStatus: entry.status,
              newStatus: action,
              comments: comments || null,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          return {
            updated: {
              ...updated,
              amount: toCurrencyString(updated.amount.toString()),
            },
            approval,
          };
        });

        return reply.status(200).send({
          message: `Cost entry successfully ${action.toLowerCase()}`,
          data: result,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to process cost approval');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to process cost approval',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 5. POST /api/v1/projects/:projectId/costs/:costId/void - Append-Only Voiding
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/costs/:costId/void',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.COST_APPROVE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, costId } = request.params as { projectId: string; costId: string };

      const bodyParse = VoidCostEntrySchema.safeParse(request.body);
      if (!bodyParse.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid void payload. A clear reason is required.',
          details: bodyParse.error.errors,
        });
      }

      const { reason } = bodyParse.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const entry = await tx.costEntry.findFirst({
            where: { id: costId, project_id: projectId },
          });

          if (!entry) {
            throw { status: 404, message: 'Cost entry not found' };
          }

          if (entry.status === 'VOIDED') {
            throw { status: 400, message: 'Cost entry is already voided' };
          }

          // Strict Append-Only Invariant: No DELETE; status updated to VOIDED
          const updated = await tx.costEntry.update({
            where: { id: costId },
            data: { status: 'VOIDED' },
          });

          // Record atomic audit log with void reason
          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'COST_VOIDED',
            entityType: 'CostEntry',
            entityId: costId,
            changes: {
              previousStatus: entry.status,
              newStatus: 'VOIDED',
              voidReason: reason,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          return {
            ...updated,
            amount: toCurrencyString(updated.amount.toString()),
          };
        });

        return reply.status(200).send({
          message: 'Cost entry voided successfully with audit trail preserved',
          data: result,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to void cost entry');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to void cost entry',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 6. POST /api/v1/projects/:projectId/costs/:costId/receipts - Add Receipt
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/costs/:costId/receipts',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.COST_CREATE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, costId } = request.params as { projectId: string; costId: string };
      const body = request.body as {
        filename: string;
        fileSize: number;
        mimeType: string;
        storageKey?: string;
      };

      if (!body.filename || !body.fileSize || !body.mimeType) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'filename, fileSize, and mimeType are required',
        });
      }

      try {
        const receipt = await withTenantTx(prisma, tenantId, async (tx) => {
          const entry = await tx.costEntry.findFirst({
            where: { id: costId, project_id: projectId },
          });

          if (!entry) {
            throw { status: 404, message: 'Cost entry not found' };
          }

          const created = await tx.costReceipt.create({
            data: {
              tenant_id: tenantId,
              cost_entry_id: costId,
              storage_key: body.storageKey || `receipts/${tenantId}/${costId}/${Date.now()}-${body.filename}`,
              filename: body.filename,
              file_size: body.fileSize,
              mime_type: body.mimeType,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'RECEIPT_ATTACHED',
            entityType: 'CostReceipt',
            entityId: created.id,
            changes: {
              filename: body.filename,
              costEntryId: costId,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || null,
          });

          return created;
        });

        return reply.status(201).send({
          message: 'Receipt attached successfully',
          data: receipt,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to attach receipt');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to attach receipt',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 7. GET /api/v1/projects/:projectId/budget/summary - Budget vs Actual Metrics
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/budget/summary',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { progressRatio } = request.query as { progressRatio?: string };

      try {
        const summary = await withTenantTx(prisma, tenantId, async (tx) => {
        const project = await tx.project.findFirst({
          where: { id: projectId },
          include: {
            boqs: {
              where: { status: { in: ['ACTIVE', 'APPROVED'] } },
              orderBy: { version: 'desc' },
              take: 1,
              include: {
                sections: {
                  orderBy: { order_idx: 'asc' },
                  include: {
                    items: {
                      select: {
                        id: true,
                        item_code: true,
                        description: true,
                        total_amount: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!project) {
          throw { status: 404, message: 'Project not found' };
        }

        // Determine approved budget from project or active BOQ
        const activeBoq = project.boqs[0];
        let approvedBudgetDec = project.current_approved_budget
          ? toDecimal(project.current_approved_budget.toString())
          : new Decimal(0);

        if (approvedBudgetDec.isZero() && activeBoq) {
          approvedBudgetDec = toDecimal(activeBoq.total_amount ? activeBoq.total_amount.toString() : '0');
        }

        // Fetch all non-voided cost entries
        const costEntries = await tx.costEntry.findMany({
          where: {
            project_id: projectId,
            status: { not: 'VOIDED' },
          },
        });

        let approvedCostDec = new Decimal(0);
        let pendingCostDec = new Decimal(0);
        let rejectedCostDec = new Decimal(0);

        type CategoryType = 'MATERIAL' | 'LABOR' | 'PLANT' | 'SUBCONTRACT' | 'PRELIMINARY';
        const categories: Record<CategoryType, { approved: Decimal; pending: Decimal }> = {
          MATERIAL: { approved: new Decimal(0), pending: new Decimal(0) },
          LABOR: { approved: new Decimal(0), pending: new Decimal(0) },
          PLANT: { approved: new Decimal(0), pending: new Decimal(0) },
          SUBCONTRACT: { approved: new Decimal(0), pending: new Decimal(0) },
          PRELIMINARY: { approved: new Decimal(0), pending: new Decimal(0) },
        };

        for (const entry of costEntries) {
          const amt = toDecimal(entry.amount.toString());
          const cat = entry.cost_category as CategoryType;

          if (entry.status === 'APPROVED') {
            approvedCostDec = approvedCostDec.plus(amt);
            if (categories[cat]) {
              categories[cat].approved = categories[cat].approved.plus(amt);
            }
          } else if (entry.status === 'PENDING') {
            pendingCostDec = pendingCostDec.plus(amt);
            if (categories[cat]) {
              categories[cat].pending = categories[cat].pending.plus(amt);
            }
          } else if (entry.status === 'REJECTED') {
            rejectedCostDec = rejectedCostDec.plus(amt);
          }
        }

        const remainingBudgetDec = approvedBudgetDec.minus(approvedCostDec);
        const consumptionRatio = calculateBudgetConsumptionRatio(approvedCostDec, approvedBudgetDec);

        // Physical progress evaluation:
        // If progressRatio query param is omitted, automatically query the latest progressRecord for the project:
        const latestProgress = await tx.progressRecord.findFirst({
          where: { project_id: projectId },
          orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
        });

        const physicalProgress = progressRatio
          ? toDecimal(progressRatio)
          : latestProgress
            ? toDecimal(latestProgress.overall_progress.toString())
            : new Decimal(0);

        const varianceAlert = evaluateProgressVariance(consumptionRatio, physicalProgress);
        const detailedVariance = calculateDetailedVariance(consumptionRatio, physicalProgress);

        // Calculate section-by-section breakdown using active BOQ sections and items:
        // For each section: calculate total allocated budget from items, sum of approved cost entries mapped to items in that section, sum of pending cost entries. Call calculateSectionVariance(allocated, approved, pending). Include in response as sectionBreakdown.
        const sectionBreakdown = (activeBoq?.sections || []).map((sec) => {
          let allocatedDec = new Decimal(0);
          const itemIds = new Set<string>();
          for (const item of sec.items) {
            allocatedDec = allocatedDec.plus(toDecimal(item.total_amount ? item.total_amount.toString() : '0'));
            itemIds.add(item.id);
          }
          if (sec.items.length === 0 && sec.total_amount) {
            allocatedDec = toDecimal(sec.total_amount.toString());
          }

          let sectionApproved = new Decimal(0);
          let sectionPending = new Decimal(0);

          for (const entry of costEntries) {
            if (entry.boq_item_id && itemIds.has(entry.boq_item_id)) {
              const amt = toDecimal(entry.amount.toString());
              if (entry.status === 'APPROVED') {
                sectionApproved = sectionApproved.plus(amt);
              } else if (entry.status === 'PENDING') {
                sectionPending = sectionPending.plus(amt);
              }
            }
          }

          const secVariance = calculateSectionVariance(allocatedDec, sectionApproved, sectionPending);

          return {
            sectionId: sec.id,
            sectionTitle: sec.title,
            title: sec.title,
            orderIdx: sec.order_idx,
            allocatedBudget: secVariance.allocatedBudget,
            actualSpent: secVariance.actualSpent,
            pendingSpent: secVariance.pendingSpent,
            remainingBudget: secVariance.remainingBudget,
            consumptionPercentage: secVariance.consumptionPercentage,
            isOverBudget: secVariance.isOverBudget,
            status: secVariance.status,
            itemCount: sec.items.length,
          };
        });

        return {
          projectId,
          projectName: project.name,
          currency: 'KES',
          approvedBudget: toCurrencyString(approvedBudgetDec),
          approvedCost: toCurrencyString(approvedCostDec),
          pendingCost: toCurrencyString(pendingCostDec),
          rejectedCost: toCurrencyString(rejectedCostDec),
          remainingBudget: toCurrencyString(remainingBudgetDec),
          consumptionRatio: consumptionRatio.toFixed(4),
          consumptionPercentage: consumptionRatio.times(100).toFixed(2),
          physicalProgressRatio: physicalProgress.toFixed(4),
          physicalProgressPercentage: physicalProgress.times(100).toFixed(2),
          latestProgressRecordDate: latestProgress ? latestProgress.record_date.toISOString().split('T')[0] : null,
          varianceAlert,
          detailedVariance: {
            costConsumptionRatio: detailedVariance.costConsumptionRatio.toString(),
            physicalProgressRatio: detailedVariance.physicalProgressRatio.toString(),
            costConsumptionPercentage: detailedVariance.costConsumptionPercentage,
            physicalProgressPercentage: detailedVariance.physicalProgressPercentage,
            differenceRatio: detailedVariance.differenceRatio.toString(),
            differencePercentage: detailedVariance.differencePercentage,
            hasWarning: detailedVariance.hasWarning,
            status: detailedVariance.status,
            statusLabel: detailedVariance.statusLabel,
            severity: detailedVariance.severity,
            message: detailedVariance.message,
          },
          sectionBreakdown,
          categoryBreakdown: {
            MATERIAL: {
              approved: toCurrencyString(categories.MATERIAL.approved),
              pending: toCurrencyString(categories.MATERIAL.pending),
            },
            LABOR: {
              approved: toCurrencyString(categories.LABOR.approved),
              pending: toCurrencyString(categories.LABOR.pending),
            },
            PLANT: {
              approved: toCurrencyString(categories.PLANT.approved),
              pending: toCurrencyString(categories.PLANT.pending),
            },
            SUBCONTRACT: {
              approved: toCurrencyString(categories.SUBCONTRACT.approved),
              pending: toCurrencyString(categories.SUBCONTRACT.pending),
            },
            PRELIMINARY: {
              approved: toCurrencyString(categories.PRELIMINARY.approved),
              pending: toCurrencyString(categories.PRELIMINARY.pending),
            },
          },
          totalEntries: costEntries.length,
        };
      });

      return reply.status(200).send({ data: summary });
    } catch (err: any) {
      if (err.status) {
        return reply.status(err.status).send({
          statusCode: err.status,
          error: err.status === 404 ? 'Not Found' : 'Bad Request',
          message: err.message,
        });
      }
      server.log.error(err, 'Failed to fetch budget summary');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to fetch budget summary',
      });
    }
  },
);
};
