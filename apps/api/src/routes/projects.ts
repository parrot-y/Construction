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
          orderBy: { created_at: 'desc' },
        });
      });

      return reply.status(200).send({ data: projects });
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
      const body = request.body as { name: string; code: string; location?: string; budget?: number };

      if (!body.name || !body.code) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Project name and code are required',
        });
      }

      // Execute project creation + audit log inside atomic withTenantTx lease
      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const project = await tx.project.create({
          data: {
            tenant_id: tenantId,
            name: body.name,
            code: body.code,
            location: body.location,
            original_contract_sum: body.budget || 0,
            current_approved_budget: body.budget || 0,
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

  // GET /api/v1/company/settings (requires COMPANY_MANAGE - Admin only)
  server.get(
    '/api/v1/company/settings',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      return reply.status(200).send({ data: tenant });
    },
  );
};
