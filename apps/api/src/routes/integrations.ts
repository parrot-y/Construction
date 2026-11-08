import type { FastifyPluginAsync } from 'fastify';
import { hasPermission, Permissions, Role } from '@construction/permissions';
import { integrationStatuses, dispatchNotification } from '../integrations/messaging';

export const integrationRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/integrations/status — provider configuration status (no secrets)
  server.get(
    '/api/v1/integrations/status',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { role } = request.user;
      if (!hasPermission(role as Role, Permissions.COMPANY_MANAGE) && role !== 'ADMIN') {
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
      if (!hasPermission(role as Role, Permissions.COMPANY_MANAGE) && role !== 'ADMIN') {
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
      return reply.send({ ...result });
    },
  );
};
