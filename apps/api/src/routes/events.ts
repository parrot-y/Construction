import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { watchInbox } from '../lib/inboxEvents';

/**
 * P5.5 — Server-Sent Events stream for live inbox notifications.
 *
 * GET /api/v1/events (authenticated). Each event is a bare hint —
 * `event: inbox` with `data: {"t":"<tenantId>","id":"<messageId>"}` — emitted
 * only when the notification's tenant matches the session tenant. Clients
 * refetch /api/v1/inbox (which applies audience/role filtering) rather than
 * trusting event payloads, so nothing leaks across roles or tenants.
 *
 * A `:hb` comment heartbeat every 25s keeps proxies from idling the
 * connection out. The stream ends when the client disconnects.
 */
export const eventRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get(
    '/api/v1/events',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      raw.write(': connected\n\n');

      let unsubscribe: (() => void) | null = null;
      let heartbeat: NodeJS.Timeout | null = null;
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try { raw.end(); } catch { /* socket already gone */ }
      };

      try {
        unsubscribe = await watchInbox((payload) => {
          if (closed || payload.t !== tenantId) return;
          try {
            raw.write(`event: inbox\ndata: ${JSON.stringify(payload)}\n\n`);
          } catch {
            cleanup();
          }
        });
      } catch {
        // Bus unavailable (e.g. no DATABASE_URL for LISTEN) — degrade to a
        // stream that only heartbeats; clients fall back to manual refresh.
        raw.write(`event: degraded\ndata: {}\n\n`);
      }

      heartbeat = setInterval(() => {
        try { raw.write(': hb\n\n'); } catch { cleanup(); }
      }, 25_000);

      request.raw.on('close', cleanup);
    },
  );
};
