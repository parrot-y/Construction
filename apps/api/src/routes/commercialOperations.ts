import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { toDecimal, Decimal } from '@construction/money';
import { getTaxSettings, whtRateFor } from '../lib/tax';
import { notifyTeam } from '../lib/notify';
import {
  CreateMaterialRequisitionSchema,
  ReviewMaterialRequisitionSchema,
  CreateMaterialWastageReconciliationSchema,
  CreateCashFlowForecastSchema,
  CreateSubcontractorValuationSchema,
  ReviewSubcontractorValuationSchema,
} from '@construction/validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const commercialOperationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ===========================================================================
  // MODULE 1: MATERIAL PURCHASE REQUISITIONS (BUILD-SASA BENCHMARK)
  // ===========================================================================

  // 1.1 List Material Requisitions
  server.get(
    '/api/v1/projects/:projectId/material-requisitions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const requisitions = await tx.materialRequisition.findMany({
            where: { project_id: projectId },
            include: { inventory_item: true },
            orderBy: { created_at: 'desc' },
          });

          const totalCount = requisitions.length;
          const pendingCount = requisitions.filter((r) => r.status === 'PENDING_APPROVAL').length;
          const approvedCount = requisitions.filter((r) => r.status === 'APPROVED' || r.status === 'PO_ISSUED').length;
          const totalEstimatedKes = requisitions.reduce(
            (sum, r) => sum.plus(toDecimal(r.estimated_total_cost_kes.toString())),
            toDecimal('0.00')
          );

          return {
            projectId,
            summary: {
              totalCount,
              pendingCount,
              approvedCount,
              totalEstimatedKes: totalEstimatedKes.toFixed(2),
            },
            requisitions: requisitions.map((r) => ({
              id: r.id,
              requisitionNo: r.requisition_no,
              inventoryItemId: r.inventory_item_id,
              materialName: r.inventory_item?.material_name || r.item_description,
              itemDescription: r.item_description,
              unitOfMeasure: r.unit_of_measure,
              requestedQuantity: r.requested_quantity.toString(),
              estimatedUnitCostKes: r.estimated_unit_cost_kes.toString(),
              estimatedTotalCostKes: r.estimated_total_cost_kes.toString(),
              urgency: r.urgency,
              requiredByDate: r.required_by_date ? r.required_by_date.toISOString().split('T')[0] : null,
              supplierName: r.supplier_name,
              status: r.status,
              rejectionReason: r.rejection_reason,
              requestedBy: r.requested_by,
              approvedBy: r.approved_by,
              approvedAt: r.approved_at?.toISOString() || null,
              createdAt: r.created_at.toISOString(),
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list requisitions' });
      }
    }
  );

  // 1.2 Create Material Requisition
  server.post(
    '/api/v1/projects/:projectId/material-requisitions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateMaterialRequisitionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid material requisition payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const qty = toDecimal(data.requestedQuantity);
      const unitCost = toDecimal(data.estimatedUnitCostKes);
      const totalCost = qty.times(unitCost);

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const createdReq = await tx.materialRequisition.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              requisition_no: data.requisitionNo,
              inventory_item_id: data.inventoryItemId || null,
              item_description: data.itemDescription,
              unit_of_measure: data.unitOfMeasure,
              requested_quantity: qty.toFixed(2),
              estimated_unit_cost_kes: unitCost.toFixed(2),
              estimated_total_cost_kes: totalCost.toFixed(2),
              urgency: data.urgency,
              required_by_date: data.requiredByDate ? new Date(data.requiredByDate) : null,
              supplier_name: data.supplierName || null,
              status: 'PENDING_APPROVAL',
              requested_by: data.requestedBy,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'MATERIAL_REQUISITION',
            entityId: createdReq.id,
            projectId,
            changes: { requisitionNo: createdReq.requisition_no, totalCostKes: totalCost.toFixed(2) },
          });

          return createdReq;
        });

        return reply.status(201).send({
          message: 'Material purchase requisition created successfully',
          requisition: {
            id: created.id,
            requisitionNo: created.requisition_no,
            requestedQuantity: created.requested_quantity.toString(),
            estimatedTotalCostKes: created.estimated_total_cost_kes.toString(),
            status: created.status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create requisition' });
      }
    }
  );

  // 1.3 Review Requisition (Approve, Issue PO, Reject)
  server.patch(
    '/api/v1/projects/:projectId/material-requisitions/:requisitionId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, requisitionId } = request.params as { projectId: string; requisitionId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(requisitionId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = ReviewMaterialRequisitionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid review payload',
          details: parseResult.error.flatten(),
        });
      }

      const { status, approvedBy, rejectionReason } = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const req = await tx.materialRequisition.findFirst({
            where: { id: requisitionId, project_id: projectId },
          });
          if (!req) throw { status: 404, message: 'Requisition not found' };

          const updatedReq = await tx.materialRequisition.update({
            where: { id: requisitionId },
            data: {
              status,
              approved_by: approvedBy || (status === 'APPROVED' ? sub : req.approved_by),
              approved_at: status === 'APPROVED' || status === 'PO_ISSUED' ? new Date() : req.approved_at,
              rejection_reason: rejectionReason || null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'REVIEW',
            entityType: 'MATERIAL_REQUISITION',
            entityId: updatedReq.id,
            projectId,
            changes: { status, approvedBy: updatedReq.approved_by },
          });

          return updatedReq;
        });

        return reply.send({
          message: `Material requisition status updated to ${status}`,
          requisition: {
            id: updated.id,
            status: updated.status,
            approvedBy: updated.approved_by,
            approvedAt: updated.approved_at?.toISOString() || null,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to review requisition' });
      }
    }
  );

  // ===========================================================================
  // MODULE 2: MATERIAL WASTAGE VARIANCE ENGINE (BS 8110 / EUROCODE 2 / EASMM)
  // ===========================================================================

  // 2.1 List Material Wastage Reconciliations
  server.get(
    '/api/v1/projects/:projectId/material-wastage',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const records = await tx.materialWastageReconciliation.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          const totalFinancialLoss = records.reduce(
            (sum, r) => sum.plus(toDecimal(r.financial_loss_kes.toString())),
            toDecimal('0.00')
          );
          const criticalLossesCount = records.filter((r) => r.status === 'CRITICAL_UNEXPLAINED_LOSS').length;
          const elevatedCount = records.filter((r) => r.status === 'ELEVATED_LOSS').length;
          const withinToleranceCount = records.filter((r) => r.status === 'WITHIN_TOLERANCE').length;

          return {
            projectId,
            summary: {
              totalReconciliations: records.length,
              totalFinancialLossKes: totalFinancialLoss.toFixed(2),
              criticalLossesCount,
              elevatedCount,
              withinToleranceCount,
            },
            reconciliations: records.map((r) => ({
              id: r.id,
              periodName: r.period_name,
              materialName: r.material_name,
              unitOfMeasure: r.unit_of_measure,
              theoreticalQuantity: r.theoretical_quantity.toString(),
              actualConsumedQuantity: r.actual_consumed_quantity.toString(),
              allowableWastagePct: r.allowable_wastage_pct.toString(),
              actualWastagePct: r.actual_wastage_pct.toString(),
              varianceQuantity: r.variance_quantity.toString(),
              unitCostKes: r.unit_cost_kes.toString(),
              financialLossKes: r.financial_loss_kes.toString(),
              status: r.status,
              investigationNotes: r.investigation_notes,
              createdBy: r.created_by,
              createdAt: r.created_at.toISOString(),
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list wastage records' });
      }
    }
  );

  // 2.2 Record Material Wastage Reconciliation
  server.post(
    '/api/v1/projects/:projectId/material-wastage',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateMaterialWastageReconciliationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid wastage reconciliation payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const theoretical = toDecimal(data.theoreticalQuantity);
      const actual = toDecimal(data.actualConsumedQuantity);
      const allowablePct = toDecimal(data.allowableWastagePct || '5.00');
      const unitCost = toDecimal(data.unitCostKes);

      // Variance quantity = actual - theoretical
      const varianceQty = actual.minus(theoretical);

      // Actual wastage % = (variance / theoretical) * 100
      let actualWastagePct = toDecimal('0.00');
      if (theoretical.gt(0)) {
        actualWastagePct = varianceQty.times(100).dividedBy(theoretical);
      }

      // Maximum allowable threshold = theoretical * (1 + allowablePct / 100)
      const allowedThresholdQty = theoretical.times(toDecimal(1).plus(allowablePct.dividedBy(100)));
      
      // Excess quantity beyond allowed wastage
      const excessQty = actual.gt(allowedThresholdQty) ? actual.minus(allowedThresholdQty) : toDecimal('0.00');
      const financialLossKes = excessQty.times(unitCost);

      // Status classification
      let status: 'WITHIN_TOLERANCE' | 'ELEVATED_LOSS' | 'CRITICAL_UNEXPLAINED_LOSS' = 'WITHIN_TOLERANCE';
      if (actualWastagePct.gt(allowablePct.plus(5))) {
        // More than 5% above allowable (e.g. >10% total)
        status = 'CRITICAL_UNEXPLAINED_LOSS';
      } else if (actualWastagePct.gt(allowablePct)) {
        status = 'ELEVATED_LOSS';
      }

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const createdRec = await tx.materialWastageReconciliation.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              period_name: data.periodName,
              inventory_item_id: data.inventoryItemId || null,
              material_name: data.materialName,
              unit_of_measure: data.unitOfMeasure,
              theoretical_quantity: theoretical.toFixed(2),
              actual_consumed_quantity: actual.toFixed(2),
              allowable_wastage_pct: allowablePct.toFixed(2),
              actual_wastage_pct: actualWastagePct.toFixed(2),
              variance_quantity: varianceQty.toFixed(2),
              unit_cost_kes: unitCost.toFixed(2),
              financial_loss_kes: financialLossKes.toFixed(2),
              status,
              investigation_notes: data.investigationNotes || null,
              created_by: data.createdBy,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'MATERIAL_WASTAGE',
            entityId: createdRec.id,
            projectId,
            changes: {
              material: createdRec.material_name,
              varianceQty: varianceQty.toFixed(2),
              financialLossKes: financialLossKes.toFixed(2),
              status,
            },
          });

          return createdRec;
        });

        return reply.status(201).send({
          message: 'Material wastage reconciliation computed and logged',
          reconciliation: {
            id: created.id,
            materialName: created.material_name,
            varianceQuantity: created.variance_quantity.toString(),
            actualWastagePct: created.actual_wastage_pct.toString(),
            financialLossKes: created.financial_loss_kes.toString(),
            status: created.status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record wastage' });
      }
    }
  );

  // ===========================================================================
  // MODULE 3: CONTRACTOR CASH FLOW FORECASTING & VALUATION S-CURVE
  // ===========================================================================

  // 3.1 Get Project Cash Flow & S-Curve Coordinates
  server.get(
    '/api/v1/projects/:projectId/cash-flow',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const records = await tx.projectCashFlowForecast.findMany({
            where: { project_id: projectId },
            orderBy: { period_month: 'asc' },
          });

          // Aggregate portfolio metrics
          let totalPv = toDecimal('0.00');
          let totalAc = toDecimal('0.00');
          let totalEv = toDecimal('0.00');
          let totalBilled = toDecimal('0.00');
          let totalNetCashFlow = toDecimal('0.00');

          for (const r of records) {
            totalPv = totalPv.plus(toDecimal(r.planned_value_kes.toString()));
            totalAc = totalAc.plus(toDecimal(r.actual_cost_kes.toString()));
            totalEv = totalEv.plus(toDecimal(r.earned_value_kes.toString()));
            totalBilled = totalBilled.plus(toDecimal(r.client_billed_kes.toString()));
            totalNetCashFlow = totalNetCashFlow.plus(toDecimal(r.net_cash_flow_kes.toString()));
          }

          const portfolioCpi = totalAc.gt(0) ? totalEv.dividedBy(totalAc) : toDecimal(1);
          const portfolioSpi = totalPv.gt(0) ? totalEv.dividedBy(totalPv) : toDecimal(1);

          // Estimate at Completion (EAC = BAC / CPI)
          const bac = toDecimal(project.current_approved_budget.toString());
          const eac = portfolioCpi.gt(0) ? bac.dividedBy(portfolioCpi) : bac;

          return {
            projectId,
            projectName: project.name,
            budgetAtCompletionKes: bac.toFixed(2),
            metrics: {
              cumulativePlannedValueKes: totalPv.toFixed(2),
              cumulativeActualCostKes: totalAc.toFixed(2),
              cumulativeEarnedValueKes: totalEv.toFixed(2),
              cumulativeClientBilledKes: totalBilled.toFixed(2),
              cumulativeNetCashFlowKes: totalNetCashFlow.toFixed(2),
              cpi: portfolioCpi.toFixed(4),
              spi: portfolioSpi.toFixed(4),
              estimateAtCompletionKes: eac.toFixed(2),
              varianceAtCompletionKes: bac.minus(eac).toFixed(2),
            },
            sCurveSeries: records.map((r) => ({
              periodMonth: r.period_month,
              plannedValueKes: r.planned_value_kes.toString(),
              actualCostKes: r.actual_cost_kes.toString(),
              earnedValueKes: r.earned_value_kes.toString(),
              cpi: r.cpi.toString(),
              spi: r.spi.toString(),
              clientBilledKes: r.client_billed_kes.toString(),
              netCashFlowKes: r.net_cash_flow_kes.toString(),
              status: r.status,
              notes: r.notes,
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve cash flow' });
      }
    }
  );

  // 3.2 Record Monthly Cash Flow / EVM Data Point
  server.post(
    '/api/v1/projects/:projectId/cash-flow',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateCashFlowForecastSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid cash flow payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const pv = toDecimal(data.plannedValueKes);
      const ac = toDecimal(data.actualCostKes);
      const ev = toDecimal(data.earnedValueKes);
      const billed = toDecimal(data.clientBilledKes || '0.00');

      const cpi = ac.gt(0) ? ev.dividedBy(ac) : toDecimal(1);
      const spi = pv.gt(0) ? ev.dividedBy(pv) : toDecimal(1);
      const netCashFlow = billed.minus(ac);

      let status: 'AHEAD_UNDER_BUDGET' | 'ON_TRACK' | 'COST_OVERRUN' | 'SCHEDULE_DELAY' | 'CRITICAL_DIVERGENCE' = 'ON_TRACK';
      if (cpi.gte(1.05) && spi.gte(1.05)) {
        status = 'AHEAD_UNDER_BUDGET';
      } else if (cpi.lt(0.9) && spi.lt(0.9)) {
        status = 'CRITICAL_DIVERGENCE';
      } else if (cpi.lt(0.95)) {
        status = 'COST_OVERRUN';
      } else if (spi.lt(0.95)) {
        status = 'SCHEDULE_DELAY';
      }

      try {
        const record = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const bac = toDecimal(project.current_approved_budget.toString());
          const eac = cpi.gt(0) ? bac.dividedBy(cpi) : bac;

          const upserted = await tx.projectCashFlowForecast.upsert({
            where: {
              tenant_id_project_id_period_month: {
                tenant_id: tenantId,
                project_id: projectId,
                period_month: data.periodMonth,
              },
            },
            create: {
              tenant_id: tenantId,
              project_id: projectId,
              period_month: data.periodMonth,
              planned_value_kes: pv.toFixed(2),
              actual_cost_kes: ac.toFixed(2),
              earned_value_kes: ev.toFixed(2),
              cpi: cpi.toFixed(4),
              spi: spi.toFixed(4),
              forecasted_final_cost_kes: eac.toFixed(2),
              client_billed_kes: billed.toFixed(2),
              net_cash_flow_kes: netCashFlow.toFixed(2),
              status,
              notes: data.notes || null,
            },
            update: {
              planned_value_kes: pv.toFixed(2),
              actual_cost_kes: ac.toFixed(2),
              earned_value_kes: ev.toFixed(2),
              cpi: cpi.toFixed(4),
              spi: spi.toFixed(4),
              forecasted_final_cost_kes: eac.toFixed(2),
              client_billed_kes: billed.toFixed(2),
              net_cash_flow_kes: netCashFlow.toFixed(2),
              status,
              notes: data.notes || null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'UPSERT',
            entityType: 'CASH_FLOW_FORECAST',
            entityId: upserted.id,
            projectId,
            changes: { periodMonth: data.periodMonth, cpi: cpi.toFixed(4), spi: spi.toFixed(4), status },
          });

          return upserted;
        });

        return reply.status(201).send({
          message: 'Cash flow forecast and S-Curve point recorded',
          forecast: {
            id: record.id,
            periodMonth: record.period_month,
            cpi: record.cpi.toString(),
            spi: record.spi.toString(),
            netCashFlowKes: record.net_cash_flow_kes.toString(),
            status: record.status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record cash flow' });
      }
    }
  );

  // ===========================================================================
  // MODULE 4: SUBCONTRACTOR VALUATION & BACK-TO-BACK RETENTION (JBC 1999)
  // ===========================================================================

  // 4.1 List Subcontractor Valuations
  server.get(
    '/api/v1/projects/:projectId/subcontractor-valuations',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const valuations = await tx.subcontractorValuation.findMany({
            where: { project_id: projectId },
            include: { subcontractor_package: true },
            orderBy: { valuation_date: 'desc' },
          });

          let totalGross = toDecimal('0.00');
          let totalRetention = toDecimal('0.00');
          let totalWht = toDecimal('0.00');
          let totalNetPayable = toDecimal('0.00');

          for (const v of valuations) {
            totalGross = totalGross.plus(toDecimal(v.gross_work_certified_kes.toString()));
            totalRetention = totalRetention.plus(toDecimal(v.retention_deducted_kes.toString()));
            totalWht = totalWht.plus(toDecimal(v.withholding_tax_deducted_kes.toString()));
            totalNetPayable = totalNetPayable.plus(toDecimal(v.net_payable_kes.toString()));
          }

          return {
            projectId,
            summary: {
              totalValuations: valuations.length,
              totalGrossCertifiedKes: totalGross.toFixed(2),
              totalRetentionHeldKes: totalRetention.toFixed(2),
              totalWhtDeductedKes: totalWht.toFixed(2),
              totalNetPayableKes: totalNetPayable.toFixed(2),
            },
            valuations: valuations.map((v) => ({
              id: v.id,
              certificateNo: v.certificate_no,
              subcontractorPackageId: v.subcontractor_package_id,
              subcontractorFirm: v.subcontractor_package.firm_name,
              tradeCategory: v.subcontractor_package.trade_category,
              valuationDate: v.valuation_date.toISOString().split('T')[0],
              grossWorkCertifiedKes: v.gross_work_certified_kes.toString(),
              retentionRatePct: v.retention_rate_pct.toString(),
              retentionDeductedKes: v.retention_deducted_kes.toString(),
              previousPaymentsDeductedKes: v.previous_payments_deducted_kes.toString(),
              withholdingTaxPct: v.withholding_tax_pct.toString(),
              withholdingTaxDeductedKes: v.withholding_tax_deducted_kes.toString(),
              netPayableKes: v.net_payable_kes.toString(),
              paymentStatus: v.payment_status === 'QS_VERIFIED' ? 'UNDER_REVIEW' : v.payment_status,
              paymentReference: v.payment_reference,
              paidAt: v.paid_at?.toISOString() || null,
              preparedById: v.prepared_by_id,
              submittedAt: v.submitted_at?.toISOString() || null,
              approvedById: v.approved_by_id,
              approvedAt: v.approved_at?.toISOString() || null,
              rejectedById: v.rejected_by_id,
              rejectedAt: v.rejected_at?.toISOString() || null,
              rejectionReason: v.rejection_reason,
              costEntryId: v.cost_entry_id,
              approvedBy: v.approved_by,
              notes: v.notes,
              createdAt: v.created_at.toISOString(),
            })),
            packages: (() => {
              const byPkg = new Map<string, { certified: Decimal; paid: Decimal; outstanding: Decimal; contractValue: Decimal }>();
              for (const v of valuations) {
                const key = v.subcontractor_package_id;
                const agg = byPkg.get(key) ?? {
                  certified: new Decimal(0),
                  paid: new Decimal(0),
                  outstanding: new Decimal(0),
                  contractValue: toDecimal(v.subcontractor_package.subcontract_sum.toString()),
                };
                const status = v.payment_status === 'QS_VERIFIED' ? 'UNDER_REVIEW' : v.payment_status;
                if (status === 'APPROVED_FOR_PAYMENT' || status === 'PAID') {
                  agg.certified = agg.certified.plus(toDecimal(v.gross_work_certified_kes.toString()));
                }
                if (status === 'PAID') {
                  agg.paid = agg.paid.plus(toDecimal(v.net_payable_kes.toString()));
                }
                if (status === 'APPROVED_FOR_PAYMENT') {
                  agg.outstanding = agg.outstanding.plus(toDecimal(v.net_payable_kes.toString()));
                }
                byPkg.set(key, agg);
              }
              return [...byPkg.entries()].map(([packageId, a]) => ({
                subcontractorPackageId: packageId,
                contractValueKes: a.contractValue.toFixed(2),
                certifiedToDateKes: a.certified.toFixed(2),
                paidToDateKes: a.paid.toFixed(2),
                outstandingToPayKes: a.outstanding.toFixed(2),
                contractRemainingKes: a.contractValue.minus(a.certified).toFixed(2),
              }));
            })(),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list subcontractor valuations' });
      }
    }
  );

  // 4.2 Create Subcontractor Valuation
  server.post(
    '/api/v1/projects/:projectId/subcontractor-valuations',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSubcontractorValuationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid subcontractor valuation payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const gross = toDecimal(data.grossWorkCertifiedKes);
      const retentionPct = toDecimal(data.retentionRatePct || '10.00');
      const prevPayments = toDecimal(data.previousPaymentsDeductedKes || '0.00');

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const subPkg = await tx.subcontractorPackage.findFirst({
            where: { id: data.subcontractorPackageId, project_id: projectId },
          });
          if (!subPkg) throw { status: 404, message: 'Subcontractor package not found' };

          // WHT rate: explicit override wins, otherwise tenant tax settings.
          const taxSettings = await getTaxSettings(tx, tenantId);
          const whtPct = data.withholdingTaxPct != null
            ? toDecimal(data.withholdingTaxPct)
            : whtRateFor(taxSettings, 'SUBCONTRACTOR');

          // Kenyan JBC Subcontract Formulation:
          // Retention is computed on gross work certified
          const retentionDeducted = gross.times(retentionPct.dividedBy(100));

          // Work done in current valuation period subject to WHT = gross - prevPayments
          const currentPeriodGross = gross.minus(prevPayments);
          const whtDeducted = currentPeriodGross.gt(0)
            ? currentPeriodGross.times(whtPct.dividedBy(100))
            : toDecimal('0.00');

          // Net payable = gross - retention - previous payments - WHT
          const netPayable = gross.minus(retentionDeducted).minus(prevPayments).minus(whtDeducted);

          const createdVal = await tx.subcontractorValuation.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              subcontractor_package_id: data.subcontractorPackageId,
              certificate_no: data.certificateNo,
              valuation_date: new Date(data.valuationDate),
              gross_work_certified_kes: gross.toFixed(2),
              retention_rate_pct: retentionPct.toFixed(2),
              retention_deducted_kes: retentionDeducted.toFixed(2),
              previous_payments_deducted_kes: prevPayments.toFixed(2),
              withholding_tax_pct: whtPct.toFixed(2),
              withholding_tax_deducted_kes: whtDeducted.toFixed(2),
              net_payable_kes: netPayable.toFixed(2),
              payment_status: 'SUBMITTED',
              prepared_by_id: sub,
              submitted_at: new Date(),
              notes: data.notes || null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'SUBCONTRACTOR_VALUATION',
            entityId: createdVal.id,
            projectId,
            changes: {
              certificateNo: createdVal.certificate_no,
              grossKes: gross.toFixed(2),
              retentionKes: retentionDeducted.toFixed(2),
              whtKes: whtDeducted.toFixed(2),
              netPayableKes: netPayable.toFixed(2),
            },
          });

          const preparerName = (request.user as any).full_name || (request.user as any).email || 'Site Safi';
          await notifyTeam(tx, {
            tenantId,
            projectId,
            senderId: sub,
            senderName: preparerName,
            body: `Subcontractor valuation ${createdVal.certificate_no} submitted — gross ${gross.toFixed(2)} KES, net payable ${netPayable.toFixed(2)} KES. Awaiting review.`,
          });

          return createdVal;
        });

        return reply.status(201).send({
          message: 'Subcontractor valuation certificate created successfully',
          valuation: {
            id: created.id,
            certificateNo: created.certificate_no,
            grossWorkCertifiedKes: created.gross_work_certified_kes.toString(),
            retentionDeductedKes: created.retention_deducted_kes.toString(),
            withholdingTaxDeductedKes: created.withholding_tax_deducted_kes.toString(),
            netPayableKes: created.net_payable_kes.toString(),
            paymentStatus: created.payment_status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create subcontractor valuation' });
      }
    }
  );

  // 4.3 Review & Pay Subcontractor Valuation
  server.patch(
    '/api/v1/projects/:projectId/subcontractor-valuations/:valuationId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, valuationId } = request.params as { projectId: string; valuationId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(valuationId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = ReviewSubcontractorValuationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid review payload',
          details: parseResult.error.flatten(),
        });
      }

      const { paymentStatus, approvedBy, paymentReference, paidAt, notes } = parseResult.data;

      // State machine: SUBMITTED -> UNDER_REVIEW -> APPROVED_FOR_PAYMENT -> PAID
      // with REJECTED reachable from SUBMITTED/UNDER_REVIEW. Legacy QS_VERIFIED
      // normalizes to UNDER_REVIEW.
      const TRANSITIONS: Record<string, string[]> = {
        SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
        UNDER_REVIEW: ['APPROVED_FOR_PAYMENT', 'REJECTED', 'SUBMITTED'],
        QS_VERIFIED: ['APPROVED_FOR_PAYMENT', 'REJECTED', 'SUBMITTED'],
        APPROVED_FOR_PAYMENT: ['PAID'],
        PAID: [],
        REJECTED: [],
      };

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const val = await tx.subcontractorValuation.findFirst({
            where: { id: valuationId, project_id: projectId },
          });
          if (!val) throw { status: 404, message: 'Subcontractor valuation not found' };

          const current = val.payment_status === 'QS_VERIFIED' ? 'UNDER_REVIEW' : val.payment_status;
          const target = paymentStatus === 'QS_VERIFIED' ? 'UNDER_REVIEW' : paymentStatus;
          const allowed = TRANSITIONS[current] ?? [];
          if (!allowed.includes(target)) {
            throw {
              status: 409,
              message: `Illegal valuation transition: ${current} -> ${target}`,
            };
          }

          // Segregation of duties: approver must differ from whoever prepared
          // or reviewed (moved to UNDER_REVIEW) the valuation.
          if (target === 'APPROVED_FOR_PAYMENT') {
            const conflict =
              (val.prepared_by_id && val.prepared_by_id === sub) ||
              (val.reviewed_by_id && val.reviewed_by_id === sub);
            if (conflict) {
              throw {
                status: 409,
                message: 'The person who prepared or reviewed this valuation cannot approve it — a different approver is required',
              };
            }
          }

          const now = new Date();
          const updateData: any = {
            payment_status: target,
            payment_reference: paymentReference || val.payment_reference,
            notes: notes || val.notes,
          };
          if (target === 'UNDER_REVIEW') {
            updateData.submitted_at = val.submitted_at ?? now;
            updateData.reviewed_by_id = sub;
            updateData.reviewed_at = now;
          }
          if (target === 'APPROVED_FOR_PAYMENT') {
            updateData.approved_by_id = sub;
            updateData.approved_at = now;
            updateData.approved_by = approvedBy || sub;
          }
          if (target === 'REJECTED') {
            updateData.rejected_by_id = sub;
            updateData.rejected_at = now;
            updateData.rejection_reason = notes ?? null;
          }
          if (target === 'PAID') {
            updateData.paid_at = paidAt ? new Date(paidAt) : now;
          }

          // Atomic claim on current status — prevents double transitions.
          const claim = await tx.subcontractorValuation.updateMany({
            where: { id: valuationId, payment_status: val.payment_status },
            data: updateData,
          });
          if (claim.count !== 1) {
            throw { status: 409, message: 'Valuation was modified concurrently — please retry' };
          }

          // Post to cost ledger on approval — commitment-linked, once only.
          if (target === 'APPROVED_FOR_PAYMENT' && !val.cost_entry_id) {
            const pkg = await tx.subcontractorPackage.findUnique({ where: { id: val.subcontractor_package_id } });
            let commitment = await tx.commitment.findFirst({
              where: { project_id: projectId, subcontractor_package_id: val.subcontractor_package_id, status: 'ACTIVE' },
            });
            if (!commitment && pkg) {
              const latest = await tx.commitment.findFirst({
                where: { project_id: projectId },
                orderBy: { commitment_no: 'desc' },
                select: { commitment_no: true },
              });
              commitment = await tx.commitment.create({
                data: {
                  tenant_id: tenantId,
                  project_id: projectId,
                  commitment_no: (latest?.commitment_no ?? 0) + 1,
                  vendor_name: pkg.firm_name,
                  vendor_type: 'SUBCONTRACTOR',
                  contract_value: pkg.subcontract_sum.toString(),
                  retention_pct: pkg.retention_rate_pct.toString(),
                  status: 'ACTIVE',
                  subcontractor_package_id: pkg.id,
                },
              });
            }
            if (commitment) {
              const netPayable = toDecimal(val.net_payable_kes.toString());
              const costEntry = await tx.costEntry.create({
                data: {
                  tenant_id: tenantId,
                  project_id: projectId,
                  commitment_id: commitment.id,
                  cost_category: 'SUBCONTRACT',
                  amount: netPayable.toFixed(2),
                  vendor_name: pkg?.firm_name ?? null,
                  description: `Subcontractor valuation ${val.certificate_no} — ${pkg?.firm_name ?? 'subcontractor'} (net payable)`,
                  status: 'APPROVED',
                  created_by_id: sub,
                },
              });
              await tx.subcontractorValuation.update({
                where: { id: valuationId },
                data: { cost_entry_id: costEntry.id },
              });
            }
          }

          const updatedVal = await tx.subcontractorValuation.findUniqueOrThrow({ where: { id: valuationId } });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: `SUBCONTRACTOR_VALUATION_${target}`,
            entityType: 'SUBCONTRACTOR_VALUATION',
            entityId: updatedVal.id,
            projectId,
            changes: {
              previousStatus: current,
              newStatus: target,
              approvedById: updatedVal.approved_by_id,
              approvedAt: updatedVal.approved_at?.toISOString() ?? null,
              paymentReference: updatedVal.payment_reference,
              costEntryId: updatedVal.cost_entry_id,
            },
          });

          return updatedVal;
        });

        return reply.send({
          message: `Subcontractor valuation status updated to ${paymentStatus}`,
          valuation: {
            id: updated.id,
            paymentStatus: updated.payment_status,
            paymentReference: updated.payment_reference,
            paidAt: updated.paid_at?.toISOString() || null,
            approvedById: updated.approved_by_id,
            approvedAt: updated.approved_at?.toISOString() || null,
            costEntryId: updated.cost_entry_id,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        if (err.status === 409) {
          return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update subcontractor valuation' });
      }
    }
  );
};
