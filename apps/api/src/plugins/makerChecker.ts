import { Roles } from '@construction/permissions';

/**
 * Maker-checker rule (auditor decision): the person who entered a cost,
 * certificate or invoice cannot approve/send it themselves — EXCEPT
 * COMPANY_ADMIN/ADMIN, who may self-approve only with a recorded
 * selfApprovalReason (stored on the row + audit log).
 */
const SELF_APPROVER_ROLES = new Set<string>([Roles.COMPANY_ADMIN, Roles.ADMIN]);

export interface SelfApprovalDecision {
  selfApproved: boolean;
  reason: string | null;
}

export function evaluateSelfApproval(opts: {
  creatorId: string | null | undefined;
  actorId: string;
  actorRole: string | undefined;
  reason?: string | null;
  entity: 'cost' | 'payment certificate' | 'invoice';
}): SelfApprovalDecision {
  if (!opts.creatorId || opts.creatorId !== opts.actorId) {
    return { selfApproved: false, reason: null };
  }
  if (!SELF_APPROVER_ROLES.has(opts.actorRole ?? '')) {
    throw {
      status: 409,
      message: `The person who entered this ${opts.entity} cannot approve it — a different approver is required`,
    };
  }
  const reason = opts.reason?.trim() || null;
  if (!reason) {
    throw {
      status: 409,
      message: `Self-approval of your own ${opts.entity} requires a selfApprovalReason`,
    };
  }
  if (reason.replace(/\s+/g, '').length < 15) {
    throw {
      status: 409,
      message: `selfApprovalReason must be at least 15 non-space characters for a self-approved ${opts.entity}`,
    };
  }
  return { selfApproved: true, reason };
}
