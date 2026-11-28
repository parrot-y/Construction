/**
 * J2 — one shared helper that turns every status enum into words a site
 * manager, QS or owner understands. Raw ALL_CAPS_WITH_UNDERSCORE values
 * must never reach the screen; unknown values are humanised rather than
 * passed through.
 */

const LABELS: Record<string, string> = {
  // Retention releases (subcontractor)
  PENDING_QS_REVIEW: 'Waiting for QS review',
  QS_RECOMMENDED: 'Recommended by QS — waiting for director',
  APPROVED_BY_DIRECTOR: 'Approved by director — ready to pay',
  PAID: 'Paid',
  REJECTED: 'Rejected',

  // Payment certificates / closeout
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  CERTIFIED: 'Certified',
  VOID: 'Void',
  CLOSED: 'Closed',

  // Invoices
  SENT: 'Sent',
  PART_PAID: 'Part paid',
  OVERDUE: 'Overdue',

  // Variations / change orders
  PM_REVIEW: 'With PM review',
  OWNER_REVIEW: 'Waiting for owner approval',
  QS_EVALUATED: 'QS evaluated',
  APPROVED: 'Approved',

  // Subcontractor valuations
  QS_VERIFIED: 'QS verified',
  APPROVED_FOR_PAYMENT: 'Approved for payment',
  PENDING_CLAIM: 'Claim submitted — awaiting review',

  // Snags
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  READY_FOR_REVIEW: 'Ready for review',
  RECTIFIED_BY_CONTRACTOR: 'Rectified by contractor',
  VERIFIED_CLOSED: 'Verified closed',
  CONTESTED: 'Under dispute',

  // Purchase orders / deliveries
  ISSUED: 'Issued',
  ACCEPTED: 'Accepted',
  PART_DELIVERED: 'Part delivered',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',

  // Inspections
  PENDING: 'Pending',
  PENDING_CONSULTANT_REVIEW: 'With consultant review',
  APPROVED_WITHOUT_COMMENTS: 'Approved',
  APPROVED_WITH_CONDITIONS: 'Approved with conditions',

  // Payment methods
  M_PESA: 'M-Pesa',
  BANK: 'Bank transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  CARD: 'Card',
  OTHER: 'Other',

  // Bonds
  ACTIVE: 'Active',
  RELEASED: 'Released',
  CALLED_CLAIMED: 'Called by bank',
  EXPIRED: 'Expired',
  PERFORMANCE_BOND: 'Performance bond',
  ADVANCE_PAYMENT_GUARANTEE: 'Advance payment guarantee',
  RETENTION_BOND: 'Retention bond',
  BID_TENDER_BOND: 'Bid bond',
};

/** Plain-language label for a status enum; humanises anything unknown. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const key = String(status).trim().toUpperCase();
  if (LABELS[key]) return LABELS[key];
  // Humanise: "SOME_NEW_STATUS" → "Some new status" — never raw caps.
  const words = key.toLowerCase().replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
