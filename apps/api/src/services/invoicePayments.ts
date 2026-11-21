import type { Prisma } from '@construction/db';
import { recordAuditLog } from '@construction/db';
import { toDecimal, DecimalValue } from '@construction/money';

/**
 * Shared invoice-payment recording — used by BOTH the authenticated
 * POST /api/v1/invoices/:id/payments route and the provider webhook
 * (Paystack) settlement path, so online and manual payments go through
 * identical lock → idempotency → ledger → audit semantics.
 *
 * Must be called inside withTenantTx (RLS context already set) AFTER the
 * caller has taken the invoice row lock (SELECT ... FOR UPDATE).
 */

export interface RecordInvoicePaymentParams {
  tenantId: string;
  invoiceId: string;
  /** Major units (e.g. KES 1,500.00), not minor units. */
  amount: DecimalValue;
  method: string;
  reference?: string | null;
  note?: string | null;
  paidAt?: Date | null;
  recordedBy?: string | null;
  /** Required — replays return the originally recorded response. */
  idempotencyKey: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  auditAction?: string;
  /** Optional formatter for the stored/replayed response body. */
  buildBody?: (invoice: unknown, payment: unknown) => unknown;
}

export interface RecordInvoicePaymentResult {
  isReplay: boolean;
  status: number;
  body: unknown;
}

type Tx = Prisma.TransactionClient;
type RouteError = { status?: number; code?: string; message?: string };

/** audit_logs.actor_id is a required UUID — system-initiated entries (provider
 * webhooks) use the nil UUID, which is never a real user. */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

export async function recordInvoicePaymentTx(
  tx: Tx,
  p: RecordInvoicePaymentParams,
): Promise<RecordInvoicePaymentResult> {
  const prior = await tx.idempotencyKey.findUnique({
    where: {
      tenant_id_idempotency_key: {
        tenant_id: p.tenantId,
        idempotency_key: p.idempotencyKey,
      },
    },
  });
  if (prior) {
    const priorInvoiceId = (prior.response_body as { invoice?: { id?: string } })?.invoice?.id;
    if (priorInvoiceId && priorInvoiceId !== p.invoiceId) {
      throw {
        status: 409,
        code: 'IDEMPOTENCY_KEY_REUSE',
        message: 'Idempotency-Key was already used for a different invoice payment',
      } as RouteError;
    }
    return { isReplay: true, status: prior.response_status, body: prior.response_body };
  }

  const existing = await tx.invoice.findFirst({ where: { id: p.invoiceId } });
  if (!existing) throw { status: 404, message: 'Invoice not found' } as RouteError;
  if (existing.status !== 'SENT' && existing.status !== 'PART_PAID') {
    throw {
      status: 409,
      message: `Payments can only be recorded on SENT or PART_PAID invoices (current: ${existing.status})`,
    } as RouteError;
  }

  const totalDec = toDecimal(existing.total.toString());
  const paidDec = toDecimal(existing.amount_paid.toString());
  const amountDec = toDecimal(p.amount);
  const balanceDec = totalDec.minus(paidDec);

  if (amountDec.lte(0)) throw { status: 400, message: 'Payment amount must be positive' } as RouteError;
  if (amountDec.gt(balanceDec)) {
    throw { status: 400, message: `Payment exceeds balance due (${balanceDec.toFixed(2)})` } as RouteError;
  }

  const newPaidDec = paidDec.plus(amountDec);
  const newBalanceDec = totalDec.minus(newPaidDec);
  const newStatus = newBalanceDec.lte(0) ? 'PAID' : 'PART_PAID';
  const paidAt = p.paidAt ?? new Date();

  const payment = await tx.invoicePayment.create({
    data: {
      tenant_id: p.tenantId,
      invoice_id: p.invoiceId,
      amount: amountDec.toFixed(2),
      method: p.method,
      reference: p.reference ?? null,
      paid_at: paidAt,
      note: p.note ?? null,
      recorded_by: p.recordedBy ?? null,
    },
  });

  const updated = await tx.invoice.update({
    where: { id: p.invoiceId },
    data: {
      amount_paid: newPaidDec.toFixed(2),
      balance_due: newBalanceDec.toFixed(2),
      status: newStatus,
      paid_at: newStatus === 'PAID' ? paidAt : existing.paid_at,
    },
    include: { items: true, payments: { orderBy: { paid_at: 'asc' } } },
  });

  // Certificate paid state derives from linked invoice payments.
  if (newStatus === 'PAID' && existing.certificate_id) {
    await tx.paymentCertificate.updateMany({
      where: { id: existing.certificate_id, status: 'CERTIFIED' },
      data: { status: 'PAID', paid_at: paidAt },
    });
  }

  // Client payment notices are confirmed ONLY when the payment is actually
  // recorded — never before.
  await tx.clientPaymentNotice.updateMany({
    where: { invoice_id: p.invoiceId, status: 'PENDING' },
    data: { status: 'CONFIRMED', confirmed_at: paidAt },
  });

  await recordAuditLog(tx, {
    tenantId: p.tenantId,
    projectId: existing.project_id,
    actorId: p.recordedBy ?? SYSTEM_ACTOR_ID,
    action: p.auditAction ?? 'INVOICE_PAYMENT_RECORDED',
    entityType: 'Invoice',
    entityId: p.invoiceId,
    changes: {
      paymentId: payment.id,
      amount: amountDec.toFixed(2),
      method: p.method,
      reference: p.reference ?? null,
      newStatus,
      amountPaid: newPaidDec.toFixed(2),
      balanceDue: newBalanceDec.toFixed(2),
      via: p.auditAction ?? 'manual',
    },
    ipAddress: p.ipAddress ?? null,
    userAgent: p.userAgent ?? null,
  });

  const body = p.buildBody
    ? p.buildBody(updated, payment)
    : { invoice: updated, payment };

  await tx.idempotencyKey.create({
    data: {
      tenant_id: p.tenantId,
      idempotency_key: p.idempotencyKey,
      response_status: 201,
      response_body: body as Prisma.InputJsonValue,
    },
  });

  return { isReplay: false, status: 201, body };
}
