import React, { useCallback, useEffect, useState } from 'react';
import { useConsole } from './console/ConsoleContext';

interface ChecklistStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  section: string;
  tab: string;
}

/**
 * Guided project checklist — each step is derived from real API data and
 * deep-links to the screen where the work happens. Shown on the project
 * overview (Projects → All) for the selected project.
 */
export default function ProjectChecklist({ projectId }: { projectId: string }): React.JSX.Element | null {
  const { setSection, setTab } = useConsole();
  const [steps, setSteps] = useState<ChecklistStep[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) { setSteps(null); return; }
    setError(false);
    const get = (url: string) =>
      fetch(url, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    const [project, quotes, diaries, certs, invoices, closeout] = await Promise.all([
      get(`/api/v1/projects/${projectId}`),
      get(`/api/v1/quotes?projectId=${projectId}&status=ACCEPTED`),
      get(`/api/v1/projects/${projectId}/site-diaries`),
      get(`/api/v1/projects/${projectId}/payment-certificates`),
      get(`/api/v1/invoices?projectId=${projectId}&status=PAID`),
      get(`/api/v1/projects/${projectId}/closeout`),
    ]);

    if (!project?.data) { setError(true); setSteps(null); return; }

    const p = project.data;
    const quoteAccepted = (quotes?.quotes || quotes?.data || []).length > 0;
    const boqImported = Array.isArray(p.boqs) && p.boqs.length > 0;
    const teamAssigned = Array.isArray(p.members) && p.members.length > 0;
    const diaryList = diaries?.data || diaries || [];
    const firstDiary = Array.isArray(diaryList) && diaryList.length > 0;
    const certList = certs?.data || [];
    const firstCert = Array.isArray(certList) && certList.length > 0;
    const invList = invoices?.invoices || invoices?.data || [];
    const firstInvoicePaid = Array.isArray(invList) && invList.length > 0;
    const closeoutStage = closeout?.data?.stage;
    const closed = closeoutStage === 'CLOSED';

    setSteps([
      { key: 'quote', label: 'Quote accepted', hint: 'Client accepted a quote for this project', done: quoteAccepted, section: 'money', tab: 'quotes' },
      { key: 'boq', label: 'BoQ imported', hint: 'Bill of quantities loaded and priced', done: boqImported, section: 'money', tab: 'boq' },
      { key: 'team', label: 'Team assigned', hint: 'PM, QS and site roles assigned to the project', done: teamAssigned, section: 'people', tab: 'team' },
      { key: 'diary', label: 'First site diary', hint: 'Daily site log filed by the supervisor', done: firstDiary, section: 'site', tab: 'dailylog' },
      { key: 'cert', label: 'First certificate', hint: 'Interim payment certificate certified', done: firstCert, section: 'money', tab: 'certificates' },
      { key: 'invoice', label: 'First invoice paid', hint: 'A client invoice recorded as paid', done: firstInvoicePaid, section: 'money', tab: 'invoices' },
      { key: 'closeout', label: 'Closeout', hint: closeoutStage && closeoutStage !== 'IN_PROGRESS' ? `Closeout stage: ${closeoutStage.replace(/_/g, ' ')}` : 'Practical completion through to closed', done: closed, section: 'money', tab: 'certificates' },
    ]);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (error) return null;
  if (!steps) {
    return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
<p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Project checklist</p>
<p className="text-xs text-slate-400">Loading progress…</p>
</div>
);
  }

  const doneCount = steps.filter((s) => s.done).length;

  return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
<div className="flex items-center justify-between mb-3">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Project checklist</h3>
<span className="text-[11px] font-bold text-slate-500">{doneCount} of {steps.length} done</span>
</div>
<div className="space-y-1.5">
      {steps.map((s, i) => (
<button
          key={s.key}
          onClick={() => { setSection(s.section as any); setTab(s.tab); }}
          className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition"
        >
<span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
            s.done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400'
          }`}>
            {s.done ? '✓' : i + 1}
</span>
<span className="min-w-0">
<span className={`block text-xs font-bold ${s.done ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{s.label}</span>
<span className="block text-[10px] text-slate-400 truncate">{s.hint}</span>
</span>
<span className="ml-auto text-[10px] font-bold text-orange-600 shrink-0">{s.done ? 'View' : 'Go →'}</span>
</button>
))}
</div>
</div>
);
}
