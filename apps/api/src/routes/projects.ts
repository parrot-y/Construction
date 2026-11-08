import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toDecimal, Decimal } from '@construction/money';
import {
  CreateProjectDetailsSchema,
  UpdateProjectDetailsSchema,
  AssignProjectMemberSchema,
} from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export const projectRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/projects (requires PROJECT_VIEW)
  server.get(
    '/api/v1/projects',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;

      const projects = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.project.findMany({
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, full_name: true, email: true },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
        });
      });

      return reply.status(200).send({ data: projects });
    },
  );

  // GET /api/v1/projects/:id (requires PROJECT_VIEW)
  server.get(
    '/api/v1/projects/:id',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      const project = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.project.findUnique({
          where: { id },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, full_name: true, email: true, phone_number: true },
                },
              },
            },
            boqs: { select: { id: true, version: true, total_amount: true, status: true } },
          },
        });
      });

      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      return reply.status(200).send({ data: project });
    },
  );

  // POST /api/v1/projects (requires PROJECT_CREATE) — Gate-4 S8 full onboarding payload
  server.post(
    '/api/v1/projects',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_CREATE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;

      const parseResult = CreateProjectDetailsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid project payload',
          details: parseResult.error.errors,
        });
      }
      const body = parseResult.data;

      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        // Legacy aliases: budget / originalContractSum / currentApprovedBudget
        const legacyValue =
          body.contractValue ??
          (body.originalContractSum != null ? String(body.originalContractSum) : null) ??
          (body.budget != null ? String(body.budget) : null);
        const contractValue = legacyValue ? toDecimal(legacyValue) : null;
        const approvedBudget =
          body.currentApprovedBudget != null
            ? toDecimal(String(body.currentApprovedBudget))
            : (contractValue ?? 0);
        const project = await tx.project.create({
          data: {
            tenant_id: tenantId,
            name: body.name,
            code: body.code,
            description: body.description ?? null,
            location: body.location ?? null,
            map_latitude: body.mapLatitude != null ? toDecimal(body.mapLatitude) : null,
            map_longitude: body.mapLongitude != null ? toDecimal(body.mapLongitude) : null,
            contract_currency: body.contractCurrency || 'KES',
            money_at_risk_kes: body.moneyAtRiskKes ? toDecimal(body.moneyAtRiskKes) : null,
            nca_project_no: body.ncaProjectNo ?? null,
            status: body.status || 'PLANNING',
            original_contract_sum: contractValue ?? 0,
            current_approved_budget: approvedBudget,
            start_date: body.startDate ? toDateOnly(body.startDate) : null,
            target_end_date: body.targetEndDate ? toDateOnly(body.targetEndDate) : null,
            members: {
              create: {
                tenant_id: tenantId,
                user_id: sub,
                role: 'PROJECT_LEAD',
              },
            },
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          projectId: project.id,
          actorId: sub,
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: project.id,
          changes: {
            name: body.name,
            code: body.code,
            contractValue: contractValue?.toFixed(2) ?? null,
            status: project.status,
          },
        });

        return project;
      });

      return reply.status(201).send({ data: result });
    },
  );

  // PATCH /api/v1/projects/:id (requires PROJECT_EDIT) — Gate-4 S8 edit-project parity
  server.patch(
    '/api/v1/projects/:id',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = UpdateProjectDetailsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid project update',
          details: parseResult.error.errors,
        });
      }
      const body = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.project.findUnique({ where: { id } });
          if (!existing) throw { status: 404, message: 'Project not found' };

          const data: Record<string, any> = {};
          if (body.name !== undefined) data.name = body.name;
          if (body.code !== undefined) data.code = body.code;
          if (body.description !== undefined) data.description = body.description;
          if (body.location !== undefined) data.location = body.location;
          if (body.mapLatitude !== undefined) data.map_latitude = body.mapLatitude === null ? null : toDecimal(body.mapLatitude);
          if (body.mapLongitude !== undefined) data.map_longitude = body.mapLongitude === null ? null : toDecimal(body.mapLongitude);
          if (body.contractCurrency !== undefined) data.contract_currency = body.contractCurrency;
          if (body.moneyAtRiskKes !== undefined) data.money_at_risk_kes = body.moneyAtRiskKes === null ? null : toDecimal(body.moneyAtRiskKes);
          if (body.ncaProjectNo !== undefined) data.nca_project_no = body.ncaProjectNo;
          if (body.status !== undefined) data.status = body.status;
          if (body.startDate !== undefined) data.start_date = body.startDate === null ? null : toDateOnly(body.startDate);
          if (body.targetEndDate !== undefined) data.target_end_date = body.targetEndDate === null ? null : toDateOnly(body.targetEndDate);

          if (body.contractValue !== undefined) {
            const newValue = body.contractValue === null ? new Decimal(0) : toDecimal(body.contractValue);
            data.original_contract_sum = newValue;
            // Keep approved budget in sync while it still equals the old contract sum
            // (pre-variation state); once variations have moved it, leave it alone.
            if (toDecimal(existing.current_approved_budget.toString()).equals(toDecimal(existing.original_contract_sum.toString()))) {
              data.current_approved_budget = newValue;
            }
          }

          const project = await tx.project.update({ where: { id }, data });

          // progressPct → real ProgressRecord (no duplicated manual field)
          if (body.progressPct !== undefined && body.progressPct !== null) {
            const pct = toDecimal(body.progressPct);
            if (pct.lt(0) || pct.gt(100)) {
              throw { status: 400, message: 'progressPct must be between 0 and 100' };
            }
            await tx.progressRecord.create({
              data: {
                tenant_id: tenantId,
                project_id: id,
                record_date: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
                overall_progress: pct.dividedBy(100).toFixed(4),
                notes: 'Manual progress update via project settings',
              },
            });
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId: project.id,
            actorId: sub,
            action: 'PROJECT_UPDATED',
            entityType: 'Project',
            entityId: project.id,
            changes: { fields: Object.keys(body) },
          });

          return project;
        });

        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update project' });
      }
    },
  );

  // POST /api/v1/projects/:id/members (requires PROJECT_EDIT) — PM/Architect/QS assignment
  server.post(
    '/api/v1/projects/:id/members',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };

      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project or Member not found' });
      }

      const parseResult = AssignProjectMemberSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid member assignment',
          details: parseResult.error.errors,
        });
      }
      const body = parseResult.data;

      try {
        const assignment = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findUnique({ where: { id }, select: { id: true } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const member = await tx.projectMember.upsert({
            where: {
              project_id_user_id: {
                project_id: id,
                user_id: body.userId,
              },
            },
            update: { role: body.role },
            create: {
              tenant_id: tenantId,
              project_id: id,
              user_id: body.userId,
              role: body.role,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: id,
            actorId: sub,
            action: 'PROJECT_MEMBER_ASSIGNED',
            entityType: 'ProjectMember',
            entityId: member.id,
            changes: { userId: body.userId, role: body.role },
          });

          return member;
        });

        return reply.status(200).send({ data: assignment });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Not Found', message: err.message });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to assign member' });
      }
    },
  );

  // DELETE /api/v1/projects/:id/members/:userId (requires PROJECT_EDIT)
  server.delete(
    '/api/v1/projects/:id/members/:userId',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id, userId } = request.params as { id: string; userId: string };

      if (!UUID_REGEX.test(id) || !UUID_REGEX.test(userId)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project or Member not found' });
      }

      await withTenantTx(prisma, tenantId, async (tx) => {
        await tx.projectMember.delete({
          where: {
            project_id_user_id: {
              project_id: id,
              user_id: userId,
            },
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          projectId: id,
          actorId: sub,
          action: 'PROJECT_MEMBER_REMOVED',
          entityType: 'ProjectMember',
          entityId: userId,
          changes: { userId },
        });
      });

      return reply.status(200).send({ success: true, message: 'Member removed from project' });
    },
  );
};
