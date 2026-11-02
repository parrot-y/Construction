import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../plugins/rbac';

export const companyRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/company - Get company profile
  server.get(
    '/api/v1/company',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Not Found', message: 'Company tenant not found' });
      }

      return reply.status(200).send({ data: tenant });
    },
  );

  // GET /api/v1/company/settings - Get company settings (Admin only)
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

  // PATCH /api/v1/company - Update company details (Admin only)
  server.patch(
    '/api/v1/company',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const body = request.body as { name?: string; kra_pin?: string; nca_category?: string };

      const updated = await withTenantTx(prisma, tenantId, async (tx) => {
        const tenant = await tx.tenant.update({
          where: { id: tenantId },
          data: {
            name: body.name,
            kra_pin: body.kra_pin,
            nca_category: body.nca_category,
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'COMPANY_SETTINGS_UPDATED',
          entityType: 'Tenant',
          entityId: tenantId,
          changes: body,
        });

        return tenant;
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // GET /api/v1/company/members - List team members
  server.get(
    '/api/v1/company/members',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;

      const members = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.membership.findMany({
          include: {
            user: {
              select: {
                id: true,
                email: true,
                full_name: true,
                phone_number: true,
                is_active: true,
                created_at: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        });
      });

      const formatted = members.map((m) => ({
        membershipId: m.id,
        role: m.role,
        joinedAt: m.created_at,
        user: m.user,
      }));

      return reply.status(200).send({ data: formatted });
    },
  );

  // DELETE /api/v1/company/members/:membershipId - Revoke company access
  server.delete(
    '/api/v1/company/members/:membershipId',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { membershipId } = request.params as { membershipId: string };

      const result = await withTenantTx(prisma, tenantId, async (tx) => {
        const target = await tx.membership.findUnique({
          where: { id: membershipId },
          include: { user: true },
        });

        if (!target || target.tenant_id !== tenantId) {
          return reply.status(404).send({ error: 'Not Found', message: 'Membership not found' });
        }

        // Prevent removing the last admin in the company
        if (target.role === 'ADMIN' || target.role === 'COMPANY_ADMIN') {
          const adminCount = await tx.membership.count({
            where: {
              tenant_id: tenantId,
              role: { in: ['ADMIN', 'COMPANY_ADMIN'] },
            },
          });

          if (adminCount <= 1) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: 'Cannot revoke membership of the only company admin',
            });
          }
        }

        await tx.membership.delete({
          where: { id: membershipId },
        });

        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'MEMBER_REVOKED',
          entityType: 'Membership',
          entityId: membershipId,
          changes: { userEmail: target.user.email, role: target.role },
        });

        return { success: true, message: `Access revoked for ${target.user.email}` };
      });

      return reply.status(200).send({ data: result });
    },
  );
};
