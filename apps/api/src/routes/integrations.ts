import type { FastifyPluginAsync } from 'fastify';
import { hasPermission, Permissions, Role } from '@construction/permissions';
import { prisma, withTenantTx } from '@construction/db';
import { integrationStatuses, dispatchNotification } from '../integrations/messaging';
import { recordMessageDelivery } from '../lib/messageDeliveries';
import { listParams, listPage } from '../lib/pagination';

function canManageIntegrations(role: string): boolean {
  return hasPermission(role as Role, Permissions.COMPANY_MANAGE) || role === 'ADMIN';
}

export const integrationRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/integrations/status — provider configuration status (no secrets)
  server.get(
    '/api/v1/integrations/status',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { role } = request.user;
      if (!canManageIntegrations(role)) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const proto = request.protocol;
      const host = request.hostname;
      return reply.send({ integrations: integrationStatuses(`${proto}://${host}`) });
    },
  );

  // POST /api/v1/integrations/test — send a test message to verify a provider
  server.post(
    '/api/v1/integrations/test',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { role, tenantId } = request.user;
      if (!canManageIntegrations(role)) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const body = (request.body || {}) as { channel?: string; to?: string; message?: string };
      const channel = (body.channel || '').toUpperCase();
      if (!['SMS', 'WHATSAPP', 'EMAIL'].includes(channel) || !body.to) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'channel (SMS|WHATSAPP|EMAIL) and to are required' });
      }
      const result = await dispatchNotification({
        channel: channel as 'SMS' | 'WHATSAPP' | 'EMAIL',
        to: body.to,
        subject: 'Integration test',
        body: body.message || `Test notification from ${tenantId} — provider check.`,
      });
      await recordMessageDelivery(tenantId, {
        channel: channel as 'SMS' | 'WHATSAPP' | 'EMAIL',
        to: body.to,
        subject: 'Integration test',
        body: body.message || `Test notification from ${tenantId} — provider check.`,
        source: 'integration-test',
      }, result);
      return reply.send({ ...result });
    },
  );

  // GET /api/v1/message-deliveries — durable outbound-message log (P5.7).
  // Admin-only: rows expose masked recipients and provider internals.
  server.get(
    '/api/v1/message-deliveries',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { role, tenantId } = request.user;
      if (!canManageIntegrations(role)) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const { channel, status } = request.query as { channel?: string; status?: string };
      const pg = listParams(request);
      try {
        const rows = await withTenantTx(prisma, tenantId, (tx) =>
          tx.messageDelivery.findMany({
            where: {
              tenant_id: tenantId,
              ...(channel ? { channel: channel.toUpperCase() } : {}),
              ...(status ? { status: status.toUpperCase() } : {}),
            },
            orderBy: { created_at: 'desc' },
            take: 500,
          }),
        );
        const data = rows.map((r: any) => ({
          id: r.id,
          channel: r.channel,
          provider: r.provider,
          recipientMasked: r.recipient_masked,
          subject: r.subject,
          bodyExcerpt: r.body_excerpt,
          status: r.status,
          providerReference: r.provider_reference,
          errorMessage: r.error_message,
          source: r.source,
          createdAt: r.created_at.toISOString(),
          sentAt: r.sent_at ? r.sent_at.toISOString() : null,
        }));
        const paged = listPage(data, pg);
        return reply.send({ data: paged.data, page: paged.page });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load message deliveries' });
      }
    },
  );
};
