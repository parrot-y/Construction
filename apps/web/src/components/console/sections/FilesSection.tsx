import React, { useEffect, useState } from 'react';
import { useConsole } from '../ConsoleContext';
import CompanyDocumentsView from '../../CompanyDocumentsView';
import ScheduledReportsView from '../../ScheduledReportsView';

const PERIODS = ['7D', '30D', 'QTD', 'YTD'];

const REPORT_LINKS = [
  { label: 'Interim Payment Certificate (IPC)', path: (pid: string) => `/api/v1/projects/${pid}/reports/ipc`, desc: 'Certified valuation for the current period' },
  { label: 'Project Summary', path: (pid: string) => `/api/v1/projects/${pid}/reports/summary`, desc: 'Budget, spend and progress snapshot' },
  { label: 'Cost Report', path: (pid: string) => `/api/v1/projects/${pid}/reports/cost`, desc: 'Cost ledger by category' },
];

/** Reports — period selector + export cards (reference "Reports" tab). */
function ReportsView(): React.JSX.Element {
  const { projectId, projects } = useConsole();
  const [period, setPeriod] = useState('30D');
  const [coMetrics, setCoMetrics] = useState<{ total: number; approvalRate: number | null; medianCycle: number | null; reworkRate: number | null } | null>(null);
  const livePid = projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : '';
  const pname = projects.find((p) => p.id === projectId)?.name;

  useEffect(() => {
    if (!livePid) { setCoMetrics(null); return; }
    fetch(`/api/v1/projects/${livePid}/variations`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const rows = (j.data || j || []) as any[];
        if (!rows.length) { setCoMetrics(null); return; }
        const total = rows.reduce((a, v) => a + Number(v.amount_approved ?? v.amount ?? v.value ?? 0), 0);
        const approved = rows.filter((v) => v.status === 'APPROVED').length;
        const rejected = rows.filter((v) => ['REJECTED', 'REWORK_REQUIRED'].includes(v.status)).length;
        const cycles = rows
          .filter((v) => v.status === 'APPROVED' && v.created_at && v.updated_at)
          .map((v) => (new Date(v.updated_at).getTime() - new Date(v.created_at).getTime()) / 86400000)
          .filter((d) => d >= 0)
          .sort((a, b) => a - b);
        const median = cycles.length ? (cycles[Math.floor(cycles.length / 2)] ?? null) : null;
        setCoMetrics({
          total,
          approvalRate: Math.round((approved / rows.length) * 100),
          medianCycle: median === null ? null : Math.round(median * 10) / 10,
          reworkRate: Math.round((rejected / rows.length) * 100),
        });
      })
      .catch(() => setCoMetrics(null));
  }, [livePid]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reports</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Financial and operational reporting across your projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400">Period</span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === p ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {coMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Total CO Value', `KES ${coMetrics.total.toLocaleString()}`, 'all change orders'],
            ['Approval Rate', coMetrics.approvalRate === null ? '—' : `${coMetrics.approvalRate}%`, 'of submitted COs'],
            ['Median Cycle', coMetrics.medianCycle === null ? '—' : `${coMetrics.medianCycle}d`, 'submit → decision'],
            ['Rework Rate', `${coMetrics.reworkRate}%`, 'rejected or rework'],
          ].map(([label, value, sub]) => (
            <div key={label as string} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_LINKS.map((r) => (
          <div key={r.label} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.label}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex-1">{r.desc}</p>
            {livePid ? (
              <a href={r.path(livePid)} download
                className="mt-4 inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-lg hover:opacity-90">
                Export PDF
              </a>
            ) : (
              <span className="mt-4 text-[11px] text-slate-400">Select a project</span>
            )}
          </div>
        ))}
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">BOQ workbook</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex-1">Active bill of quantities as Excel.</p>
          {livePid ? (
            <a href={`/api/v1/projects/${livePid}/boq/export`} download
              className="mt-4 inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">
              Export Excel
            </a>
          ) : (
            <span className="mt-4 text-[11px] text-slate-400">Select a project</span>
          )}
        </div>
      </div>

      {pname && <p className="text-[11px] text-slate-400">Project: {pname} · period {period} (filters apply to scheduled reports below)</p>}
      <ScheduledReportsView canManage={false} />
    </div>
  );
}

export default function FilesSection(): React.JSX.Element {
  const { tab } = useConsole();
  switch (tab) {
    case 'reports': return <ReportsView />;
    case 'companydocs': return <CompanyDocumentsView canManage />;
    case 'unfiled': return <CompanyDocumentsView canManage initialTab="UNFILED" />;
    default: return <CompanyDocumentsView canManage />;
  }
}
