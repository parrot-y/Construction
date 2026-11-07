export const Roles = {
  ADMIN: 'ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  PM_QS: 'PM_QS',
  SITE_SUPERVISOR: 'SITE_SUPERVISOR',
  CLIENT: 'CLIENT',
  CONSULTANT: 'CONSULTANT',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
  SUPPLIER: 'SUPPLIER',
  COMPLIANCE: 'COMPLIANCE',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const Permissions = {
  // Projects
  PROJECT_CREATE: 'project.create',
  PROJECT_VIEW: 'project.view',
  PROJECT_EDIT: 'project.edit',

  // BOQ
  BOQ_IMPORT: 'boq.import',
  BOQ_VIEW: 'boq.view',
  BOQ_EDIT: 'boq.edit',

  // Costs
  COST_CREATE: 'cost.create',
  COST_VIEW: 'cost.view',
  COST_APPROVE: 'cost.approve',

  // Payment Certificates & Closeout (ADR-008)
  CERTIFICATE_MANAGE: 'certificate.manage',
  ANNOUNCEMENT_MANAGE: 'announcement.manage',

  // Site Diary & Progress
  SITE_DIARY_CREATE: 'site.diary_create',
  SITE_DIARY_VIEW: 'site.diary_view',
  PROGRESS_RECORD: 'progress.record',
  PROGRESS_VIEW: 'progress.view',

  // Variations
  VARIATION_REQUEST: 'variation.request',
  VARIATION_REVIEW: 'variation.review',
  VARIATION_APPROVE: 'variation.approve',

  // Reports
  REPORT_GENERATE: 'report.generate',
  REPORT_VIEW: 'report.view',

  // Organization & Members
  COMPANY_INVITE: 'company.invite',
  COMPANY_MANAGE: 'company.manage',

  // Tender Board
  TENDER_CREATE: 'tender.create',
  TENDER_VIEW: 'tender.view',
  TENDER_BID: 'tender.bid',
  TENDER_EVALUATE: 'tender.evaluate',
  TENDER_AWARD: 'tender.award',

  // Independent Site Inspections
  INSPECTION_REQUEST: 'inspection.request',
  INSPECTION_SUBMIT: 'inspection.submit',
  INSPECTION_VIEW: 'inspection.view',
  INSPECTION_REVIEW: 'inspection.review',

  // Quotes (quotes-to-cash)
  QUOTE_CREATE: 'quote.create',
  QUOTE_VIEW: 'quote.view',
  QUOTE_EDIT: 'quote.edit',
  QUOTE_SEND: 'quote.send',

  // Invoices (accounts receivable)
  INVOICE_CREATE: 'invoice.create',
  INVOICE_VIEW: 'invoice.view',
  INVOICE_EDIT: 'invoice.edit',
  INVOICE_SEND: 'invoice.send',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

// Role to Permission Matrix (V1 Baseline + Extended Role Matrix)
export const RolePermissionsMap: Record<Role, readonly Permission[]> = {
  [Roles.ADMIN]: [
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_VIEW,
    Permissions.PROJECT_EDIT,
    Permissions.BOQ_IMPORT,
    Permissions.BOQ_VIEW,
    Permissions.BOQ_EDIT,
    Permissions.COST_CREATE,
    Permissions.COST_VIEW,
    Permissions.COST_APPROVE,
    Permissions.CERTIFICATE_MANAGE,
    Permissions.ANNOUNCEMENT_MANAGE,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REQUEST,
    Permissions.VARIATION_REVIEW,
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
    Permissions.COMPANY_INVITE,
    Permissions.COMPANY_MANAGE,
    Permissions.TENDER_CREATE,
    Permissions.TENDER_VIEW,
    Permissions.TENDER_BID,
    Permissions.TENDER_EVALUATE,
    Permissions.TENDER_AWARD,
    Permissions.QUOTE_CREATE,
    Permissions.QUOTE_VIEW,
    Permissions.QUOTE_EDIT,
    Permissions.QUOTE_SEND,
    Permissions.INVOICE_CREATE,
    Permissions.INVOICE_VIEW,
    Permissions.INVOICE_EDIT,
    Permissions.INVOICE_SEND,
    Permissions.INSPECTION_REQUEST,
    Permissions.INSPECTION_SUBMIT,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
  ],
  [Roles.COMPANY_ADMIN]: [
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_VIEW,
    Permissions.PROJECT_EDIT,
    Permissions.BOQ_IMPORT,
    Permissions.BOQ_VIEW,
    Permissions.BOQ_EDIT,
    Permissions.COST_CREATE,
    Permissions.COST_VIEW,
    Permissions.COST_APPROVE,
    Permissions.CERTIFICATE_MANAGE,
    Permissions.ANNOUNCEMENT_MANAGE,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REQUEST,
    Permissions.VARIATION_REVIEW,
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
    Permissions.COMPANY_INVITE,
    Permissions.COMPANY_MANAGE,
    Permissions.TENDER_CREATE,
    Permissions.TENDER_VIEW,
    Permissions.TENDER_BID,
    Permissions.TENDER_EVALUATE,
    Permissions.TENDER_AWARD,
    Permissions.QUOTE_CREATE,
    Permissions.QUOTE_VIEW,
    Permissions.QUOTE_EDIT,
    Permissions.QUOTE_SEND,
    Permissions.INVOICE_CREATE,
    Permissions.INVOICE_VIEW,
    Permissions.INVOICE_EDIT,
    Permissions.INVOICE_SEND,
    Permissions.INSPECTION_REQUEST,
    Permissions.INSPECTION_SUBMIT,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
  ],
  [Roles.PM_QS]: [
    Permissions.PROJECT_VIEW,
    Permissions.PROJECT_EDIT,
    Permissions.BOQ_IMPORT,
    Permissions.BOQ_VIEW,
    Permissions.BOQ_EDIT,
    Permissions.COST_CREATE,
    Permissions.COST_VIEW,
    Permissions.COST_APPROVE,
    Permissions.CERTIFICATE_MANAGE,
    Permissions.ANNOUNCEMENT_MANAGE,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REQUEST,
    Permissions.VARIATION_REVIEW,
    // ADR-010: PMs may finally approve COs only within their configured
    // co_approval_limit; larger amounts escalate to OWNER_REVIEW (server-side).
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_CREATE,
    Permissions.TENDER_VIEW,
    Permissions.TENDER_EVALUATE,
    Permissions.TENDER_AWARD,
    Permissions.QUOTE_CREATE,
    Permissions.QUOTE_VIEW,
    Permissions.QUOTE_EDIT,
    Permissions.QUOTE_SEND,
    Permissions.INVOICE_CREATE,
    Permissions.INVOICE_VIEW,
    Permissions.INVOICE_EDIT,
    Permissions.INVOICE_SEND,
    Permissions.INSPECTION_REQUEST,
    Permissions.INSPECTION_SUBMIT,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
  ],
  [Roles.SITE_SUPERVISOR]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.COST_CREATE,
    Permissions.COST_VIEW,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_VIEW,
  ],
  [Roles.CLIENT]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_REQUEST,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
  ],
  [Roles.CONSULTANT]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_SUBMIT,
    Permissions.INSPECTION_VIEW,
  ],
  [Roles.SUBCONTRACTOR]: [
    Permissions.PROJECT_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.TENDER_BID,
  ],
  [Roles.SUPPLIER]: [
    Permissions.PROJECT_VIEW,
    Permissions.SITE_DIARY_VIEW,
  ],
  [Roles.COMPLIANCE]: [
    Permissions.PROJECT_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.INSPECTION_VIEW,
  ],
};

/**
 * Returns all permissions granted to a given role.
 */
export function getPermissionsForRole(role: Role | string): readonly Permission[] {
  const allowed = RolePermissionsMap[role as Role];
  return allowed || [];
}

/**
 * Evaluates whether a role grants a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = RolePermissionsMap[role];
  if (!allowed) {
    return false;
  }
  return allowed.includes(permission);
}
