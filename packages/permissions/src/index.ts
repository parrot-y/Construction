export const Roles = {
  ADMIN: 'ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  PM_QS: 'PM_QS',
  SITE_SUPERVISOR: 'SITE_SUPERVISOR',
  CLIENT: 'CLIENT',
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
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

// Role to Permission Matrix (V1 Baseline)
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
  ],
  [Roles.PM_QS]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_IMPORT,
    Permissions.BOQ_VIEW,
    Permissions.BOQ_EDIT,
    Permissions.COST_CREATE,
    Permissions.COST_VIEW,
    Permissions.COST_APPROVE,
    Permissions.SITE_DIARY_CREATE,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_RECORD,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_REQUEST,
    Permissions.VARIATION_REVIEW,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
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
  ],
  [Roles.CLIENT]: [
    Permissions.PROJECT_VIEW,
    Permissions.BOQ_VIEW,
    Permissions.SITE_DIARY_VIEW,
    Permissions.PROGRESS_VIEW,
    Permissions.VARIATION_APPROVE,
    Permissions.REPORT_GENERATE,
    Permissions.REPORT_VIEW,
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
