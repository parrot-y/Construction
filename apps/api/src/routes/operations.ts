import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';
import {
  CreateScheduleTaskSchema,
  UpdateScheduleTaskSchema,
  CreateInventoryItemSchema,
  RecordInventoryMovementSchema,
  CreateSafetyIncidentSchema,
  CreateProjectDocumentSchema,
  CreateSubcontractorPackageSchema,
} from '@construction/validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const operationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ===========================================================================
  // MODULE 1: PROJECT SCHEDULE & GANTT TASKS
  // ===========================================================================

  // 1.1 List Schedule Tasks
  server.get(
    '/api/v1/projects/:projectId/tasks',
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

          const tasks = await tx.projectScheduleTask.findMany({
            where: { project_id: projectId },
            orderBy: [{ wbs_phase: 'asc' }, { order_index: 'asc' }, { planned_start_date: 'asc' }],
          });

          const totalTasks = tasks.length;
          const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
          const delayedTasks = tasks.filter((t) => t.status === 'DELAYED').length;
          const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
          const overallProgress = totalTasks === 0 ? 0 : Math.round(
            tasks.reduce((sum, t) => sum + Number(t.progress_percentage), 0) / totalTasks
          );

          return {
            tasks,
            summary: {
              totalTasks,
              completedTasks,
              inProgressTasks,
              delayedTasks,
              overallProgress,
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to fetch schedule tasks');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve schedule tasks' });
      }
    },
  );

  // 1.2 Create Schedule Task
  server.post(
    '/api/v1/projects/:projectId/tasks',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateScheduleTaskSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid schedule task payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const task = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const created = await tx.projectScheduleTask.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              wbs_phase: data.wbsPhase.toUpperCase(),
              task_name: data.taskName,
              description: data.description,
              planned_start_date: new Date(data.plannedStartDate),
              planned_end_date: new Date(data.plannedEndDate),
              duration_days: data.durationDays,
              assigned_trade: data.assignedTrade,
              order_index: data.orderIndex,
              status: 'PLANNED',
              progress_percentage: 0.0,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'SCHEDULE_TASK_CREATED',
            entityType: 'ProjectScheduleTask',
            entityId: created.id,
            projectId,
          });

          return created;
        });

        return reply.status(201).send(task);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to create schedule task');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create schedule task' });
      }
    },
  );

  // 1.3 Update Schedule Task (Progress, Status, Dates)
  server.put(
    '/api/v1/projects/:projectId/tasks/:taskId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, taskId } = request.params as { projectId: string; taskId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(taskId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Task or project not found' });
      }

      const parseResult = UpdateScheduleTaskSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid task update payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.projectScheduleTask.findFirst({
            where: { id: taskId, project_id: projectId },
          });
          if (!existing) throw { status: 404, message: 'Schedule task not found' };

          const updateData: any = {};
          if (data.taskName !== undefined) updateData.task_name = data.taskName;
          if (data.description !== undefined) updateData.description = data.description;
          if (data.plannedStartDate) updateData.planned_start_date = new Date(data.plannedStartDate);
          if (data.plannedEndDate) updateData.planned_end_date = new Date(data.plannedEndDate);
          if (data.actualStartDate) updateData.actual_start_date = new Date(data.actualStartDate);
          if (data.actualEndDate) updateData.actual_end_date = new Date(data.actualEndDate);
          if (data.durationDays !== undefined) updateData.duration_days = data.durationDays;
          if (data.progressPercentage !== undefined) updateData.progress_percentage = toDecimal(data.progressPercentage);
          if (data.assignedTrade !== undefined) updateData.assigned_trade = data.assignedTrade;
          if (data.status !== undefined) updateData.status = data.status;
          if (data.orderIndex !== undefined) updateData.order_index = data.orderIndex;

          const res = await tx.projectScheduleTask.update({
            where: { id: taskId },
            data: updateData,
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'SCHEDULE_TASK_UPDATED',
            entityType: 'ProjectScheduleTask',
            entityId: taskId,
            projectId,
          });

          return res;
        });

        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to update schedule task');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update schedule task' });
      }
    },
  );

  // ===========================================================================
  // MODULE 2: SITE STORE INVENTORY & STOCK MOVEMENTS
  // ===========================================================================

  // 2.1 Get Site Inventory Overview
  server.get(
    '/api/v1/projects/:projectId/inventory',
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

          const items = await tx.siteInventoryItem.findMany({
            where: { project_id: projectId },
            include: {
              movements: {
                orderBy: { movement_date: 'desc' },
                take: 5,
              },
            },
            orderBy: { material_name: 'asc' },
          });

          const lowStockCount = items.filter(
            (item) => Number(item.current_stock) <= Number(item.minimum_reorder_level)
          ).length;

          return {
            items,
            summary: {
              totalTrackedItems: items.length,
              lowStockCount,
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to retrieve inventory items');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve inventory' });
      }
    },
  );

  // 2.2 Create Inventory Item
  server.post(
    '/api/v1/projects/:projectId/inventory/items',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateInventoryItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid inventory item payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const item = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const created = await tx.siteInventoryItem.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              material_name: data.materialName,
              category: data.category.toUpperCase(),
              unit: data.unit.toUpperCase(),
              opening_balance: toDecimal(data.openingBalance),
              current_stock: toDecimal(data.openingBalance),
              minimum_reorder_level: toDecimal(data.minimumReorderLevel),
              unit_cost_estimate: data.unitCostEstimate ? toDecimal(data.unitCostEstimate) : null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'INVENTORY_ITEM_CREATED',
            entityType: 'SiteInventoryItem',
            entityId: created.id,
            projectId,
          });

          return created;
        });

        return reply.status(201).send(item);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to create inventory item');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create inventory item' });
      }
    },
  );

  // 2.3 Record Inventory Movement (Delivery in or usage out)
  server.post(
    '/api/v1/projects/:projectId/inventory/movements',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = RecordInventoryMovementSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid inventory movement payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const qtyDecimal = toDecimal(data.quantity);

      try {
        const movement = await withTenantTx(prisma, tenantId, async (tx) => {
          const item = await tx.siteInventoryItem.findFirst({
            where: { id: data.inventoryItemId, project_id: projectId },
          });
          if (!item) throw { status: 404, message: 'Inventory item not found' };

          // Invariant: DELIVERY_IN increases stock; USAGE_OUT / WASTAGE / TRANSFER decreases stock
          let newStock = toDecimal(item.current_stock);
          if (data.movementType === 'DELIVERY_IN') {
            newStock = newStock.plus(qtyDecimal);
          } else {
            newStock = newStock.minus(qtyDecimal);
          }

          // Record Movement
          const created = await tx.inventoryMovement.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              inventory_item_id: item.id,
              movement_type: data.movementType,
              quantity: qtyDecimal,
              movement_date: new Date(data.movementDate),
              reference_no: data.referenceNo,
              notes: data.notes,
              recorded_by_name: data.recordedByName,
            },
          });

          // Update current stock on item
          await tx.siteInventoryItem.update({
            where: { id: item.id },
            data: { current_stock: newStock },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'INVENTORY_MOVEMENT_RECORDED',
            entityType: 'InventoryMovement',
            entityId: created.id,
            projectId,
          });

          return { ...created, updatedCurrentStock: String(newStock) };
        });

        return reply.status(201).send(movement);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to record inventory movement');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record inventory movement' });
      }
    },
  );

  // ===========================================================================
  // MODULE 3: SAFETY, HEALTH & ENVIRONMENTAL (HSE) INCIDENTS (OSHA 2007)
  // ===========================================================================

  // 3.1 List Safety Incidents
  server.get(
    '/api/v1/projects/:projectId/safety-incidents',
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

          const incidents = await tx.safetyIncident.findMany({
            where: { project_id: projectId },
            orderBy: { incident_date: 'desc' },
          });

          const oshaReportableCount = incidents.filter((i) => i.is_osha_reportable).length;

          return {
            incidents,
            summary: {
              totalIncidents: incidents.length,
              oshaReportableCount,
              nearMissCount: incidents.filter((i) => i.incident_type === 'NEAR_MISS').length,
              ppeViolationsCount: incidents.filter((i) => i.incident_type === 'PPE_VIOLATION').length,
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to fetch safety incidents');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve safety incidents' });
      }
    },
  );

  // 3.2 Report Safety Incident
  server.post(
    '/api/v1/projects/:projectId/safety-incidents',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSafetyIncidentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid safety incident payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const incident = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const created = await tx.safetyIncident.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              incident_date: new Date(data.incidentDate),
              incident_time: data.incidentTime,
              incident_type: data.incidentType,
              severity: data.severity,
              exact_location: data.exactLocation,
              affected_person_name: data.affectedPersonName,
              affected_trade: data.affectedTrade,
              description: data.description,
              immediate_action: data.immediateAction,
              preventative_action: data.preventativeAction,
              is_osha_reportable: data.isOshaReportable,
              investigated_by: data.investigatedBy,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'SAFETY_INCIDENT_REPORTED',
            entityType: 'SafetyIncident',
            entityId: created.id,
            projectId,
          });

          return created;
        });

        return reply.status(201).send(incident);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to report safety incident');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to report safety incident' });
      }
    },
  );

  // ===========================================================================
  // MODULE 4: PROJECT DOCUMENTS & DRAWINGS VAULT
  // ===========================================================================

  // 4.1 List Project Documents
  server.get(
    '/api/v1/projects/:projectId/documents',
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

          const documents = await tx.projectDocument.findMany({
            where: { project_id: projectId },
            orderBy: [{ category: 'asc' }, { created_at: 'desc' }],
          });

          return {
            documents,
            summary: {
              totalDocuments: documents.length,
              architecturalCount: documents.filter((d) => d.category === 'ARCHITECTURAL_DRAWING').length,
              structuralCount: documents.filter((d) => d.category === 'STRUCTURAL_DRAWING').length,
              permitsCount: documents.filter((d) => d.category === 'COUNTY_APPROVAL_STAMP' || d.category === 'NEMA_LICENSE').length,
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to fetch project documents');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve project documents' });
      }
    },
  );

  // 4.2 Register / Upload Document Metadata
  server.post(
    '/api/v1/projects/:projectId/documents',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateProjectDocumentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid document payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const document = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const created = await tx.projectDocument.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              title: data.title,
              category: data.category,
              drawing_reference: data.drawingReference,
              revision_code: data.revisionCode,
              storage_key: data.storageKey,
              status: data.status,
              uploaded_by_name: data.uploadedByName,
              notes: data.notes,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'PROJECT_DOCUMENT_REGISTERED',
            entityType: 'ProjectDocument',
            entityId: created.id,
            projectId,
          });

          return created;
        });

        return reply.status(201).send(document);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to register project document');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to register document' });
      }
    },
  );

  // ===========================================================================
  // MODULE 5: SUBCONTRACTOR WORK PACKAGES & DIRECTORY
  // ===========================================================================

  // 5.1 List Subcontractor Packages
  server.get(
    '/api/v1/projects/:projectId/subcontractors',
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

          const packages = await tx.subcontractorPackage.findMany({
            where: { project_id: projectId },
            orderBy: { trade_category: 'asc' },
          });

          const totalCommitment = packages.reduce(
            (sum, p) => sum.plus(toDecimal(p.subcontract_sum)),
            toDecimal(0)
          );

          return {
            packages,
            summary: {
              totalPackages: packages.length,
              activePackagesCount: packages.filter((p) => p.status === 'ACTIVE').length,
              totalCommitmentKes: totalCommitment.toFixed(2),
            },
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to fetch subcontractor packages');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to retrieve subcontractor packages' });
      }
    },
  );

  // 5.2 Award / Create Subcontractor Work Package
  server.post(
    '/api/v1/projects/:projectId/subcontractors',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSubcontractorPackageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid subcontractor package payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const pkg = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const created = await tx.subcontractorPackage.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              trade_category: data.tradeCategory.toUpperCase(),
              firm_name: data.firmName,
              contact_person: data.contactPerson,
              phone_number: data.phoneNumber,
              subcontract_sum: toDecimal(data.subcontractSum),
              retention_rate_pct: toDecimal(data.retentionRatePct),
              status: data.status,
              scope_description: data.scopeDescription,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'SUBCONTRACTOR_PACKAGE_AWARDED',
            entityType: 'SubcontractorPackage',
            entityId: created.id,
            projectId,
          });

          return created;
        });

        return reply.status(201).send(pkg);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err, 'Failed to create subcontractor package');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create subcontractor package' });
      }
    },
  );

  // 3.3 Update Subcontractor Package Status
  server.patch(
    '/api/v1/projects/:projectId/subcontractors/:packageId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, packageId } = request.params as { projectId: string; packageId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(packageId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Package not found' });
      }
      const { status } = (request.body || {}) as { status?: string };
      const allowed = ['AWARDED', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'SUSPENDED'];
      if (!status || !allowed.includes(status)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `status must be one of ${allowed.join(', ')}` });
      }
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const pkg = await tx.subcontractorPackage.findFirst({ where: { id: packageId, project_id: projectId } });
          if (!pkg) throw { status: 404, message: 'Subcontractor package not found' };
          const result = await tx.subcontractorPackage.update({ where: { id: packageId }, data: { status } });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, projectId,
            action: 'SUBCONTRACTOR_PACKAGE_STATUS', entityType: 'SubcontractorPackage', entityId: packageId,
            changes: { from: pkg.status, to: status },
          });
          return result;
        });
        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update package' });
      }
    },
  );

  // 4.3 Drawing markups — pins/annotations on a drawing sheet
  server.get(
    '/api/v1/projects/:projectId/documents/:documentId/annotations',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, documentId } = request.params as { projectId: string; documentId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(documentId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
      }
      const annotations = await withTenantTx(prisma, tenantId, async (tx) =>
        tx.drawingAnnotation.findMany({
          where: { project_id: projectId, document_id: documentId },
          orderBy: { created_at: 'asc' },
        }),
      );
      return reply.status(200).send({ data: annotations });
    },
  );

  server.post(
    '/api/v1/projects/:projectId/documents/:documentId/annotations',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, documentId } = request.params as { projectId: string; documentId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(documentId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
      }
      const body = request.body as { xPct?: number; yPct?: number; note?: string };
      const x = Number(body.xPct); const y = Number(body.yPct);
      const note = String(body.note || '').trim();
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100 || note.length < 2 || note.length > 2000) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'xPct/yPct must be 0-100 and note 2-2000 chars' });
      }
      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const doc = await tx.projectDocument.findFirst({ where: { id: documentId, project_id: projectId } });
          if (!doc) throw { status: 404, message: 'Document not found' };
          const me = await tx.user.findUnique({ where: { id: sub }, select: { full_name: true, email: true } });
          const ann = await tx.drawingAnnotation.create({
            data: {
              tenant_id: tenantId, project_id: projectId, document_id: documentId,
              x_pct: x, y_pct: y, note, author_name: me?.full_name || me?.email || 'Team member',
            },
          });
          await recordAuditLog(tx, {
            tenantId, actorId: sub, projectId,
            action: 'DRAWING_ANNOTATION_ADDED', entityType: 'DrawingAnnotation', entityId: ann.id,
          });
          return ann;
        });
        return reply.status(201).send(created);
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to add annotation' });
      }
    },
  );

  server.patch(
    '/api/v1/projects/:projectId/documents/:documentId/annotations/:annotationId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, annotationId } = request.params as { projectId: string; annotationId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(annotationId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
      }
      const { resolved, note } = (request.body || {}) as { resolved?: boolean; note?: string };
      const updated = await withTenantTx(prisma, tenantId, async (tx) => {
        const ann = await tx.drawingAnnotation.findFirst({ where: { id: annotationId, project_id: projectId } });
        if (!ann) throw { status: 404, message: 'Annotation not found' };
        return tx.drawingAnnotation.update({
          where: { id: annotationId },
          data: {
            ...(typeof resolved === 'boolean' ? { resolved } : {}),
            ...(typeof note === 'string' && note.trim().length >= 2 ? { note: note.trim().slice(0, 2000) } : {}),
          },
        });
      });
      return reply.status(200).send(updated);
    },
  );
};
