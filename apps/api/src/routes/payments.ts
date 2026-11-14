import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { prisma, withTenantTx } from '@construction/db';
import { Permissions } from '@construction/permissions';
import { toDecimal } from '@construction/money';
import { requirePermission } from '../plugins/rbac';
import { recordInvoicePaymentTx } from '../services/invoicePayments';
import { getPaymentProvider } from '../integrations/payments';

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
      const amountMinor = Math.round(Number(balance.toFixed(2)) * 100);
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid invoice balance' });
      }
      if (currency === 'KES' && amountMinor > MPESA_SINGLE_TRANSACTION_LIMIT_MINOR) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'MPESA_TRANSACTION_LIMIT',
          message: `M-Pesa collections are capped at KES 150,000.00 per transaction — split this invoice or use bank transfer for the balance.`,
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
      await withTenantTx(prisma, charge.tenant_id, async (tx) =>
        tx.providerPaymentCharge.updateMany({
          where: { id: charge.id, status: { in: ['PENDING', 'PROCESSING'] } },
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
      // Claim the charge exactly once — concurrent duplicate webhooks lose here.
      const claim = await tx.providerPaymentCharge.updateMany({
        where: { id: charge.id, status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });
      if (claim.count === 0) {
        return { alreadyProcessed: true as const };
      }

      // Serialise against manual payment posts on the same invoice.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${charge.invoice_id}::uuid FOR UPDATE`;

      const amountMajor = (charge.amount_minor / 100).toFixed(2);
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
    });

    if (result.alreadyProcessed) {
      return reply.send({ received: true, status: 'already_processed' });
    }
    return reply.send({ received: true, status: 'paid', payment: result.payment.body });
  });
};
