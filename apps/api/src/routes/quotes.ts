import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toCurrencyString } from '@construction/money';
import {
  CreateQuoteSchema,
  UpdateQuoteSchema,
  SendQuoteSchema,
  PublicQuoteRespondSchema,
  ConvertQuoteSchema,
} from '@construction/validation';
import { requirePermission } from '../plugins/rbac';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function computeTotals(subtotal: number, taxPct: number, depositPct: number) {
  const taxAmount = Math.round(subtotal * (taxPct / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  const depositAmount = Math.round(total * (depositPct / 100) * 100) / 100;
  return { subtotal, taxAmount, total, depositAmount };
}

function formatQuote(q: any) {
  if (!q) return null;
  const { share_token_hash: _shareTokenHash, ...rest } = q;
  return {
    ...rest,
    subtotal: toCurrencyString(q.subtotal ? q.subtotal.toString() : '0'),
    tax_pct: q.tax_pct ? q.tax_pct.toString() : '0',
    tax_amount: toCurrencyString(q.tax_amount ? q.tax_amount.toString() : '0'),
    total: toCurrencyString(q.total ? q.total.toString() : '0'),
    deposit_pct: q.deposit_pct ? q.deposit_pct.toString() : '0',
    deposit_amount: toCurrencyString(q.deposit_amount ? q.deposit_amount.toString() : '0'),
    items: q.items
      ? q.items.map((i: any) => ({
          ...i,
          quantity: i.quantity ? i.quantity.toString() : '0',
          unit_rate: i.unit_rate ? i.unit_rate.toString() : '0',
          total_amount: toCurrencyString(i.total_amount ? i.total_amount.toString() : '0'),
        }))
      : [],
  };
}

/**
 * Resolves a public quote share token to { id, tenant_id } via the narrow
 * SECURITY DEFINER lookup_quote_by_share_hash function (SHA-256, fail-closed).
 */
async function resolveQuoteLink(token: string) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }
  const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM lookup_quote_by_share_hash(${tokenHash}::text);
  `;
  return rows.length > 0 ? rows[0] : null;
}

async function addQuoteEvent(
  tx: any,
  tenantId: string,
  quoteId: string,
  actorType: string,
  event: string,
  actorName?: string | null,
  note?: string | null,
) {
  await tx.quoteEvent.create({
    data: {
      tenant_id: tenantId,
      quote_id: quoteId,
      actor_type: actorType,
      actor_name: actorName ?? null,
      event,
      note: note ?? null,
    },
  });
}

export const quotesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // GET /api/v1/quotes - List quotes (contractor)
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/quotes',
    { preHandler: [server.authenticate, requirePermission(Permissions.QUOTE_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { status, projectId, q } = request.query as Record<string, string | undefined>;

      const quotes = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.quote.findMany({
          where: {
            ...(status ? { status: status.toUpperCase() } : {}),
            ...(projectId && UUID_REGEX.test(projectId) ? { project_id: projectId } : {}),
            ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
          },
          include: { items: true, project: { select: { id: true, name: true, code: true } } },
          orderBy: { quote_no: 'desc' },
        });
      });

      return reply.send({ quotes: quotes.map(formatQuote) });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/quotes - Create quote with line items
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/quotes',
    { preHandler: [server.authenticate, requirePermission(Permissions.QUOTE_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = CreateQuoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }
      const data = parsed.data;

      if (data.projectId && !UUID_REGEX.test(data.projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const quote = await withTenantTx(prisma, tenantId, async (tx) => {
          if (data.projectId) {
            const project = await tx.project.findFirst({ where: { id: data.projectId } });
            if (!project) throw { status: 404, message: 'Project not found' };
          }

          const maxNo = await tx.quote.aggregate({
            where: { tenant_id: tenantId },
            _max: { quote_no: true },
          });
          const quoteNo = (maxNo._max.quote_no ?? 0) + 1;

          const subtotal = data.items.reduce((sum, it) => sum + it.quantity * it.unitRate, 0);
          const totals = computeTotals(subtotal, data.taxPct, data.depositPct);
          const validUntil = data.validDays
            ? new Date(Date.now() + data.validDays * 86400000)
            : null;

          const created = await tx.quote.create({
            data: {
              tenant_id: tenantId,
              quote_no: quoteNo,
              title: data.title,
              client_name: data.clientName,
              client_email: data.clientEmail ?? null,
              client_phone: data.clientPhone ?? null,
              site_location: data.siteLocation ?? null,
              project_id: data.projectId ?? null,
              currency: data.currency,
              status: 'DRAFT',
              subtotal: totals.subtotal,
              tax_pct: data.taxPct,
              tax_amount: totals.taxAmount,
              total: totals.total,
              deposit_pct: data.depositPct,
              deposit_amount: totals.depositAmount,
              terms: data.terms ?? null,
              scope_notes: data.scopeNotes ?? null,
              valid_until: validUntil,
              created_by: sub,
              items: {
                create: data.items.map((it, idx) => ({
                  tenant_id: tenantId,
                  section: it.section ?? null,
                  description: it.description,
                  unit: it.unit,
                  quantity: it.quantity,
                  unit_rate: it.unitRate,
                  total_amount: Math.round(it.quantity * it.unitRate * 100) / 100,
                  sort_order: idx,
                })),
              },
            },
            include: { items: true },
          });

          await addQuoteEvent(tx, tenantId, created.id, 'STAFF', 'CREATED', sub, `Quote Q-${String(quoteNo).padStart(4, '0')} created`);
          await recordAuditLog(tx, {
            tenantId,
            projectId: data.projectId ?? null,
            actorId: sub,
            action: 'QUOTE_CREATED',
            entityType: 'Quote',
            entityId: created.id,
            changes: { quoteNo, title: data.title, total: totals.total },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return created;
        });

        return reply.status(201).send({ quote: formatQuote(quote) });
      } catch (err: any) {
        if (err?.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/quotes/:id - Quote detail
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/quotes/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.QUOTE_VIEW)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote not found' });
      }
      const quote = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.quote.findFirst({
          where: { id },
          include: {
            items: { orderBy: { sort_order: 'asc' } },
            events: { orderBy: { created_at: 'asc' } },
            project: { select: { id: true, name: true, code: true } },
          },
        });
      });
      if (!quote) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote not found' });
      return reply.send({ quote: formatQuote(quote) });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /api/v1/quotes/:id - Edit draft quote
  // -------------------------------------------------------------------------
  server.patch(
    '/api/v1/quotes/:id',
    { preHandler: [server.authenticate, requirePermission(Permissions.QUOTE_EDIT)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote not found' });
      }
      const parsed = UpdateQuoteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }
      const data = parsed.data;

      try {
        const quote = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.quote.findFirst({ where: { id } });
          if (!existing) throw { status: 404, message: 'Quote not found' };
          if (existing.status !== 'DRAFT') {
            throw { status: 409, message: `Cannot edit a quote in status ${existing.status}` };
          }

          if (data.items) {
            await tx.quoteLineItem.deleteMany({ where: { quote_id: id } });
          }

          const items = data.items ?? [];
          const itemSource = items.length
            ? items
            : (await tx.quoteLineItem.findMany({ where: { quote_id: id } })).map((i: any) => ({
                section: i.section,
                description: i.description,
                unit: i.unit as any,
                quantity: Number(i.quantity),
                unitRate: Number(i.unit_rate),
              }));
          const subtotal = itemSource.reduce((sum, it) => sum + it.quantity * it.unitRate, 0);
          const taxPct = data.taxPct ?? Number(existing.tax_pct);
          const depositPct = data.depositPct ?? Number(existing.deposit_pct);
          const totals = computeTotals(subtotal, taxPct, depositPct);

          const updated = await tx.quote.update({
            where: { id },
            data: {
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.clientName !== undefined ? { client_name: data.clientName } : {}),
              ...(data.clientEmail !== undefined ? { client_email: data.clientEmail } : {}),
              ...(data.clientPhone !== undefined ? { client_phone: data.clientPhone } : {}),
              ...(data.siteLocation !== undefined ? { site_location: data.siteLocation } : {}),
              ...(data.projectId !== undefined ? { project_id: data.projectId } : {}),
              ...(data.currency !== undefined ? { currency: data.currency } : {}),
              ...(data.terms !== undefined ? { terms: data.terms } : {}),
              ...(data.scopeNotes !== undefined ? { scope_notes: data.scopeNotes } : {}),
              ...(data.validDays !== undefined
                ? { valid_until: data.validDays ? new Date(Date.now() + data.validDays * 86400000) : null }
                : {}),
              subtotal: totals.subtotal,
              tax_pct: taxPct,
              tax_amount: totals.taxAmount,
              total: totals.total,
              deposit_pct: depositPct,
              deposit_amount: totals.depositAmount,
              ...(data.items
                ? {
                    items: {
                      create: data.items.map((it, idx) => ({
                        tenant_id: tenantId,
                        section: it.section ?? null,
                        description: it.description,
                        unit: it.unit,
                        quantity: it.quantity,
                        unit_rate: it.unitRate,
                        total_amount: Math.round(it.quantity * it.unitRate * 100) / 100,
                        sort_order: idx,
                      })),
                    },
                  }
                : {}),
            },
            include: { items: true },
          });

          await addQuoteEvent(tx, tenantId, id, 'STAFF', 'UPDATED', sub);
          await recordAuditLog(tx, {
            tenantId,
            projectId: existing.project_id,
            actorId: sub,
            action: 'QUOTE_UPDATED',
            entityType: 'Quote',
            entityId: id,
            changes: { fields: Object.keys(data) },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return updated;
        });

        return reply.send({ quote: formatQuote(quote) });
      } catch (err: any) {
        if (err?.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/quotes/:id/send - Mark sent + issue share token
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/quotes/:id/send',
    { preHandler: [server.authenticate, requirePermission(Permissions.QUOTE_SEND)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote not found' });
      }
      const parsed = SendQuoteSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }

      try {
        const quote = await withTenantTx(prisma, tenantId, async (tx) => {
          const existing = await tx.quote.findFirst({ where: { id } });
          if (!existing) throw { status: 404, message: 'Quote not found' };
          if (existing.status !== 'DRAFT' && existing.status !== 'SENT') {
            throw { status: 409, message: `Cannot send a quote in status ${existing.status}` };
          }

          // Rotate the share token on every send: raw token is shown once and only
          // its SHA-256 hash is persisted, so re-sending invalidates older links.
          const rawToken = randomBytes(24).toString('base64url');
          const tokenHash = createHash('sha256').update(rawToken).digest('hex');
          const updated = await tx.quote.update({
            where: { id },
            data: { status: 'SENT', share_token_hash: tokenHash },
            include: { items: true },
          });
          await addQuoteEvent(tx, tenantId, id, 'STAFF', 'SENT', sub, `Sent via ${parsed.data.channel}`);
          await recordAuditLog(tx, {
            tenantId,
            projectId: existing.project_id,
            actorId: sub,
            action: 'QUOTE_SENT',
            entityType: 'Quote',
            entityId: id,
            changes: { channel: parsed.data.channel },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });
          return { quote: updated, rawToken };
        });

        return reply.send({
          quote: formatQuote(quote.quote),
          shareToken: quote.rawToken,
          shareUrl: `/public/quotes/${quote.rawToken}`,
        });
      } catch (err: any) {
        if (err?.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/quotes/:id/convert - Accepted quote -> project (+deposit invoice flag)
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/quotes/:id/convert',
    { preHandler: [server.authenticate, requirePermission(Permissions.PROJECT_CREATE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote not found' });
      }
      const parsed = ConvertQuoteSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
      }
      const data = parsed.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const quote = await tx.quote.findFirst({ where: { id }, include: { items: true } });
          if (!quote) throw { status: 404, message: 'Quote not found' };
          if (quote.status !== 'ACCEPTED') {
            throw { status: 409, message: `Only ACCEPTED quotes can be converted (current: ${quote.status})` };
          }
          if (quote.converted_project_id) {
            throw { status: 409, message: 'Quote already converted to a project' };
          }

          const projectCode =
            data.projectCode ??
            `PRJ-${String(quote.quote_no).padStart(4, '0')}`;

          const project = await tx.project.create({
            data: {
              tenant_id: tenantId,
              name: data.projectName ?? quote.title,
              code: projectCode,
              description: quote.scope_notes ?? `Converted from quote Q-${String(quote.quote_no).padStart(4, '0')}`,
              location: quote.site_location ?? null,
              status: 'PLANNING',
              original_contract_sum: Number(quote.total),
              current_approved_budget: Number(quote.total),
            },
          });

          const convertedQuote = await tx.quote.update({
            where: { id },
            data: {
              status: 'CONVERTED',
              converted_project_id: project.id,
            },
            include: { items: true },
          });

          await addQuoteEvent(tx, tenantId, id, 'STAFF', 'CONVERTED', sub, `Converted to project ${project.code}`);
          await recordAuditLog(tx, {
            tenantId,
            projectId: project.id,
            actorId: sub,
            action: 'QUOTE_CONVERTED',
            entityType: 'Quote',
            entityId: id,
            changes: { projectId: project.id, projectCode: project.code, total: quote.total.toString() },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return { project, quote: convertedQuote };
        });

        return reply.status(201).send({
          project: { id: result.project.id, name: result.project.name, code: result.project.code },
          quote: formatQuote(result.quote),
        });
      } catch (err: any) {
        if (err?.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        if (err?.code === 'P2002') {
          return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Project code already exists in this tenant' });
        }
        throw err;
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/client/quotes - Client portal: quotes addressed to my email
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/client/quotes',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      if (role !== 'CLIENT') {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Client role required' });
      }

      const user = await prisma.user.findUnique({ where: { id: sub }, select: { email: true } });
      if (!user?.email) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      const quotes = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.quote.findMany({
          where: {
            client_email: { equals: user.email, mode: 'insensitive' },
            status: { in: ['SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED'] },
          },
          include: {
            items: { orderBy: { sort_order: 'asc' } },
            project: { select: { id: true, name: true, code: true } },
          },
          orderBy: { created_at: 'desc' },
        });
      });

      return reply.send({ quotes: quotes.map(formatQuote) });
    },
  );

  // -------------------------------------------------------------------------
  // PUBLIC: GET /api/public/quotes/:token - View shared quote
  // -------------------------------------------------------------------------
  server.get('/api/public/quotes/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const link = await resolveQuoteLink(token);
    if (!link) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote link is invalid or expired' });
    }

    const quote = await withTenantTx(prisma, link.tenant_id, async (tx) => {
      return tx.quote.findFirst({
        where: { id: link.id },
        include: {
          items: { orderBy: { sort_order: 'asc' } },
          events: { orderBy: { created_at: 'asc' } },
          project: { select: { id: true, name: true, code: true } },
          tenant: { select: { name: true, currency: true } },
        },
      });
    });
    if (!quote) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote link is invalid or expired' });
    }

    // mark viewed (fire-and-forget inside tenant tx)
    try {
      await withTenantTx(prisma, quote.tenant_id, async (tx) => {
        await addQuoteEvent(tx, quote.tenant_id, quote.id, 'CLIENT', 'VIEWED', null, 'Opened shared link');
      });
    } catch {
      // viewing must never fail the read
    }

    return reply.send({ quote: formatQuote(quote), contractor: { name: quote.tenant.name } });
  });

  // -------------------------------------------------------------------------
  // PUBLIC: POST /api/public/quotes/:token/respond - Accept / decline / comment
  // -------------------------------------------------------------------------
  server.post('/api/public/quotes/:token/respond', async (request, reply) => {
    const { token } = request.params as { token: string };
    const parsed = PublicQuoteRespondSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
    }
    const data = parsed.data;

    const link = await resolveQuoteLink(token);
    if (!link) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Quote link is invalid or expired' });
    }

    try {
      const updated = await withTenantTx(prisma, link.tenant_id, async (tx) => {
        const quote = await tx.quote.findFirst({ where: { id: link.id } });
        if (!quote) {
          throw { status: 404, message: 'Quote link is invalid or expired' };
        }
        if (quote.status !== 'SENT') {
          throw { status: 409, message: `Quote already ${quote.status.toLowerCase()}` };
        }

        let newStatus = quote.status;
        let respondedBy: string | null = null;
        let responseNote: string | null = null;

        if (data.action === 'accept') {
          if (!data.typedName || data.typedName.trim().length < 2) {
            throw { status: 400, message: 'Typing your full name is required to accept this quote' };
          }
          newStatus = 'ACCEPTED';
          respondedBy = data.typedName.trim();
          responseNote = data.note ?? null;
        } else if (data.action === 'decline') {
          newStatus = 'DECLINED';
          respondedBy = data.typedName?.trim() || null;
          responseNote = data.note ?? null;
        }

        const result = await tx.quote.update({
          where: { id: quote.id },
          data: {
            status: newStatus,
            responded_at: newStatus !== 'SENT' ? new Date() : quote.responded_at,
            responded_by: respondedBy ?? quote.responded_by,
            response_note: responseNote ?? quote.response_note,
          },
          include: { items: true },
        });

        const eventName = data.action === 'accept' ? 'ACCEPTED' : data.action === 'decline' ? 'DECLINED' : 'COMMENT';
        await addQuoteEvent(tx, link.tenant_id, quote.id, 'CLIENT', eventName, respondedBy, data.note ?? null);
        await recordAuditLog(tx, {
          tenantId: link.tenant_id,
          projectId: quote.project_id,
          actorId: quote.id, // public client has no user id; the quote's share link is the actor context
          action: `QUOTE_${eventName}`,
          entityType: 'Quote',
          entityId: quote.id,
          changes: { action: data.action, respondedBy },
          ipAddress: request.ip,
          userAgent: (request.headers['user-agent'] as string) || null,
        });
        return result;
      });

      return reply.send({ quote: formatQuote(updated) });
    } catch (err: any) {
      if (err?.status) return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
      throw err;
    }
  });
};
