import React, { useEffect, useState} from 'react';
import { useConsole} from '../ConsoleContext';
import InboxView from '../../InboxView';
import AnnouncementsView from '../../AnnouncementsView';
import { api } from '../../../lib/api';
import HomeDashboard from '../dashboard/HomeDashboard';

/** Executive / admin / viewer home — portfolio KPIs + change-order pulse. */
function ExecHome(): React.JSX.Element {
  const { session, projects, projectsLoaded, members, projectId, setSection, setTab} = useConsole();
  const [coStats, setCoStats] = useState<Record<string, number>>({});
  const [openSnags, setOpenSnags] = useState(0);
  const [logToday, setLogToday] = useState<boolean | null>(null);
  const [clientRequests, setClientRequests] = useState(0);
  const [gettingStarted, setGettingStarted] = useState<{ hasBoq: boolean; hasTeam: boolean; hasQuote: boolean; hasPayments: boolean } | null>(null);
  const [invoiceStats, setInvoiceStats] = useState<{ unpaid: number; overdue: number } | null>(null);

  useEffect(() => {
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

  // A6 — get-started signals + invoice attention. These five calls do not
  // depend on the project list, so they run once on mount (P4.1: the old
  // [projects] dep refired them all when the list populated).
  useEffect(() => {
    const get = (url: string) => api.get<any>(url).catch(() => null);

    void (async () => {
      const [invites, quotes, payments] = await Promise.all([
        get('/api/v1/invitations'),
        get('/api/v1/quotes'),
        get('/api/v1/company/payment-instructions'),
      ]);
      const inviteList = invites?.data || invites || [];
      const quoteList = quotes?.quotes || quotes?.data || [];
      const payRaw = payments?.data?.paymentInstructions ?? payments?.paymentInstructions ?? null;
      const paymentsReady = payRaw != null && (typeof payRaw === 'string' ? payRaw.trim().length > 0 : Object.values(payRaw).some((v) => v != null && String(v).trim() !== ''));
      setGettingStarted((prev) => ({
        hasBoq: prev?.hasBoq ?? false,
        hasTeam: Array.isArray(inviteList) && inviteList.length > 0,
        hasQuote: Array.isArray(quoteList) && quoteList.length > 0,
        hasPayments: paymentsReady,
      }));
    })();

    void get('/api/v1/invoices').then((j) => {
      const list = j?.invoices || j?.data || [];
      if (!Array.isArray(list)) return;
      const today = new Date().toISOString().slice(0, 10);
      const unpaid = list.filter((i: any) => !['PAID', 'VOID', 'WRITTEN_OFF'].includes(String(i.status)));
      const overdue = unpaid.filter((i: any) => i.due_date && String(i.due_date).slice(0, 10) < today);
      setInvoiceStats({ unpaid: unpaid.length, overdue: overdue.length });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- members is read via closure at render, not needed here
  }, []);

  // BoQ presence depends on the first project — fetched separately so the
  // checklist doesn't refire the whole batch when projects load.
  const firstProjectId = projects[0]?.id;
  useEffect(() => {
    if (!firstProjectId || !/^[0-9a-f-]{36}$/i.test(firstProjectId)) return;
    api.get(`/api/v1/projects/${firstProjectId}/boq`)
      .then((j: any) => {
        setGettingStarted((prev) => ({
          hasBoq: Boolean(j?.data),
          hasTeam: prev?.hasTeam ?? false,
          hasQuote: prev?.hasQuote ?? false,
          hasPayments: prev?.hasPayments ?? false,
        }));
      })
      .catch(() => {
        // intentionally ignored: BoQ presence is optional
      });
  }, [firstProjectId]);

  const firstName = ((session.user.fullName || session.user.email || 'there').split(' ')[0] || 'there');
  const hour = new Date().getHours();
  const greet = hour< 12 ? 'Good morning' : hour< 17 ? 'Good afternoon' : 'Good evening';
  const pendingApproval = coStats['OWNER_REVIEW'] || 0;

  // A6 — get-started checklist. Shows on a brand-new company and stays
  // until every step is done; each step deep-links to its screen.
  const gs = gettingStarted;
  const hasProject = projects.length > 0;
  const steps = [
    { label: 'Create your first project', done: hasProject, go: () => { setSection('projects'); setTab('all'); } },
    { label: 'Add a Bill of Quantities', done: Boolean(gs?.hasBoq), go: () => { setSection('money'); setTab('financials'); } },
    { label: 'Invite your team', done: Boolean(gs?.hasTeam) || members.length > 1, go: () => { setSection('people'); setTab('team'); } },
    { label: 'Create a quote', done: Boolean(gs?.hasQuote), go: () => { setSection('money'); setTab('quotes'); } },
    { label: 'Set up how you get paid', done: Boolean(gs?.hasPayments), go: () => { setSection('money'); setTab('invoices'); } },
  ];
  const stepsDone = steps.filter((s) => s.done).length;
  const showChecklist = !gs || stepsDone < steps.length;
  // Attention items feed the dashboard's "Needs you now" block — each links
  // to the exact screen behind the number.
  const pname = projects.find((p) => p.id === projectId)?.name;
  const attentionItems = [
    logToday === false ? { label: `No site log today${pname ? ` on ${pname}` : ''}`, detail: "File today's diary", section: 'site', tab: 'dailylog', tone: 'warn' as const } : null,
    clientRequests > 0 ? { label: `${clientRequests} new client project request${clientRequests === 1 ? '' : 's'}`, detail: 'Review under Projects → Correspondence', section: 'projects', tab: 'correspondence', tone: 'info' as const } : null,
    openSnags > 0 ? { label: `${openSnags} open snag${openSnags === 1 ? '' : 's'}`, detail: 'Open the punch list', section: 'site', tab: 'punch', tone: 'warn' as const } : null,
    pendingApproval > 0 ? { label: `${pendingApproval} change order${pendingApproval === 1 ? '' : 's'} awaiting approval`, detail: 'Maker-checker review', section: 'projects', tab: 'changeorders', tone: 'bad' as const } : null,
    invoiceStats && invoiceStats.overdue > 0 ? { label: `${invoiceStats.overdue} overdue invoice${invoiceStats.overdue === 1 ? '' : 's'}`, detail: 'Chase payment', section: 'money', tab: 'invoices', tone: 'bad' as const } : null,
    invoiceStats && invoiceStats.unpaid > 0 ? { label: `${invoiceStats.unpaid} unpaid invoice${invoiceStats.unpaid === 1 ? '' : 's'}`, detail: 'Not yet settled', section: 'money', tab: 'invoices', tone: 'info' as const } : null,
  ].filter(Boolean) as any[];

  // A6 — aggregate attention stats; every number links to the list behind it.
  const attentionStats = projects.length > 0 && invoiceStats ? [
    { label: 'Projects needing attention', value: projects.filter((p) => p.status && !/COMPLETED|CLOSED|ARCHIVED/i.test(p.status)).length, section: 'projects', tab: 'all' },
    { label: 'Money waiting approval', value: pendingApproval, warn: pendingApproval > 0, section: 'projects', tab: 'changeorders' },
    { label: 'Overdue invoices', value: invoiceStats.overdue, warn: invoiceStats.overdue > 0, section: 'money', tab: 'invoices' },
    { label: 'Unpaid invoices', value: invoiceStats.unpaid, warn: invoiceStats.unpaid > 0, section: 'money', tab: 'invoices' },
  ] : [];

  const selectedProject = projects.find((p) => p.id === projectId) || projects[0];

  return (
<div className="space-y-6">
<div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
<p className="text-xs font-semibold text-orange-600">{greet}, {firstName}</p>
<h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Your projects, money and site activity at a glance.</h2>
<button onClick={() => { setSection('projects'); setTab('all'); }}
          className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-700">
          Open projects
</button>
</div>

      {showChecklist && (
<div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
<div className="mb-3 flex items-center justify-between">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Get started</h3>
<p className="mt-0.5 text-xs text-slate-500">{stepsDone} of {steps.length} done — each step opens the exact screen.</p>
</div>
<span className="text-xs font-bold text-slate-500">{Math.round((stepsDone / steps.length) * 100)}%</span>
</div>
<div className="space-y-1.5">
            {steps.map((st, i) => (
<button key={st.label} onClick={st.go}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-orange-400 hover:bg-orange-50 dark:border-slate-700 dark:hover:bg-orange-950/20">
<span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${st.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                  {st.done ? '✓' : i + 1}
</span>
<span className={`text-xs font-semibold ${st.done ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{st.label}</span>
<span className="ml-auto text-xs font-bold text-orange-600">{st.done ? 'Done' : 'Open →'}</span>
</button>
))}
</div>
</div>
)}

<HomeDashboard
        attentionItems={attentionItems}
        attentionStats={attentionStats}
        attentionLoading={false}
        projects={projects as any}
        projectsReady={projectsLoaded}
        selectedProject={selectedProject as any}
        onNavigate={(sec, tab) => { setSection(sec as any); setTab(tab as any); }}
      />
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
<p className="text-xs text-slate-500 mt-0.5">Start here: site log, headcount, snags and safety for today.</p>
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {actions.map((a) => (
<button key={a.tab} onClick={() => { setSection('site'); setTab(a.tab); }}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition">
<p className={`text-xs font-bold ${a.warn ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{a.label}</p>
<p className="text-xs text-slate-500 mt-1">{a.desc}</p>
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
