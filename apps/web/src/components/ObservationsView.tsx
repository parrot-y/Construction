import React, { useCallback, useEffect, useState} from 'react';

interface Observation {
  id: string;
  ref: string;
  title: string;
  type: string;
  priority: string;
  location?: string | null;
  description: string;
  status: string;
  raised_by_name: string;
  created_at: string;
  closed_at?: string | null;
  corrective_actions: { id: string; title: string; status: string; due_date?: string | null; owner_name: string}[];
}

interface CorrectiveAction {
  id: string;
  title: string;
  owner_name: string;
  due_date?: string | null;
  source_ref?: string | null;
  steps: string[];
  status: string;
  effective_status: string;
  observation?: { id: string; obs_number: number; title: string} | null;
  created_at: string;
}

const OBS_STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-rose-50 text-rose-700',
  IN_REVIEW: 'bg-amber-50 text-amber-700',
  CLOSED: 'bg-emerald-50 text-emerald-700',
};
const TYPE_STYLE: Record<string, string> = {
  QUALITY: 'bg-sky-50 text-sky-700',
  SAFETY: 'bg-rose-50 text-rose-700',
  ENVIRONMENTAL: 'bg-emerald-50 text-emerald-700',
  COMMISSIONING: 'bg-violet-50 text-violet-700',
};

export default function ObservationsView({ projectId, canManage = true}: { projectId: string; canManage?: boolean}): React.JSX.Element {
  const [tab, setTab] = useState<'observations' | 'actions'>('observations');
  const [obs, setObs] = useState<Observation[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showObsForm, setShowObsForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [obsForm, setObsForm] = useState({ title: '', type: 'QUALITY', priority: 'MEDIUM', location: '', description: ''});
  const [actForm, setActForm] = useState({ title: '', ownerName: '', dueDate: '', observationId: '', sourceRef: '', steps: ''});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (typeFilter) qs.set('type', typeFilter);
      const [oRes, aRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/observations?${qs}`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/corrective-actions`, { credentials: 'include'}),
      ]);
      if (!oRes.ok) throw new Error('Failed to load observations');
      const oJson = await oRes.json();
      setObs(oJson.data || []);
      if (aRes.ok) {
        const aJson = await aRes.json();
        setActions(aJson.data || []);
}
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [projectId, statusFilter, typeFilter]);

  useEffect(() => { void load();}, [load]);

  const createObs = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/observations`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: obsForm.title, type: obsForm.type, priority: obsForm.priority,
          location: obsForm.location || null, description: obsForm.description,
}),
});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowObsForm(false);
      setObsForm({ title: '', type: 'QUALITY', priority: 'MEDIUM', location: '', description: ''});
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const setObsStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/v1/projects/${projectId}/observations/${id}/status`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ status}),
});
      await load();
} catch { /* ignore */}
};

  const createAction = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/corrective-actions`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: actForm.title,
          ownerName: actForm.ownerName,
          dueDate: actForm.dueDate || null,
          observationId: actForm.observationId || null,
          sourceRef: actForm.sourceRef || null,
          steps: actForm.steps.split('\n').map((s) => s.trim()).filter(Boolean),
}),
});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowActionForm(false);
      setActForm({ title: '', ownerName: '', dueDate: '', observationId: '', sourceRef: '', steps: ''});
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const setActionStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/v1/projects/${projectId}/corrective-actions/${id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ status}),
});
      await load();
} catch { /* ignore */}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading observations…</div>;
}

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex items-center justify-between flex-wrap gap-2">
<div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5">
          {(['observations', 'actions'] as const).map((t) => (
<button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t === 'observations' ? 'Observations' : 'Corrective actions'}
</button>
))}
</div>
        {canManage && (
<button
            onClick={() => (tab === 'observations' ? setShowObsForm((v) => !v) : setShowActionForm((v) => !v))}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            {tab === 'observations' ? '+ New Observation' : '+ New corrective action'}
</button>
)}
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {tab === 'observations' && (
<>
<div className="flex gap-2">
<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${input} max-w-[160px]`}>
<option value="">All statuses</option>
<option value="OPEN">Open</option>
<option value="IN_REVIEW">In Review</option>
<option value="CLOSED">Closed</option>
</select>
<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${input} max-w-[160px]`}>
<option value="">All types</option>
              {['QUALITY', 'SAFETY', 'ENVIRONMENTAL', 'COMMISSIONING'].map((t) =><option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
</select>
</div>

          {showObsForm && canManage && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
<label className="sm:col-span-2 space-y-1"><span className={label}>Observation title *</span>
<input value={obsForm.title} onChange={(e) => setObsForm({ ...obsForm, title: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Type</span>
<select value={obsForm.type} onChange={(e) => setObsForm({ ...obsForm, type: e.target.value})} className={input}>
                  {['QUALITY', 'SAFETY', 'ENVIRONMENTAL', 'COMMISSIONING'].map((t) =><option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
</select></label>
<label className="space-y-1"><span className={label}>Priority</span>
<select value={obsForm.priority} onChange={(e) => setObsForm({ ...obsForm, priority: e.target.value})} className={input}>
                  {['LOW', 'MEDIUM', 'HIGH'].map((p) =><option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()} priority</option>)}
</select></label>
<label className="space-y-1"><span className={label}>Location</span>
<input value={obsForm.location} onChange={(e) => setObsForm({ ...obsForm, location: e.target.value})} placeholder="e.g. Level 2 — Grid C4" className={input} /></label>
<label className="sm:col-span-2 space-y-1"><span className={label}>Description *</span>
<textarea rows={3} value={obsForm.description} onChange={(e) => setObsForm({ ...obsForm, description: e.target.value})} className={`${input} resize-none`} /></label>
<div className="sm:col-span-2 flex justify-end">
<button onClick={() => void createObs()} disabled={saving || obsForm.title.length< 3 || obsForm.description.length< 3}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Raise observation'}
</button>
</div>
</div>
)}

          {obs.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No observations{statusFilter || typeFilter ? ' matching filters' : ''}.</p>
) : (
<div className="space-y-2.5">
              {obs.map((o) => (
<div key={o.id} className="border border-slate-200 rounded-xl p-4">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
<span className="tabular-nums text-[10px] font-bold text-slate-400">{o.ref}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${TYPE_STYLE[o.type] || 'bg-slate-100 text-slate-600'}`}>{o.type[0] + o.type.slice(1).toLowerCase()}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${OBS_STATUS_STYLE[o.status]}`}>{o.status.replace('_', ' ')}</span>
<span className="text-[10px] text-slate-400">{o.priority} · {o.raised_by_name} · {new Date(o.created_at).toLocaleDateString()}</span>
</div>
<h4 className="text-sm font-bold text-slate-900 mt-1">{o.title}</h4>
                      {o.location &&<p className="text-[11px] text-slate-500"> {o.location}</p>}
<p className="text-xs text-slate-600 mt-1">{o.description}</p>
                      {o.corrective_actions.length > 0 && (
<p className="text-[11px] text-indigo-600 mt-1.5">{o.corrective_actions.length} corrective action{o.corrective_actions.length === 1 ? '' : 's'} linked</p>
)}
</div>
                    {canManage && o.status !== 'CLOSED' && (
<div className="flex flex-col gap-1 shrink-0">
                        {o.status === 'OPEN' && (
<button onClick={() => void setObsStatus(o.id, 'IN_REVIEW')} className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg">→ In review</button>
)}
<button onClick={() => void setObsStatus(o.id, 'CLOSED')} className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg">Close</button>
</div>
)}
</div>
</div>
))}
</div>
)}
</>
)}

      {tab === 'actions' && (
<>
          {showActionForm && canManage && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
<label className="sm:col-span-2 space-y-1"><span className={label}>Plan title *</span>
<input value={actForm.title} onChange={(e) => setActForm({ ...actForm, title: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Owner *</span>
<input value={actForm.ownerName} onChange={(e) => setActForm({ ...actForm, ownerName: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Due date</span>
<input type="date" value={actForm.dueDate} onChange={(e) => setActForm({ ...actForm, dueDate: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Linked observation</span>
<select value={actForm.observationId} onChange={(e) => setActForm({ ...actForm, observationId: e.target.value})} className={input}>
<option value="">None</option>
                  {obs.map((o) =><option key={o.id} value={o.id}>{o.ref} — {o.title.slice(0, 40)}</option>)}
</select></label>
<label className="space-y-1"><span className={label}>Source ref</span>
<input value={actForm.sourceRef} onChange={(e) => setActForm({ ...actForm, sourceRef: e.target.value})} placeholder="e.g. OBS-003" className={input} /></label>
<label className="sm:col-span-2 space-y-1"><span className={label}>Steps (one per line)</span>
<textarea rows={3} value={actForm.steps} onChange={(e) => setActForm({ ...actForm, steps: e.target.value})} placeholder={'Mark out repair zone\nApply bonding agent\nApply repair mortar'} className={`${input} resize-none`} /></label>
<div className="sm:col-span-2 flex justify-end">
<button onClick={() => void createAction()} disabled={saving || actForm.title.length< 3 || actForm.ownerName.length< 2}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Create action plan'}
</button>
</div>
</div>
)}

          {actions.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No corrective actions.</p>
) : (
<div className="space-y-2.5">
              {actions.map((a) => (
<div key={a.id} className="border border-slate-200 rounded-xl p-4">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${a.effective_status === 'OVERDUE' ? 'bg-rose-50 text-rose-700' : a.effective_status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{a.effective_status}</span>
<span className="text-[10px] text-slate-400">Owner: {a.owner_name}{a.due_date ? ` · due ${new Date(a.due_date).toLocaleDateString()}` : ''}</span>
                        {a.observation &&<span className="px-2 py-0.5 text-[10px] font-mono tabular-nums bg-indigo-50 text-indigo-700 rounded-full">OBS-{String(a.observation.obs_number).padStart(3, '0')}</span>}
                        {a.source_ref &&<span className="text-[10px] text-slate-400 font-mono tabular-nums">src: {a.source_ref}</span>}
</div>
<h4 className="text-sm font-bold text-slate-900 mt-1">{a.title}</h4>
                      {a.steps.length > 0 && (
<ol className="mt-1.5 space-y-0.5">
                          {a.steps.map((s, i) => (
<li key={i} className="text-[11px] text-slate-600 flex gap-1.5">
<span className="text-slate-400 tabular-nums">{i + 1}.</span> {s}
</li>
))}
</ol>
)}
</div>
                    {canManage && a.status === 'ACTIVE' && (
<button onClick={() => void setActionStatus(a.id, 'COMPLETED')} className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg shrink-0">Complete</button>
)}
</div>
</div>
))}
</div>
)}
</>
)}
</div>
);
}
