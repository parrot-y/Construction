import React, { useEffect, useState } from 'react';
import { useConsole } from '../ConsoleContext';
import InboxView from '../../InboxView';
import AnnouncementsView from '../../AnnouncementsView';
import { IconSpark } from '../icons';

const CO_STATUSES = ['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW', 'APPROVED', 'REJECTED'];

/** Executive / admin / viewer home — portfolio KPIs + change-order pulse. */
function ExecHome(): React.JSX.Element {
  const { session, projects, projectId, setProjectId, setSection, setTab } = useConsole();
  const [dash, setDash] = useState<any>(null);
  const [coStats, setCoStats] = useState<Record<string, number>>({});
  const [openSnags, setOpenSnags] = useState(0);

  useEffect(() => {
    fetch('/api/v1/dashboard', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data && setDash(j.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return;
    fetch(`/api/v1/projects/${projectId}/variations`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const counts: Record<string, number> = {};
        for (const v of j.data || []) counts[v.status] = (counts[v.status] || 0) + 1;
        setCoStats(counts);
      })
      .catch(() => {});
    fetch(`/api/v1/projects/${projectId}/snags`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const list = j.data || j || [];
        setOpenSnags(list.filter?.((s: any) => ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW'].includes(s.status))?.length ?? 0);
      })
      .catch(() => {});
  }, [projectId]);

  const m = dash?.metrics || {};
  const firstName = ((session.user.fullName || session.user.email || 'there').split(' ')[0] || 'there').toUpperCase();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const openCO = CO_STATUSES.filter((s) => ['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW'].includes(s)).reduce((n, s) => n + (coStats[s] || 0), 0);
  const pendingApproval = coStats['OWNER_REVIEW'] || 0;
  const approved = coStats['APPROVED'] || 0;

  const kpis = [
    { label: 'Active projects', value: m.activeProjectsCount ?? projects.length, sub: `${m.totalProjectsCount ?? projects.length} total` },
    { label: 'Approved CO value', value: approved ? `${approved} COs` : '—', sub: 'approved change orders' },
    { label: 'Open change orders', value: openCO, sub: 'in progress', warn: openCO > 0 },
    { label: 'Pending approval', value: pendingApproval, sub: 'awaiting owner', warn: pendingApproval > 0 },
    { label: 'At-risk (>7d)', value: '—', sub: 'needs attention' },
    { label: 'Open snags', value: openSnags, sub: 'across site', warn: openSnags > 0 },
  ];

  const insight = openCO === 0 && pendingApproval === 0
    ? 'No open change orders — budgets are stable. Maintain current commercial controls.'
    : `${openCO + pendingApproval} change order${openCO + pendingApproval === 1 ? '' : 's'} need attention — review under Projects → Change orders.`;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-orange-600/20 blur-3xl" />
        <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider">{greet}, {firstName}</p>
        <h2 className="text-xl font-bold mt-1">Your projects, money and site activity at a glance.</h2>
        <button onClick={() => { setSection('projects'); setTab('all'); }}
          className="mt-4 px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition">
          Open projects →
        </button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 flex items-start gap-3">
        <IconSpark className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Assistant insight</p>
          <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5">{insight}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.warn ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Change Orders by Status</h3>
          <button onClick={() => { setSection('projects'); setTab('changeorders'); }} className="text-[11px] font-bold text-orange-600 hover:underline">View all →</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {CO_STATUSES.map((s) => (
            <div key={s} className="flex-1 min-w-[90px] bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{coStats[s] || 0}</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{s.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Workspace modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            ['Projects & clients', 'projects', 'all'],
            ['Quotes & estimates', 'money', 'quotes'],
            ['Invoices & payments', 'money', 'invoices'],
            ['Budgeting & cost control', 'money', 'financials'],
            ['Site & daily logs', 'site', 'dailylog'],
            ['Planning & schedule', 'projects', 'schedule'],
            ['Quality & inspections', 'site', 'inspections'],
            ['Health & safety', 'site', 'safety'],
            ['Suppliers & subcontractors', 'people', 'subcontractors'],
            ['Money & reports', 'files', 'reports'],
            ['Letters & contracts', 'projects', 'correspondence'],
            ['Drawings & architecture', 'projects', 'drawings'],
          ].map(([label, sec, tab]) => (
            <button key={label as string}
              onClick={() => { setSection(sec as any); setTab(tab as any); }}
              className="text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition">
              {label}
            </button>
          ))}
        </div>
      </div>

      {projects.length > 1 && (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Portfolio</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {projects.map((p) => (
              <button key={p.id} onClick={() => setProjectId(p.id)}
                className={`text-left px-4 py-3 rounded-xl border text-xs font-semibold transition ${projectId === p.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Field-role home — team inbox + announcements (reference pattern). */
function FieldHome(): React.JSX.Element {
  const { tab, session } = useConsole();
  if (tab === 'announcements') return <AnnouncementsView canManage={false} />;
  return <InboxView currentUserId={session.user.id} />;
}

export default function HomeSection(): React.JSX.Element {
  const { nav, tab } = useConsole();
  if (nav.homeKind === 'field') return <FieldHome />;
  if (tab === 'inbox') return <PmInbox />;
  if (tab === 'announcements') return <AnnouncementsView canManage={false} />;
  if (nav.homeKind === 'pm') return <ExecHome />;
  return <ExecHome />;
}

function PmInbox(): React.JSX.Element {
  const { session } = useConsole();
  return <InboxView currentUserId={session.user.id} />;
}
