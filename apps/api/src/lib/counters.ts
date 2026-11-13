import type { Prisma } from '@construction/db';

/**
 * Atomic document numbering (Stage-7 audit): replaces `MAX(no)+1` reads that
 * race under concurrent creates. Each scope has a counter row incremented
 * inside the caller's transaction via INSERT ... ON CONFLICT — the row lock
 * serialises concurrent increments, so numbers are gapless-per-commit-order
 * and never duplicate.
 *
 * Scopes: 'INVOICE' (per tenant), `CERT:<projectId>` (per project).
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  scope: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ last_value: bigint }[]>`
    INSERT INTO document_counters (tenant_id, scope, last_value, updated_at)
    VALUES (${tenantId}::uuid, ${scope}, 1, now())
    ON CONFLICT (tenant_id, scope)
    DO UPDATE SET last_value = document_counters.last_value + 1,
                  updated_at = now()
    RETURNING last_value
  `;
  const value = Number(rows[0]?.last_value ?? 0);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Document counter returned invalid value for scope ${scope}`);
  }
  return value;
}
