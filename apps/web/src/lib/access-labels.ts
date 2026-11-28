/**
 * Human-readable labels for permission keys — used by the admin-only
 * "My access" view. Keys are stable API identifiers; labels are what a
 * person actually does.
 */

const PERMISSION_LABELS: Record<string, string> = {
  'project.create': 'Create projects',
  'project.view': 'View projects',
  'project.edit': 'Edit project details',
  'boq.import': 'Import bills of quantities',
  'boq.view': 'View bills of quantities',
  'boq.edit': 'Edit bills of quantities',
  'cost.create': 'Record costs',
  'cost.view': 'View costs',
  'cost.approve': 'Approve costs',
  'certificate.manage': 'Manage payment certificates',
  'certificate.closeout': 'Issue completion certificates & release retention',
  'announcement.manage': 'Post announcements',
  'site.diary_create': 'Write site diary entries',
  'site.diary_view': 'View site diary',
  'progress.record': 'Record progress claims',
  'progress.view': 'View progress',
  'variation.request': 'Request change orders',
  'variation.review': 'Review change orders',
  'variation.approve': 'Approve change orders',
  'report.generate': 'Generate reports',
  'report.view': 'View reports',
  'company.invite': 'Invite team members',
  'portal.manage': 'Manage stakeholder portal links',
  'company.manage': 'Manage company settings',
  'tender.create': 'Create tenders',
  'tender.view': 'View tenders',
  'tender.bid': 'Submit tender bids',
  'tender.evaluate': 'Evaluate tenders',
  'tender.award': 'Award tenders',
  'inspection.request': 'Request inspections',
  'inspection.submit': 'Submit inspection results',
  'inspection.view': 'View inspections',
  'inspection.review': 'Review inspections',
  'quote.create': 'Create quotes',
  'quote.view': 'View quotes',
  'quote.edit': 'Edit quotes',
  'quote.send': 'Send quotes to clients',
  'invoice.create': 'Create invoices',
  'invoice.view': 'View invoices',
  'invoice.edit': 'Edit invoices',
  'invoice.send': 'Send invoices',
  'document.manage': 'Manage documents',
};

const GROUP_ORDER = ['Projects', 'Bills of quantities', 'Money', 'Site', 'Change orders', 'Reports', 'Team & company', 'Tenders', 'Inspections', 'Quotes', 'Invoices', 'Documents'];

function groupFor(key: string): string {
  if (key.startsWith('boq.')) return 'Bills of quantities';
  if (key.startsWith('cost.') || key.startsWith('invoice.') || key.startsWith('certificate.')) return 'Money';
  if (key.startsWith('site.') || key.startsWith('progress.') || key.startsWith('inspection.')) return 'Site';
  if (key.startsWith('variation.')) return 'Change orders';
  if (key.startsWith('report.')) return 'Reports';
  if (key.startsWith('company.') || key.startsWith('portal.') || key === 'announcement.manage') return 'Team & company';
  if (key.startsWith('tender.')) return 'Tenders';
  if (key.startsWith('quote.')) return 'Quotes';
  if (key.startsWith('document.')) return 'Documents';
  return 'Projects';
}

/** Fallback for permission keys added after this map — readable, not raw. */
function humanize(key: string): string {
  const words = key.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function permissionLabel(key: string): string {
  return PERMISSION_LABELS[key] ?? humanize(key);
}

export interface AccessGroup {
  group: string;
  items: { key: string; label: string }[];
}

/** Group a user's permission keys into readable sections for "My access". */
export function groupPermissions(keys: string[]): AccessGroup[] {
  const map = new Map<string, AccessGroup>();
  for (const key of keys) {
    const group = groupFor(key);
    if (!map.has(group)) map.set(group, { group, items: [] });
    map.get(group)!.items.push({ key, label: permissionLabel(key) });
  }
  const groups = [...map.values()];
  groups.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.group);
    const bi = GROUP_ORDER.indexOf(b.group);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const g of groups) g.items.sort((a, b) => a.label.localeCompare(b.label));
  return groups;
}
