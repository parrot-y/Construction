import React, { useEffect, useState } from 'react';
import { AuthSession } from '../types/auth';
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

interface ProjectOpt { id: string; name: string; code: string }

type FieldSection = 'today' | 'messages' | 'site' | 'more';

const SECTIONS: { id: FieldSection; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '📋' },
  { id: 'messages', label: 'Inbox', icon: '✉️' },
  { id: 'site', label: 'Site', icon: '🏗️' },
  { id: 'more', label: 'More', icon: '⋯' },
];

/**
 * Field workspace — site engineer / superintendent / trade lead /
 * foreman / worker day-to-day. Mobile-first: bottom tab bar on small
 * screens, pill tabs on desktop. Sections group the same live views.
 */
export default function FieldDashboard({ session, readOnly = false }: { session: AuthSession; readOnly?: boolean }): React.JSX.Element {
  const { user } = session;
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [section, setSection] = useState<FieldSection>('today');

  useEffect(() => {
    fetch('/api/v1/projects', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code }));
        setProjects(list);
        if (list.length) setProjectId(list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  const projectName = projects.find((p) => p.id === projectId)?.name || '';

  const projectPicker = projects.length > 0 && (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
      <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Project:</label>
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs flex-1 min-w-0 sm:max-w-[280px]">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
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
          {projectId && <ProjectScheduleGanttView projectId={projectId} canEdit={!readOnly} />}
          {projectId && <DrawingsView projectId={projectId} canManage={!readOnly} />}
          {projectId && <RfiManagementView projectId={projectId} projectName={projectName} canCreate={!readOnly} />}
          {projectId && <ObservationsView projectId={projectId} canManage={!readOnly} />}
          {projectId && <CorrespondenceView canManage={!readOnly} />}
          {!projectId && <p className="text-sm text-slate-500">Select a project to view site workflows.</p>}
        </>
      )}

      {section === 'more' && (
        <>
          {projectPicker}
          <CrewsView canManage={!readOnly} />
          {projectId && <TendersView projectId={projectId} canManage={!readOnly} />}
        </>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-40" data-testid="field-bottom-nav">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              section === s.id ? 'text-slate-900' : 'text-slate-400'
            }`}>
            <span className="text-lg leading-none">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
