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
  // Gate-5 role ladder (observed the reference platform team roles, doc 15)
  EXECUTIVE: 'EXECUTIVE',
  SUPERINTENDENT: 'SUPERINTENDENT',
  SITE_ENGINEER: 'SITE_ENGINEER',
  TRADE_LEAD: 'TRADE_LEAD',
  FOREMAN: 'FOREMAN',
  WORKER: 'WORKER',
  VIEWER: 'VIEWER',
  // Reference-observed design/quality roles (architect + QA/QC officer)
  ARCHITECT: 'ARCHITECT',
  QA_QC: 'QA_QC',
  // Project owner/developer — approves COs & certificates, reads reports;
  // read-only on most operational surfaces (observed reference role).
  OWNER: 'OWNER',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

/**
 * Invitation seniority ladder. Only COMPANY_ADMIN may invite ADMIN or
 * COMPANY_ADMIN; every other inviter may only invite roles ranked strictly
 * below their own. External/portal-facing roles sit at the bottom — they are
 * normally reached through token portals, not seats.
 */
export const INVITE_ROLE_RANK: Record<Role, number> = {
  [Roles.COMPANY_ADMIN]: 60,
  [Roles.EXECUTIVE]: 50,
  [Roles.OWNER]: 50,
  [Roles.ADMIN]: 45,
  [Roles.PM_QS]: 40,
  [Roles.SUPERINTENDENT]: 35,
  [Roles.SITE_ENGINEER]: 34,
  [Roles.SITE_SUPERVISOR]: 33,
  [Roles.ARCHITECT]: 32,
  [Roles.QA_QC]: 31,
  [Roles.CONSULTANT]: 30,
  [Roles.COMPLIANCE]: 25,
  [Roles.TRADE_LEAD]: 20,
  [Roles.FOREMAN]: 15,
  [Roles.WORKER]: 10,
  [Roles.VIEWER]: 5,
  [Roles.CLIENT]: 5,
  [Roles.SUBCONTRACTOR]: 5,
  [Roles.SUPPLIER]: 5,
};

const PROTECTED_INVITE_ROLES: ReadonlySet<string> = new Set([Roles.ADMIN, Roles.COMPANY_ADMIN]);

/** Whether `inviterRole` may create an invitation for `targetRole`. */
export function canInviteRole(inviterRole: string, targetRole: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(INVITE_ROLE_RANK, targetRole)) return false;
  if (PROTECTED_INVITE_ROLES.has(targetRole)) {
    return inviterRole === Roles.COMPANY_ADMIN;
  }
  const inviterRank = INVITE_ROLE_RANK[inviterRole as Role];
  const targetRank = INVITE_ROLE_RANK[targetRole as Role];
  if (inviterRank === undefined || targetRank === undefined) return false;
  return targetRank < inviterRank;
}

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
  // External stakeholder portal links
  PORTAL_MANAGE: 'portal.manage',
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
  DOCUMENT_MANAGE: 'document.manage',
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
    Permissions.DOCUMENT_MANAGE,
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
    Permissions.PORTAL_MANAGE,
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
    Permissions.DOCUMENT_MANAGE,
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
    Permissions.PORTAL_MANAGE,
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
    Permissions.DOCUMENT_MANAGE,
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
    Permissions.PORTAL_MANAGE,
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
    Permissions.INSPECTION_REQUEST,
    Permissions.INSPECTION_SUBMIT,
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
    Permissions.INSPECTION_REVIEW,
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
  // ARCHITECT: design authority — drawings, inspections, site visibility;
  // no money admin (financial tracker view-only via REPORT/COST_VIEW below).
  [Roles.ARCHITECT]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.COST_VIEW,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.DOCUMENT_MANAGE,
    Permissions.INSPECTION_SUBMIT,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
  ],
  [Roles.OWNER]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.COST_VIEW,
    // Stage-2: owners read and acknowledge — they do NOT create or certify
    // payment certificates (CERTIFICATE_MANAGE removed; COST_APPROVE never held).
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REVIEW,
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_VIEW,
    Permissions.QUOTE_VIEW,
    Permissions.INVOICE_VIEW,
  ],
  // QA/QC Officer: quality gatekeeper — inspections, checklists, site
  // records, inventory; no financial tracker, no team admin.
  [Roles.QA_QC]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_REQUEST,
    Permissions.INSPECTION_SUBMIT,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
  ],
  // ---- Gate-5 observed role ladder (doc 15_role_portals.md) ----
  // EXECUTIVE: owner-side oversight — mirrors COMPANY_ADMIN minus billing
  // admin; keeps invite + manage for team growth.
  [Roles.EXECUTIVE]: [
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_VIEW,
    Permissions.PROJECT_EDIT,
    Permissions.BOQ_VIEW,
    Permissions.COST_VIEW,
    Permissions.COST_APPROVE,
    Permissions.CERTIFICATE_MANAGE,
    Permissions.DOCUMENT_MANAGE,
    Permissions.ANNOUNCEMENT_MANAGE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REVIEW,
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
    Permissions.COMPANY_INVITE,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
    Permissions.QUOTE_VIEW,
    Permissions.INVOICE_VIEW,
  ],
  // SUPERINTENDENT: senior field commander — full financial tracker view,
  // CO visibility, crew management; no billing admin.
  [Roles.SUPERINTENDENT]: [
    Permissions.PROJECT_VIEW,
    Permissions.PROJECT_EDIT,
    Permissions.BOQ_VIEW,
    Permissions.COST_CREATE,
    Permissions.COST_VIEW,
    Permissions.COST_APPROVE,
    Permissions.CERTIFICATE_MANAGE,
    Permissions.DOCUMENT_MANAGE,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REQUEST,
    Permissions.VARIATION_REVIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_VIEW,
    Permissions.INSPECTION_REVIEW,
    Permissions.QUOTE_VIEW,
    Permissions.INVOICE_VIEW,
    Permissions.INVOICE_CREATE,
    Permissions.INVOICE_SEND,
  ],
  // SITE_ENGINEER: field delivery — diary, progress, inventory, crews;
  // money section scoped to inventory (no financial tracker).
  [Roles.SITE_ENGINEER]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.DOCUMENT_MANAGE,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_VIEW,
  ],
  // TRADE_LEAD: trade contractor lead — field ops + own invoicing view.
  [Roles.TRADE_LEAD]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.TENDER_BID,
    Permissions.INSPECTION_VIEW,
    Permissions.INVOICE_VIEW,
  ],
  // FOREMAN: crew-level field ops.
  [Roles.FOREMAN]: [
    Permissions.PROJECT_VIEW,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.INSPECTION_VIEW,
  ],
  // WORKER: minimal field — diary log + progress + plans view.
  [Roles.WORKER]: [
    Permissions.PROJECT_VIEW,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.INSPECTION_VIEW,
  ],
  // VIEWER: strict read-only across the workspace.
  [Roles.VIEWER]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.REPORT_VIEW,
    Permissions.TENDER_VIEW,
    Permissions.INSPECTION_VIEW,
    Permissions.QUOTE_VIEW,
    Permissions.INVOICE_VIEW,
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
