/**
 * Console navigation model — mirrors the role-based information
 * architecture observed on the reference platform (captured live
 * 2026-11-08, /tmp/refstudy/crawl), implemented independently.
 */

export type ConsoleSection = 'home' | 'projects' | 'site' | 'money' | 'people' | 'files';
export type SubTab = string;

export interface SectionDef {
  id: ConsoleSection;
  label: string;
  /** which sub-tabs this role sees; undefined = all */
  tabs?: SubTab[];
}

export interface RoleNav {
  /** home variant: 'exec' dashboard | 'field' inbox | 'pm' dashboard+inbox */
  homeKind: 'exec' | 'pm' | 'field';
  sections: SectionDef[];
  /** home sub-tabs for pm/exec/viewer */
  homeTabs?: SubTab[];
}

const ALL_PROJECT_TABS = ['all', 'schedule', 'drawings', 'changeorders', 'coordination', 'correspondence'];
const NO_CO_PROJECT_TABS = ['all', 'schedule', 'drawings', 'coordination', 'correspondence'];
const DRAWINGS_ONLY_PROJECT_TABS = ['drawings'];

const ALL_SITE_TABS = ['dailylog', 'checklists', 'assignments', 'punch', 'inspections', 'observations', 'actionplans', 'safety', 'attendance'];
const VIEWER_SITE_TABS = ['dailylog', 'checklists', 'punch', 'inspections', 'observations', 'safety', 'attendance'];

const ALL_MONEY_TABS = ['financials', 'commitments', 'quotes', 'invoices', 'inventory', 'billing'];
const NO_BILLING_MONEY_TABS = ['financials', 'commitments', 'quotes', 'invoices', 'inventory'];
const INVOICES_INVENTORY = ['invoices', 'inventory'];
const INVENTORY_ONLY = ['inventory'];
const VIEWER_MONEY_TABS = ['commitments', 'invoices', 'inventory'];

const ALL_PEOPLE_TABS = ['team', 'crews', 'subcontractors', 'directory', 'roles'];
const NO_TEAM_PEOPLE_TABS = ['crews', 'subcontractors', 'directory', 'roles'];
const NO_CREWS_PEOPLE_TABS = ['team', 'subcontractors', 'directory', 'roles'];
const SUBS_DIRECTORY_PEOPLE_TABS = ['subcontractors', 'directory'];
const CREWS_ONLY_PEOPLE_TABS = ['crews', 'subcontractors', 'directory'];
const VIEWER_PEOPLE_TABS = ['subcontractors', 'directory', 'roles'];

const ALL_FILES_TABS = ['reports', 'companydocs', 'unfiled'];
const DOCS_ONLY_FILES_TABS = ['companydocs', 'unfiled'];

function nav(
  homeKind: RoleNav['homeKind'],
  sections: SectionDef[],
  homeTabs?: SubTab[],
): RoleNav {
  return { homeKind, sections, homeTabs };
}

const S = (id: ConsoleSection, label: string, tabs?: SubTab[]): SectionDef => ({ id, label, tabs });

export const ROLE_NAV: Record<string, RoleNav> = {
  // Full commercial oversight — everything incl. billing & reports
  COMPANY_ADMIN: nav('exec', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', ALL_MONEY_TABS),
    S('people', 'People', ALL_PEOPLE_TABS),
    S('files', 'Files & reports', ALL_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),
  ADMIN: nav('exec', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', ALL_MONEY_TABS),
    S('people', 'People', ALL_PEOPLE_TABS),
    S('files', 'Files & reports', ALL_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),
  EXECUTIVE: nav('exec', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', ALL_MONEY_TABS),
    S('people', 'People', ALL_PEOPLE_TABS),
    S('files', 'Files & reports', ALL_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),

  // PM/QS — full minus billing plan & invite-member
  PM_QS: nav('pm', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', NO_BILLING_MONEY_TABS),
    S('people', 'People', ALL_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),

  // Superintendent — like PM but no Team tab
  SUPERINTENDENT: nav('pm', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', NO_BILLING_MONEY_TABS),
    S('people', 'People', NO_TEAM_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),

  // Site engineer — no change orders, inventory-only money, no team tab
  SITE_ENGINEER: nav('field', [
    S('projects', 'Projects', NO_CO_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', INVENTORY_ONLY),
    S('people', 'People', CREWS_ONLY_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ]),

  // Trade lead — invoices + inventory money
  TRADE_LEAD: nav('field', [
    S('projects', 'Projects', NO_CO_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', INVOICES_INVENTORY),
    S('people', 'People', NO_TEAM_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ]),

  // Foreman — inventory-only money, crews directory
  FOREMAN: nav('field', [
    S('projects', 'Projects', NO_CO_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', INVENTORY_ONLY),
    S('people', 'People', CREWS_ONLY_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ]),

  // Worker — drawings only in Projects, NO People, NO Files
  WORKER: nav('field', [
    S('projects', 'Projects', DRAWINGS_ONLY_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', INVENTORY_ONLY),
  ]),

  // Site supervisor — legacy role treated as superintendent
  SITE_SUPERVISOR: nav('field', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', NO_BILLING_MONEY_TABS),
    S('people', 'People', NO_TEAM_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ]),

  // Owner — exec dashboard; full project/site visibility for approvals;
  // money minus billing; directory-level people; full files/reports.
  OWNER: nav('exec', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', NO_BILLING_MONEY_TABS),
    S('people', 'People', VIEWER_PEOPLE_TABS),
    S('files', 'Files & reports', ALL_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),

  // Architect — exec-style dashboard; full site/projects; money minus
  // billing; people minus crews (observed live).
  ARCHITECT: nav('pm', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', NO_BILLING_MONEY_TABS),
    S('people', 'People', NO_CREWS_PEOPLE_TABS),
    S('files', 'Files & reports', ALL_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),

  // QA/QC Officer — field inbox home; no change orders; inventory-only
  // money; subs+directory people; docs-only files (observed live).
  QA_QC: nav('field', [
    S('projects', 'Projects', NO_CO_PROJECT_TABS),
    S('site', 'Site', ALL_SITE_TABS),
    S('money', 'Money', INVENTORY_ONLY),
    S('people', 'People', SUBS_DIRECTORY_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ]),

  // Viewer — read-only subset
  VIEWER: nav('pm', [
    S('projects', 'Projects', ALL_PROJECT_TABS),
    S('site', 'Site', VIEWER_SITE_TABS),
    S('money', 'Money', VIEWER_MONEY_TABS),
    S('people', 'People', VIEWER_PEOPLE_TABS),
    S('files', 'Files & reports', DOCS_ONLY_FILES_TABS),
  ], ['dashboard', 'inbox', 'announcements']),
};

export const SECTION_LABELS: Record<ConsoleSection, string> = {
  home: 'Home',
  projects: 'Projects',
  site: 'Site',
  money: 'Money',
  people: 'People',
  files: 'Files & reports',
};

export const SUBTAB_LABELS: Record<string, string> = {
  // projects
  all: 'All projects',
  schedule: 'Schedule',
  drawings: 'Plans & drawings',
  changeorders: 'Change orders',
  coordination: 'Coordination',
  correspondence: 'Correspondence',
  // site
  dailylog: 'Daily log',
  checklists: 'Checklists',
  assignments: 'Assignments',
  punch: 'Punch list',
  inspections: 'Inspections',
  observations: 'Observations',
  actionplans: 'Action plans',
  safety: 'Safety',
  attendance: 'Attendance',
  // money
  financials: 'Financials',
  commitments: 'Commitments',
  quotes: 'Quotes',
  invoices: 'Invoices',
  inventory: 'Inventory',
  billing: 'Billing & plan',
  // people
  team: 'Team',
  crews: 'Crews',
  subcontractors: 'Subcontractors',
  directory: 'Directory',
  roles: 'Roles',
  // files
  reports: 'Reports',
  companydocs: 'Company documents',
  unfiled: 'Unfiled documents',
  // home
  dashboard: 'Dashboard',
  inbox: 'Inbox',
  announcements: 'Announcements',
};

const FALLBACK_NAV: RoleNav = ROLE_NAV.VIEWER as RoleNav;

export function getRoleNav(role: string): RoleNav {
  return ROLE_NAV[role] ?? FALLBACK_NAV;
}
