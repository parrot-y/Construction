import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { pushConfig } from '../lib/webPush';

/**
 * P6 — web push subscriptions (self-service).
 *
 * GET    /api/v1/push/vapid-key        → { publicKey } for pushManager.subscribe
 * GET    /api/v1/push-subscriptions   → own devices (endpoint never returned —
 *                                       it is a capability URL)
 * POST   /api/v1/push-subscriptions   → upsert { endpoint, keys:{p256dh,auth} }
 * DELETE /api/v1/push-subscriptions/:id → remove own device (404 otherwise)
 *
 * Any authenticated member may manage their own subscriptions; rows are
 * tenant+user scoped and RLS-covered.
 */

const ENDPOINT_RE = /^https:\/\/.{1,990}$/;

export const pushRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get(
    '/api/v1/push/vapid-key',
    { preHandler: [server.authenticate] },
    async (_request, reply) => {
      return reply.send({ data: { publicKey: pushConfig().publicKey } });
    },
  );

  server.get(
    '/api/v1/push-subscriptions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub: userId } = request.user;
      const rows = await withTenantTx(prisma, tenantId, (tx) =>
        tx.pushSubscription.findMany({
          where: { tenant_id: tenantId, user_id: userId },
          orderBy: { last_seen_at: 'desc' },
          select: { id: true, user_agent: true, created_at: true, last_seen_at: true },
        }),
      );
      return reply.send({
        data: rows.map((r) => ({
          id: r.id,
          userAgent: r.user_agent,
          createdAt: r.created_at,
          lastSeenAt: r.last_seen_at,
        })),
      });
    },
  );

  server.post(
    '/api/v1/push-subscriptions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub: userId } = request.user;
      const body = (request.body ?? {}) as {
        endpoint?: unknown;
        keys?: { p256dh?: unknown; auth?: unknown };
      };
      const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
      const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
      const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';

      if (!ENDPOINT_RE.test(endpoint) || !p256dh || !auth) {
        return reply.status(422).send({
          statusCode: 422,
          error: 'Validation Error',
          message: 'A valid https push endpoint and p256dh/auth keys are required.',
        });
      }
      const userAgent = (request.headers['user-agent'] ?? '').slice(0, 500) || null;

      const sub = await withTenantTx(prisma, tenantId, (tx) =>
        tx.pushSubscription.upsert({
          where: { tenant_id_user_id_endpoint: { tenant_id: tenantId, user_id: userId, endpoint } },
          create: { tenant_id: tenantId, user_id: userId, endpoint, p256dh, auth, user_agent: userAgent },
          update: { p256dh, auth, user_agent: userAgent, last_seen_at: new Date() },
          select: { id: true },
        }),
      );
      return reply.status(201).send({ data: { id: sub.id } });
    },
  );

  server.delete(
    '/api/v1/push-subscriptions/:id',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub: userId } = request.user;
      const { id } = request.params as { id: string };
      const deleted = await withTenantTx(prisma, tenantId, (tx) =>
        tx.pushSubscription.deleteMany({ where: { id, tenant_id: tenantId, user_id: userId } }),
      );
      if (deleted.count === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Subscription not found.' });
      }
      return reply.status(204).send();
    },
  );
};
