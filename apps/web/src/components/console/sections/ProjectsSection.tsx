import React, { useEffect, useState } from 'react';
import { useConsole } from '../ConsoleContext';
import { SUBTAB_LABELS } from '../navConfig';
import ProjectScheduleGanttView from '../../ProjectScheduleGanttView';
import DrawingsView from '../../DrawingsView';
import VariationManagementView from '../../VariationManagementView';
import RfiManagementView from '../../RfiManagementView';
import CorrespondenceView from '../../CorrespondenceView';
import { IconPlus } from '../icons';
import PortalAccessLinkManager from '../../PortalAccessLinkManager';

const FILTERS = ['All', 'Active', 'At Risk', 'Planning', 'Closing', 'Archived'];

function ProjectsAll({ canEdit }: { canEdit: boolean }): React.JSX.Element {
  const { projects, projectId, setProjectId, setPortalPreview } = useConsole();
  const livePidCheck = /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : '';
  const [filter, setFilter] = useState('All');
  const [recentCos, setRecentCos] = useState<any[]>([]);
  const [coCounts, setCoCounts] = useState<Record<string, { count: number; value: number }>>({});

  useEffect(() => {
    // Latest change orders across projects for the activity strip
    Promise.all(
      projects.slice(0, 5).map((p) =>
        fetch(`/api/v1/projects/${p.id}/variations`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .then((j) => (j.data || []).map((v: any) => ({ ...v, projectName: p.name })))
          .catch(() => []),
      ),
    ).then((lists) => {
      const all = lists.flat().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
      setRecentCos(all);
      const counts: Record<string, { count: number; value: number }> = {};
      for (const v of lists.flat()) {
        const k = v.project_id || v.projectName;
        counts[k] = counts[k] || { count: 0, value: 0 };
        counts[k].count += 1;
        counts[k].value += Number(v.net_amount ?? v.amount ?? 0) || 0;
      }
      setCoCounts(counts);
    });
  }, [projects]);

  const statusOf = (p: any) => (p.status || 'ACTIVE').toUpperCase();
  const visible = projects.filter((p) => {
    const st = statusOf(p);
    if (filter === 'All') return true;
    if (filter === 'Active') return st === 'ACTIVE' || st === 'ON_TRACK';
    if (filter === 'At Risk') return st === 'AT_RISK';
    if (filter === 'Planning') return st === 'PLANNING';
    if (filter === 'Closing') return st === 'CLOSING';
    if (filter === 'Archived') return st === 'ARCHIVED' || st === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === f ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}>
              {f}
            </button>
          ))}
        </div>
        {canEdit && (
          <button className="px-3.5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1.5">
            <IconPlus className="w-3.5 h-3.5" /> New project
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No projects in this view</p>
          <p className="text-xs text-slate-400 mt-1">Projects you can access will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className={`text-left bg-white dark:bg-slate-800/60 border rounded-2xl p-5 transition hover:shadow-md ${
                projectId === p.id ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{p.code}</p>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">{p.name}</h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${
                  statusOf(p) === 'ACTIVE' || statusOf(p) === 'ON_TRACK'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                }`}>
                  {statusOf(p).replace(/_/g, ' ')}
                </span>
              </div>
              {p.location && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{p.location}</p>}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{p.contract_currency || 'KES'} {Number(p.original_contract_sum || 0).toLocaleString()}</span> value
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{coCounts[p.id]?.count ?? 0}</span> COs
                </span>
                {(coCounts[p.id]?.value ?? 0) > 0 && (
                  <span className="text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{coCounts[p.id]!.value.toLocaleString()}</span> CO value
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mt-3">Open workspace →</p>
            </button>
          ))}
        </div>
      )}

      {livePidCheck && (
        <PortalAccessLinkManager projectId={livePidCheck} onPreviewPortal={(t, token, name, role) => setPortalPreview({ type: t, token, name, role })} />
      )}

      {recentCos.length > 0 && (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recent Activity</h3>
            <span className="text-[11px] text-slate-400">Latest change orders</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-2.5 font-semibold">Project</th>
                  <th className="px-3 py-2.5 font-semibold">CO #</th>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {recentCos.map((v: any) => (
                  <tr key={v.id} className="text-slate-700 dark:text-slate-300">
                    <td className="px-5 py-2.5 font-medium">{v.projectName}</td>
                    <td className="px-3 py-2.5 font-mono">{v.co_number || v.id?.slice(0, 8)}</td>
                    <td className="px-3 py-2.5 max-w-[260px] truncate">{v.title || v.description || '—'}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold">{v.status}</span></td>
                    <td className="px-5 py-2.5 text-right font-mono">{v.currency || 'KES'} {v.net_amount ?? v.amount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsSection(): React.JSX.Element {
  const { tab, projectId: pid, projects, role } = useConsole();
  const canEdit = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE', 'PM_QS', 'SUPERINTENDENT', 'SITE_ENGINEER'].includes(role);
  const projectName = projects.find((p) => p.id === pid)?.name;
  const livePid = pid && /^[0-9a-f-]{36}$/i.test(pid) ? pid : undefined;

  if (tab === 'all') return <ProjectsAll canEdit={canEdit} />;
  if (!livePid) {
    return <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">Select a project to view {SUBTAB_LABELS[tab] || tab}.</div>;
  }
  switch (tab) {
    case 'schedule': return <ProjectScheduleGanttView projectId={livePid} canEdit={canEdit} />;
    case 'drawings': return <DrawingsView projectId={livePid} canManage={canEdit} />;
    case 'changeorders': return <VariationManagementView projectId={livePid} userRole={role} canRequest={canEdit} canReview={canEdit} canApprove={['COMPANY_ADMIN','ADMIN','EXECUTIVE','CLIENT'].includes(role)} />;
    case 'coordination': return <RfiManagementView projectId={livePid} projectName={projectName} canCreate={canEdit} />;
    case 'correspondence': return <CorrespondenceView canManage={canEdit} />;
    default: return <ProjectsAll canEdit={canEdit} />;
  }
}
