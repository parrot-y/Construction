import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { sendTransactionalEmail } from '../lib/email';
import { randomUUID } from 'node:crypto';

/**
 * F1: "Report a problem" — any authenticated user can file a report from
 * any screen. Captures route, user, tenant, app version and the last
 * Sentry event id, writes an audit entry, and emails the operator inbox
 * (OPERATOR_INBOX env; simulated driver honestly reports simulated).
 */
export const problemReportRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post('/api/v1/problem-reports', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { tenantId, sub } = request.user;
    const body = (request.body ?? {}) as {
      route?: string;
      description?: string;
      appVersion?: string;
      lastSentryEventId?: string;
    };
    const route = String(body.route ?? '').slice(0, 500);
    const description = String(body.description ?? '').slice(0, 4000);
    const appVersion = String(body.appVersion ?? 'unknown').slice(0, 60);
    const lastSentryEventId = String(body.lastSentryEventId ?? '').slice(0, 64) || null;
    if (!route && !description) {
      return reply.status(400).send({ error: 'Bad Request', message: 'route or description required' });
    }

    const reportId = randomUUID();
    const receivedAt = new Date().toISOString();

    // Persist as an audit entry (append-only trail) inside the tenant tx.
    await withTenantTx(prisma, tenantId, async (tx) => {
      await recordAuditLog(tx, {
        tenantId,
        actorId: sub,
        action: 'PROBLEM_REPORT',
        entityType: 'ProblemReport',
        entityId: reportId,
        projectId: null,
        changes: { route, appVersion, lastSentryEventId, description: description.slice(0, 500) },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    });

    const inbox = process.env.OPERATOR_INBOX;
    let email: { sent: boolean; simulated: boolean; provider: string } | null = null;
    if (inbox) {
      const result = await sendTransactionalEmail({
        to: inbox,
        subject: `[SiteSafi] Problem report ${reportId.slice(0, 8)} — ${route || 'unknown route'}`,
        text: [
          `Report ID: ${reportId}`,
          `Received: ${receivedAt}`,
          `Tenant: ${tenantId}`,
          `User: ${sub}`,
          `Route: ${route}`,
          `App version: ${appVersion}`,
          `Last Sentry event: ${lastSentryEventId ?? 'none'}`,
          `IP: ${request.ip}`,
          '',
          description || '(no description)',
        ].join('\n'),
      });
      email = { sent: result.ok, simulated: result.simulated, provider: result.provider };
    }

    return reply.status(201).send({
      data: {
        reportId,
        receivedAt,
        emailed: email?.sent === true,
        emailSimulated: email?.simulated ?? null,
        emailConfigured: Boolean(inbox),
      },
    });
  });
};
