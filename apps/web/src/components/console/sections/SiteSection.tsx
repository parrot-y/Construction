import React, { useEffect, useState } from 'react';
import { useConsole } from '../ConsoleContext';
import ChecklistsView from '../../ChecklistsView';
import SnaggingListView from '../../SnaggingListView';
import ObservationsView from '../../ObservationsView';
import SafetyIncidentLogView from '../../SafetyIncidentLogView';
import AttendanceView from '../../AttendanceView';
import QualityControlView from '../../QualityControlView';
import IndependentSiteReportView from '../../IndependentSiteReportView';
import SiteDiaryModal from '../../SiteDiaryModal';
import { IconPlus } from '../icons';

function EmptyProject({ what }: { what: string }): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
      Select a project to view {what}.
    </div>
  );
}

/** Daily log — day-by-day site record like the reference "Daily log" tab. */
function DailyLogsView({ projectId, projectName, canEdit }: { projectId: string; projectName?: string; canEdit: boolean }): React.JSX.Element {
  const [diaries, setDiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = () => {
    fetch(`/api/v1/projects/${projectId}/site-diaries`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setDiaries(j.data || []))
      .catch(() => setDiaries([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const byDate = new Map<string, any[]>();
  for (const d of diaries) {
    const day = String(d.entry_date || d.created_at || '').slice(0, 10);
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day)!.push(d);
  }
  const days = [...byDate.keys()].sort().reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Daily log</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Day-by-day site record — evidence for claims, delays and disputes.</p>
        </div>
        {canEdit && (
          <button onClick={() => setModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1.5">
            <IconPlus className="w-3.5 h-3.5" /> New daily log
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : days.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No logs yet</p>
          <p className="text-xs text-slate-400 mt-1">Record today&apos;s site work while it&apos;s fresh.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => {
            const entries = byDate.get(day)!;
            const photos = entries.reduce((n, d) => n + (d.photos?.length || 0), 0);
            const labour = entries.reduce((n, d) => n + (d.labor_headcounts?.reduce((x: number, h: any) => x + (h.headcount || 0), 0) || 0), 0);
            return (
              <div key={day} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} · {labour} labour-day{labour === 1 ? '' : 's'} · {photos} photo{photos === 1 ? '' : 's'}
                    {entries[0]?.weather && ` · ${entries[0].weather}`}
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">Logged</span>
              </div>
            );
          })}
        </div>
      )}

      <SiteDiaryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        onDiarySubmitted={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}

export default function SiteSection(): React.JSX.Element {
  const { tab, projectId: pid, projects, role } = useConsole();
  const canEdit = !['VIEWER', 'CLIENT'].includes(role);
  const canInvestigate = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE', 'PM_QS', 'SITE_SUPERVISOR', 'SUPERINTENDENT'].includes(role);
  const projectName = projects.find((p) => p.id === pid)?.name;
  const livePid = pid && /^[0-9a-f-]{36}$/i.test(pid) ? pid : '';

  if (tab === 'dailylog') {
    return livePid ? <DailyLogsView projectId={livePid} projectName={projectName} canEdit={canEdit} /> : <EmptyProject what="the daily log" />;
  }
  if (!livePid) return <EmptyProject what={tab} />;

  switch (tab) {
    case 'checklists': return <ChecklistsView projectId={livePid} canManage={canEdit} initialTab="templates" />;
    case 'assignments': return <ChecklistsView projectId={livePid} canManage={canEdit} initialTab="assignments" />;
    case 'punch': return <SnaggingListView projectId={livePid} projectName={projectName} canAdd={canEdit} canRectify={canEdit} canVerify={canInvestigate} />;
    case 'inspections': return (
      <div className="space-y-4">
        <IndependentSiteReportView projectId={livePid} projectName={projectName} userRole={role} />
        <QualityControlView projectId={livePid} projectName={projectName} defaultTab="cube-tests" canApprove={canInvestigate} />
      </div>
    );
    case 'observations': return <ObservationsView projectId={livePid} canManage={canEdit} />;
    case 'actionplans': return <ObservationsView projectId={livePid} canManage={canEdit} />;
    case 'safety': return <SafetyIncidentLogView projectId={livePid} canLog={canEdit} canInvestigate={canInvestigate} />;
    case 'attendance': return <AttendanceView projectId={livePid} canManage={canEdit} />;
    default: return <DailyLogsView projectId={livePid} projectName={projectName} canEdit={canEdit} />;
  }
}
