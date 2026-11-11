import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { SendInboxMessageSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { Permissions } from '@construction/permissions';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gate-5 G5-3: Team inbox — observed Home > Inbox for field roles.
 * Visibility:
 *  - ALL_MEMBERS: every tenant member
 *  - PROJECT_TEAM: members of the message's project (ProjectMember) + sender
 *  - ROLE: users whose tenant role is in target_roles
 * PROJECT_VIEW required to read/send (all internal roles have it;
 * external portal users never reach this route — they use token portals).
 */

async function visibleWhere(tx: any, tenantId: string, userId: string, role: string) {
  // Fetch candidate messages then filter in JS (audience logic is role/ membership based)
  const messages = await tx.inboxMessage.findMany({
    where: { tenant_id: tenantId },
    include: {
      reads: { where: { user_id: userId }, select: { user_id: true } },
      _count: { select: { reads: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  });

  const myProjectIds = new Set(
    (await tx.projectMember.findMany({ where: { user_id: userId }, select: { project_id: true } })).map((m: any) => m.project_id),
  );

  return messages.filter((m: any) => {
    if (m.sender_id === userId) return true;
    if (m.audience === 'ALL_MEMBERS') return true;
    if (m.audience === 'ROLE') return m.target_roles.includes(role);
    if (m.audience === 'PROJECT_TEAM') {
      // sender always sees own; project members see it; admins/company roles see tenant-wide
      if (['ADMIN', 'COMPANY_ADMIN', 'EXECUTIVE'].includes(role)) return true;
      return m.project_id ? myProjectIds.has(m.project_id) : false;
    }
    return false;
  });
}

function format(m: any) {
  return {
    id: m.id,
    project_id: m.project_id,
    sender_id: m.sender_id,
    sender_name: m.sender_name,
    body: m.body,
    audience: m.audience,
    target_roles: m.target_roles,
    parent_id: m.parent_id,
    created_at: m.created_at.toISOString(),
    read_count: m._count?.reads ?? 0,
    read_by_me: (m.reads?.length ?? 0) > 0,
  };
}

export const inboxRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/inbox — visible messages, newest first
  server.get(
    '/api/v1/inbox',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, unread } = request.query as { projectId?: string; unread?: string };
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          let msgs = await visibleWhere(tx, tenantId, sub, role);
          if (projectId && UUID_REGEX.test(projectId)) msgs = msgs.filter((m: any) => m.project_id === projectId);
          if (unread === 'true') msgs = msgs.filter((m: any) => m.sender_id !== sub && m.reads.length === 0);
          return msgs.map(format);
        });
        return reply.status(200).send({ data, count: data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load inbox' });
      }
    },
  );

  // GET /api/v1/notifications — alias of the inbox feed under the name the
  // auditor contract uses for "in-app notifications for the logged-in user".
  server.get(
    '/api/v1/notifications',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const msgs = await visibleWhere(tx, tenantId, sub, role);
          return msgs.map(format);
        });
        return reply.status(200).send({ data, count: data.length });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load notifications' });
      }
    },
  );

  // POST /api/v1/inbox — send message
  server.post(
    '/api/v1/inbox',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = SendInboxMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid message', details: parsed.error.errors });
      }
      const data = parsed.data;
      const senderName = (request.user as any).full_name || (request.user as any).email || 'Team member';

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }
          if (data.parentId) {
            const parent = await tx.inboxMessage.findFirst({ where: { id: data.parentId, tenant_id: tenantId } });
            if (!parent) throw { status: 404, message: 'Parent message not found' };
          }
          const msg = await tx.inboxMessage.create({
            data: {
              tenant_id: tenantId,
              project_id: data.projectId ?? null,
              sender_id: sub,
              sender_name: senderName,
              body: data.body,
              audience: data.audience,
              target_roles: data.audience === 'ROLE' ? (data.targetRoles ?? []) : [],
              parent_id: data.parentId ?? null,
            },
          });
          await recordAuditLog(tx, {
            tenantId,
            projectId: data.projectId ?? undefined,
            actorId: sub,
            action: 'INBOX_MESSAGE_SENT',
            entityType: 'InboxMessage',
            entityId: msg.id,
            changes: { audience: data.audience, projectId: data.projectId ?? null, replyTo: data.parentId ?? null },
          });
          return msg;
        });
        return reply.status(201).send({ data: { ...format({ ...created, reads: [], _count: { reads: 0 } }) } });
      } catch (err: any) {
        if (err.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to send message' });
      }
    },
  );

  // POST /api/v1/inbox/:id/read
  server.post(
    '/api/v1/inbox/:id/read',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Message not found' });
      }
      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const msg = await tx.inboxMessage.findFirst({
            where: { id, tenant_id: tenantId },
            include: { reads: { where: { user_id: sub } } },
          });
          if (!msg) throw { status: 404, message: 'Message not found' };
          if (msg.reads.length > 0) return { alreadyRead: true };
          await tx.inboxMessageRead.create({ data: { tenant_id: tenantId, message_id: id, user_id: sub } });
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

  // GET /api/v1/inbox/unread-count — badge count
  server.get(
    '/api/v1/inbox/unread-count',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      try {
        const count = await withTenantTx(prisma, tenantId, async (tx) => {
          const msgs = await visibleWhere(tx, tenantId, sub, role);
          return msgs.filter((m: any) => m.sender_id !== sub && m.reads.length === 0).length;
        });
        return reply.status(200).send({ data: { unread: count } });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to count unread' });
      }
    },
  );
};
