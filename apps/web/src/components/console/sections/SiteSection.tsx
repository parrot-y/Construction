import React, { useEffect, useState } from 'react';
import { useConsole } from '../ConsoleContext';
import ChecklistsView from '../../ChecklistsView';
import SnaggingListView from '../../SnaggingListView';
import ObservationsView from '../../ObservationsView';
import SafetyIncidentLogView from '../../SafetyIncidentLogView';
import InspectionRequestModal from '../../InspectionRequestModal';
import { GeofencedClockInView } from '../../GeofencedClockInView';
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
  const [logDate, setLogDate] = useState<string | undefined>(undefined);

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
      ) : (
        <>
          {/* Week strip — last 14 days, logged vs not */}
          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {days.length} of {Math.min(14, days.length + 14 - days.length)} recent days logged
              </p>
              <p className="text-[11px] text-slate-400">{days.length} day{days.length === 1 ? '' : 's'} with entries</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {Array.from({ length: 14 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                const entries = byDate.get(key) || [];
                const isToday = i === 0;
                const photos = entries.reduce((n, x) => n + (x.photos?.length || 0), 0);
                const labour = entries.reduce((n, x) => n + (x.labor_headcounts?.reduce((a: number, h: any) => a + (h.headcount || 0), 0) || 0), 0);
                const deliveries = entries.reduce((n, x) => n + (x.material_deliveries?.length || x.deliveries?.length || 0), 0);
                return (
                  <div key={key} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {isToday && <span className="ml-2 text-[10px] font-bold text-orange-600 uppercase">Today</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {entries.length > 0
                          ? `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · ${labour} labour-day${labour === 1 ? '' : 's'} · ${photos} photo${photos === 1 ? '' : 's'} · ${deliveries} deliver${deliveries === 1 ? 'y' : 'ies'}`
                          : isToday ? 'No log for today yet — record it while the day is fresh.' : 'Not logged'}
                      </p>
                    </div>
                    {entries.length === 0 && canEdit && !isToday && (
                      <button onClick={() => { setLogDate(key); setModalOpen(true); }} className="text-[11px] font-bold text-orange-600 hover:underline shrink-0">Add log</button>
                    )}
                    {entries.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 shrink-0">Logged</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Why log every day</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              A dated record of who was on site, what got done and what held you up is what wins extension-of-time claims and settles payment disputes. Two minutes at the end of each day is enough.
            </p>
          </div>
        </>
      )}

      <SiteDiaryModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setLogDate(undefined); }}
        projectId={projectId}
        projectName={projectName}
        initialDate={logDate}
        onDiarySubmitted={() => { setModalOpen(false); setLogDate(undefined); load(); }}
      />
    </div>
  );
}

function InspectionsTab(): React.JSX.Element {
  const { projectId, projects, role } = useConsole();
  const livePid = projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : '';
  const [reqOpen, setReqOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const projectName = projects.find((p) => p.id === projectId)?.name;
  const canRequest = ['COMPANY_ADMIN','ADMIN','EXECUTIVE','PM_QS','SUPERINTENDENT','SITE_SUPERVISOR','SITE_ENGINEER','ARCHITECT','QA_QC'].includes(role);
  return (
    <div className="space-y-4">
      {canRequest && livePid && (
        <div className="flex justify-end">
          <button onClick={() => setReqOpen(true)} className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg">New Request</button>
        </div>
      )}
      <IndependentSiteReportView projectId={livePid} projectName={projectName} userRole={role} />
      <QualityControlView key={refreshKey} projectId={livePid} projectName={projectName} defaultTab="cube-tests" canApprove={['COMPANY_ADMIN','ADMIN','EXECUTIVE','PM_QS','SITE_SUPERVISOR','SUPERINTENDENT'].includes(role)} />
      {livePid && (
        <InspectionRequestModal projectId={livePid} projectName={projectName} open={reqOpen}
          onClose={() => setReqOpen(false)} onCreated={() => setRefreshKey((k) => k + 1)} />
      )}
    </div>
  );
}


/** Field view — personalized field hub (observed on reference): my checklists + quick actions. */
function FieldView({ projectId, projectName, setTab }: { projectId: string; projectName?: string; setTab: (t: string) => void }): React.JSX.Element {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/checklist-assignments`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setAssignments(j.data || j || []))
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const open = assignments.filter((a) => !['APPROVED', 'REJECTED'].includes(String(a.status)));
  const actions = [
    { label: 'Report a snag', desc: 'Log a defect or snag for follow-up', tab: 'punch', icon: '🔧' },
    { label: 'New daily log', desc: 'Record today’s work, labour and weather', tab: 'dailylog', icon: '📋' },
    { label: 'My checklists', desc: 'Assigned QA checklists and inspections', tab: 'assignments', icon: '✅' },
    { label: 'Clock in / out', desc: 'Geofenced attendance for your crew', tab: 'attendance', icon: '📍' },
    { label: 'Report observation', desc: 'Quality, safety or environmental issue', tab: 'observations', icon: '👁️' },
    { label: 'Safety incident', desc: 'Report an incident or near-miss', tab: 'safety', icon: '⛑️' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Field view</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">What do you need in the field?{projectName ? ` · ${projectName}` : ''}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((a) => (
          <button key={a.tab} onClick={() => setTab(a.tab)}
            className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition">
            <span className="text-lg">{a.icon}</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1.5">{a.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{a.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">My Assigned Checklists</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Complete your assigned QA checklists and safety inspections.</p>
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : open.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No assigned checklists</p>
            <p className="text-xs text-slate-400 mt-1">Ask your supervisor to assign you a checklist from Assignments.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {open.map((a) => (
              <button key={a.id} onClick={() => setTab('assignments')}
                className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{a.title}</p>
                  <p className="text-[10px] text-slate-400">{a.trade}{a.assigned_to_name ? ` · ${a.assigned_to_name}` : ''}{a.due_date ? ` · due ${String(a.due_date).slice(0, 10)}` : ''}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{String(a.status).replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SiteSection(): React.JSX.Element {
  const { tab, projectId: pid, projects, role, setTab } = useConsole();
  const canEdit = !['VIEWER', 'CLIENT'].includes(role);
  const canInvestigate = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE', 'PM_QS', 'SITE_SUPERVISOR', 'SUPERINTENDENT'].includes(role);
  const projectName = projects.find((p) => p.id === pid)?.name;
  const livePid = pid && /^[0-9a-f-]{36}$/i.test(pid) ? pid : '';

  if (tab === 'dailylog') {
    return livePid ? <DailyLogsView projectId={livePid} projectName={projectName} canEdit={canEdit} /> : <EmptyProject what="the daily log" />;
  }
  if (!livePid) return <EmptyProject what={tab} />;

  if (tab === 'fieldview') {
    return livePid ? <FieldView projectId={livePid} projectName={projectName} setTab={setTab} /> : <EmptyProject what="the field view" />;
  }
  switch (tab) {
    case 'checklists': return <ChecklistsView projectId={livePid} canManage={canEdit} initialTab="templates" />;
    case 'assignments': return <ChecklistsView projectId={livePid} canManage={canEdit} initialTab="assignments" />;
    case 'punch': return <SnaggingListView projectId={livePid} projectName={projectName} canAdd={canEdit} canRectify={canEdit} canVerify={canInvestigate} />;
    case 'inspections': return (
      <InspectionsTab />
    );
    case 'observations': return <ObservationsView projectId={livePid} canManage={canEdit} />;
    case 'actionplans': return <ObservationsView projectId={livePid} canManage={canEdit} />;
    case 'safety': return <SafetyIncidentLogView projectId={livePid} canLog={canEdit} canInvestigate={canInvestigate} />;
    case 'attendance': return (
      <div className="space-y-4">
        {livePid && <GeofencedClockInView projectId={livePid} projectName={projectName} />}
        <AttendanceView projectId={livePid} canManage={canEdit} />
      </div>
    );
    default: return <DailyLogsView projectId={livePid} projectName={projectName} canEdit={canEdit} />;
  }
}
