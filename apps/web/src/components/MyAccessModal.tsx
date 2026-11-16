import React from 'react';
import { Modal } from '../ui';
import { groupPermissions } from '../lib/access-labels';
import { AuthSession } from '../types/auth';

const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: 'Company admin',
  ADMIN: 'Administrator',
  EXECUTIVE: 'Executive',
  PM_QS: 'Project manager / QS',
  SUPERINTENDENT: 'Superintendent',
  SITE_ENGINEER: 'Site engineer',
  SITE_SUPERVISOR: 'Site supervisor',
  FOREMAN: 'Foreman',
  WORKER: 'Worker',
  TRADE_LEAD: 'Trade lead',
  QA_QC: 'QA/QC officer',
  ARCHITECT: 'Architect',
  OWNER: 'Owner',
  CLIENT: 'Client',
  VIEWER: 'Viewer',
};

/**
 * Admin-only "My access" view — what this account can do, in plain
 * language. Replaces the old raw permission-chip strip on headers.
 */
export default function MyAccessModal({ open, onClose, session }: {
  open: boolean;
  onClose: () => void;
  session: AuthSession;
}): React.JSX.Element {
  const groups = groupPermissions(session.permissions || []);
  return (
<Modal open={open} onClose={onClose} title="My access" wide>
<div className="space-y-4">
<p className="text-xs text-slate-500">
          Signed in as <span className="font-semibold text-slate-700">{session.user.fullName || session.user.email}</span>{' '}
          — role <span className="font-semibold text-slate-700">{ROLE_LABELS[session.user.role] || session.user.role}</span>.
          These are the things this account is allowed to do.
</p>
        {groups.length === 0 && (
<p className="text-xs text-slate-400">No special permissions on this account.</p>
)}
        {groups.map((g) => (
<div key={g.group}>
<h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{g.group}</h4>
<ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {g.items.map((p) => (
<li key={p.key} className="text-xs text-slate-600 flex items-start gap-1.5">
<span className="text-emerald-600 mt-0.5">✓</span>{p.label}
</li>
))}
</ul>
</div>
))}
</div>
</Modal>
);
}
