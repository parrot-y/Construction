import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { listParams, listPage } from '../lib/pagination';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import {
  CreateAnnouncementSchema,
  UpdateAnnouncementSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gate-5 G5-1: Announcements with audience targeting + read receipts.
 * Visibility rule: PUBLISHED + not expired + audience match.
 *  - ALL: everyone in tenant
 *  - INTERNAL: non-CLIENT roles
 *  - CLIENTS: CLIENT role only
 *  - FIELD_TEAM: SITE_SUPERVISOR + field roles
 *  - targetRoles (optional): explicit role list narrows further.
 */

function isVisibleTo(ann: any, userRole: string): boolean {
  if (ann.audience === 'CLIENTS' && userRole !== 'CLIENT') return false;
  if (ann.audience === 'INTERNAL' && userRole === 'CLIENT') return false;
  if (ann.audience === 'FIELD_TEAM' && !['SITE_SUPERVISOR', 'SITE_MANAGER', 'FOREMAN'].includes(userRole)) return false;
  if (ann.target_roles?.length && !ann.target_roles.includes(userRole)) return false;
  return true;
}

function format(a: any, readCount?: number, readByMe?: boolean) {
  return {
    ...a,
    published_at: a.published_at?.toISOString() ?? null,
    expires_at: a.expires_at?.toISOString() ?? null,
    created_at: a.created_at?.toISOString() ?? null,
    ...(readCount !== undefined ? { read_count: readCount, read_by_me: readByMe } : {}),
  };
}

export const announcementsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/announcements — visible to caller
  server.get(
    '/api/v1/announcements',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.query as { projectId?: string };
      const pg = listParams(request);

      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const rows = await tx.announcement.findMany({
            where: {
              status: 'PUBLISHED',
              ...(projectId && UUID_REGEX.test(projectId) ? { project_id: projectId } : {}),
              OR: [
                { expires_at: null },
                { expires_at: { gt: new Date() } },
              ],
            },
            include: {
              reads: { where: { user_id: sub }, select: { user_id: true } },
              _count: { select: { reads: true } },
            },
            orderBy: [{ published_at: 'desc' }, { created_at: 'desc' }],
          });

          return rows
            .filter((a) => isVisibleTo(a, role))
            .map((a) => format(a, a._count.reads, a.reads.length > 0));
        });
        const paged = listPage(data, pg);
        return reply.status(200).send({ data: paged.data, page: paged.page, count: paged.data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list announcements' });
      }
    },
  );

  // POST /api/v1/announcements
  server.post(
    '/api/v1/announcements',
    { preHandler: [server.authenticate, requirePermission(Permissions.ANNOUNCEMENT_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateAnnouncementSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid announcement', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }
          const ann = await tx.announcement.create({
            data: {
              tenant_id: tenantId,
              project_id: data.projectId ?? null,
              title: data.title,
              body: data.body,
              priority: data.priority,
              audience: data.audience,
              target_roles: data.targetRoles ?? [],
              status: data.status,
              published_at: data.status === 'PUBLISHED' ? new Date() : null,
              expires_at: data.expiresAt ? new Date(data.expiresAt) : null,
              created_by_id: sub,
            },
          });
          await recordAuditLog(tx, {
            tenantId,
            projectId: data.projectId ?? undefined,
            actorId: sub,
            action: 'ANNOUNCEMENT_CREATED',
            entityType: 'Announcement',
            entityId: ann.id,
            changes: { title: data.title, audience: data.audience, priority: data.priority, status: data.status },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return ann;
        });
        return reply.status(201).send({ data: format(created) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create announcement' });
      }
    },
  );

  // PATCH /api/v1/announcements/:id
  server.patch(
    '/api/v1/announcements/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.ANNOUNCEMENT_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Announcement not found' });
      }
      const parsed = UpdateAnnouncementSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid update', details: parsed.error.errors });
      }
      const data = parsed.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const ann = await tx.announcement.findUnique({ where: { id } });
          if (!ann) throw { status: 404, message: 'Announcement not found' };
          if (ann.status === 'ARCHIVED') throw { status: 400, message: 'Cannot modify an archived announcement' };

          const result = await tx.announcement.update({
            where: { id },
            data: {
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.body !== undefined ? { body: data.body } : {}),
              ...(data.priority !== undefined ? { priority: data.priority } : {}),
              ...(data.audience !== undefined ? { audience: data.audience } : {}),
              ...(data.targetRoles !== undefined ? { target_roles: data.targetRoles } : {}),
              ...(data.status !== undefined
                ? {
                    status: data.status,
                    published_at: data.status === 'PUBLISHED' && !ann.published_at ? new Date() : ann.published_at,
                  }
                : {}),
              ...(data.expiresAt !== undefined ? { expires_at: data.expiresAt === null ? null : new Date(data.expiresAt) } : {}),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId: ann.project_id ?? undefined,
            actorId: sub,
            action: 'ANNOUNCEMENT_UPDATED',
            entityType: 'Announcement',
            entityId: id,
            changes: { fields: Object.keys(data), status: result.status },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return result;
        });
        return reply.status(200).send({ data: format(updated) });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update announcement' });
      }
    },
  );

  // POST /api/v1/announcements/:id/read — any authenticated user marks read
  server.post(
    '/api/v1/announcements/:id/read',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Announcement not found' });
      }
      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const ann = await tx.announcement.findFirst({
            where: { id, status: 'PUBLISHED' },
            include: { reads: { where: { user_id: sub } } },
          });
          if (!ann) throw { status: 404, message: 'Announcement not found' };
          if (ann.reads.length > 0) return { alreadyRead: true };

          await tx.announcementRead.create({
            data: { tenant_id: tenantId, announcement_id: id, user_id: sub },
          });
          await recordAuditLog(tx, {
            tenantId,
            projectId: ann.project_id ?? undefined,
            actorId: sub,
            action: 'ANNOUNCEMENT_READ',
            entityType: 'Announcement',
            entityId: id,
            changes: {},
          });
          return { alreadyRead: false };
        });
        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to mark read' });
      }
    },
  );

  // GET /api/v1/announcements/:id/readers — read receipts (manage perm)
  server.get(
    '/api/v1/announcements/:id/readers',
    { preHandler: [server.authenticate, requirePermission(Permissions.ANNOUNCEMENT_MANAGE)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      const pg = listParams(request);
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Announcement not found' });
      }
      try {
        const readers = await withTenantTx(prisma, tenantId, async (tx) => {
          const ann = await tx.announcement.findUnique({ where: { id }, select: { id: true } });
          if (!ann) throw { status: 404, message: 'Announcement not found' };
          return tx.announcementRead.findMany({
            where: { announcement_id: id },
            include: { announcement: { select: { id: true } } },
            orderBy: { read_at: 'asc' },
            skip: pg.skip,
            take: pg.limit + 1,
          });
        });
        // Resolve reader names
        const userIds = readers.map((r: any) => r.user_id);
        const users = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, full_name: true, email: true } }),
        );
        const map = new Map(users.map((u) => [u.id, u]));
        const pagedReaders = listPage(readers.map((r: any) => ({
          user_id: r.user_id,
          read_at: r.read_at.toISOString(),
          user: map.get(r.user_id) ?? null,
        })), pg);
        return reply.status(200).send({ data: pagedReaders.data, page: pagedReaders.page });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list readers' });
      }
    },
  );
};
