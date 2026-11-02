import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../plugins/rbac';

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

  // POST /api/v1/projects (requires PROJECT_CREATE)
  server.post(
    '/api/v1/projects',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_CREATE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const body = request.body as {
        name: string;
        code: string;
        description?: string;
        location?: string;
        ncaProjectNo?: string;
        budget?: number;
      };

      if (!body.name || !body.code) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Project name and code are required',
        });
      }

      // Execute project creation + membership assignment + audit log inside atomic withTenantTx lease
      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const project = await tx.project.create({
          data: {
            tenant_id: tenantId,
            name: body.name,
            code: body.code,
            description: body.description,
            location: body.location,
            nca_project_no: body.ncaProjectNo,
            original_contract_sum: body.budget || 0,
            current_approved_budget: body.budget || 0,
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
          changes: { name: body.name, code: body.code },
        });

        return project;
      });

      return reply.status(201).send({ data: result });
    },
  );

  // PATCH /api/v1/projects/:id (requires PROJECT_EDIT)
  server.patch(
    '/api/v1/projects/:id',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        description?: string;
        location?: string;
        status?: string;
      };

      const updated = await withTenantTx(prisma, tenantId, async (tx) => {
        const project = await tx.project.update({
          where: { id },
          data: {
            name: body.name,
            description: body.description,
            location: body.location,
            status: body.status,
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          projectId: project.id,
          actorId: sub,
          action: 'PROJECT_UPDATED',
          entityType: 'Project',
          entityId: project.id,
          changes: body,
        });

        return project;
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // POST /api/v1/projects/:id/members (requires PROJECT_EDIT)
  server.post(
    '/api/v1/projects/:id/members',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      const body = request.body as { userId: string; role?: string };

      if (!body.userId) {
        return reply.status(400).send({ error: 'Bad Request', message: 'userId is required' });
      }

      const assignment = await withTenantTx(prisma, tenantId, async (tx) => {
        const member = await tx.projectMember.upsert({
          where: {
            project_id_user_id: {
              project_id: id,
              user_id: body.userId,
            },
          },
          update: { role: body.role || 'MEMBER' },
          create: {
            tenant_id: tenantId,
            project_id: id,
            user_id: body.userId,
            role: body.role || 'MEMBER',
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
