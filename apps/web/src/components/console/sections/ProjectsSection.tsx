import React, { useEffect, useState} from 'react';
import { PROJECT_TYPE_CATEGORIES, projectTypeCategory } from '@construction/validation';
import { formatKes } from '../../../ui';
import { statusLabel } from '../../../lib/status-labels';
import { useConsole} from '../ConsoleContext';
import { SUBTAB_LABELS} from '../navConfig';
import ProjectScheduleGanttView from '../../ProjectScheduleGanttView';
import DrawingsView from '../../DrawingsView';
import VariationManagementView from '../../VariationManagementView';
import RfiManagementView from '../../RfiManagementView';
import CorrespondenceView from '../../CorrespondenceView';
import { IconPlus} from '../icons';
import PortalAccessLinkManager from '../../PortalAccessLinkManager';
import ProjectChecklist from '../../ProjectChecklist';
import NewProjectModal from '../../NewProjectModal';
import ProjectSettingsModal from '../../ProjectSettingsModal';
import { api } from '../../../lib/api';

const FILTERS = ['All', 'Active', 'At Risk', 'Planning', 'Closing', 'Archived'];

function ProjectsAll({ canEdit}: { canEdit: boolean}): React.JSX.Element {
  const { projects, projectId, setProjectId, setPortalPreview, refreshProjects} = useConsole();
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const livePidCheck = /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : '';
  const [filter, setFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [recentCos, setRecentCos] = useState<any[]>([]);
  const [coCounts, setCoCounts] = useState<Record<string, { count: number; value: number}>>({});

  useEffect(() => {
    // P1.7 — ONE summary call replaces the per-project /variations fan-out.
    api.get<{ data?: any[]; recent?: any[] }>('/api/v1/variations/summary')
      .then((j) => {
        setRecentCos((j.recent || []).slice(0, 6));
        const counts: Record<string, { count: number; value: number}> = {};
        for (const row of j.data || []) {
          counts[row.project_id] = { count: row.count, value: Number(row.net_total) || 0 };
        }
        setCoCounts(counts);
      })
      .catch(() => { /* intentionally ignored: CO strip stays empty on failure */ });
}, [projects]);

  const statusOf = (p: any) => (p.status || 'ACTIVE').toUpperCase();
  const visible = projects.filter((p) => {
    const st = statusOf(p);
    if (typeFilter !== 'All' && (p.project_type || 'UNTYPED') !== typeFilter) return false;
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
<button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === f ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
}`}>
              {f}
</button>
))}
<select
            aria-label="Filter by project type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <option value="All">All types</option>
            {PROJECT_TYPE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            <option value="UNTYPED">No type set</option>
</select>
</div>
        {canEdit && (
<button onClick={() => setShowCreate(true)}
            className="px-3.5 py-2 text-xs font-bold bg-orange-700 hover:bg-orange-800 text-white rounded-lg flex items-center gap-1.5">
<IconPlus className="w-3.5 h-3.5" /> New project
</button>
)}
        {showCreate && (
<NewProjectModal
            onClose={() => setShowCreate(false)}
            onCreated={(id) => { setShowCreate(false); refreshProjects(); if (id) setProjectId(id); }}
          />
)}
</div>

      {visible.length === 0 ? (
<div className="rounded-lg border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No projects in this view</p>
<p className="mt-1 text-xs text-slate-500">{filter === 'All' && typeFilter === 'All' ? 'Create your first project to get started.' : 'Try a different filter.'}</p>
{canEdit && filter === 'All' && typeFilter === 'All' && (
<button onClick={() => setShowCreate(true)} className="mt-4 rounded-lg bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800">Create project</button>
)}
</div>
) : (
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((p) => (
<button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className={`text-left bg-white dark:bg-slate-800/60 border rounded-lg p-5 transition hover:shadow-md ${
                projectId === p.id ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
}`}
            >
<div className="flex items-start justify-between gap-2">
<div>
<p className="text-xs font-bold text-slate-500">{p.code}</p>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">{p.name}</h3>
{(() => { const cat = projectTypeCategory(p.project_type); return cat ? (
<span className="inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                    {cat.label}{p.project_subtype ? ` · ${cat.subtypes.find((x) => x.key === p.project_subtype)?.label ?? p.project_subtype}` : ''}
</span>
) : null; })()}
</div>
<span className={`px-2 py-0.5 text-xs font-bold rounded-full border shrink-0 ${
                  statusOf(p) === 'ACTIVE' || statusOf(p) === 'ON_TRACK'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
}`}>
                  {statusLabel(statusOf(p))}
</span>
</div>
              {p.location &&<p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{p.location}</p>}
<div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
<span className="text-slate-500 dark:text-slate-400">
<span className="font-bold text-slate-800 dark:text-slate-200">{formatKes(Number(p.original_contract_sum || 0))}</span>
</span>
<span className="text-slate-500 dark:text-slate-400">
<span className="font-bold text-slate-800 dark:text-slate-200">{coCounts[p.id]?.count ?? 0}</span> COs
</span>
                {(coCounts[p.id]?.value ?? 0) > 0 && (
<span className="text-slate-500 dark:text-slate-400">
<span className="font-bold text-slate-800 dark:text-slate-200">{formatKes(coCounts[p.id]!.value)}</span> CO value
</span>
)}
</div>
<p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mt-3">Open workspace →</p>
</button>
))}
</div>
)}

      {livePidCheck && canEdit && (
<div className="flex justify-end">
<button onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            Project settings
</button>
</div>
)}
      {showSettings && livePidCheck && (
<ProjectSettingsModal projectId={livePidCheck} onClose={() => setShowSettings(false)} onSaved={() => refreshProjects()} />
)}

      {livePidCheck && (
<div className="space-y-5">
<ProjectChecklist projectId={livePidCheck} />
<PortalAccessLinkManager projectId={livePidCheck} onPreviewPortal={(t, token, name, role) => setPortalPreview({ type: t, token, name, role})} />
</div>
)}

      {recentCos.length > 0 && (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recent Activity</h3>
<span className="text-xs text-slate-500">Latest change orders</span>
</div>
<div className="overflow-x-auto">
<table className="rt w-full text-xs">
<thead>
<tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
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
<td className="px-5 py-2.5 font-medium" data-label="Project">{v.projectName}</td>
<td className="px-3 py-2.5 font-mono tabular-nums" data-label="CO #">{v.co_number || v.id?.slice(0, 8)}</td>
<td className="px-3 py-2.5 max-w-[260px] truncate" data-label="Description">{v.title || v.description || '—'}</td>
<td className="px-3 py-2.5" data-label="Status"><span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold">{statusLabel(v.status)}</span></td>
<td className="px-5 py-2.5 text-right font-mono tabular-nums" data-label="Amount">{v.currency || 'KES'} {v.net_amount ?? v.amount ?? '—'}</td>
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
  const { tab, projectId: pid, projects, role} = useConsole();
  const canEdit = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE', 'PM_QS', 'SUPERINTENDENT', 'SITE_ENGINEER'].includes(role);
  const projectName = projects.find((p) => p.id === pid)?.name;
  const livePid = pid && /^[0-9a-f-]{36}$/i.test(pid) ? pid : undefined;

  if (tab === 'all') return<ProjectsAll canEdit={canEdit} />;
  if (!livePid) {
    return<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">Select a project to view {SUBTAB_LABELS[tab] || tab}.</div>;
}
  switch (tab) {
    case 'schedule': return<ProjectScheduleGanttView projectId={livePid} canEdit={canEdit} />;
    case 'drawings': return<DrawingsView projectId={livePid} canManage={canEdit} />;
    case 'changeorders': return<VariationManagementView projectId={livePid} userRole={role} canRequest={canEdit} canReview={canEdit} canApprove={['COMPANY_ADMIN','ADMIN','EXECUTIVE','CLIENT'].includes(role)} />;
    case 'coordination': return<RfiManagementView projectId={livePid} projectName={projectName} canCreate={canEdit} />;
    case 'correspondence': return<CorrespondenceView canManage={canEdit} />;
    default: return<ProjectsAll canEdit={canEdit} />;
}
}
