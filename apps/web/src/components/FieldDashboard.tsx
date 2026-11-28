import React, { useEffect, useState} from 'react';
import { AuthSession} from '../types/auth';
import InboxView from './InboxView';
import AnnouncementsView from './AnnouncementsView';
import AttendanceView from './AttendanceView';
import ChecklistsView from './ChecklistsView';
import CorrespondenceView from './CorrespondenceView';
import RfiManagementView from './RfiManagementView';
import DrawingsView from './DrawingsView';
import ProjectScheduleGanttView from './ProjectScheduleGanttView';
import TendersView from './TendersView';
import CrewsView from './CrewsView';
import ObservationsView from './ObservationsView';
import SiteDiaryModal from './SiteDiaryModal';
import SafetyIncidentLogView from './SafetyIncidentLogView';
import SnaggingListView from './SnaggingListView';
import OfflineSyncBanner from './OfflineSyncBanner';
import { fetchJsonCached, isOfflineError } from '../services/offline-cache';
import { SavedDataNotice, formatDate } from '../ui';

interface ProjectOpt { id: string; name: string; code: string}

interface DiaryRow {
  id: string; entry_date: string; weather?: string; site_status?: string;
  general_notes?: string; recorded_by_id?: string;
}

type FieldSection = 'today' | 'messages' | 'site' | 'more';
type SiteJob = 'menu' | 'snags' | 'safety' | 'inspections' | 'drawings' | 'schedule' | 'rfis' | 'observations' | 'correspondence';

const SITE_JOBS: { id: Exclude<SiteJob, 'menu'>; label: string; hint: string }[] = [
  { id: 'snags', label: 'Snags', hint: 'Defects to fix and sign off' },
  { id: 'safety', label: 'Safety', hint: 'Incidents and hazards' },
  { id: 'inspections', label: 'Inspections', hint: 'Checklists and inspections' },
  { id: 'drawings', label: 'Drawings', hint: 'Latest drawings and revisions' },
  { id: 'schedule', label: 'Schedule', hint: 'Programme and look-ahead' },
  { id: 'rfis', label: 'RFIs', hint: 'Requests for information' },
  { id: 'observations', label: 'Observations', hint: 'Site observations' },
  { id: 'correspondence', label: 'Letters', hint: 'Site correspondence' },
];

const SECTIONS: { id: FieldSection; label: string; icon: string}[] = [
  { id: 'today', label: 'Today', icon: ''},
  { id: 'messages', label: 'Inbox', icon: ''},
  { id: 'site', label: 'Site', icon: ''},
  { id: 'more', label: 'More', icon: '⋯'},
];

/**
 * Field workspace — site engineer / superintendent / trade lead /
 * foreman / worker day-to-day. Mobile-first: bottom tab bar on small
 * screens, pill tabs on desktop. Sections group the same live views.
 */
export default function FieldDashboard({ session, readOnly = false, onLogout}: { session: AuthSession; readOnly?: boolean; onLogout?: () => void}): React.JSX.Element {
  const { user, permissions = []} = session;
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [section, setSection] = useState<FieldSection>('today');
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [siteJob, setSiteJob] = useState<SiteJob>('menu');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const can = (p: string) => permissions.includes(p);
  const canDiary = can('site.diary_create') || can('site.diary_view');
  const canTenders = can('tender.view');

  const applyProjects = (rows: any[]) => {
    const list = (rows || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code}));
    setProjects(list);
    setProjectId((cur) => cur || list[0]?.id || '');
  };

  useEffect(() => {
    fetchJsonCached('/api/v1/projects', `field:projects:${user.id}`)
      .then(({ body, savedAt: staleAt }) => {
        const rows = body.data || body.projects || (Array.isArray(body) ? body : []);
        if (staleAt) setSavedAt(staleAt);
        applyProjects(rows);
      })
      .catch(() => setProjects([]));
  }, [user.id]);

  const loadDiaries = () => {
    if (!projectId || !canDiary) { setDiaries([]); return; }
    fetchJsonCached(`/api/v1/projects/${projectId}/site-diaries`, `field:diaries:${projectId}`)
      .then(({ body, savedAt: staleAt }) => {
        if (staleAt) setSavedAt(staleAt);
        const rows = body.data || body.diaries || body.rows || (Array.isArray(body) ? body : []);
        setDiaries(rows.slice(0, 10));
      })
      .catch((e) => {
        // Offline with nothing saved — show an empty list, never "Failed to fetch".
        if (!isOfflineError(e)) setDiaries([]);
      });
  };

  useEffect(() => { loadDiaries(); }, [projectId, canDiary]);

  const projectName = projects.find((p) => p.id === projectId)?.name || '';

  const projectPicker = projects.length > 0 && (
<div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
<label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Project:</label>
<select value={projectId} onChange={(e) => setProjectId(e.target.value)}
        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs flex-1 min-w-0 sm:max-w-[280px]">
        {projects.map((p) =><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
</select>
</div>
);

  return (
<div className="space-y-6 pb-24 sm:pb-6">
      <OfflineSyncBanner />
      {savedAt && <SavedDataNotice savedAt={savedAt} />}
      {/* Desktop pills */}
<div className="hidden sm:flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 w-fit">
        {SECTIONS.map((s) => (
<button key={s.id} onClick={() => setSection(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              section === s.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
}`}>
            {s.label}
</button>
))}
</div>

      {section === 'today' && (
<>
          {projectPicker}
          {canDiary && projectId && (
<div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Site Diary</h3>
                {!readOnly && can('site.diary_create') && (
                  <button onClick={() => setDiaryOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg">
                    Record diary
                  </button>
                )}
              </div>
              {diaries.length === 0 ? (
                <p className="text-xs text-slate-500">No diary entries yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {diaries.map((d) => (
                    <li key={d.id} className="py-2 text-xs">
                      <span className="font-semibold text-slate-800">{formatDate(d.entry_date)}</span>
                      <span className="text-slate-500"> — {d.weather || '—'} • {d.site_status || '—'}</span>
                      {d.general_notes && <p className="text-slate-500 mt-0.5 truncate">{d.general_notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <SiteDiaryModal
                isOpen={diaryOpen}
                onClose={() => setDiaryOpen(false)}
                projectId={projectId}
                projectName={projectName}
                onDiarySubmitted={() => {
                  setDiaryOpen(false);
                  loadDiaries();
                }}
              />
</div>
          )}
<AttendanceView canManage={!readOnly} />
<ChecklistsView canManage={!readOnly} />
</>
)}

      {section === 'messages' && (
<>
          {projectPicker}
<InboxView currentUserId={user.id} />
<AnnouncementsView canManage={false} />
</>
)}

      {section === 'site' && (
<>
          {projectPicker}
          {siteJob === 'menu' ? (
<div className="space-y-3" data-testid="field-site-menu">
              <button
                onClick={() => setSection('today')}
                className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3 hover:border-slate-300 transition"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-900">Daily diary &amp; attendance</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Today's work, weather and headcounts</span>
                </span>
                <span className="text-slate-300">›</span>
</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SITE_JOBS.map((job) => (
<button
                    key={job.id}
                    onClick={() => setSiteJob(job.id)}
                    data-testid={`field-job-${job.id}`}
                    className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition"
                  >
                    <span className="block text-sm font-bold text-slate-900">{job.label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{job.hint}</span>
</button>
))}
</div>
              {!projectId &&<p className="text-sm text-slate-500">Select a project to view site workflows.</p>}
</div>
) : (
<div className="space-y-4" data-testid={`field-job-view-${siteJob}`}>
<button
                onClick={() => setSiteJob('menu')}
                className="text-xs font-semibold text-blue-700 hover:underline"
                data-testid="field-job-back"
              >
                ‹ All site jobs
</button>
              {!projectId ? (
<p className="text-sm text-slate-500">Select a project to view site workflows.</p>
) : siteJob === 'snags' ? <SnaggingListView projectId={projectId} />
              : siteJob === 'safety' ? <SafetyIncidentLogView projectId={projectId} canLog={!readOnly} canInvestigate={!readOnly} />
              : siteJob === 'inspections' ? <ChecklistsView canManage={!readOnly} />
              : siteJob === 'drawings' ? <DrawingsView projectId={projectId} canManage={!readOnly} />
              : siteJob === 'schedule' ? <ProjectScheduleGanttView projectId={projectId} canEdit={!readOnly} />
              : siteJob === 'rfis' ? <RfiManagementView projectId={projectId} projectName={projectName} canCreate={!readOnly} />
              : siteJob === 'observations' ? <ObservationsView projectId={projectId} canManage={!readOnly} />
              : <CorrespondenceView canManage={!readOnly} />}
</div>
)}
</>
)}

      {section === 'more' && (
<>
          {projectPicker}
<CrewsView canManage={!readOnly} />
          {canTenders && projectId &&<TendersView projectId={projectId} canManage={!readOnly} />}
          {onLogout && (
            <div className="flex justify-end">
              <button onClick={onLogout} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg">
                Sign out
              </button>
            </div>
          )}
</>
)}

      {/* Mobile bottom tab bar */}
<nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-40" data-testid="field-bottom-nav">
        {SECTIONS.map((s) => (
<button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              section === s.id ? 'text-slate-900' : 'text-slate-600'
}`}>
<span className="text-lg leading-none">{s.icon}</span>
            {s.label}
</button>
))}
</nav>
</div>
);
}
