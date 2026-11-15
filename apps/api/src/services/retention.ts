import type { Prisma } from '@construction/db';
import { toDecimal, Decimal } from '@construction/money';

/**
 * Stage 6 — retention position for a project, derived from the ledger
 * (never guessed from contract-sum percentages):
 *
 *   held       = retention_held on the latest CERTIFIED/PAID payment
 *                certificate (cumulative, already net of per-certificate
 *                retention_released add-backs). Draft/submitted certs have
 *                not withheld anything yet, so they do not count.
 *   released   = sum of retention_amount_released on issued
 *                defects-liability certificates (PC moiety + final).
 *   outstanding= held - released (floored at 0) — what may still be
 *                released or must be written off before CLOSED.
 */
export async function retentionPosition(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<{ held: Decimal; released: Decimal; outstanding: Decimal }> {
  const [lastCert, releasedAgg] = await Promise.all([
    tx.paymentCertificate.findFirst({
      where: { project_id: projectId, status: { in: ['CERTIFIED', 'PAID'] } },
      orderBy: { certificate_no: 'desc' },
      select: { retention_held: true },
    }),
    tx.defectsLiabilityCertificate.aggregate({
      where: { project_id: projectId },
      _sum: { retention_amount_released: true },
    }),
  ]);
  const held = lastCert ? toDecimal(lastCert.retention_held.toString()) : new Decimal(0);
  const released = toDecimal(releasedAgg._sum.retention_amount_released?.toString() ?? '0');
  const outstanding = Decimal.max(new Decimal(0), held.minus(released));
  return { held, released, outstanding };
}
