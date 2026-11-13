import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';
import { Permissions } from '@construction/permissions';
import { CreateCrewSchema, UpdateCrewSchema, AddCrewMemberSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gate-5 G5-5: Crews — observed People > Crews (New Crew for site
 * engineer/superintendent/trade lead/foreman). Tenant-wide list with
 * optional project assignment; members embedded.
 */
export const crewsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/crews — list all crews (optionally ?projectId=)
  server.get(
    '/api/v1/crews',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, status } = request.query as { projectId?: string; status?: string };
      const pg = listParams(request);
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.crew.findMany({
            where: {
              ...(projectId && UUID_REGEX.test(projectId) ? { project_id: projectId } : {}),
              ...(status ? { status } : {}),
            },
            include: {
              members: { orderBy: { created_at: 'asc' } },
              project: { select: { id: true, name: true, code: true } },
            },
            orderBy: { created_at: 'desc' },
            skip: pg.skip,
            take: pg.limit + 1,
          }),
        );
        const paged = listPage(data, pg);
        return reply.status(200).send({
          data: paged.data.map((c) => ({
            ...c,
            member_count: c.members.length,
            daily_cost_kes: c.members.reduce((s, m) => s + (m.daily_rate_kes ? parseFloat(m.daily_rate_kes.toString()) : 0), 0).toFixed(2),
            created_at: c.created_at.toISOString(),
            updated_at: c.updated_at.toISOString(),
          })),
          page: paged.page,
          count: paged.data.length,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list crews' });
      }
    },
  );

  // POST /api/v1/crews
  server.post(
    '/api/v1/crews',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateCrewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid crew', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const crew = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }
          const c = await tx.crew.create({
            data: {
              tenant_id: tenantId,
              project_id: data.projectId ?? null,
              name: data.name,
              trade: data.trade,
              foreman_name: data.foremanName ?? null,
              notes: data.notes ?? null,
              created_by_id: sub,
            },
            include: { members: true },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: data.projectId ?? undefined, actorId: sub,
            action: 'CREW_CREATED', entityType: 'Crew', entityId: c.id,
            changes: { name: data.name, trade: data.trade },
          });
          return c;
        });
        return reply.status(201).send({ data: crew });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create crew' });
      }
    },
  );

  // PATCH /api/v1/crews/:id
  server.patch(
    '/api/v1/crews/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Crew not found' });
      const parsed = UpdateCrewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid update', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const crew = await tx.crew.findUnique({ where: { id } });
          if (!crew) throw { status: 404, message: 'Crew not found' };
          const result = await tx.crew.update({
            where: { id },
            data: {
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.trade !== undefined ? { trade: data.trade } : {}),
              ...(data.foremanName !== undefined ? { foreman_name: data.foremanName } : {}),
              ...(data.projectId !== undefined ? { project_id: data.projectId } : {}),
              ...(data.status !== undefined ? { status: data.status } : {}),
              ...(data.notes !== undefined ? { notes: data.notes } : {}),
            },
            include: { members: true },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: crew.project_id ?? undefined, actorId: sub,
            action: 'CREW_UPDATED', entityType: 'Crew', entityId: id,
            changes: { fields: Object.keys(data) },
          });
          return result;
        });
        return reply.status(200).send({ data: updated });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update crew' });
      }
    },
  );

  // DELETE /api/v1/crews/:id — soft-delete via INACTIVE (audit trail preserved)
  server.delete(
    '/api/v1/crews/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Crew not found' });
      try {
        await withTenantTx(prisma, tenantId, async (tx) => {
          const crew = await tx.crew.findUnique({ where: { id } });
          if (!crew) throw { status: 404, message: 'Crew not found' };
          await tx.crew.update({ where: { id }, data: { status: 'INACTIVE' } });
          await recordAuditLog(tx, {
            tenantId, projectId: crew.project_id ?? undefined, actorId: sub,
            action: 'CREW_DEACTIVATED', entityType: 'Crew', entityId: id,
            changes: { name: crew.name },
          });
        });
        return reply.status(200).send({ success: true, message: 'Crew deactivated' });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to deactivate crew' });
      }
    },
  );

  // POST /api/v1/crews/:id/members
  server.post(
    '/api/v1/crews/:id/members',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Crew not found' });
      const parsed = AddCrewMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid member', details: parsed.error.errors });
      }
      const data = parsed.data;
      try {
        const member = await withTenantTx(prisma, tenantId, async (tx) => {
          const crew = await tx.crew.findUnique({ where: { id } });
          if (!crew) throw { status: 404, message: 'Crew not found' };
          const m = await tx.crewMember.create({
            data: {
              tenant_id: tenantId,
              crew_id: id,
              name: data.name,
              trade: data.trade ?? null,
              phone: data.phone ?? null,
              daily_rate_kes: data.dailyRateKes ? toDecimal(data.dailyRateKes) : null,
            },
          });
          await recordAuditLog(tx, {
            tenantId, projectId: crew.project_id ?? undefined, actorId: sub,
            action: 'CREW_MEMBER_ADDED', entityType: 'CrewMember', entityId: m.id,
            changes: { crewId: id, name: data.name },
          });
          return m;
        });
        return reply.status(201).send({ data: member });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to add member' });
      }
    },
  );

  // DELETE /api/v1/crews/:id/members/:memberId
  server.delete(
    '/api/v1/crews/:id/members/:memberId',
    { preHandler: [server.authenticate, requirePermission(Permissions.SITE_DIARY_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id, memberId } = request.params as { id: string; memberId: string };
      if (!UUID_REGEX.test(id) || !UUID_REGEX.test(memberId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Crew or member not found' });
      }
      try {
        await withTenantTx(prisma, tenantId, async (tx) => {
          const member = await tx.crewMember.findFirst({ where: { id: memberId, crew_id: id } });
          if (!member) throw { status: 404, message: 'Member not found' };
          await tx.crewMember.delete({ where: { id: memberId } });
          await recordAuditLog(tx, {
            tenantId, actorId: sub,
            action: 'CREW_MEMBER_REMOVED', entityType: 'CrewMember', entityId: memberId,
            changes: { crewId: id, name: member.name },
          });
        });
        return reply.status(200).send({ success: true, message: 'Member removed' });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to remove member' });
      }
    },
  );
};
