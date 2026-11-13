import { getRoleNav} from '../navConfig';
import React, { useEffect, useState} from 'react';
import { useConsole} from '../ConsoleContext';
import CrewsView from '../../CrewsView';
import SubcontractorManagementView from '../../SubcontractorManagementView';
import { IconPlus} from '../icons';
import { useAppDialog } from '../../AppDialog';

const ASSIGN_ROLES = ['COMPANY_ADMIN','CLIENT','ARCHITECT','PM_QS','QA_QC','OWNER','EXECUTIVE','SUPERINTENDENT','SITE_ENGINEER','TRADE_LEAD','FOREMAN','WORKER','VIEWER','CONSULTANT','SUBCONTRACTOR','SUPPLIER','COMPLIANCE','ADMIN','SITE_SUPERVISOR'];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', COMPANY_ADMIN: 'Contractor', EXECUTIVE: 'Executive', PM_QS: 'Project Manager / QS',
  SITE_SUPERVISOR: 'Site Supervisor', SUPERINTENDENT: 'Superintendent', SITE_ENGINEER: 'Site Engineer',
  TRADE_LEAD: 'Trade Lead', FOREMAN: 'Foreman', WORKER: 'Worker', VIEWER: 'Viewer',
  CLIENT: 'Client', CONSULTANT: 'Consultant', SUBCONTRACTOR: 'Subcontractor', SUPPLIER: 'Supplier', COMPLIANCE: 'Compliance',
  ARCHITECT: 'Architect', QA_QC: 'QA/QC Officer', OWNER: 'Owner',
};

/** Team — members table with live role editing + invite + revoke. */
function TeamView({ canInvite}: { canInvite: boolean}): React.JSX.Element {
  const dialog = useAppDialog();
  const { session, role} = useConsole();
  const isCompanyAdmin = role === 'COMPANY_ADMIN' || role === 'ADMIN';
  const [exportBusy, setExportBusy] = useState(false);

  const downloadCompanyData = async (format: 'json' | 'csv', entity?: string) => {
    setExportBusy(true);
    try {
      const qs = new URLSearchParams({ format});
      if (entity) qs.set('entity', entity);
      const r = await fetch(`/api/v1/company/export?${qs}`, { credentials: 'include'});
      if (!r.ok) { setMsg('Export failed — company admin access required'); return; }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = format === 'csv' ? `${entity}-export.csv` : 'company-export.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExportBusy(false);
    }
};
  const [members, setMembers] = useState<any[] | null>(null);
  const [invite, setInvite] = useState({ email: '', role: 'SITE_ENGINEER', open: false});
  const [msg, setMsg] = useState('');

  const load = () => {
    fetch('/api/v1/company/members', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : { data: []}))
      .then((j) => setMembers(j.data || []))
      .catch(() => setMembers([]));
};
  useEffect(load, []);

  const changeRole = async (membershipId: string, role: string) => {
    const r = await fetch(`/api/v1/company/members/${membershipId}/role`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ role}),
});
    if (r.ok) setMembers((prev) => prev?.map((m) => (m.membershipId === membershipId ? { ...m, role} : m)) ?? prev);
    else { const j = await r.json().catch(() => ({})); setMsg(j.message || 'Role change failed');}
};

  const revoke = async (membershipId: string) => {
    const ok = await dialog.confirm({ title: 'Revoke member access', message: 'Revoke this member’s access?', confirmLabel: 'Revoke', danger: true });
    if (!ok) return;
    const r = await fetch(`/api/v1/company/members/${membershipId}`, { method: 'DELETE', credentials: 'include'});
    if (r.ok) setMembers((prev) => prev?.filter((m) => m.membershipId !== membershipId) ?? prev);
};

  const sendInvite = async () => {
    const r = await fetch('/api/v1/invitations', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ email: invite.email, role: invite.role}),
});
    const j = await r.json().catch(() => ({}));
    const link = r.ok && j.data?.inviteUrl ? ` Copy and send this link to ${invite.email}: ${j.data.inviteUrl}` : '';
    setMsg(r.ok ? `Invitation created for ${invite.email}.${link}` : (j.message || 'Invite failed'));
    if (r.ok) { setInvite({ email: '', role: 'SITE_ENGINEER', open: false}); loadInvites();}
};

  const [invites, setInvites] = useState<any[] | null>(null);
  const [inviteMsg, setInviteMsg] = useState('');

  const loadInvites = () => {
    fetch('/api/v1/invitations', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : { data: []}))
      .then((j) => setInvites(j.data || []))
      .catch(() => setInvites([]));
};
  useEffect(loadInvites, []);

  const copyInviteLink = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteMsg('Invite link copied to clipboard — send it to the invitee.');
    } catch {
      setInviteMsg(inviteUrl);
    }
};

  const resetMemberPassword = async (userId: string, email: string) => {
    const r = await fetch(`/api/v1/company/members/${userId}/password-reset`, { method: 'POST', credentials: 'include'});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.message || 'Could not generate reset link'); return; }
    const url = j.data?.resetUrl;
    try {
      await navigator.clipboard.writeText(url);
      setMsg(`One-time reset link for ${email} copied — send it to them. It expires in 30 minutes.`);
    } catch {
      setMsg(`Reset link for ${email}: ${url}`);
    }
};

  const activateMember = async (userId: string, email: string) => {
    const r = await fetch(`/api/v1/company/members/${userId}/activate`, { method: 'POST', credentials: 'include'});
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(`${email} activated — they can sign in now.`); load(); }
    else setMsg(j.message || 'Activation failed');
};

  const revokeInvite = async (id: string) => {
    const r = await fetch(`/api/v1/invitations/${id}/revoke`, { method: 'POST', credentials: 'include'});
    if (r.ok) loadInvites();
    else { const j = await r.json().catch(() => ({})); setInviteMsg(j.message || 'Revoke failed');}
};

  const regenerateInvite = async (id: string) => {
    const r = await fetch(`/api/v1/invitations/${id}/regenerate`, { method: 'POST', credentials: 'include'});
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setInviteMsg('New invite link generated — the old link no longer works.'); loadInvites();}
    else setInviteMsg(j.message || 'Regenerate failed');
};

  return (
<div className="space-y-4">
<div className="flex items-center justify-between">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Team</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">Invite teammates and give each a role. They sign in with that role.</p>
</div>
        <div className="flex items-center gap-2">
          {isCompanyAdmin && (
<button onClick={() => downloadCompanyData('json')} disabled={exportBusy}
              className="px-3.5 py-2 text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              {exportBusy ? 'Preparing…' : 'Download company data'}
</button>
)}
          {canInvite && (
<button onClick={() => setInvite({ ...invite, open: !invite.open})}
            className="px-3.5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1.5">
<IconPlus className="w-3.5 h-3.5" /> Invite member
</button>
)}
</div>
</div>

      {msg &&<p className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">{msg}</p>}

      {invite.open && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
<label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Email
<input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value})}
              className="mt-1 block border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm w-64" placeholder="teammate@company.co.ke" />
</label>
<label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Role
<select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value})}
              className="mt-1 block border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm">
              {ASSIGN_ROLES.map((r) =><option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
</select>
</label>
<button onClick={sendInvite} className="px-4 py-2 text-xs font-bold bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-lg">Send invite</button>
</div>
)}

<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
<th className="px-5 py-3 font-semibold">Name</th>
<th className="px-3 py-3 font-semibold">Email</th>
<th className="px-3 py-3 font-semibold">Role</th>
<th className="px-5 py-3 font-semibold text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {(members || []).map((m: any) => {
                const isSelf = m.user?.id === session.user.id;
                return (
<tr key={m.membershipId} className="text-slate-700 dark:text-slate-300">
<td className="px-5 py-3 font-semibold">{m.user?.full_name || '—'}</td>
<td className="px-3 py-3">{m.user?.email}</td>
<td className="px-3 py-3">
                      {m.verificationPending && (
<span className="mr-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold align-middle">PENDING ACTIVATION</span>
)}
                      {canInvite && !isSelf ? (
<select value={m.role} onChange={(e) => changeRole(m.membershipId, e.target.value)}
                          className="border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-2 py-1 text-[11px] font-bold">
                          {ASSIGN_ROLES.map((r) =><option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
</select>
) : (
<span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold">{ROLE_LABELS[m.role] || m.role}</span>
)}
</td>
<td className="px-5 py-3 text-right whitespace-nowrap">
                      {canInvite && !isSelf && (
<span className="inline-flex items-center gap-2">
<button onClick={() => revoke(m.membershipId)} className="text-[11px] font-bold text-red-500 hover:text-red-700">Revoke</button>
<button onClick={() => resetMemberPassword(m.user?.id, m.user?.email)} className="text-[11px] font-bold text-slate-600 hover:text-slate-900">Reset link</button>
{m.verificationPending && (
<button onClick={() => activateMember(m.user?.id, m.user?.email)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">Activate</button>
)}
</span>
)}
</td>
</tr>
);
})}
              {members !== null && members.length === 0 && (
<tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No members found.</td></tr>
)}
</tbody>
</table>
</div>
</div>

      {/* Invitations — pending / accepted / revoked with link actions */}
      {canInvite && invites !== null && invites.length > 0 && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
<h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Invitations</h4>
</div>
{inviteMsg &&<p className="px-5 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">{inviteMsg}</p>}
<div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {invites.map((inv: any) => (
<div key={inv.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-xs">
<span className="font-semibold text-slate-800 dark:text-slate-200 w-56 truncate">{inv.email}</span>
<span className="text-slate-500">{ROLE_LABELS[inv.role] || inv.role}</span>
<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  inv.status === 'PENDING' ? 'bg-amber-100 text-amber-800'
                  : inv.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-600'
                }`}>
                {inv.status}
</span>
<span className="text-[10px] text-slate-400">
                expires {new Date(inv.expiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
</span>
<div className="ml-auto flex items-center gap-3">
                  {inv.status === 'PENDING' && (
<>
<button onClick={() => copyInviteLink(inv.inviteUrl)} className="text-[11px] font-bold text-brand-600 hover:text-brand-700">Copy link</button>
<button onClick={() => regenerateInvite(inv.id)} className="text-[11px] font-bold text-slate-600 hover:text-slate-900">Regenerate</button>
<button onClick={() => revokeInvite(inv.id)} className="text-[11px] font-bold text-red-500 hover:text-red-700">Revoke</button>
</>
)}
                  {inv.status === 'REVOKED' && (
<button onClick={() => regenerateInvite(inv.id)} className="text-[11px] font-bold text-slate-600 hover:text-slate-900">Regenerate</button>
)}
</div>
</div>
))}
</div>
</div>
)}
{dialog.element}
</div>
);
}

/** Directory — combined read-only listing of members + subcontractors + suppliers. */
const DIR_CATS = ['All', 'Team', 'Subcontractor', 'Supplier'] as const;

function DirectoryView(): React.JSX.Element {
  const { projectId} = useConsole();
  const [members, setMembers] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [cat, setCat] = useState<(typeof DIR_CATS)[number]>('All');
  useEffect(() => {
    fetch('/api/v1/company/members', { credentials: 'include'}).then((r) => r.ok ? r.json() : { data: []}).then((j) => setMembers(j.data || [])).catch(() => {});
    if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
      fetch(`/api/v1/projects/${projectId}/subcontractors`, { credentials: 'include'})
        .then((r) => (r.ok ? r.json() : { data: []}))
        .then((j) => setSubs(j.data || j || [])).catch(() => {});
}
}, [projectId]);
  return (
<div className="space-y-4">
<div className="flex flex-wrap items-start justify-between gap-3">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Directory</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">Contacts and companies you work with.</p>
</div>
<div className="flex gap-1.5 flex-wrap">
          {DIR_CATS.map((c) => (
<button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${cat === c ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {c}
</button>
))}
</div>
</div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(cat === 'All' || cat === 'Team') && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<p className="px-5 py-3 text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">Team ({members.length})</p>
<div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {members.map((m: any) => (
<div key={m.membershipId} className="px-5 py-2.5 flex justify-between text-xs">
<span className="font-semibold text-slate-800 dark:text-slate-200">{m.user?.full_name || m.user?.email}</span>
<span className="text-slate-400">{m.user?.email}</span>
</div>
))}
</div>
</div>
)}
        {(cat === 'All' || cat === 'Subcontractor' || cat === 'Supplier') && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<p className="px-5 py-3 text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">Subcontractors &amp; suppliers ({subs.length})</p>
<div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {subs.map((s: any) => (
<div key={s.id} className="px-5 py-2.5 flex justify-between text-xs">
<span className="font-semibold text-slate-800 dark:text-slate-200">{s.company_name || s.name}</span>
<span className="text-slate-400">{s.trade || s.category || s.type || ''}</span>
</div>
))}
              {subs.length === 0 &&<p className="px-5 py-6 text-xs text-slate-400 text-center">No subcontractors yet.</p>}
</div>
</div>
)}
        {(cat === 'All' || cat === 'Subcontractor' || cat === 'Supplier') && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<p className="px-5 py-3 text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">Subcontractors &amp; suppliers ({subs.length})</p>
<div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {subs.map((s: any) => (
<div key={s.id} className="px-5 py-2.5 flex justify-between text-xs">
<span className="font-semibold text-slate-800 dark:text-slate-200">{s.company_name || s.name}</span>
<span className="text-slate-400">{s.trade || s.category || s.type || ''}</span>
</div>
))}
            {subs.length === 0 &&<p className="px-5 py-6 text-xs text-slate-400 text-center">No subcontractors yet.</p>}
</div>
</div>
)}
</div>
</div>
);
}

/** Roles — live workspace access matrix derived from the console nav config. */
const MATRIX_ROLES: { key: string; label: string}[] = [
  { key: 'COMPANY_ADMIN', label: 'Contractor'},
  { key: 'EXECUTIVE', label: 'Executive'},
  { key: 'PM_QS', label: 'Project Manager / QS'},
  { key: 'ARCHITECT', label: 'Architect'},
  { key: 'QA_QC', label: 'QA/QC Officer'},
  { key: 'OWNER', label: 'Owner'},
  { key: 'SUPERINTENDENT', label: 'Superintendent'},
  { key: 'SITE_ENGINEER', label: 'Site Engineer'},
  { key: 'TRADE_LEAD', label: 'Trade Lead'},
  { key: 'FOREMAN', label: 'Foreman'},
  { key: 'WORKER', label: 'Worker'},
  { key: 'VIEWER', label: 'Viewer'},
];
const MATRIX_SECTIONS = ['projects', 'site', 'money', 'people', 'files'] as const;

const ROLE_DESCRIPTIONS: { label: string; desc: string}[] = [
  { label: 'Contractor', desc: 'Workspace owner. Full control over projects, finances, team and permissions.'},
  { label: 'Client', desc: 'Project client — read access to progress, reports and approvals.'},
  { label: 'Architect', desc: 'Design lead. Reviews plans, drawings and field clarifications.'},
  { label: 'Quantity Surveyor', desc: 'Cost control — BOQs, quantities, budget variance.'},
  { label: 'QA/QC Officer', desc: 'Quality assurance — inspections, checklists, compliance.'},
  { label: 'Owner', desc: 'Client/developer paying for the project. Approves budget and change orders.'},
  { label: 'Executive', desc: 'Oversight — approvals and reporting across the portfolio.'},
  { label: 'Project Manager', desc: 'Day-to-day operations. Approves change orders within a configured limit.'},
  { label: 'Site Engineer', desc: 'On-site technical lead — inspections, tasks, quality readiness.'},
  { label: 'Superintendent', desc: 'Jobsite lead — assigns daily tasks to crews and trade leads.'},
  { label: 'Trade Lead', desc: 'Head of a sub-crew. Accepts tasks, manages crew, uploads progress.'},
  { label: 'Foreman', desc: 'Crew foreman — oversees workers on site.'},
  { label: 'Worker', desc: 'Tradesperson — mobile-first tasks, checklists, photo uploads.'},
  { label: 'Viewer', desc: 'Read-only stakeholder — inspector, lender, consultant.'},
];

function RolesView(): React.JSX.Element {
  return (
<div className="space-y-4">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Roles</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">What each workspace role can see and do.</p>
</div>
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
<p className="text-[10px] font-bold text-slate-400 mb-3">Role hierarchy &amp; responsibilities · {ROLE_DESCRIPTIONS.length} roles defined</p>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ROLE_DESCRIPTIONS.map((r) => (
<div key={r.label} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60">
<p className="text-xs font-bold text-slate-800 dark:text-slate-200">{r.label}</p>
<p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{r.desc}</p>
</div>
))}
</div>
</div>
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
<th className="px-5 py-3 font-semibold">Role</th>
              {MATRIX_SECTIONS.map((sec) =><th key={sec} className="px-3 py-3 font-semibold capitalize text-center">{sec === 'files' ? 'Files' : sec}</th>)}
</tr>
</thead>
<tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {MATRIX_ROLES.map((r) => {
              const rn = getRoleNav(r.key);
              return (
<tr key={r.key} className="text-slate-700 dark:text-slate-300">
<td className="px-5 py-3 font-bold whitespace-nowrap">{r.label}</td>
                  {MATRIX_SECTIONS.map((sec) => {
                    const def = rn.sections.find((x) => x.id === sec);
                    const n = def?.tabs?.length ?? 0;
                    return (
<td key={sec} className="px-3 py-3 text-center">
                        {def ? (
<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${n >= 5 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : n > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                            {n > 0 ? `${n} tabs` : 'limited'}
</span>
) : (
<span className="text-slate-300 dark:text-slate-600">—</span>
)}
</td>
);
})}
</tr>
);
})}
</tbody>
</table>
</div>
<p className="text-[11px] text-slate-400">Assign roles from Team. External stakeholders (client, consultant, subcontractor, supplier, compliance) use token portals, not seats.</p>
</div>
);
}

export default function PeopleSection(): React.JSX.Element {
  const { tab, role, projectId} = useConsole();
  const canInvite = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE'].includes(role);
  const livePid = projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : '';
  switch (tab) {
    case 'team': return<TeamView canInvite={canInvite} />;
    case 'crews': return<CrewsView canManage={canInvite || ['PM_QS','SUPERINTENDENT','SITE_SUPERVISOR','SITE_ENGINEER'].includes(role)} />;
    case 'subcontractors': return livePid ?<SubcontractorManagementView projectId={livePid} canAward={canInvite || ['PM_QS','SUPERINTENDENT'].includes(role)} /> :<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">Select a project to view subcontractors.</div>;
    case 'directory': return<DirectoryView />;
    case 'roles': return<RolesView />;
    default: return<TeamView canInvite={canInvite} />;
}
}
