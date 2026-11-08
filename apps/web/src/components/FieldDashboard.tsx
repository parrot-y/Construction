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
import CrewsView from './CrewsView';
import ObservationsView from './ObservationsView';

interface ProjectOpt { id: string; name: string; code: string }

/**
 * Field workspace — site engineer / superintendent / trade lead /
 * foreman / worker day-to-day: attendance, assigned checklists,
 * crews, observations & corrective actions, correspondence,
 * inbox + announcements.
 */
export default function FieldDashboard({ session, readOnly = false }: { session: AuthSession; readOnly?: boolean }): React.JSX.Element {
  const { user } = session;
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState('');

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

  return (
    <div className="space-y-6">
      {projects.length > 0 && (
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5 w-fit">
          <label className="text-xs font-semibold text-slate-600">Project:</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs max-w-[280px]">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
      )}

      <InboxView currentUserId={user.id} />
      <AnnouncementsView canManage={false} />
      <AttendanceView canManage={!readOnly} />
      <ChecklistsView canManage={!readOnly} />
      <CrewsView canManage={!readOnly} />
      {projectId && <ProjectScheduleGanttView projectId={projectId} canEdit={!readOnly} />}
      {projectId && <DrawingsView projectId={projectId} canManage={!readOnly} />}
      {projectId && <RfiManagementView projectId={projectId} projectName={projects.find((p) => p.id === projectId)?.name || ''} canCreate={!readOnly} />}
      {projectId && <ObservationsView projectId={projectId} canManage={!readOnly} />}
      {projectId && <CorrespondenceView canManage={!readOnly} />}
    </div>
  );
}
