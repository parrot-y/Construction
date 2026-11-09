import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, hasPermission, Role } from '@construction/permissions';
import { calculateLineTotal, toDecimal, toCurrencyString, Decimal } from '@construction/money';
import {
  CreateVariationOrderSchema,
  ReviewVariationOrderSchema,
} from '@construction/validation';
import { requirePermission, requireAnyPermission } from '../plugins/rbac';
import {
  applyCoBudgetRollup,
  claimCoTransition,
  coCanApprove,
  normalizeCoStatus,
  recordCoEvent,
  resolveCoApprovalAuthority,
  CO_PENDING_STATUSES,
} from '../services/variationWorkflow';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VARIATION_INCLUDE = {
  items: {
    include: {
      boq_item: {
        select: { id: true, item_code: true, description: true },
      },
    },
    orderBy: { id: 'asc' as const },
  },
  assignees: true,
  events: { orderBy: { created_at: 'asc' as const } },
};

function formatVariation(v: any) {
  if (!v) return null;
  return {
    ...v,
    status: normalizeCoStatus(v.status),
    net_amount: toCurrencyString(v.net_amount ? v.net_amount.toString() : '0'),
    items: v.items
      ? v.items.map((i: any) => ({
          ...i,
          quantity: i.quantity ? i.quantity.toString() : '0',
          unit_rate: i.unit_rate ? i.unit_rate.toString() : '0',
          total_amount: toCurrencyString(i.total_amount ? i.total_amount.toString() : '0'),
        }))
      : [],
  };
}

async function getActorName(tx: any, userId: string): Promise<string> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { full_name: true, email: true } });
  return user?.full_name || user?.email || 'Unknown user';
}

export const variationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/projects/:projectId/variations - List Project Change Orders
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/variations',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
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
        const variations = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const records = await tx.variationOrder.findMany({
            where: { project_id: projectId },
            include: VARIATION_INCLUDE,
            orderBy: { variation_no: 'asc' },
          });

          return records.map(formatVariation);
        });

        return reply.status(200).send({
          data: variations,
          count: variations.length,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to fetch variations');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to fetch variation orders',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/projects/:projectId/variations/:variationId - CO Detail
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/variations/:variationId',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, variationId } = request.params as { projectId: string; variationId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(variationId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Variation order not found',
        });
      }

      try {
        const variation = await withTenantTx(prisma, tenantId, async (tx) => {
          const record = await tx.variationOrder.findFirst({
            where: {
              id: variationId,
              project_id: projectId,
            },
            include: VARIATION_INCLUDE,
          });

          return formatVariation(record);
        });

        if (!variation) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Variation order not found',
          });
        }

        return reply.status(200).send({
          data: variation,
        });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to fetch variation order');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to fetch variation order',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 3. POST /api/v1/projects/:projectId/variations - Create CO (DRAFT)
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/variations',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.VARIATION_REQUEST),
      ],
    },
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

      const bodyParse = CreateVariationOrderSchema.safeParse(request.body);
      if (!bodyParse.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid variation order data',
          details: bodyParse.error.errors,
        });
      }

      const data = bodyParse.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          // Validate linked BOQ items belong to this project
          for (const item of data.items) {
            if (item.boqItemId) {
              const boqItem = await tx.bOQItem.findFirst({
                where: {
                  id: item.boqItemId,
                  section: {
                    boq: {
                      project_id: projectId,
                    },
                  },
                },
              });

              if (!boqItem) {
                throw {
                  status: 400,
                  message: `Linked BOQ item does not exist or does not belong to this project: ${item.boqItemId}`,
                };
              }
            }
          }

          // Validate linked RFI belongs to this project
          if (data.linkedRfiId) {
            const rfi = await tx.rFI.findFirst({
              where: { id: data.linkedRfiId, project_id: projectId },
              select: { id: true },
            });
            if (!rfi) {
              throw { status: 400, message: 'Linked RFI does not exist or does not belong to this project' };
            }
          }

          // Validate assignees are members of this project
          if (data.assigneeIds.length > 0) {
            const members = await tx.projectMember.findMany({
              where: { project_id: projectId, id: { in: data.assigneeIds } },
              select: { id: true },
            });
            if (members.length !== data.assigneeIds.length) {
              throw { status: 400, message: 'One or more assignees are not members of this project' };
            }
          }

          const latest = await tx.variationOrder.findFirst({
            where: { project_id: projectId },
            orderBy: { variation_no: 'desc' },
            select: { variation_no: true },
          });
          const nextVariationNo = latest ? latest.variation_no + 1 : 1;

          let netAmount = new Decimal(0);
          const itemRows = data.items.map((item) => {
            const lineTotal = calculateLineTotal(item.quantity, item.unitRate);
            netAmount = netAmount.plus(lineTotal);
            return {
              tenant_id: tenantId,
              boq_item_id: item.boqItemId || null,
              description: item.description,
              unit: item.unit,
              quantity: toDecimal(item.quantity).toFixed(4),
              unit_rate: toDecimal(item.unitRate).toFixed(4),
              total_amount: lineTotal.toFixed(2),
            };
          });

          const actorName = await getActorName(tx, sub);

          const variation = await tx.variationOrder.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              variation_no: nextVariationNo,
              title: data.title,
              reason: data.reason,
              status: 'DRAFT',
              trigger_type: data.triggerType || 'OTHER',
              linked_rfi_id: data.linkedRfiId || null,
              requested_by_id: sub,
              net_amount: netAmount.toFixed(2),
              time_extension_days: data.timeExtensionDays ?? 0,
              items: {
                create: itemRows,
              },
              assignees: {
                create: data.assigneeIds.map((memberId) => ({
                  tenant_id: tenantId,
                  project_member_id: memberId,
                  role: 'REVIEWER',
                })),
              },
            },
            include: VARIATION_INCLUDE,
          });

          await recordCoEvent(tx, tenantId, variation.id, 'USER', actorName, 'CREATED', data.title);

          const withEvents = await tx.variationOrder.findUniqueOrThrow({
            where: { id: variation.id },
            include: VARIATION_INCLUDE,
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'VARIATION_CREATED',
            entityType: 'VariationOrder',
            entityId: variation.id,
            changes: {
              variationNo: nextVariationNo,
              title: data.title,
              triggerType: data.triggerType || 'OTHER',
              linkedRfiId: data.linkedRfiId || null,
              netAmount: netAmount.toFixed(2),
              timeExtensionDays: data.timeExtensionDays ?? 0,
              itemCount: itemRows.length,
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatVariation(withEvents);
        });

        return reply.status(201).send({
          message: 'Change order created as draft',
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
        server.log.error(err, 'Failed to submit variation order');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to submit variation order',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/projects/:projectId/variations/:variationId/submit
  //    DRAFT -> PM_REVIEW
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/variations/:variationId/submit',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.VARIATION_REQUEST),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, variationId } = request.params as { projectId: string; variationId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(variationId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Variation order not found',
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const variation = await tx.variationOrder.findFirst({
            where: { id: variationId, project_id: projectId },
          });

          if (!variation) {
            throw { status: 404, message: 'Variation order not found' };
          }

          const current = normalizeCoStatus(variation.status);
          if (current !== 'DRAFT') {
            throw { status: 400, message: `Only draft change orders can be submitted (current: ${current})` };
          }

          const updated = await tx.variationOrder.update({
            where: { id: variationId },
            data: { status: 'PM_REVIEW', submitted_at: new Date() },
            include: VARIATION_INCLUDE,
          });

          const actorName = await getActorName(tx, sub);
          await recordCoEvent(tx, tenantId, variationId, 'USER', actorName, 'SUBMITTED', `CO-${String(variation.variation_no).padStart(4, '0')} submitted for PM review`);

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'VARIATION_SUBMIT',
            entityType: 'VariationOrder',
            entityId: variationId,
            changes: {
              previousStatus: current,
              newStatus: 'PM_REVIEW',
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatVariation(updated);
        });

        return reply.status(200).send({
          message: 'Change order submitted for PM review',
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
        server.log.error(err, 'Failed to submit change order');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to submit change order',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 5. POST /api/v1/projects/:projectId/variations/:variationId/review
  //    EVALUATE | APPROVE | REJECT | VOID — ADR-010 state machine
  // ---------------------------------------------------------------------------
  server.post(
    '/api/v1/projects/:projectId/variations/:variationId/review',
    {
      preHandler: [
        server.authenticate,
        // Baseline gate; handler enforces per-action permission (APPROVE→VARIATION_APPROVE,
        // VOID→VARIATION_REQUEST, REJECT→VARIATION_REVIEW|VARIATION_APPROVE, else VARIATION_REVIEW).
        requireAnyPermission(Permissions.VARIATION_REQUEST, Permissions.VARIATION_REVIEW, Permissions.VARIATION_APPROVE),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, variationId } = request.params as { projectId: string; variationId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(variationId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Variation order not found',
        });
      }

      const bodyParse = ReviewVariationOrderSchema.safeParse(request.body);
      if (!bodyParse.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid variation review payload',
          details: bodyParse.error.errors,
        });
      }

      const { action, comments } = bodyParse.data;

      // Role permission check based on action
      const requiredPermission =
        action === 'APPROVE'
          ? Permissions.VARIATION_APPROVE
          : action === 'VOID'
            ? Permissions.VARIATION_REQUEST
            : action === 'REJECT'
              ? null // VARIATION_REVIEW or VARIATION_APPROVE
              : Permissions.VARIATION_REVIEW;

      if (requiredPermission) {
        if (!hasPermission(role as Role, requiredPermission)) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Access denied. Role "${role}" does not have required permission "${requiredPermission}"`,
          });
        }
      } else if (action === 'REJECT') {
        const canReject =
          hasPermission(role as Role, Permissions.VARIATION_APPROVE) ||
          hasPermission(role as Role, Permissions.VARIATION_REVIEW);
        if (!canReject) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Access denied. Role "${role}" does not have permission to reject change orders`,
          });
        }
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const variation = await tx.variationOrder.findFirst({
            where: { id: variationId, project_id: projectId },
          });

          if (!variation) {
            throw { status: 404, message: 'Variation order not found' };
          }

          const currentStatus = normalizeCoStatus(variation.status);
          const actorName = await getActorName(tx, sub);
          const isTerminal = currentStatus === 'APPROVED' || currentStatus === 'REJECTED' || currentStatus === 'VOID';

          if (isTerminal) {
            throw {
              status: 400,
              message: `Change order is already ${currentStatus.toLowerCase()} and cannot be modified`,
            };
          }

          let newStatus = currentStatus;
          let approvedAt: Date | null = null;
          let newApprovedBudget = toDecimal(project.current_approved_budget.toString()).toFixed(2);
          let coEvent: string | null = null;
          let coEventNote: string | null = comments || null;

          if (action === 'EVALUATE') {
            if (!CO_PENDING_STATUSES.includes(currentStatus as any)) {
              throw { status: 400, message: `Cannot evaluate a change order in ${currentStatus} status` };
            }
            coEvent = 'EVALUATED';
          } else if (action === 'APPROVE') {
            if (!CO_PENDING_STATUSES.includes(currentStatus as any)) {
              throw { status: 400, message: `Cannot approve a change order in ${currentStatus} status` };
            }

            const authority = await resolveCoApprovalAuthority(tx, tenantId, sub, role);

            // OWNER_REVIEW stage may only be decided by owner-side actors.
            if (currentStatus === 'OWNER_REVIEW' && !authority.unlimited) {
              throw {
                status: 403,
                message: `Change order requires owner approval — role "${role}" cannot decide OWNER_REVIEW stage`,
              };
            }

            if (coCanApprove(authority, variation.net_amount)) {
              newStatus = 'APPROVED';
              approvedAt = new Date();
              coEvent = 'APPROVED';
            } else {
              newStatus = 'OWNER_REVIEW';
              coEvent = 'ESCALATED';
              coEventNote = `Amount exceeds approver limit — escalated to owner review${comments ? `: ${comments}` : ''}`;
            }
          } else if (action === 'REJECT') {
            if (!CO_PENDING_STATUSES.includes(currentStatus as any)) {
              throw { status: 400, message: `Cannot reject a change order in ${currentStatus} status` };
            }
            newStatus = 'REJECTED';
            coEvent = 'REJECTED';
          } else {
            // VOID
            if (!['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW'].includes(currentStatus)) {
              throw { status: 400, message: `Cannot void a change order in ${currentStatus} status` };
            }
            newStatus = 'VOID';
            coEvent = 'VOIDED';
          }

          // Atomic claim: fails if a concurrent request already transitioned
          // the order, preventing double budget rollups on approval.
          const claimed = await claimCoTransition(
            tx,
            variationId,
            variation.status,
            newStatus,
            approvedAt,
          );
          if (!claimed) {
            throw { status: 409, message: 'Change order was modified concurrently — please retry' };
          }

          if (newStatus === 'APPROVED') {
            newApprovedBudget = await applyCoBudgetRollup(tx, project, variation.net_amount);
          }

          const updatedVariation = await tx.variationOrder.findUniqueOrThrow({
            where: { id: variationId },
            include: VARIATION_INCLUDE,
          });

          if (coEvent) {
            await recordCoEvent(tx, tenantId, variationId, 'USER', actorName, coEvent, coEventNote);
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: `VARIATION_${action}`,
            entityType: 'VariationOrder',
            entityId: variation.id,
            changes: {
              previousStatus: currentStatus,
              newStatus,
              action,
              comments: comments || null,
              netAmount: variation.net_amount.toString(),
              previousBudget: project.current_approved_budget.toString(),
              newBudget: newApprovedBudget,
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return formatVariation(updatedVariation);
        });

        return reply.status(200).send({
          message: `Change order ${action.toLowerCase()} processed successfully`,
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
        server.log.error(err, 'Failed to review variation order');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to review variation order',
        });
      }
    },
  );
};
