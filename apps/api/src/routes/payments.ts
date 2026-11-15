import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { prisma, withTenantTx, recordAuditLog } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toDecimal } from '@construction/money';
import { requirePermission } from '../plugins/rbac';
import { recordInvoicePaymentTx } from '../services/invoicePayments';
import { getPaymentProvider } from '../integrations/payments';
import { notifyTeam } from '../lib/notify';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Paystack mobile-money rails cap a single M-Pesa collection at
 * KES 150,000.00 — surface it server-side AND in the UI.
 */
export const MPESA_SINGLE_TRANSACTION_LIMIT_MINOR = 15_000_000; // KES 150,000.00 in cents

interface ProviderChargeRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  invoice_payment_id: string | null;
}

async function lookupCharge(provider: string, reference: string): Promise<ProviderChargeRow | null> {
  const rows = await prisma.$queryRaw<ProviderChargeRow[]>`
    SELECT id, tenant_id, invoice_id, amount_minor, currency, status, invoice_payment_id
    FROM lookup_provider_payment_charge(${provider}::text, ${reference}::text)
  `;
  return rows[0] ?? null;
}

export const paymentRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // POST /api/v1/invoices/:id/paystack/initialize — start an online charge.
  // Contractor-facing: creates a PENDING ProviderPaymentCharge and returns the
  // provider authorization URL. SIMULATED provider → honest 409, no fake link.
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/invoices/:id/paystack/initialize',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.INVOICE_EDIT)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }

      const provider = getPaymentProvider();
      if (!provider.live) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          code: 'PAYMENTS_SIMULATED',
          message: 'Online payments are SIMULATED — no real payment provider is configured. Record the payment manually once received.',
        });
      }

      const invoice = await withTenantTx(prisma, tenantId, async (tx) =>
        tx.invoice.findFirst({
          where: { id },
          select: {
            id: true, status: true, balance_due: true, currency: true,
            client_email: true, client_name: true, invoice_no: true,
          },
        }),
      );
      if (!invoice) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invoice not found' });
      }
      if (invoice.status !== 'SENT' && invoice.status !== 'PART_PAID') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Online payment can only be initiated on SENT or PART_PAID invoices (current: ${invoice.status})`,
        });
      }

      const balance = toDecimal(invoice.balance_due.toString());
      if (balance.lte(0)) {
        return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Invoice has no balance due' });
      }
      const currency = (invoice.currency || 'KES').toUpperCase();

      // Optional partial amount (major units) — lets a client settle a large
      // invoice across several M-Pesa transactions under the per-tx cap.
      const body = (request.body ?? {}) as { amount?: unknown };
      let amountDec = balance;
      if (body.amount !== undefined) {
        const requested = typeof body.amount === 'number' ? body.amount : NaN;
        if (!Number.isFinite(requested)) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'amount must be a number in major units (e.g. 50000.00)' });
        }
        amountDec = toDecimal(requested);
        if (amountDec.lte(0)) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'amount must be greater than zero' });
        }
        if (amountDec.gt(balance)) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `amount exceeds balance due (${balance.toFixed(2)})` });
        }
      }

      // Minor units via Decimal — never float math on money.
      const minorDec = amountDec.times(100);
      if (!minorDec.isInteger() || !minorDec.isFinite()) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'amount must have at most 2 decimal places' });
      }
      const amountMinor = minorDec.toNumber();
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid payment amount' });
      }
      if (currency === 'KES' && amountMinor > MPESA_SINGLE_TRANSACTION_LIMIT_MINOR) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'MPESA_TRANSACTION_LIMIT',
          message: `M-Pesa collections are capped at KES 150,000.00 per transaction — initialize a partial amount (this invoice's balance is KES ${balance.toFixed(2)}) or use bank transfer.`,
        });
      }

      const reference = `ss_${randomBytes(12).toString('hex')}`;
      const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';

      // Persist the charge BEFORE calling the provider so a webhook that
      // arrives early still resolves to a known row.
      const charge = await withTenantTx(prisma, tenantId, async (tx) =>
        tx.providerPaymentCharge.create({
          data: {
            tenant_id: tenantId,
            invoice_id: id,
            provider: provider.name,
            reference,
            amount_minor: amountMinor,
            currency,
            email: invoice.client_email ?? null,
            created_by: sub,
          },
        }),
      );

      try {
        const init = await provider.initiateCharge({
          reference,
          amountMinor,
          currency,
          email: invoice.client_email || `payments@${new URL(webOrigin).hostname}`,
          callbackUrl: `${webOrigin}/`,
          metadata: {
            invoice_id: id,
            invoice_no: String(invoice.invoice_no),
            tenant_id: tenantId,
            charge_id: charge.id,
          },
        });
        const updated = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.providerPaymentCharge.update({
            where: { id: charge.id },
            data: { access_code: init.accessCode, authorization_url: init.authorizationUrl },
          }),
        );
        return reply.status(201).send({
          charge: {
            id: updated.id,
            reference: updated.reference,
            amountMinor: updated.amount_minor,
            currency: updated.currency,
            status: updated.status,
          },
          balanceDue: balance.toFixed(2),
          mpesaSingleTransactionLimitMinor: currency === 'KES' ? MPESA_SINGLE_TRANSACTION_LIMIT_MINOR : null,
          authorizationUrl: init.authorizationUrl,
          simulated: init.simulated,
        });
      } catch (err) {
        await withTenantTx(prisma, tenantId, async (tx) =>
          tx.providerPaymentCharge.update({
            where: { id: charge.id },
            data: { status: 'FAILED', failure_reason: err instanceof Error ? err.message : 'provider error' },
          }),
        );
        return reply.status(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: 'Payment provider rejected the charge initialization',
        });
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/webhooks/paystack — provider callback (unauthenticated;
  // x-paystack-signature HMAC-SHA512 over the raw body is the auth).
  // Settlement is server-side verified BEFORE any invoice is marked paid.
  // -------------------------------------------------------------------------
  server.post('/api/v1/webhooks/paystack', async (request, reply) => {
    const provider = getPaymentProvider();
    if (provider.name !== 'paystack') {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    }

    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? '';
    const signature = request.headers['x-paystack-signature'] as string | undefined;
    if (!provider.verifyWebhookSignature(rawBody, signature)) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid webhook signature' });
    }

    const event = request.body as {
      event?: string;
      data?: { reference?: string; status?: string; amount?: number; currency?: string };
    } | undefined;

    // Only successful charges settle invoices; everything else is acked.
    if (event?.event !== 'charge.success') {
      return reply.send({ received: true, ignored: event?.event ?? 'unknown' });
    }
    const reference = event.data?.reference;
    if (!reference) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Missing transaction reference' });
    }

    const charge = await lookupCharge(provider.name, reference);
    if (!charge) {
      // Unknown reference — acknowledge so the provider stops retrying.
      return reply.send({ received: true, ignored: 'unknown_reference' });
    }
    if (charge.status === 'PAID') {
      return reply.send({ received: true, status: 'already_paid' });
    }
    if (charge.status === 'NEEDS_REVIEW') {
      // Verified money that could not be applied is already flagged for a
      // human — acknowledge so the provider stops retrying.
      return reply.send({ received: true, status: 'needs_review' });
    }

    // Server-side verification — never trust the webhook payload alone.
    let verified;
    try {
      verified = await provider.verifyTransaction(reference);
    } catch {
      return reply.status(502).send({ statusCode: 502, error: 'Bad Gateway', message: 'Provider verification unavailable' });
    }

    const amountMatches = verified.amountMinor === charge.amount_minor;
    const currencyMatches = verified.currency.toUpperCase() === charge.currency.toUpperCase();
    if (verified.status !== 'success' || !amountMatches || !currencyMatches) {
      // FAILED stays re-settleable: a later webhook whose provider verify now
      // reports success is claimed below (PENDING|FAILED → PROCESSING).
      await withTenantTx(prisma, charge.tenant_id, async (tx) =>
        tx.providerPaymentCharge.updateMany({
          where: { id: charge.id, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
          data: {
            status: 'FAILED',
            failure_reason: !amountMatches
              ? `amount mismatch: expected ${charge.amount_minor}, got ${verified.amountMinor}`
              : !currencyMatches
                ? `currency mismatch: expected ${charge.currency}, got ${verified.currency}`
                : `provider status ${verified.status}`,
          },
        }),
      );
      return reply.send({
        received: true,
        status: 'rejected',
        reason: !amountMatches ? 'amount_mismatch' : !currencyMatches ? 'currency_mismatch' : 'not_successful',
      });
    }

    // Atomic claim + settlement inside tenant context.
    const result = await withTenantTx(prisma, charge.tenant_id, async (tx) => {
      // Claim the charge exactly once — concurrent duplicate webhooks lose
      // here. FAILED is re-claimable: the provider may report success on a
      // later delivery after an earlier transient verify failure.
      const claim = await tx.providerPaymentCharge.updateMany({
        where: { id: charge.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'PROCESSING' },
      });
      if (claim.count === 0) {
        return { alreadyProcessed: true as const };
      }

      // Serialise against manual payment posts on the same invoice.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${charge.invoice_id}::uuid FOR UPDATE`;

      const amountMajor = toDecimal(charge.amount_minor).dividedBy(100).toFixed(2);
      try {
        const payment = await recordInvoicePaymentTx(tx, {
          tenantId: charge.tenant_id,
          invoiceId: charge.invoice_id,
          amount: amountMajor,
          method: 'M_PESA',
          reference: `paystack:${reference}`,
          note: `Paystack online payment (${provider.name})`,
          recordedBy: null,
          idempotencyKey: `provider:${provider.name}:${reference}`,
          auditAction: 'INVOICE_PAYMENT_RECORDED_PROVIDER',
          buildBody: (invoice, p) => ({ invoice, payment: p, chargeId: charge.id }),
        });

        const paymentId = (payment.body as { payment?: { id?: string } })?.payment?.id ?? null;
        await tx.providerPaymentCharge.update({
          where: { id: charge.id },
          data: { status: 'PAID', invoice_payment_id: paymentId },
        });
        return { alreadyProcessed: false as const, payment };
      } catch (err) {
        // Domain validation errors ({status,message} thrown before any write
        // inside recordInvoicePaymentTx — bad invoice status, amount over the
        // remaining balance) mean verified money cannot be applied cleanly.
        // Commit NEEDS_REVIEW + audit + admin notification and ack the
        // webhook so the provider stops retrying — never silently lose a
        // verified payment. Unexpected errors rethrow → rollback → 500 →
        // provider retries (correct for transient failures).
        const domain = err as { status?: number; message?: string };
        if (typeof domain?.status !== 'number' || typeof domain?.message !== 'string') throw err;

        const reason = `settlement rejected: ${domain.message}`;
        await tx.providerPaymentCharge.update({
          where: { id: charge.id },
          data: { status: 'NEEDS_REVIEW', failure_reason: reason },
        });
        const invoice = await tx.invoice.findUnique({
          where: { id: charge.invoice_id },
          select: { project_id: true, invoice_no: true },
        });
        await recordAuditLog(tx, {
          tenantId: charge.tenant_id,
          projectId: invoice?.project_id ?? null,
          actorId: '00000000-0000-0000-0000-000000000000',
          action: 'PROVIDER_PAYMENT_NEEDS_REVIEW',
          entityType: 'ProviderPaymentCharge',
          entityId: charge.id,
          changes: {
            provider: provider.name,
            reference,
            invoiceId: charge.invoice_id,
            invoiceNo: invoice?.invoice_no ?? null,
            amountMinor: charge.amount_minor,
            currency: charge.currency,
            reason,
          },
        });
        await notifyTeam(tx, {
          tenantId: charge.tenant_id,
          projectId: invoice?.project_id ?? null,
          senderId: '00000000-0000-0000-0000-000000000000',
          body: `Online payment of KES ${(charge.amount_minor / 100).toFixed(2)} received via ${provider.name} for invoice #${invoice?.invoice_no ?? charge.invoice_id} but could not be applied automatically (${domain.message}). Charge ${reference} is flagged NEEDS_REVIEW — reconcile manually.`,
          audience: 'ROLE',
          targetRoles: ['COMPANY_ADMIN', 'ADMIN'],
        });
        return { alreadyProcessed: false as const, needsReview: reason };
      }
    });

    if (result.alreadyProcessed) {
      return reply.send({ received: true, status: 'already_processed' });
    }
    if ('needsReview' in result && result.needsReview) {
      return reply.send({ received: true, status: 'needs_review', reason: result.needsReview });
    }
    return reply.send({ received: true, status: 'paid', payment: (result as { payment: { body: unknown } }).payment.body });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/payments/charges/review — held provider payments awaiting a
  // human decision (NEEDS_REVIEW, not yet resolved). Money-approval roles only.
  // -------------------------------------------------------------------------
  server.get(
    '/api/v1/payments/charges/review',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_APPROVE)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const charges = await withTenantTx(prisma, tenantId, async (tx) =>
        tx.providerPaymentCharge.findMany({
          where: { status: 'NEEDS_REVIEW', resolved_at: null },
          select: {
            id: true, provider: true, reference: true, amount_minor: true, currency: true,
            failure_reason: true, created_at: true, invoice_id: true,
            invoice: { select: { invoice_no: true, project_id: true } },
          },
          orderBy: { created_at: 'asc' },
        }),
      );
      return reply.send({
        data: charges.map((c) => ({
          id: c.id,
          provider: c.provider,
          reference: c.reference,
          amountMinor: c.amount_minor,
          currency: c.currency,
          amount: (c.amount_minor / 100).toFixed(2),
          reason: c.failure_reason,
          createdAt: c.created_at,
          invoiceId: c.invoice_id,
          invoiceNo: c.invoice?.invoice_no ?? null,
        })),
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/payments/charges/:id/resolve — resolve a held charge once:
  //   APPLY    → post the verified amount to another invoice (same tenant,
  //              same row-lock + idempotency path as provider settlement)
  //   REFUNDED → money returned outside SiteSafi (note ≥15 chars + reference)
  //   KEEP     → reviewed and deliberately left flagged
  // Second resolution attempt → 409. Other tenant's charge → 404 (RLS).
  // -------------------------------------------------------------------------
  server.post(
    '/api/v1/payments/charges/:id/resolve',
    { preHandler: [server.authenticate, requirePermission(Permissions.COST_APPROVE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { id } = request.params as { id: string };
      if (!UUID_REGEX.test(id)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Charge not found' });
      }
      const body = (request.body ?? {}) as {
        action?: string; invoiceId?: string; note?: string; refundReference?: string;
      };
      const action = body.action;
      if (action !== 'APPLY' && action !== 'REFUNDED' && action !== 'KEEP') {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: "action must be APPLY, REFUNDED or KEEP" });
      }

      let targetInvoiceId: string | null = null;
      if (action === 'APPLY') {
        if (!body.invoiceId || !UUID_REGEX.test(body.invoiceId)) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'invoiceId (uuid) is required for APPLY' });
        }
        targetInvoiceId = body.invoiceId;
      }
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      const refundReference = typeof body.refundReference === 'string' ? body.refundReference.trim() : '';
      if (action === 'REFUNDED') {
        if (note.replace(/\s+/g, '').length < 15) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'A refund note of at least 15 characters is required' });
        }
        if (!refundReference) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'refundReference is required' });
        }
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const charge = await tx.providerPaymentCharge.findFirst({ where: { id } });
          if (!charge) throw { status: 404, message: 'Charge not found' };
          if (charge.status !== 'NEEDS_REVIEW' || charge.resolved_at) {
            throw { status: 409, message: 'Charge has already been resolved' };
          }

          // Atomic claim — concurrent resolutions serialise on this row and
          // the loser sees resolved_at set → 409.
          const resolutionState = action === 'APPLY' ? 'APPLIED' : action === 'REFUNDED' ? 'REFUNDED' : 'KEPT';
          const claim = await tx.providerPaymentCharge.updateMany({
            where: { id: charge.id, status: 'NEEDS_REVIEW', resolved_at: null },
            data: {
              resolution: resolutionState,
              resolved_at: new Date(),
              resolved_by: sub,
              resolution_note: action === 'REFUNDED' ? note : null,
              resolution_reference: action === 'REFUNDED' ? refundReference : null,
              ...(action === 'REFUNDED' ? { status: 'REFUNDED' } : {}),
            },
          });
          if (claim.count === 0) throw { status: 409, message: 'Charge has already been resolved' };

          const invoice = await tx.invoice.findUnique({
            where: { id: charge.invoice_id },
            select: { project_id: true, invoice_no: true },
          });

          let paymentId: string | null = null;
          let appliedInvoiceNo: string | null = null;
          if (action === 'APPLY' && targetInvoiceId) {
            // Same serialisation as provider settlement: invoice row lock
            // first, then the shared idempotent recording core.
            await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${targetInvoiceId}::uuid FOR UPDATE`;
            const amountMajor = toDecimal(charge.amount_minor).dividedBy(100).toFixed(2);
            const payment = await recordInvoicePaymentTx(tx, {
              tenantId,
              invoiceId: targetInvoiceId,
              amount: amountMajor,
              method: 'M_PESA',
              reference: `paystack:${charge.reference}`,
              note: `Held online payment applied by reviewer (charge ${charge.reference})`,
              recordedBy: sub,
              idempotencyKey: `provider-charge-resolve:${charge.id}`,
              ipAddress: request.ip,
              userAgent: (request.headers['user-agent'] as string) || null,
              auditAction: 'INVOICE_PAYMENT_RECORDED_PROVIDER_RESOLVED',
            });
            paymentId = (payment.body as { payment?: { id?: string } })?.payment?.id ?? null;
            appliedInvoiceNo = ((payment.body as { invoice?: { invoice_no?: unknown } })?.invoice?.invoice_no ?? null) as string | null;
            await tx.providerPaymentCharge.update({
              where: { id: charge.id },
              data: { status: 'PAID', invoice_payment_id: paymentId, resolved_invoice_id: targetInvoiceId },
            });
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId: invoice?.project_id ?? null,
            actorId: sub,
            action: 'PROVIDER_PAYMENT_RESOLVED',
            entityType: 'ProviderPaymentCharge',
            entityId: charge.id,
            changes: {
              provider: charge.provider,
              reference: charge.reference,
              amountMinor: charge.amount_minor,
              currency: charge.currency,
              originalInvoiceId: charge.invoice_id,
              originalInvoiceNo: invoice?.invoice_no ?? null,
              resolution: action,
              resolvedInvoiceId: targetInvoiceId,
              appliedInvoiceNo,
              refundReference: action === 'REFUNDED' ? refundReference : null,
              note: action === 'REFUNDED' ? note : null,
              previousReason: charge.failure_reason,
            },
            ipAddress: request.ip,
            userAgent: (request.headers['user-agent'] as string) || null,
          });

          return { chargeId: charge.id, action, paymentId };
        });

        return reply.send({ resolved: true, ...result });
      } catch (err) {
        const e = err as { status?: number; message?: string };
        if (typeof e?.status === 'number' && typeof e?.message === 'string') {
          const errorName = e.status === 404 ? 'Not Found' : e.status === 409 ? 'Conflict' : e.status === 400 ? 'Bad Request' : 'Error';
          return reply.status(e.status).send({ statusCode: e.status, error: errorName, message: e.message });
        }
        throw err;
      }
    },
  );
};
