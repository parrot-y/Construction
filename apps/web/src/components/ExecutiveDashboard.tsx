import React, { useEffect, useState } from 'react';
import { AuthSession } from '../types/auth';
import InboxView from './InboxView';
import AnnouncementsView from './AnnouncementsView';
import ObservationsView from './ObservationsView';
import ScheduledReportsView from './ScheduledReportsView';
import CompanyDocumentsView from './CompanyDocumentsView';

interface ProjectOpt { id: string; name: string; code: string; status?: string }

/**
 * Executive workspace — portfolio oversight: KPIs, inbox,
 * announcements, cross-project observations, scheduled reports,
 * company documents. Read-mostly; approvals stay with PM/QS.
 */
export default function ExecutiveDashboard({ session }: { session: AuthSession }): React.JSX.Element {
  const { user } = session;
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [kpis, setKpis] = useState<{ projects: number; openObservations: number; openSnags: number } | null>(null);

  useEffect(() => {
    fetch('/api/v1/projects', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code, status: p.status }));
        setProjects(list);
        if (list.length) setProjectId(list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    // Lightweight KPI probes — failures degrade gracefully to 0
    Promise.all([
      fetch(`/api/v1/projects/${projectId}/observations?status=OPEN`, { credentials: 'include' }).then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`/api/v1/projects/${projectId}/snags`, { credentials: 'include' }).then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]).then(([obs, snags]) => {
      setKpis({
        projects: projects.length,
        openObservations: (obs.data || []).filter((o: any) => o.status === 'OPEN' || o.status === 'IN_REVIEW').length,
        openSnags: (snags.data || snags || []).filter?.((s: any) => ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW'].includes(s.status))?.length ?? 0,
      });
    });
  }, [projectId, projects.length]);

  return (
    <div className="space-y-6">
      {/* Portfolio strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active projects</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{projects.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open observations</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{kpis?.openObservations ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open snags</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{kpis?.openSnags ?? '—'}</p>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Focus project:</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs max-w-[280px]">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
      )}

      <InboxView currentUserId={user.id} />
      <AnnouncementsView canManage={false} />
      {projectId && <ObservationsView projectId={projectId} canManage={false} />}
      <ScheduledReportsView canManage={false} />
      <CompanyDocumentsView canManage={false} />
    </div>
  );
}
