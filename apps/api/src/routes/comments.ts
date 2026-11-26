import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { CreateEntityCommentSchema } from '@construction/validation';
import { requirePermission } from '../plugins/rbac';
import { Permissions } from '@construction/permissions';
import { publishInboxEvent } from '../lib/inboxEvents';

/**
 * P5.6 — polymorphic comments + @mentions.
 *
 * GET/POST /api/v1/comments?entityType=&entityId= (POST takes the same query
 * params with a JSON body {body}). Entities are resolved through a whitelist
 * so a comment can never attach to an arbitrary table; RLS scopes every read
 * and write to the caller's tenant.
 *
 * `@mention` tokens in the body are resolved against tenant members (email,
 * email prefix, or exact full name). Each mentioned member — except the
 * author — gets a direct InboxMessage (recipient_id) plus the usual SSE
 * hint, so the mention arrives live like any other notification.
 */

const ENTITY_MODELS: Record<string, { delegate: string; label: string }> = {
  SITE_DIARY: { delegate: 'siteDiary', label: 'site diary' },
  SNAG_ITEM: { delegate: 'snagItem', label: 'snag' },
  INVOICE: { delegate: 'invoice', label: 'invoice' },
  RFI: { delegate: 'rFI', label: 'RFI' },
  SITE_OBSERVATION: { delegate: 'siteObservation', label: 'observation' },
  VARIATION_ORDER: { delegate: 'variationOrder', label: 'variation' },
  QUOTE: { delegate: 'quote', label: 'quote' },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "@Jane Doe", "@jane", "@jane.doe@firm.co" — captures up to three
// space-separated segments; every word-prefix is a candidate so
// "@supervisor please confirm" still resolves "@supervisor".
const MENTION_RE = /@([A-Za-z0-9][A-Za-z0-9._-]*(?: [A-Za-z0-9][A-Za-z0-9._-]*){0,2})/g;

function mentionTokens(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    const words = (m[1] ?? '').trim().toLowerCase().split(/\s+/).map((w) => w.replace(/[.,;:!?)\]]+$/, ''));
    for (let i = words.length; i >= 1; i--) {
      const candidate = words.slice(0, i).join(' ');
      if (candidate) out.add(candidate);
    }
  }
  return [...out];
}

async function resolveEntity(tx: any, entityType: string, entityId: string) {
  const spec = ENTITY_MODELS[entityType];
  if (!spec) return null;
  const delegate = tx[spec.delegate];
  if (!delegate?.findFirst) return null;
  return delegate.findFirst({
    where: { id: entityId },
    select: { id: true, project_id: true },
  });
}

export const commentRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/comments?entityType=&entityId= — oldest first (thread order)
  server.get(
    '/api/v1/comments',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { entityType, entityId } = request.query as { entityType?: string; entityId?: string };
      if (!entityType || !ENTITY_MODELS[entityType] || !entityId || !UUID_REGEX.test(entityId)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'entityType and entityId are required' });
      }
      try {
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const entity = await resolveEntity(tx, entityType, entityId);
          if (!entity) throw { status: 404, message: 'Entity not found' };
          const comments = await tx.entityComment.findMany({
            where: { tenant_id: tenantId, entity_type: entityType, entity_id: entityId },
            orderBy: { created_at: 'asc' },
            take: 200,
          });
          return comments.map((c: any) => ({
            id: c.id,
            entityType: c.entity_type,
            entityId: c.entity_id,
            projectId: c.project_id,
            authorId: c.author_id,
            authorName: c.author_name,
            body: c.body,
            mentions: c.mentions ?? [],
            createdAt: c.created_at.toISOString(),
          }));
        });
        return reply.status(200).send({ data });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Not Found', message: err.message });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load comments' });
      }
    },
  );

  // POST /api/v1/comments?entityType=&entityId= — add a comment
  server.post(
    '/api/v1/comments',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_VIEW)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { entityType, entityId } = request.query as { entityType?: string; entityId?: string };
      const parsed = CreateEntityCommentSchema.safeParse({ ...(request.body as object), entityType, entityId });
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid comment',
          details: parsed.error.flatten(),
        });
      }
      const data = parsed.data;
      const authorName = (request.user as any).full_name || (request.user as any).email || 'Team member';

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const entity = await resolveEntity(tx, data.entityType, data.entityId);
          if (!entity) throw { status: 404, message: 'Entity not found' };

          // Resolve @mentions against tenant members — email, email prefix,
          // or exact full name (case-insensitive). Author can never mention
          // themselves into a notification.
          const tokens = mentionTokens(data.body);
          const mentionedIds: string[] = [];
          if (tokens.length > 0) {
            const memberships = await tx.membership.findMany({
              where: { tenant_id: tenantId },
              include: { user: { select: { id: true, full_name: true, email: true } } },
            });
            const matched = new Set<string>();
            for (const mb of memberships as any[]) {
              const u = mb.user;
              if (!u || u.id === sub) continue;
              const email = String(u.email || '').toLowerCase();
              const name = String(u.full_name || '').toLowerCase();
              const prefix = email.split('@')[0] || '';
              const hit = tokens.some((t) =>
                t === email || t === prefix || (name && t === name),
              );
              if (hit) matched.add(u.id);
            }
            mentionedIds.push(...matched);
          }

          const comment = await tx.entityComment.create({
            data: {
              tenant_id: tenantId,
              entity_type: data.entityType,
              entity_id: data.entityId,
              project_id: entity.project_id ?? null,
              author_id: sub,
              author_name: authorName,
              body: data.body,
              mentions: mentionedIds,
            },
          });

          // Direct inbox delivery per mention — same tx, same commit, same
          // SSE hint path as every other notification.
          const label = ENTITY_MODELS[data.entityType]?.label ?? 'record';
          const excerpt = data.body.length > 140 ? `${data.body.slice(0, 140)}…` : data.body;
          for (const uid of mentionedIds) {
            const msg = await tx.inboxMessage.create({
              data: {
                tenant_id: tenantId,
                project_id: entity.project_id ?? null,
                sender_id: sub,
                sender_name: authorName,
                body: `${authorName} mentioned you in a comment on a ${label}: "${excerpt}"`,
                audience: 'USER',
                recipient_id: uid,
              },
            });
            await publishInboxEvent(tx, { tenantId, messageId: msg.id, senderId: sub });
          }

          return {
            id: comment.id,
            entityType: comment.entity_type,
            entityId: comment.entity_id,
            projectId: comment.project_id,
            authorId: comment.author_id,
            authorName: comment.author_name,
            body: comment.body,
            mentions: comment.mentions ?? [],
            createdAt: comment.created_at.toISOString(),
            notifiedCount: mentionedIds.length,
          };
        });
        return reply.status(201).send({ statusCode: 201, data: created });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Not Found', message: err.message });
        }
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to post comment' });
      }
    },
  );
};
