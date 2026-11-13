import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { prisma, recordAuditLog, withTenantTx, hashPassword } from '@construction/db';
import { OperatorAdminAccountSchema } from '@construction/validation';
import { ALL_GATED_MODULES, GATED_MODULES } from '../plugins/moduleGate';

/**
 * Platform-operator routes (Stage 4 auditor fix A).
 *
 * Self-serve signup creates an unverified first COMPANY_ADMIN and email/SMS
 * delivery is simulated for the pilot — so in production there is no operator
 * above the first admin. These endpoints are guarded by a deployment secret
 * (OPERATOR_KEY env), NOT a user session: they exist for the platform owner
 * to activate or reset a company's first admin until a real email/SMS
 * provider is wired.
 *
 * Every call is audit-logged inside the tenant transaction.
 */

function operatorKeyOk(request: { headers: Record<string, unknown> }): boolean {
  const expected = process.env.OPERATOR_KEY;
  if (!expected) return false; // endpoint disabled when no key configured
  const provided = request.headers['x-operator-key'];
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const operatorRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post('/api/v1/operator/admin-account', async (request, reply) => {
    if (!process.env.OPERATOR_KEY) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Operator endpoints are not configured (OPERATOR_KEY unset)',
      });
    }
    if (!operatorKeyOk(request)) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid operator key' });
    }

    const parsed = OperatorAdminAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid operator payload',
        details: parsed.error.flatten(),
      });
    }
    const { companySlug, mode, newPassword } = parsed.data;

    const tenant = await prisma.tenant.findUnique({ where: { slug: companySlug } });
    if (!tenant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Company not found' });
    }

    // First admin = earliest COMPANY_ADMIN membership of the tenant.
    const admin = await withTenantTx(prisma, tenant.id, async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { tenant_id: tenant.id, role: 'COMPANY_ADMIN' },
        orderBy: { created_at: 'asc' },
        include: { user: true },
      });
      if (!membership) return null;

      const changes: Record<string, unknown> = { mode, targetUserId: membership.user_id };

      if (mode === 'activate') {
        const updated = await tx.user.update({
          where: { id: membership.user_id },
          data: { email_verified_at: new Date(), phone_verified_at: membership.user.phone_verified_at ?? new Date() },
        });
        changes.emailVerifiedAt = updated.email_verified_at;
      } else {
        if (!newPassword) {
          throw { status: 400, message: 'newPassword is required for reset-password' };
        }
        const passwordHash = await hashPassword(newPassword);
        await tx.user.update({
          where: { id: membership.user_id },
          data: { password_hash: passwordHash },
        });
        changes.passwordReset = true;
      }

      await recordAuditLog(tx, {
        tenantId: tenant.id,
        actorId: membership.user_id,
        action: mode === 'activate' ? 'OPERATOR_ADMIN_ACTIVATED' : 'OPERATOR_ADMIN_PASSWORD_RESET',
        entityType: 'User',
        entityId: membership.user_id,
        projectId: null,
        changes: { ...changes, operator: 'platform-operator', ipAddress: request.ip },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return membership.user;
    }).catch((err: any) => {
      if (err?.status) return { __err: err };
      throw err;
    }) as any;

    if (admin?.__err) {
      return reply.status(admin.__err.status).send({ error: 'Bad Request', message: admin.__err.message });
    }
    if (!admin) {
      return reply.status(404).send({ error: 'Not Found', message: 'No COMPANY_ADMIN membership found for this company' });
    }

    return reply.send({
      data: {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        admin: { id: admin.id, email: admin.email, fullName: admin.full_name, role: 'COMPANY_ADMIN' },
        mode,
      },
    });
  });

  // B1: per-tenant module flags. Operator-only (OPERATOR_KEY), audit-logged.
  server.get('/api/v1/operator/tenants/:tenantId/modules', async (request, reply) => {
    if (!operatorKeyOk(request)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Operator key required' });
    }
    const { tenantId } = request.params as { tenantId: string };
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } });
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    const flags = await withTenantTx(prisma, tenantId, (tx) =>
      tx.tenantModuleFlag.findMany({ where: { tenant_id: tenantId } }),
    );
    const byModule = new Map(flags.map((f) => [f.module, f]));
    return reply.send({
      data: {
        tenant,
        modules: ALL_GATED_MODULES.map((m) => ({
          module: m,
          label: m,
          enabled: byModule.get(m)?.enabled === true,
          updatedAt: byModule.get(m)?.updated_at ?? null,
        })),
        note: 'Modules not listed are Pilot Core and always enabled.',
      },
    });
  });

  server.put('/api/v1/operator/tenants/:tenantId/modules', async (request, reply) => {
    if (!operatorKeyOk(request)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Operator key required' });
    }
    const { tenantId } = request.params as { tenantId: string };
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    const body = (request.body ?? {}) as { modules?: Record<string, boolean> };
    const modules = body.modules ?? {};
    const unknown = Object.keys(modules).filter((m) => !(m in GATED_MODULES));
    if (unknown.length) {
      return reply.status(400).send({ error: 'Bad Request', message: `Unknown modules: ${unknown.join(', ')}` });
    }
    const updated = await withTenantTx(prisma, tenantId, async (tx) => {
      const out: string[] = [];
      for (const [module, enabled] of Object.entries(modules)) {
        await tx.tenantModuleFlag.upsert({
          where: { tenant_id_module: { tenant_id: tenantId, module } },
          update: { enabled: enabled === true, updated_by: 'operator' },
          create: { tenant_id: tenantId, module, enabled: enabled === true, updated_by: 'operator' },
        });
        out.push(module);
      }
      await recordAuditLog(tx, {
        tenantId,
        actorId: '00000000-0000-0000-0000-000000000000',
        action: 'TENANT_MODULES_UPDATED',
        entityType: 'Tenant',
        entityId: tenantId,
        projectId: null,
        changes: { modules },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
      return out;
    });
    return reply.send({ data: { tenantId, updated } });
  });
};
