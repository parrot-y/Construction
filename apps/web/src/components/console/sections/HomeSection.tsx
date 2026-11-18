import React, { useEffect, useState} from 'react';
import { useConsole} from '../ConsoleContext';
import InboxView from '../../InboxView';
import AnnouncementsView from '../../AnnouncementsView';
import { IconSpark} from '../icons';
import { api } from '../../../lib/api';

const CO_STATUSES = ['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW', 'APPROVED', 'REJECTED'];

/** Executive / admin / viewer home — portfolio KPIs + change-order pulse. */
function ExecHome(): React.JSX.Element {
  const { session, projects, projectId, setProjectId, setSection, setTab} = useConsole();
  const [dash, setDash] = useState<any>(null);
  const [coStats, setCoStats] = useState<Record<string, number>>({});
  const [openSnags, setOpenSnags] = useState(0);
  const [logToday, setLogToday] = useState<boolean | null>(null);
  const [clientRequests, setClientRequests] = useState(0);
  const [gettingStarted, setGettingStarted] = useState<{ hasBoq: boolean; hasTeam: boolean; hasQuote: boolean; hasPayments: boolean } | null>(null);
  const [invoiceStats, setInvoiceStats] = useState<{ unpaid: number; overdue: number } | null>(null);

  useEffect(() => {
    api.get('/api/v1/dashboard')
      .then((j: any) => { if (j?.data) setDash(j.data); })
      .catch(() => { /* intentionally ignored: dashboard metrics are optional */ });
    api.get('/api/v1/client/project-requests')
      .then((j: any) => {
        const list = j?.data || [];
        setClientRequests(list.filter((r: any) => r.status === 'NEW').length);
      })
      .catch(() => { /* intentionally ignored: attention badge is optional */ });
}, []);

  useEffect(() => {
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return;
    api.get(`/api/v1/projects/${projectId}/variations`)
      .then((j: any) => {
        const counts: Record<string, number> = {};
        for (const v of j?.data || []) counts[v.status] = (counts[v.status] || 0) + 1;
        setCoStats(counts);
      })
      .catch(() => { /* intentionally ignored: CO stats are optional */ });
    api.get(`/api/v1/projects/${projectId}/site-diaries`)
      .then((j: any) => {
        const today = new Date().toISOString().slice(0, 10);
        const list = j?.data || j || [];
        setLogToday(Array.isArray(list) && list.some((d: any) => String(d.entry_date || d.date || '').slice(0, 10) === today));
      })
      .catch(() => setLogToday(null));
    api.get(`/api/v1/projects/${projectId}/snags`)
      .then((j: any) => {
        const list = j?.data || j || [];
        setOpenSnags(list.filter?.((s: any) => ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW'].includes(s.status))?.length ?? 0);
      })
      .catch(() => { /* intentionally ignored: snag count is optional */ });
}, [projectId]);

  // A6 — get-started signals + invoice attention, fetched once per mount.
  useEffect(() => {
    const firstProject = projects[0]?.id;
    const get = (url: string) => api.get<any>(url).catch(() => null);

    void (async () => {
      const [members, invites, quotes, payments, boq] = await Promise.all([
        get('/api/v1/company/members'),
        get('/api/v1/invitations'),
        get('/api/v1/quotes'),
        get('/api/v1/company/payment-instructions'),
        firstProject && /^[0-9a-f-]{36}$/i.test(firstProject)
          ? get(`/api/v1/projects/${firstProject}/boq`)
          : Promise.resolve(null),
      ]);
      const memberList = members?.data || members?.members || [];
      const inviteList = invites?.data || invites || [];
      const quoteList = quotes?.quotes || quotes?.data || [];
      const payRaw = payments?.data?.paymentInstructions ?? payments?.paymentInstructions ?? null;
      const paymentsReady = payRaw != null && (typeof payRaw === 'string' ? payRaw.trim().length > 0 : Object.values(payRaw).some((v) => v != null && String(v).trim() !== ''));
      setGettingStarted({
        hasBoq: Boolean(boq?.data),
        hasTeam: memberList.length > 1 || (Array.isArray(inviteList) && inviteList.length > 0),
        hasQuote: Array.isArray(quoteList) && quoteList.length > 0,
        hasPayments: paymentsReady,
      });
    })();

    void get('/api/v1/invoices').then((j) => {
      const list = j?.invoices || j?.data || [];
      if (!Array.isArray(list)) return;
      const today = new Date().toISOString().slice(0, 10);
      const unpaid = list.filter((i: any) => !['PAID', 'VOID', 'WRITTEN_OFF'].includes(String(i.status)));
      const overdue = unpaid.filter((i: any) => i.due_date && String(i.due_date).slice(0, 10) < today);
      setInvoiceStats({ unpaid: unpaid.length, overdue: overdue.length });
    });
  }, [projects]);

  const m = dash?.metrics || {};
  const firstName = ((session.user.fullName || session.user.email || 'there').split(' ')[0] || 'there').toUpperCase();
  const hour = new Date().getHours();
  const greet = hour< 12 ? 'Morning' : hour< 17 ? 'Afternoon' : 'Evening';
  const openCO = CO_STATUSES.filter((s) => ['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW'].includes(s)).reduce((n, s) => n + (coStats[s] || 0), 0);
  const pendingApproval = coStats['OWNER_REVIEW'] || 0;
  const approved = coStats['APPROVED'] || 0;

  const kpis = [
    { label: 'Active projects', value: m.activeProjectsCount ?? projects.length, sub: `${m.totalProjectsCount ?? projects.length} total`},
    { label: 'Approved CO value', value: approved ? `${approved} COs` : '—', sub: 'approved change orders'},
    { label: 'Open change orders', value: openCO, sub: 'in progress', warn: openCO > 0},
    { label: 'Pending approval', value: pendingApproval, sub: 'awaiting owner', warn: pendingApproval > 0},
    { label: 'At-risk (>7d)', value: '—', sub: 'needs attention'},
    { label: 'Open snags', value: openSnags, sub: 'across site', warn: openSnags > 0},
  ];

  const insight = openCO === 0 && pendingApproval === 0
    ? 'No open change orders — budgets are stable. Maintain current commercial controls.'
    : `${openCO + pendingApproval} change order${openCO + pendingApproval === 1 ? '' : 's'} need attention — review under Projects → Change orders.`;

  // A6 — get-started checklist. Shows on a brand-new company and stays
  // until every step is done; each step deep-links to its screen.
  const gs = gettingStarted;
  const hasProject = projects.length > 0;
  const steps = [
    { label: 'Create your first project', done: hasProject, go: () => { setSection('projects'); setTab('all'); } },
    { label: 'Add a Bill of Quantities', done: Boolean(gs?.hasBoq), go: () => { setSection('money'); setTab('financials'); } },
    { label: 'Invite your team', done: Boolean(gs?.hasTeam), go: () => { setSection('people'); setTab('team'); } },
    { label: 'Create a quote', done: Boolean(gs?.hasQuote), go: () => { setSection('money'); setTab('quotes'); } },
    { label: 'Set up how you get paid', done: Boolean(gs?.hasPayments), go: () => { setSection('money'); setTab('invoices'); } },
  ];
  const stepsDone = steps.filter((s) => s.done).length;
  const showChecklist = !gs || stepsDone < steps.length;

  return (
<div className="space-y-6">
<div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
<div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-orange-600/20 blur-3xl" />
<p className="text-xs font-semibold text-orange-300 ">{greet}, {firstName}</p>
<h2 className="text-xl font-bold mt-1">Your projects, money and site activity at a glance.</h2>
<button onClick={() => { setSection('projects'); setTab('all');}}
          className="mt-4 px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition">
          Open projects →
</button>
</div>

      {showChecklist && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
<div className="flex items-center justify-between mb-3">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Get started</h3>
<p className="text-[11px] text-slate-400 mt-0.5">{stepsDone} of {steps.length} done — each step opens the exact screen.</p>
</div>
<span className="text-[11px] font-bold text-slate-400">{Math.round((stepsDone / steps.length) * 100)}%</span>
</div>
<div className="space-y-1.5">
            {steps.map((s, i) => (
<button key={s.label} onClick={s.go}
                className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition">
<span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${s.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                  {s.done ? '✓' : i + 1}
</span>
<span className={`text-xs font-semibold ${s.done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{s.label}</span>
<span className="ml-auto text-[10px] font-bold text-orange-600">{s.done ? 'Done' : 'Open →'}</span>
</button>
))}
</div>
</div>
)}

<div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 flex items-start gap-3">
<IconSpark className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
<div>
<p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Assistant insight</p>
<p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5">{insight}</p>
</div>
</div>

      {(logToday === false || openSnags > 0 || clientRequests > 0) && (
<div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
<p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-2">Needs your attention today</p>
<div className="space-y-1.5">
            {logToday === false && (
<button onClick={() => { setSection('site'); setTab('dailylog');}} className="w-full text-left flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-200 hover:underline">
<span>No site log today on {projects.find((p) => p.id === projectId)?.name || 'this project'}</span><span className="text-orange-600">Add log →</span>
</button>
)}
            {clientRequests > 0 && (
<button onClick={() => { setSection('projects'); setTab('correspondence');}} className="w-full text-left flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-200 hover:underline">
<span>{clientRequests} new client project request{clientRequests === 1 ? '' : 's'}</span><span className="text-orange-600">Review →</span>
</button>
)}
            {openSnags > 0 && (
<button onClick={() => { setSection('site'); setTab('punch');}} className="w-full text-left flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-200 hover:underline">
<span>{openSnags} open snag{openSnags === 1 ? '' : 's'}</span><span className="text-orange-600">Open punch list →</span>
</button>
)}
</div>
</div>
)}

      {projects.length > 0 && invoiceStats && (
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Projects needing attention', value: projects.filter((p) => p.status && !/COMPLETED|CLOSED|ARCHIVED/i.test(p.status)).length, warn: false, go: () => { setSection('projects'); setTab('all'); } },
            { label: 'Money waiting approval', value: pendingApproval, warn: pendingApproval > 0, go: () => { setSection('projects'); setTab('changeorders'); } },
            { label: 'Overdue invoices', value: invoiceStats.overdue, warn: invoiceStats.overdue > 0, go: () => { setSection('money'); setTab('invoices'); } },
            { label: 'Unpaid invoices', value: invoiceStats.unpaid, warn: invoiceStats.unpaid > 0, go: () => { setSection('money'); setTab('invoices'); } },
          ].map((s) => (
<button key={s.label} onClick={s.go}
              className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left hover:border-orange-400 transition">
<p className="text-[10px] font-bold text-slate-400">{s.label}</p>
<p className={`text-xl font-bold mt-1 ${s.warn ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{s.value}</p>
<p className="text-[10px] text-orange-600 font-bold mt-0.5">Open list →</p>
</button>
))}
</div>
)}

<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
<button key={k.label} type="button"
          onClick={() => {
            if (k.label === 'Open snags') { setSection('site'); setTab('punch'); }
            else if (k.label === 'Active projects' || k.label === 'At-risk (>7d)') { setSection('projects'); setTab('all'); }
            else { setSection('projects'); setTab('changeorders'); }
          }}
          className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left hover:border-orange-400 transition">
<p className="text-[10px] font-bold text-slate-400">{k.label}</p>
<p className={`text-xl font-bold mt-1 ${k.warn ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{k.value}</p>
<p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
</button>
))}
</div>

<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
<div className="flex items-center justify-between mb-4">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Change Orders by Status</h3>
<button onClick={() => { setSection('projects'); setTab('changeorders');}} className="text-[11px] font-bold text-orange-600 hover:underline">View all →</button>
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
            ['Materials & equipment', 'money', 'inventory'],
            ['Site & daily logs', 'site', 'dailylog'],
            ['Team, roles & crews', 'people', 'team'],
            ['Planning & schedule', 'projects', 'schedule'],
            ['Quality & inspections', 'site', 'inspections'],
            ['Health & safety', 'site', 'safety'],
            ['Suppliers & subcontractors', 'people', 'subcontractors'],
            ['Money & reports', 'files', 'reports'],
            ['Letters & contracts', 'projects', 'correspondence'],
            ['Drawings & architecture', 'projects', 'drawings'],
            ['Interior design', 'projects', 'drawings'],
          ].map(([label, sec, tab]) => (
<button key={label as string}
              onClick={() => { setSection(sec as any); setTab(tab as any);}}
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

/** Field-role home — today's work first (diary, headcount, snags, safety),
 *  team inbox below. */
function FieldHome(): React.JSX.Element {
  const { tab, session, projects, projectId, setSection, setTab } = useConsole();
  const [logToday, setLogToday] = useState<boolean | null>(null);
  const [openSnags, setOpenSnags] = useState(0);
  const [presentToday, setPresentToday] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
      setLogToday(null); setOpenSnags(0); setPresentToday(null);
      return;
    }
    api.get(`/api/v1/projects/${projectId}/site-diaries`)
      .then((j: any) => {
        const today = new Date().toISOString().slice(0, 10);
        const list = j?.data || j || [];
        setLogToday(Array.isArray(list) && list.some((d: any) => String(d.entry_date || d.date || '').slice(0, 10) === today));
      })
      .catch(() => setLogToday(null));
    api.get(`/api/v1/projects/${projectId}/snags`)
      .then((j: any) => {
        const list = j?.data || j || [];
        setOpenSnags(list.filter?.((s: any) => ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW'].includes(s.status))?.length ?? 0);
      })
      .catch(() => { /* intentionally ignored: snag count is optional */ });
    api.get(`/api/v1/projects/${projectId}/attendance`)
      .then((j: any) => setPresentToday(typeof j?.summary?.present === 'number' ? j.summary.present : null))
      .catch(() => { /* intentionally ignored: headcount is optional */ });
  }, [projectId]);

  if (tab === 'announcements') return <AnnouncementsView canManage={false} />;

  const pname = projects.find((p) => p.id === projectId)?.name;
  const actions = [
    {
      label: "Log today's diary",
      desc: logToday === true ? 'Site log done today' : logToday === false ? 'Not logged yet' : 'Weather, labour, work done',
      tab: 'dailylog',
      warn: logToday === false,
    },
    {
      label: "Today's headcount",
      desc: presentToday != null ? `${presentToday} present today` : 'Attendance register',
      tab: 'attendance',
    },
    {
      label: 'Open snags',
      desc: `${openSnags} snag${openSnags === 1 ? '' : 's'} open`,
      tab: 'punch',
      warn: openSnags > 0,
    },
    {
      label: 'Report safety incident',
      desc: 'Incident register',
      tab: 'safety',
    },
  ];

  return (
<div className="space-y-6">
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Today's work{pname ? ` — ${pname}` : ''}</h2>
<p className="text-[11px] text-slate-400 mt-0.5">Start here: site log, headcount, snags and safety for today.</p>
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {actions.map((a) => (
<button key={a.tab} onClick={() => { setSection('site'); setTab(a.tab); }}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition">
<p className={`text-xs font-bold ${a.warn ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{a.label}</p>
<p className="text-[10px] text-slate-400 mt-1">{a.desc}</p>
</button>
))}
</div>
</div>
<InboxView currentUserId={session.user.id} />
</div>
);
}

export default function HomeSection(): React.JSX.Element {
  const { nav, tab} = useConsole();
  if (nav.homeKind === 'field') return<FieldHome />;
  if (tab === 'inbox') return<PmInbox />;
  if (tab === 'announcements') return<AnnouncementsView canManage={false} />;
  if (nav.homeKind === 'pm') return<ExecHome />;
  return<ExecHome />;
}

function PmInbox(): React.JSX.Element {
  const { session} = useConsole();
  return<InboxView currentUserId={session.user.id} />;
}
