import type { Prisma } from '@construction/db';
import { toDecimal, Decimal } from '@construction/money';

/**
 * Round H1 — retention position for a project, derived from the ledger
 * (never guessed from contract-sum percentages). One release, one money
 * effect: a defects-liability certificate AUTHORIZES a release
 * (retention_amount_released) and the next payment certificate EXECUTES it
 * (retention_released, added back to net_payable and shown once on the
 * client invoice). retention_released on payment certificates is
 * server-derived — there is no typed path.
 *
 *   held         = retention_held on the latest CERTIFIED/PAID payment
 *                  certificate (cumulative, already net of the releases
 *                  that certificate executed). Draft/submitted certs have
 *                  not withheld anything yet, so they do not count.
 *   released     = sum of retention_amount_released on issued
 *                  defects-liability certificates (authorized to date).
 *   paidOut      = sum of retention_released on CERTIFIED/PAID payment
 *                  certificates (money actually paid back to the contractor).
 *   pendingPayout= released - paidOut (floored at 0) — authorized but not
 *                  yet executed through a payment certificate.
 *   outstanding  = held - pendingPayout (floored at 0) — withheld retention
 *                  with NO release authorization left. This is what a new
 *                  defects certificate may still authorize; it can never
 *                  double-count a release that is already authorized or paid.
 */

const ACTIVE_CERT_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CERTIFIED', 'PAID'] as const;
const PAID_CERT_STATUSES = ['CERTIFIED', 'PAID'] as const;

/**
 * True cumulative retention held = Σ retention_deduction − Σ
 * retention_released over CERTIFIED/PAID certificates. Aggregate-derived so
 * the ledger self-heals: draft-time stored snapshots can drift when drafts
 * are created out of order, but the certified ledger always reconciles.
 */
export async function certifiedRetentionHeld(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<Decimal> {
  const agg = await tx.paymentCertificate.aggregate({
    where: { project_id: projectId, status: { in: [...PAID_CERT_STATUSES] } },
    _sum: { retention_deduction: true, retention_released: true },
  });
  return Decimal.max(
    new Decimal(0),
    toDecimal(agg._sum.retention_deduction?.toString() ?? '0')
      .minus(toDecimal(agg._sum.retention_released?.toString() ?? '0')),
  );
}

export async function retentionPosition(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<{
  held: Decimal;
  released: Decimal;
  paidOut: Decimal;
  pendingPayout: Decimal;
  outstanding: Decimal;
}> {
  const [held, releasedAgg, paidAgg] = await Promise.all([
    certifiedRetentionHeld(tx, projectId),
    tx.defectsLiabilityCertificate.aggregate({
      where: { project_id: projectId },
      _sum: { retention_amount_released: true },
    }),
    tx.paymentCertificate.aggregate({
      where: { project_id: projectId, status: { in: [...PAID_CERT_STATUSES] } },
      _sum: { retention_released: true },
    }),
  ]);
  const released = toDecimal(releasedAgg._sum.retention_amount_released?.toString() ?? '0');
  const paidOut = toDecimal(paidAgg._sum.retention_released?.toString() ?? '0');
  const pendingPayout = Decimal.max(new Decimal(0), released.minus(paidOut));
  const outstanding = Decimal.max(new Decimal(0), held.minus(pendingPayout));
  return { held, released, paidOut, pendingPayout, outstanding };
}

/**
 * Authorized-but-uncommitted retention release available for the NEXT
 * payment certificate to execute. Committed = retention_released already
 * stored on live certificates (DRAFT through PAID) so two certificates can
 * never claim the same authorized moiety — the second simply gets 0 until
 * the first is rejected/voided or paid out.
 */
export async function pendingRetentionPayout(
  tx: Prisma.TransactionClient,
  projectId: string,
  excludeCertId?: string,
): Promise<Decimal> {
  const [authAgg, committedAgg] = await Promise.all([
    tx.defectsLiabilityCertificate.aggregate({
      where: { project_id: projectId },
      _sum: { retention_amount_released: true },
    }),
    tx.paymentCertificate.aggregate({
      where: {
        project_id: projectId,
        status: { in: [...ACTIVE_CERT_STATUSES] },
        ...(excludeCertId ? { id: { not: excludeCertId } } : {}),
      },
      _sum: { retention_released: true },
    }),
  ]);
  const authorized = toDecimal(authAgg._sum.retention_amount_released?.toString() ?? '0');
  const committed = toDecimal(committedAgg._sum.retention_released?.toString() ?? '0');
  return Decimal.max(new Decimal(0), authorized.minus(committed));
}
