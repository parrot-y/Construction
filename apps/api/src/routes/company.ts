import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions, Roles } from '@construction/permissions';
import { toDecimal, Decimal } from '@construction/money';
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
        coApprovalLimit: m.co_approval_limit ? m.co_approval_limit.toFixed(2) : null,
        joinedAt: m.created_at,
        user: m.user,
      }));

      return reply.status(200).send({ data: formatted });
    },
  );

  // PATCH /api/v1/company/members/:membershipId/co-approval-limit - ADR-010
  // Sets the max |net_amount| (KES) a member may finally approve on a change
  // order. Body: { limit: number | null } — null clears the limit.
  server.patch(
    '/api/v1/company/members/:membershipId/co-approval-limit',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { membershipId } = request.params as { membershipId: string };
      const body = (request.body || {}) as { limit?: number | string | null };

      const raw = body.limit;
      let limitValue: string | null = null;
      if (raw !== null && raw !== undefined) {
        let parsed;
        try {
          parsed = toDecimal(typeof raw === 'number' ? String(raw) : raw);
        } catch {
          parsed = null;
        }
        if (!parsed || !parsed.isFinite() || parsed.isNegative()) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Approval limit must be a non-negative number or null',
          });
        }
        limitValue = parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const target = await tx.membership.findUnique({
            where: { id: membershipId },
            include: { user: { select: { email: true } } },
          });

          if (!target || target.tenant_id !== tenantId) {
            throw { status: 404, message: 'Membership not found' };
          }

          const updated = await tx.membership.update({
            where: { id: membershipId },
            data: { co_approval_limit: limitValue },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'MEMBER_CO_APPROVAL_LIMIT_SET',
            entityType: 'Membership',
            entityId: membershipId,
            changes: {
              userEmail: target.user.email,
              role: target.role,
              previousLimit: target.co_approval_limit?.toString() ?? null,
              newLimit: limitValue,
            },
          });

          return {
            membershipId: updated.id,
            role: updated.role,
            coApprovalLimit: updated.co_approval_limit ? updated.co_approval_limit.toFixed(2) : null,
          };
        });

        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to update CO approval limit');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to update CO approval limit',
        });
      }
    },
  );

  // PATCH /api/v1/company/members/:membershipId/role - Change member role
  server.patch(
    '/api/v1/company/members/:membershipId/role',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { membershipId } = request.params as { membershipId: string };
      const body = (request.body || {}) as { role?: string };
      const newRole = (body.role || '').toUpperCase();

      const validRoles = Object.values(Roles) as string[];
      if (!validRoles.includes(newRole)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid role. Allowed: ${validRoles.join(', ')}`,
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const target = await tx.membership.findUnique({
            where: { id: membershipId },
            include: { user: { select: { email: true } } },
          });

          if (!target || target.tenant_id !== tenantId) {
            throw { status: 404, message: 'Membership not found' };
          }

          const wasAdmin = target.role === 'ADMIN' || target.role === 'COMPANY_ADMIN';
          const willBeAdmin = newRole === 'ADMIN' || newRole === 'COMPANY_ADMIN';

          if (wasAdmin && !willBeAdmin) {
            const adminCount = await tx.membership.count({
              where: { tenant_id: tenantId, role: { in: ['ADMIN', 'COMPANY_ADMIN'] } },
            });
            if (adminCount <= 1) {
              throw { status: 400, message: 'Cannot demote the only company admin' };
            }
          }

          const updated = await tx.membership.update({
            where: { id: membershipId },
            data: { role: newRole },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'MEMBER_ROLE_CHANGED',
            entityType: 'Membership',
            entityId: membershipId,
            changes: { userEmail: target.user.email, previousRole: target.role, newRole },
          });

          return { membershipId: updated.id, role: updated.role };
        });

        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to update member role');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update member role' });
      }
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

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const target = await tx.membership.findUnique({
            where: { id: membershipId },
            include: { user: true },
          });

          if (!target || target.tenant_id !== tenantId) {
            throw { status: 404, message: 'Membership not found' };
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
              throw { status: 400, message: 'Cannot revoke membership of the only company admin' };
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
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to revoke membership');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to revoke membership',
        });
      }
    },
  );
};
