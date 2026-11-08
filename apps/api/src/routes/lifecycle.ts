import React from 'react';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Decimal, toDecimal } from '@construction/money';
import {
  CreateRfiSchema,
  RespondRfiSchema,
  CreateInspectionChecklistSchema,
  UpdateInspectionItemSchema,
  CreateConcreteCubeTestSchema,
  RecordCubeBreakSchema,
  CreateSnagItemSchema,
  UpdateSnagStatusSchema,
  CreateSnagCommentSchema,
  CreateSnagDistributionSchema,
  CreateDefectsCertificateSchema,
  ConsultantReviewSchema,
} from '@construction/validation';
import { Permissions } from '@construction/permissions';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const lifecycleRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 2.4 POST /api/v1/projects/:projectId/inspections/:id/consultant-review
  // Gate-5 G5-4: consultant approval chain — reviewer approves (restores the
  // computed approval status) or rejects (returns checklist to IN_PROGRESS).
  server.post(
    '/api/v1/projects/:projectId/inspections/:id/consultant-review',
    { preHandler: [server.authenticate, requirePermission(Permissions.INSPECTION_REVIEW)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Inspection not found' });
      }
      const parsed = ConsultantReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid review', details: parsed.error.errors });
      }
      const { decision, notes } = parsed.data;
      const reviewerName = (request.user as any).full_name || (request.user as any).email || 'Reviewer';

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const checklist = await tx.inspectionChecklist.findFirst({
            where: { id, project_id: projectId },
            include: { items: true },
          });
          if (!checklist) throw { status: 404, message: 'Inspection not found' };
          if (!checklist.requires_consultant_review) {
            throw { status: 400, message: 'This inspection does not require consultant review' };
          }
          if (checklist.status !== 'PENDING_CONSULTANT_REVIEW') {
            throw { status: 400, message: `Checklist is ${checklist.status}, not awaiting consultant review` };
          }

          const allItems = checklist.items;
          const hasConditions = allItems.some((i) => !i.is_mandatory && i.result !== 'PASS');
          const approvedStatus = hasConditions ? 'APPROVED_WITH_CONDITIONS' : 'APPROVED_WITHOUT_COMMENTS';

          const updated = await tx.inspectionChecklist.update({
            where: { id },
            data: {
              consultant_review_status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
              consultant_reviewed_by_id: sub,
              consultant_reviewed_by_name: reviewerName,
              consultant_reviewed_at: new Date(),
              consultant_review_notes: notes ?? null,
              ...(decision === 'APPROVE'
                ? { status: approvedStatus, inspected_at: new Date(), signed_off_by_id: sub }
                : { status: 'IN_PROGRESS' }),
            },
            include: { items: { orderBy: { order_idx: 'asc' } } },
          });

          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'INSPECTION_CONSULTANT_REVIEW', entityType: 'InspectionChecklist', entityId: id,
            changes: { decision, notes: notes ?? null, resultingStatus: updated.status },
          });
          return updated;
        });
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
      }
    },
  );

  // ===========================================================================
  // DOMAIN 1: RFIs & TECHNICAL QUERIES
  // ===========================================================================

  // 1.1 GET /api/v1/projects/:projectId/rfis - List project RFIs
  server.get(
    '/api/v1/projects/:projectId/rfis',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const rfis = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          return tx.rFI.findMany({
            where: { project_id: projectId },
            include: {
              created_by: {
                select: { id: true, full_name: true, email: true },
              },
              responses: {
                include: {
                  responder: {
                    select: { id: true, full_name: true, email: true },
                  },
                },
                orderBy: { created_at: 'asc' },
              },
              attachments: true,
            },
            orderBy: { rfi_number: 'asc' },
          });
        });

        return reply.status(200).send(rfis);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 1.2 POST /api/v1/projects/:projectId/rfis - Create RFI
  server.post(
    '/api/v1/projects/:projectId/rfis',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const parseResult = CreateRfiSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid RFI payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const rfi = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const lastRfi = await tx.rFI.findFirst({
            where: { project_id: projectId },
            orderBy: { rfi_number: 'desc' },
            select: { rfi_number: true },
          });
          const nextRfiNumber = (lastRfi?.rfi_number ?? 0) + 1;

          const created = await tx.rFI.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              rfi_number: nextRfiNumber,
              issue_type: data.issueType ?? 'RFI',
              title: data.title,
              question: data.question,
              suggested_solution: data.suggestedSolution,
              drawing_reference: data.drawingReference,
              specification_clause: data.specificationClause,
              priority: data.priority,
              status: 'SUBMITTED',
              cost_impact: data.costImpact,
              schedule_impact_days: data.scheduleImpactDays,
              assigned_to_role: data.assignedToRole,
              created_by_id: sub,
              due_date: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null,
              attachments: data.attachments?.length
                ? {
                    create: data.attachments.map((a) => ({
                      tenant_id: tenantId,
                      storage_key: a.storageKey,
                      filename: a.filename,
                      file_size: a.fileSize,
                      mime_type: a.mimeType,
                    })),
                  }
                : undefined,
            },
            include: {
              created_by: {
                select: { id: true, full_name: true, email: true },
              },
              responses: true,
              attachments: true,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'RFI_CREATED',
            entityType: 'RFI',
            entityId: created.id,
            changes: {
              rfiNumber: created.rfi_number,
              title: created.title,
              priority: created.priority,
            },
          });

          return created;
        });

        return reply.status(201).send(rfi);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 1.3 POST /api/v1/projects/:projectId/rfis/:rfiId/responses - Respond to RFI
  server.post(
    '/api/v1/projects/:projectId/rfis/:rfiId/responses',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, rfiId } = request.params as { projectId: string; rfiId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(rfiId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or RFI not found',
        });
      }

      const parseResult = RespondRfiSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid RFI response payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const rfi = await tx.rFI.findFirst({
            where: { id: rfiId, project_id: projectId },
          });
          if (!rfi) {
            throw { status: 404, message: 'RFI not found' };
          }

          const response = await tx.rFIResponse.create({
            data: {
              tenant_id: tenantId,
              rfi_id: rfiId,
              responder_id: sub,
              official_answer: data.officialAnswer,
              is_accepted: data.isAccepted,
            },
            include: {
              responder: {
                select: { id: true, full_name: true, email: true },
              },
            },
          });

          const newStatus = data.isAccepted ? 'ANSWERED' : 'REJECTED';
          const updatedRfi = await tx.rFI.update({
            where: { id: rfiId },
            data: {
              status: newStatus,
              closed_at: data.isAccepted ? new Date() : null,
            },
            include: {
              created_by: {
                select: { id: true, full_name: true, email: true },
              },
              responses: {
                include: {
                  responder: {
                    select: { id: true, full_name: true, email: true },
                  },
                },
                orderBy: { created_at: 'asc' },
              },
              attachments: true,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'RFI_RESPONDED',
            entityType: 'RFIResponse',
            entityId: response.id,
            changes: {
              rfiId,
              isAccepted: data.isAccepted,
              newStatus,
            },
          });

          return { response, rfi: updatedRfi };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // ===========================================================================
  // DOMAIN 2: QUALITY ASSURANCE & INSPECTION CHECKLISTS
  // ===========================================================================

  // 1.4 POST /api/v1/projects/:projectId/rfis/:rfiId/close — manual close
  server.post(
    '/api/v1/projects/:projectId/rfis/:rfiId/close',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, rfiId } = request.params as { projectId: string; rfiId: string };
      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(rfiId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'RFI not found' });
      }
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const rfi = await tx.rFI.findFirst({ where: { id: rfiId, project_id: projectId } });
          if (!rfi) throw { status: 404, message: 'RFI not found' };
          if (rfi.status === 'CLOSED' || rfi.status === 'DRAFT') {
            throw { status: 400, message: `Cannot close RFI in ${rfi.status} status` };
          }
          const u = await tx.rFI.update({ where: { id: rfiId }, data: { status: 'CLOSED', closed_at: new Date() } });
          await recordAuditLog(tx, {
            tenantId, projectId, actorId: sub,
            action: 'RFI_CLOSED', entityType: 'RFI', entityId: rfiId,
            changes: { from: rfi.status, to: 'CLOSED' },
          });
          return u;
        });
        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
      }
    },
  );

  // 2.1 GET /api/v1/projects/:projectId/inspections - List Inspections
  server.get(
    '/api/v1/projects/:projectId/inspections',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const inspections = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          return tx.inspectionChecklist.findMany({
            where: { project_id: projectId },
            include: {
              items: {
                orderBy: { order_idx: 'asc' },
              },
            },
            orderBy: { scheduled_date: 'desc' },
          });
        });

        return reply.status(200).send(inspections);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 2.2 POST /api/v1/projects/:projectId/inspections - Create Inspection Checklist
  server.post(
    '/api/v1/projects/:projectId/inspections',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const parseResult = CreateInspectionChecklistSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid inspection checklist payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const checklist = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const created = await tx.inspectionChecklist.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              checklist_type: data.checklistType,
              inspection_type: data.inspectionType ?? null,
              assigned_consultant: data.assignedConsultant ?? null,
              title: data.title,
              location: data.location,
              status: 'PENDING',
              scheduled_date: new Date(`${data.scheduledDate}T00:00:00.000Z`),
              inspector_name: data.inspectorName,
              inspector_role: data.inspectorRole,
              summary_notes: data.summaryNotes,
              requires_consultant_review: data.requiresConsultantReview ?? false,
              consultant_review_status: data.requiresConsultantReview ? 'PENDING' : 'NOT_REQUIRED',
              items: data.items?.length
                ? {
                    create: data.items.map((item) => ({
                      tenant_id: tenantId,
                      order_idx: item.orderIdx,
                      check_point: item.checkPoint,
                      is_mandatory: item.isMandatory,
                      result: 'PENDING',
                    })),
                  }
                : undefined,
            },
            include: {
              items: {
                orderBy: { order_idx: 'asc' },
              },
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'INSPECTION_CHECKLIST_CREATED',
            entityType: 'InspectionChecklist',
            entityId: created.id,
            changes: {
              checklistType: created.checklist_type,
              title: created.title,
              itemCount: created.items.length,
            },
          });

          return created;
        });

        return reply.status(201).send(checklist);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 2.3 PUT /api/v1/projects/:projectId/inspections/:id/items/:itemId - Update inspection item
  server.put(
    '/api/v1/projects/:projectId/inspections/:id/items/:itemId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id, itemId } = request.params as {
        projectId: string;
        id: string;
        itemId: string;
      };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id) || !UUID_REGEX.test(itemId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project, checklist, or item not found',
        });
      }

      const parseResult = UpdateInspectionItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid inspection item update payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const checklist = await tx.inspectionChecklist.findFirst({
            where: { id, project_id: projectId },
            include: { items: true },
          });
          if (!checklist) {
            throw { status: 404, message: 'Inspection checklist not found' };
          }

          const existingItem = checklist.items.find((i) => i.id === itemId);
          if (!existingItem) {
            throw { status: 404, message: 'Inspection item not found' };
          }

          const updatedItem = await tx.inspectionItem.update({
            where: { id: itemId },
            data: {
              result: data.result,
              deficiency_notes: data.deficiencyNotes,
              photo_storage_key: data.photoStorageKey,
            },
          });

          // Re-evaluate parent checklist status across all items
          const allItems = await tx.inspectionItem.findMany({
            where: { checklist_id: id },
          });

          let newChecklistStatus = checklist.status;
          let inspectedAt = checklist.inspected_at;
          let signedOffById = checklist.signed_off_by_id;

          const hasFailures = allItems.some((i) => i.result === 'FAIL');
          const hasPending = allItems.some((i) => i.result === 'PENDING');
          const allMandatoryPassed = allItems
            .filter((i) => i.is_mandatory)
            .every((i) => i.result === 'PASS');

          if (hasFailures) {
            newChecklistStatus = 'REJECTED';
            inspectedAt = new Date();
            signedOffById = sub;
          } else if (hasPending) {
            newChecklistStatus = 'IN_PROGRESS';
          } else if (allMandatoryPassed) {
            const hasConditions = allItems.some((i) => !i.is_mandatory && i.result !== 'PASS');
            const wouldApprove = hasConditions
              ? 'APPROVED_WITH_CONDITIONS'
              : 'APPROVED_WITHOUT_COMMENTS';
            // Gate-5 G5-4: consultant approval chain — pause for review
            if (checklist.requires_consultant_review && checklist.consultant_review_status !== 'APPROVED') {
              newChecklistStatus = 'PENDING_CONSULTANT_REVIEW';
            } else {
              newChecklistStatus = wouldApprove;
              inspectedAt = new Date();
              signedOffById = sub;
            }
          }

          const updatedChecklist = await tx.inspectionChecklist.update({
            where: { id },
            data: {
              status: newChecklistStatus,
              inspected_at: inspectedAt,
              signed_off_by_id: signedOffById,
            },
            include: {
              items: {
                orderBy: { order_idx: 'asc' },
              },
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'INSPECTION_ITEM_UPDATED',
            entityType: 'InspectionItem',
            entityId: updatedItem.id,
            changes: {
              checklistId: id,
              itemResult: updatedItem.result,
              checklistStatus: newChecklistStatus,
            },
          });

          return { item: updatedItem, checklist: updatedChecklist };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // ===========================================================================
  // DOMAIN 3: CONCRETE QUALITY & CUBE TESTS
  // ===========================================================================

  // 3.1 GET /api/v1/projects/:projectId/cube-tests - List Cube Tests
  server.get(
    '/api/v1/projects/:projectId/cube-tests',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const tests = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const records = await tx.concreteCubeTest.findMany({
            where: { project_id: projectId },
            include: {
              break_results: {
                orderBy: [{ break_age_days: 'asc' }, { cube_number: 'asc' }],
              },
            },
            orderBy: { pour_date: 'desc' },
          });

          return records.map((t) => ({
            ...t,
            target_strength_mpa: toDecimal(t.target_strength_mpa).toFixed(2),
            break_results: t.break_results.map((b) => ({
              ...b,
              crushing_load_kn: b.crushing_load_kn ? toDecimal(b.crushing_load_kn).toFixed(2) : null,
              compressive_mpa: b.compressive_mpa ? toDecimal(b.compressive_mpa).toFixed(2) : null,
            })),
          }));
        });

        return reply.status(200).send(tests);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 3.2 POST /api/v1/projects/:projectId/cube-tests - Create Cube Test Batch
  server.post(
    '/api/v1/projects/:projectId/cube-tests',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const parseResult = CreateConcreteCubeTestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid concrete cube test payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const test = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const created = await tx.concreteCubeTest.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              batch_reference: data.batchReference,
              pour_location: data.pourLocation,
              pour_date: new Date(`${data.pourDate}T00:00:00.000Z`),
              concrete_class: data.concreteClass,
              target_strength_mpa: toDecimal(data.targetStrengthMpa).toFixed(2),
              slump_tested_mm: data.slumpTestedMm,
              supplier_name: data.supplierName,
              delivery_docket_no: data.deliveryDocketNo,
              curing_tank_id: data.curingTankId,
              notes: data.notes,
            },
            include: {
              break_results: true,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CONCRETE_CUBE_TEST_CREATED',
            entityType: 'ConcreteCubeTest',
            entityId: created.id,
            changes: {
              batchReference: created.batch_reference,
              pourLocation: created.pour_location,
              concreteClass: created.concrete_class,
              targetStrengthMpa: created.target_strength_mpa.toString(),
            },
          });

          return {
            ...created,
            target_strength_mpa: toDecimal(created.target_strength_mpa).toFixed(2),
          };
        });

        return reply.status(201).send(test);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 3.3 POST /api/v1/projects/:projectId/cube-tests/:id/breaks - Record Break Result
  server.post(
    '/api/v1/projects/:projectId/cube-tests/:id/breaks',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, id } = request.params as { projectId: string; id: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(id)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or cube test not found',
        });
      }

      const parseResult = RecordCubeBreakSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid cube break payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const breakResult = await withTenantTx(prisma, tenantId, async (tx) => {
          const test = await tx.concreteCubeTest.findFirst({
            where: { id, project_id: projectId },
          });
          if (!test) {
            throw { status: 404, message: 'Concrete cube test not found' };
          }

          // Mechanical Compressive Strength Formulation (BS EN 12390-3 / Kenya Standard):
          // Standard cube size: 150mm x 150mm
          // Area = 150 * 150 = 22,500 mm²
          // Stress (MPa = N/mm²) = (crushingLoadKn * 1000) / 22500 = crushingLoadKn / 22.5
          let crushingLoadDec: Decimal | null = null;
          let compressiveMpaDec: Decimal | null = null;

          if (data.crushingLoadKn) {
            crushingLoadDec = toDecimal(data.crushingLoadKn);
            if (data.compressiveMpa) {
              compressiveMpaDec = toDecimal(data.compressiveMpa);
            } else {
              compressiveMpaDec = crushingLoadDec.dividedBy(22.5).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            }
          } else if (data.compressiveMpa) {
            compressiveMpaDec = toDecimal(data.compressiveMpa);
            crushingLoadDec = compressiveMpaDec.times(22.5).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          }

          // Kenyan Structural Standard Pass/Fail criteria:
          // 7-day breaks: >= 65% of 28-day target strength
          // 28-day breaks: >= 100% of 28-day target strength
          const targetMpa = toDecimal(test.target_strength_mpa.toString());
          let isPass = data.isPass;
          if (isPass === undefined || isPass === null) {
            if (compressiveMpaDec) {
              const reqRatio = data.breakAgeDays <= 7 ? new Decimal(0.65) : new Decimal(1.0);
              const requiredMpa = targetMpa.times(reqRatio);
              isPass = compressiveMpaDec.greaterThanOrEqualTo(requiredMpa);
            }
          }

          const created = await tx.cubeBreakResult.create({
            data: {
              tenant_id: tenantId,
              cube_test_id: id,
              cube_number: data.cubeNumber,
              break_age_days: data.breakAgeDays,
              scheduled_break_date: new Date(`${data.scheduledBreakDate}T00:00:00.000Z`),
              actual_break_date: data.actualBreakDate
                ? new Date(`${data.actualBreakDate}T00:00:00.000Z`)
                : new Date(),
              crushing_load_kn: crushingLoadDec ? crushingLoadDec.toFixed(2) : null,
              compressive_mpa: compressiveMpaDec ? compressiveMpaDec.toFixed(2) : null,
              is_pass: isPass,
              lab_name: data.labName,
              certificate_key: data.certificateKey,
              tested_by: data.testedBy,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CUBE_BREAK_RECORDED',
            entityType: 'CubeBreakResult',
            entityId: created.id,
            changes: {
              cubeTestId: id,
              cubeNumber: created.cube_number,
              breakAgeDays: created.break_age_days,
              compressiveMpa: created.compressive_mpa?.toString(),
              isPass: created.is_pass,
            },
          });

          return {
            ...created,
            crushing_load_kn: created.crushing_load_kn ? toDecimal(created.crushing_load_kn).toFixed(2) : null,
            compressive_mpa: created.compressive_mpa ? toDecimal(created.compressive_mpa).toFixed(2) : null,
          };
        });

        return reply.status(201).send(breakResult);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // ===========================================================================
  // DOMAIN 4: HANDOVER & SNAGGING (PUNCH LIST)
  // ===========================================================================

  // 4.1 GET /api/v1/projects/:projectId/snags - List Snags
  server.get(
    '/api/v1/projects/:projectId/snags',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const snags = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const records = await tx.snagItem.findMany({
            where: { project_id: projectId },
            include: {
              photos: {
                orderBy: { captured_at: 'asc' },
              },
            },
            orderBy: { snag_number: 'asc' },
          });

          return records.map((s) => ({
            ...s,
            photos: s.photos.map((p) => ({
              ...p,
              gps_latitude: p.gps_latitude ? p.gps_latitude.toString() : null,
              gps_longitude: p.gps_longitude ? p.gps_longitude.toString() : null,
            })),
          }));
        });

        return reply.status(200).send(snags);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 4.1b GET /api/v1/projects/:projectId/snags/export?format=csv
  // Gate-5: observed Punch list CSV export — flat register of all snags.
  server.get(
    '/api/v1/projects/:projectId/snags/export',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { format = 'csv' } = request.query as { format?: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }
      if (!['csv', 'pdf'].includes(format)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Supported formats: csv, pdf' });
      }

      try {
        const { rows, project } = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId }, select: { code: true, name: true } });
          if (!project) throw { status: 404, message: 'Project not found' };
          const rows = await tx.snagItem.findMany({
            where: { project_id: projectId },
            orderBy: { snag_number: 'asc' },
          });
          return { rows, project };
        });

        const esc = (v: unknown) => {
          const str = v === null || v === undefined ? '' : String(v);
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const header = ['Ref', 'Location', 'Trade', 'Item type', 'Description', 'Severity', 'Priority', 'Status', 'Manager', 'Final approver', 'Cost impact (KES)', 'Schedule impact (days)', 'Due date', 'Private', 'Created'];
        const lines = rows.map((s) => [
          `SNAG-${String(s.snag_number).padStart(4, '0')}`,
          [s.location_block, s.location_floor, s.location_room].filter(Boolean).join(' / '),
          s.trade_category, s.item_type ?? '', s.description, s.severity, s.priority, s.status,
          s.manager_name ?? '', s.final_approver_name ?? '',
          s.cost_impact_kes?.toString() ?? '', s.schedule_impact_days ?? '',
          s.due_date?.toISOString().slice(0, 10) ?? '', s.is_private ? 'YES' : 'NO',
          s.identified_at.toISOString().slice(0, 10),
        ].map(esc).join(','));

        if (format === 'pdf') {
          const { SnagRegisterPdf } = await import('../reports/SnagRegisterPdf');
          const { renderPdfToBuffer } = await import('../reports/renderPdf');
          // project already fetched inside tenant tx above
          const openStatuses = ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'CONTESTED'];
          const docElement = React.createElement(SnagRegisterPdf, {
            data: {
              projectName: project.name,
              projectCode: project.code,
              generatedAt: new Date().toISOString().slice(0, 10),
              totalCount: rows.length,
              openCount: rows.filter((r: any) => openStatuses.includes(r.status)).length,
              verifiedCount: rows.filter((r: any) => r.status === 'VERIFIED_CLOSED').length,
              rows: rows.map((s) => ({
                ref: `SNAG-${String(s.snag_number).padStart(4, '0')}`,
                location: [s.location_block, s.location_floor, s.location_room].filter(Boolean).join(' / '),
                trade: s.trade_category,
                itemType: s.item_type,
                description: s.description,
                severity: s.severity,
                priority: s.priority,
                status: s.status,
                managerName: s.manager_name,
                finalApproverName: s.final_approver_name,
                costImpactKes: s.cost_impact_kes?.toString() ?? null,
                dueDate: s.due_date?.toISOString().slice(0, 10) ?? null,
                isPrivate: s.is_private,
              })),
            },
          });
          const pdfBuffer = await renderPdfToBuffer(docElement);
          return reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', 'attachment; filename="snag-register.pdf"')
            .status(200)
            .send(pdfBuffer);
        }

        const csv = [header.map(esc).join(','), ...lines].join('\n');
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="snag-register.csv"`)
          .status(200)
          .send(csv);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
      }
    },
  );

  // 4.2 POST /api/v1/projects/:projectId/snags - Create Snag Item
  server.post(
    '/api/v1/projects/:projectId/snags',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const parseResult = CreateSnagItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid snag item payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const snag = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const lastSnag = await tx.snagItem.findFirst({
            where: { project_id: projectId },
            orderBy: { snag_number: 'desc' },
            select: { snag_number: true },
          });
          const nextSnagNumber = (lastSnag?.snag_number ?? 0) + 1;

          const created = await tx.snagItem.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              snag_number: nextSnagNumber,
              location_block: data.locationBlock,
              location_floor: data.locationFloor,
              location_room: data.locationRoom,
              trade_category: data.tradeCategory,
              description: data.description,
              severity: data.severity,
              status: 'OPEN',
              // Gate-4 S6 punch-list depth
              priority: data.priority ?? 'MEDIUM',
              item_type: data.itemType ?? null,
              is_private: data.isPrivate ?? false,
              manager_name: data.managerName ?? null,
              final_approver_name: data.finalApproverName ?? null,
              cost_impact_kes: data.costImpactKes ? toDecimal(data.costImpactKes).toFixed(2) : null,
              schedule_impact_days: data.scheduleImpactDays ?? null,
              cost_code: data.costCode ?? null,
              reference_doc: data.referenceDoc ?? null,
              assigned_trade_firm: data.assignedTradeFirm,
              due_date: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null,
              identified_by_name: data.identifiedByName,
              photos: data.photos?.length
                ? {
                    create: data.photos.map((p) => ({
                      tenant_id: tenantId,
                      photo_type: p.photoType,
                      storage_key: p.storageKey,
                      caption: p.caption,
                      gps_latitude:
                        p.gpsLatitude !== undefined && p.gpsLatitude !== null
                          ? toDecimal(p.gpsLatitude).toFixed(6)
                          : null,
                      gps_longitude:
                        p.gpsLongitude !== undefined && p.gpsLongitude !== null
                          ? toDecimal(p.gpsLongitude).toFixed(6)
                          : null,
                    })),
                  }
                : undefined,
              distributions: data.distributions?.length
                ? {
                    create: data.distributions.map((d) => ({
                      tenant_id: tenantId,
                      recipient_name: d.recipientName,
                      recipient_contact: d.recipientContact ?? null,
                      channel: d.channel ?? null,
                    })),
                  }
                : undefined,
            },
            include: {
              photos: true,
              distributions: true,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SNAG_ITEM_CREATED',
            entityType: 'SnagItem',
            entityId: created.id,
            changes: {
              snagNumber: created.snag_number,
              tradeCategory: created.trade_category,
              severity: created.severity,
            },
          });

          return {
            ...created,
            photos: created.photos.map((p) => ({
              ...p,
              gps_latitude: p.gps_latitude ? p.gps_latitude.toString() : null,
              gps_longitude: p.gps_longitude ? p.gps_longitude.toString() : null,
            })),
          };
        });

        return reply.status(201).send(snag);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 4.3 PUT /api/v1/projects/:projectId/snags/:snagId/status - Update Snag Status
  server.put(
    '/api/v1/projects/:projectId/snags/:snagId/status',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, fullName } = request.user;
      const { projectId, snagId } = request.params as { projectId: string; snagId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(snagId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or snag not found',
        });
      }

      const parseResult = UpdateSnagStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid snag status payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const snag = await tx.snagItem.findFirst({
            where: { id: snagId, project_id: projectId },
          });
          if (!snag) {
            throw { status: 404, message: 'Snag item not found' };
          }

          // Gate-4 S6: legal status transitions (Open -> In Progress ->
          // Ready for Review -> Resolved(rectified) -> Closed | Rejected)
          const SNAG_TRANSITIONS: Record<string, string[]> = {
            OPEN: ['IN_PROGRESS', 'RECTIFIED_BY_CONTRACTOR', 'REJECTED'],
            IN_PROGRESS: ['READY_FOR_REVIEW', 'RECTIFIED_BY_CONTRACTOR', 'REJECTED'],
            READY_FOR_REVIEW: ['VERIFIED_CLOSED', 'IN_PROGRESS', 'REJECTED'],
            RECTIFIED_BY_CONTRACTOR: ['VERIFIED_CLOSED', 'READY_FOR_REVIEW', 'IN_PROGRESS', 'CONTESTED'],
            CONTESTED: ['IN_PROGRESS', 'READY_FOR_REVIEW', 'REJECTED'],
            VERIFIED_CLOSED: [],
            REJECTED: [],
          };
          const allowed = SNAG_TRANSITIONS[snag.status] ?? [];
          if (snag.status !== data.status && !allowed.includes(data.status)) {
            throw {
              status: 400,
              message: `Illegal snag transition: ${snag.status} -> ${data.status}`,
            };
          }

          const now = new Date();
          let rectifiedAt = snag.rectified_at;
          let verifiedAt = snag.verified_at;
          let verifiedByName = snag.verified_by_name;

          if (data.status === 'RECTIFIED_BY_CONTRACTOR') {
            rectifiedAt = now;
          } else if (data.status === 'VERIFIED_CLOSED') {
            verifiedAt = now;
            verifiedByName = data.verifiedByName || fullName || 'Consulting Inspector';
          }

          // If new photos were attached with the status change (e.g. proof of rectification)
          if (data.photos?.length) {
            await tx.snagPhoto.createMany({
              data: data.photos.map((p) => ({
                tenant_id: tenantId,
                snag_item_id: snagId,
                photo_type: p.photoType,
                storage_key: p.storageKey,
                caption: p.caption,
                gps_latitude:
                  p.gpsLatitude !== undefined && p.gpsLatitude !== null
                    ? toDecimal(p.gpsLatitude).toFixed(6)
                    : null,
                gps_longitude:
                  p.gpsLongitude !== undefined && p.gpsLongitude !== null
                    ? toDecimal(p.gpsLongitude).toFixed(6)
                    : null,
              })),
            });
          }

          const record = await tx.snagItem.update({
            where: { id: snagId },
            data: {
              status: data.status,
              rectified_at: rectifiedAt,
              verified_at: verifiedAt,
              verified_by_name: verifiedByName,
            },
            include: {
              photos: {
                orderBy: { captured_at: 'asc' },
              },
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SNAG_STATUS_UPDATED',
            entityType: 'SnagItem',
            entityId: snagId,
            changes: {
              previousStatus: snag.status,
              newStatus: data.status,
              verifiedByName,
            },
          });

          return {
            ...record,
            photos: record.photos.map((p) => ({
              ...p,
              gps_latitude: p.gps_latitude ? p.gps_latitude.toString() : null,
              gps_longitude: p.gps_longitude ? p.gps_longitude.toString() : null,
            })),
          };
        });

        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 4.4 GET /api/v1/projects/:projectId/snags/:snagId - Snag detail (comments + distributions)
  server.get(
    '/api/v1/projects/:projectId/snags/:snagId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, snagId } = request.params as { projectId: string; snagId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(snagId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or snag not found',
        });
      }

      try {
        const snag = await withTenantTx(prisma, tenantId, async (tx) => {
          const record = await tx.snagItem.findFirst({
            where: { id: snagId, project_id: projectId },
            include: {
              photos: { orderBy: { captured_at: 'asc' } },
              comments: { orderBy: { created_at: 'asc' } },
              distributions: { orderBy: { created_at: 'asc' } },
            },
          });
          if (!record) throw { status: 404, message: 'Snag item not found' };
          return {
            ...record,
            cost_impact_kes: record.cost_impact_kes ? record.cost_impact_kes.toString() : null,
            photos: record.photos.map((p) => ({
              ...p,
              gps_latitude: p.gps_latitude ? p.gps_latitude.toString() : null,
              gps_longitude: p.gps_longitude ? p.gps_longitude.toString() : null,
            })),
          };
        });
        return reply.status(200).send(snag);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 4.5 POST /api/v1/projects/:projectId/snags/:snagId/comments
  server.post(
    '/api/v1/projects/:projectId/snags/:snagId/comments',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, fullName } = request.user;
      const { projectId, snagId } = request.params as { projectId: string; snagId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(snagId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or snag not found',
        });
      }

      const parseResult = CreateSnagCommentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid comment payload',
          details: parseResult.error.errors,
        });
      }
      const data = parseResult.data;

      try {
        const comment = await withTenantTx(prisma, tenantId, async (tx) => {
          const snag = await tx.snagItem.findFirst({
            where: { id: snagId, project_id: projectId },
            select: { id: true },
          });
          if (!snag) throw { status: 404, message: 'Snag item not found' };

          const created = await tx.snagComment.create({
            data: {
              tenant_id: tenantId,
              snag_item_id: snagId,
              author_name: data.authorName || fullName || 'Team Member',
              body: data.body,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SNAG_COMMENT_ADDED',
            entityType: 'SnagItem',
            entityId: snagId,
            changes: { commentId: created.id },
          });

          return created;
        });
        return reply.status(201).send(comment);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 4.6 POST /api/v1/projects/:projectId/snags/:snagId/distributions
  server.post(
    '/api/v1/projects/:projectId/snags/:snagId/distributions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, snagId } = request.params as { projectId: string; snagId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(snagId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or snag not found',
        });
      }

      const parseResult = CreateSnagDistributionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid distribution payload',
          details: parseResult.error.errors,
        });
      }
      const data = parseResult.data;

      try {
        const distribution = await withTenantTx(prisma, tenantId, async (tx) => {
          const snag = await tx.snagItem.findFirst({
            where: { id: snagId, project_id: projectId },
            select: { id: true },
          });
          if (!snag) throw { status: 404, message: 'Snag item not found' };

          const created = await tx.snagDistribution.create({
            data: {
              tenant_id: tenantId,
              snag_item_id: snagId,
              recipient_name: data.recipientName,
              recipient_contact: data.recipientContact ?? null,
              channel: data.channel ?? null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SNAG_DISTRIBUTION_ADDED',
            entityType: 'SnagItem',
            entityId: snagId,
            changes: { distributionId: created.id, recipient: data.recipientName },
          });

          return created;
        });
        return reply.status(201).send(distribution);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // ===========================================================================
  // DOMAIN 5: DEFECTS LIABILITY & FINAL RETENTION CLOSEOUT
  // ===========================================================================

  // 5.1 GET /api/v1/projects/:projectId/certificates - List Certificates
  server.get(
    '/api/v1/projects/:projectId/certificates',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const certs = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const records = await tx.defectsLiabilityCertificate.findMany({
            where: { project_id: projectId },
            orderBy: { issue_date: 'desc' },
          });

          return records.map((c) => ({
            ...c,
            retention_amount_released: toDecimal(c.retention_amount_released).toFixed(2),
          }));
        });

        return reply.status(200).send(certs);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );

  // 5.2 POST /api/v1/projects/:projectId/certificates - Issue Certificate & Retention Release
  server.post(
    '/api/v1/projects/:projectId/certificates',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const parseResult = CreateDefectsCertificateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid certificate payload',
          details: parseResult.error.errors,
        });
      }

      const data = parseResult.data;

      try {
        const certificate = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });
          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // Kenyan Standard Form of Building Contract (JBC 1999) Retention Mechanics:
          // Total Retention Fund Limit = 5.0% of Original Contract Sum
          // First Moiety (50% of retention fund = 2.5% of contract sum) released at Practical Completion
          // Second Moiety (final 50% = remaining 2.5% of contract sum) released at Making Good Defects / DLP Expiry
          let retentionReleasedDec: Decimal;

          if (data.retentionAmountReleased) {
            retentionReleasedDec = toDecimal(data.retentionAmountReleased);
          } else {
            // Determine project contract sum baseline (active BOQ or original_contract_sum)
            const activeBoq = await tx.bOQ.findFirst({
              where: { project_id: projectId, status: { in: ['ACTIVE', 'APPROVED'] } },
              orderBy: { version: 'desc' },
            });

            let contractSum = toDecimal(project.original_contract_sum.toString());
            if (activeBoq && toDecimal(activeBoq.total_amount.toString()).greaterThan(0)) {
              contractSum = toDecimal(activeBoq.total_amount.toString());
            } else if (contractSum.isZero() && toDecimal(project.current_approved_budget.toString()).greaterThan(0)) {
              contractSum = toDecimal(project.current_approved_budget.toString());
            }

            // Retention Fund Cap = 5% of Contract Sum
            const maxRetentionCap = contractSum.times(0.05);

            // JBC 1999: 50% of retention released at Practical Completion or Making Good Defects
            retentionReleasedDec = maxRetentionCap.times(0.5).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          }

          // Compute DLP Expiry Date if not specified: default is effective_date + dlp_duration_months
          let dlpExpiryDate: Date;
          if (data.dlpExpiryDate) {
            dlpExpiryDate = new Date(`${data.dlpExpiryDate}T00:00:00.000Z`);
          } else {
            const eff = new Date(`${data.effectiveDate}T00:00:00.000Z`);
            const expiry = new Date(eff);
            expiry.setMonth(expiry.getMonth() + (data.dlpDurationMonths || 6));
            dlpExpiryDate = expiry;
          }

          const created = await tx.defectsLiabilityCertificate.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              certificate_type: data.certificateType,
              certificate_reference: data.certificateReference,
              issue_date: new Date(`${data.issueDate}T00:00:00.000Z`),
              effective_date: new Date(`${data.effectiveDate}T00:00:00.000Z`),
              dlp_duration_months: data.dlpDurationMonths || 6,
              dlp_expiry_date: dlpExpiryDate,
              retention_amount_released: retentionReleasedDec.toFixed(2),
              architect_name: data.architectName,
              architect_boraqs_no: data.architectBoraqsNo,
              qs_name: data.qsName,
              qs_boraqs_no: data.qsBoraqsNo,
              signed_certificate_key: data.signedCertificateKey,
              notes: data.notes,
            },
          });

          // If practical completion achieved, project status can transition to PRACTICAL_COMPLETION or DLP
          if (data.certificateType === 'PRACTICAL_COMPLETION' && project.status === 'ACTIVE') {
            await tx.project.update({
              where: { id: projectId },
              data: { status: 'COMPLETED' },
            });
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CERTIFICATE_ISSUED',
            entityType: 'DefectsLiabilityCertificate',
            entityId: created.id,
            changes: {
              certificateType: created.certificate_type,
              certificateReference: created.certificate_reference,
              retentionAmountReleased: created.retention_amount_released.toString(),
            },
          });

          return {
            ...created,
            retention_amount_released: toDecimal(created.retention_amount_released).toFixed(2),
          };
        });

        return reply.status(201).send(certificate);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Error',
            message: err.message,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    },
  );
};
