import { Prisma } from '@construction/db';
import { toDecimal, Decimal } from '@construction/money';

/**
 * ADR-010 change-order workflow helpers shared by the contractor review
 * endpoint, the authenticated client respond endpoint, and the public
 * client token portal. All functions run inside withTenantTx.
 */

export const CO_OWNER_ROLES = new Set(['ADMIN', 'COMPANY_ADMIN', 'CLIENT']);

export const CO_PENDING_STATUSES = ['PM_REVIEW', 'OWNER_REVIEW'] as const;

export function normalizeCoStatus(status: string): string {
  // Legacy M8 values map onto the ADR-010 lifecycle.
  if (status === 'SUBMITTED' || status === 'QS_EVALUATED') return 'PM_REVIEW';
  return status;
}

type Tx = Prisma.TransactionClient;

export async function recordCoEvent(
  tx: Tx,
  tenantId: string,
  variationOrderId: string,
  actorType: 'USER' | 'CLIENT' | 'CLIENT_PORTAL' | 'SYSTEM',
  actorName: string,
  event: string,
  note?: string | null,
) {
  return tx.variationEvent.create({
    data: {
      tenant_id: tenantId,
      variation_order_id: variationOrderId,
      actor_type: actorType,
      actor_name: actorName,
      event,
      note: note ?? null,
    },
  });
}

/**
 * Resolves the actor's effective approval authority.
 * Owner-side roles (ADMIN/COMPANY_ADMIN/CLIENT) are unlimited.
 * Other roles may only finally approve when their membership carries a
 * configured co_approval_limit; NULL limit = no self-approval authority.
 */
export async function resolveCoApprovalAuthority(
  tx: Tx,
  tenantId: string,
  userId: string,
  role: string,
): Promise<{ unlimited: boolean; limit: Decimal | null }> {
  if (CO_OWNER_ROLES.has(role)) {
    return { unlimited: true, limit: null };
  }
  const membership = await tx.membership.findFirst({
    where: { tenant_id: tenantId, user_id: userId },
    select: { co_approval_limit: true },
  });
  const limit = membership?.co_approval_limit != null
    ? toDecimal(membership.co_approval_limit.toString())
    : null;
  return { unlimited: false, limit };
}

/**
 * Pure approval-authority check (ADR-010):
 * - Owner-side actors always approve.
 * - Limited actors approve only when |net_amount| <= their configured limit
 *   (boundary is inclusive). Otherwise the order escalates to OWNER_REVIEW.
 */
export function coCanApprove(
  authority: { unlimited: boolean; limit: Decimal | null },
  netAmount: Prisma.Decimal | string | number,
): boolean {
  if (authority.unlimited) return true;
  if (authority.limit === null) return false;
  return toDecimal(netAmount.toString()).abs().lte(authority.limit);
}

/**
 * Atomically claims a lifecycle transition. Returns false when the stored
 * status no longer matches `expectedStatus` (concurrent modification), so the
 * caller can abort before any budget rollup — preventing double-approval.
 */
export async function claimCoTransition(
  tx: Tx,
  variationOrderId: string,
  expectedStatus: string,
  newStatus: string,
  approvedAt: Date | null,
): Promise<boolean> {
  const res = await tx.variationOrder.updateMany({
    where: { id: variationOrderId, status: expectedStatus },
    data: { status: newStatus, approved_at: approvedAt },
  });
  return res.count === 1;
}

/**
 * Applies the budget rollup for an APPROVED change order.
 * project.current_approved_budget is incremented by net_amount
 * (negative values reduce the budget — omissions). Must only be called after
 * claimCoTransition has successfully claimed the APPROVED transition.
 */
export async function applyCoBudgetRollup(
  tx: Tx,
  project: { id: string; current_approved_budget: Prisma.Decimal | string | number },
  netAmount: Prisma.Decimal | string | number,
): Promise<string> {
  const updatedBudget = toDecimal(project.current_approved_budget.toString())
    .plus(toDecimal(netAmount.toString()));

  await tx.project.update({
    where: { id: project.id },
    data: { current_approved_budget: updatedBudget.toFixed(2) },
  });

  return updatedBudget.toFixed(2);
}
