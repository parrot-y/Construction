import React, { useCallback, useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

interface ProjectMember {
  id: string;
  role: string;
  user: { id: string; full_name: string; email: string};
}

interface Project {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  location?: string | null;
  map_latitude?: string | null;
  map_longitude?: string | null;
  contract_currency?: string;
  money_at_risk_kes?: string | null;
  nca_project_no?: string | null;
  status: string;
  original_contract_sum: string;
  current_approved_budget: string;
  start_date?: string | null;
  target_end_date?: string | null;
  closeout_stage?: string;
  members: ProjectMember[];
}

interface CompanyMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

interface RawCompanyMember {
  role: string;
  user?: { id: string; full_name: string; email: string};
}

const STATUS_OPTIONS = ['PLANNING', 'ON_TRACK', 'AT_RISK', 'CLOSING', 'ARCHIVED', 'COMPLETED', 'ON_HOLD'];
const ASSIGNMENT_ROLES = ['PM', 'ARCHITECT', 'QS', 'SITE_MANAGER', 'CLIENT', 'MEMBER'];

const emptyForm = {
  name: '',
  code: '',
  description: '',
  location: '',
  mapLatitude: '',
  mapLongitude: '',
  contractValue: '',
  contractCurrency: 'KES',
  moneyAtRiskKes: '',
  ncaProjectNo: '',
  status: 'PLANNING',
  startDate: '',
  targetEndDate: '',
  progressPct: '',
};

export default function ProjectOnboardingView(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState(emptyForm);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('PM');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, mRes] = await Promise.all([
        fetch('/api/v1/projects', { credentials: 'include'}),
        fetch('/api/v1/company/members', { credentials: 'include'}).catch(() => null),
      ]);
      if (!pRes.ok) throw new Error('Failed to load projects');
      const pJson = await pRes.json();
      const list: Project[] = pJson.data || [];
      setProjects(list);
      if (list.length && !selectedId) setSelectedId(list[0]!.id);
      if (mRes?.ok) {
        const mJson = await mRes.json();
        const raw: RawCompanyMember[] = mJson.data || [];
        setCompanyMembers(
          raw
            .filter((m) => m.user?.id)
            .map((m) => ({
              user_id: m.user!.id,
              full_name: m.user!.full_name,
              email: m.user!.email,
              role: m.role,
})),
);
}
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const selected = projects.find((p) => p.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setForm({
      name: selected.name || '',
      code: selected.code || '',
      description: selected.description || '',
      location: selected.location || '',
      mapLatitude: selected.map_latitude ?? '',
      mapLongitude: selected.map_longitude ?? '',
      contractValue: selected.original_contract_sum ?? '',
      contractCurrency: selected.contract_currency || 'KES',
      moneyAtRiskKes: selected.money_at_risk_kes ?? '',
      ncaProjectNo: selected.nca_project_no || '',
      status: selected.status || 'PLANNING',
      startDate: selected.start_date ? selected.start_date.slice(0, 10) : '',
      targetEndDate: selected.target_end_date ? selected.target_end_date.slice(0, 10) : '',
      progressPct: '',
});
}, [selected]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload: any = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        location: form.location || null,
        mapLatitude: form.mapLatitude || null,
        mapLongitude: form.mapLongitude || null,
        contractValue: form.contractValue || null,
        contractCurrency: form.contractCurrency || 'KES',
        moneyAtRiskKes: form.moneyAtRiskKes || null,
        ncaProjectNo: form.ncaProjectNo || null,
        status: form.status,
        startDate: form.startDate || null,
        targetEndDate: form.targetEndDate || null,
};
      if (form.progressPct) payload.progressPct = form.progressPct;

      const res = await fetch(`/api/v1/projects/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Save failed (${res.status})`);
      setFeedback('Project updated');
      setForm({ ...form, progressPct: ''});
      await load();
} catch (err: any) {
      setError(err?.message || 'Save failed');
} finally {
      setSaving(false);
}
};

  const createProject = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          description: form.description || null,
          location: form.location || null,
          mapLatitude: form.mapLatitude || null,
          mapLongitude: form.mapLongitude || null,
          contractValue: form.contractValue || null,
          contractCurrency: form.contractCurrency || 'KES',
          moneyAtRiskKes: form.moneyAtRiskKes || null,
          ncaProjectNo: form.ncaProjectNo || null,
          status: form.status,
          startDate: form.startDate || null,
          targetEndDate: form.targetEndDate || null,
}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Create failed (${res.status})`);
      setFeedback(`Project ${body.data.code} created`);
      setShowCreate(false);
      setForm(emptyForm);
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const assignMember = async () => {
    if (!assignUserId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${selectedId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ userId: assignUserId, role: assignRole}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Assign failed (${res.status})`);
      setFeedback(`${assignRole} assigned`);
      setAssignUserId('');
      await load();
} catch (err: any) {
      setError(err?.message || 'Assign failed');
} finally {
      setSaving(false);
}
};

  const removeMember = async (userId: string) => {
    try {
      await fetch(`/api/v1/projects/${selectedId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
});
      await load();
} catch (err: any) {
      setError(err?.message || 'Remove failed');
}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">Loading projects…</div>;
}

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex items-center justify-between flex-wrap gap-2">
<div>
<h3 className="text-base font-bold text-slate-900">Project Onboarding &amp; Settings</h3>
<p className="text-xs text-slate-500">Edit-project parity: contract value &amp; dates, map pin, health status, PM/Architect/QS assignments</p>
</div>
<button
          onClick={() => { setShowCreate((v) => !v); setSelectedId(''); setForm(emptyForm);}}
          className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition"
        >
          {showCreate ? 'Cancel' : '+ New Project'}
</button>
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}
      {feedback &&<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg">{feedback}</div>}

      {!showCreate && projects.length > 0 && (
<div className="flex items-center gap-2">
<label className={label}>Project</label>
<select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={`${input} max-w-xs`}>
            {projects.map((p) => (
<option key={p.id} value={p.id}>{p.code} — {p.name}</option>
))}
</select>
          {selected && (
<span className="text-[10px] font-mono text-slate-400">
              budget KES {toCurrencyString(selected.current_approved_budget)} · closeout {selected.closeout_stage}
</span>
)}
</div>
)}

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
<label className="space-y-1">
<span className={label}>Project name *</span>
<input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value})} className={input} />
</label>
<label className="space-y-1">
<span className={label}>Project code *</span>
<input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value})} className={input} />
</label>
<label className="space-y-1">
<span className={label}>Status / health</span>
<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value})} className={input}>
            {STATUS_OPTIONS.map((s) =><option key={s} value={s}>{s.replace('_', ' ')}</option>)}
</select>
</label>
<label className="sm:col-span-2 space-y-1">
<span className={label}>Location</span>
<input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value})} className={input} placeholder="e.g. Riverside, Nairobi" />
</label>
<label className="space-y-1">
<span className={label}>NCA registration no.</span>
<input type="text" value={form.ncaProjectNo} onChange={(e) => setForm({ ...form, ncaProjectNo: e.target.value})} className={input} />
</label>
<label className="sm:col-span-3 space-y-1">
<span className={label}>Description</span>
<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value})} className={`${input} resize-none`} />
</label>
</div>

      {/* Contract value & dates */}
<div className="border border-slate-200 rounded-xl p-4 space-y-3">
<h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Contract value &amp; dates</h4>
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
<label className="space-y-1">
<span className={label}>Contract value</span>
<input type="number" min="0" step="0.01" value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value})} className={input} />
</label>
<label className="space-y-1">
<span className={label}>Currency</span>
<select value={form.contractCurrency} onChange={(e) => setForm({ ...form, contractCurrency: e.target.value})} className={input}>
<option value="KES">KES</option>
<option value="USD">USD</option>
</select>
</label>
<label className="space-y-1">
<span className={label}>Possession of site</span>
<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value})} className={input} />
</label>
<label className="space-y-1">
<span className={label}>Completion date</span>
<input type="date" value={form.targetEndDate} onChange={(e) => setForm({ ...form, targetEndDate: e.target.value})} className={input} />
</label>
<label className="space-y-1">
<span className={label}>Money at risk (KES)</span>
<input type="number" min="0" step="0.01" value={form.moneyAtRiskKes} onChange={(e) => setForm({ ...form, moneyAtRiskKes: e.target.value})} className={input} />
</label>
<label className="space-y-1">
<span className={label}>Progress % (manual)</span>
<input type="number" min="0" max="100" step="0.01" value={form.progressPct} onChange={(e) => setForm({ ...form, progressPct: e.target.value})} placeholder="e.g. 45" className={input} />
</label>
<label className="space-y-1">
<span className={label}>Map pin latitude</span>
<input type="text" value={form.mapLatitude} onChange={(e) => setForm({ ...form, mapLatitude: e.target.value})} placeholder="-1.286389" className={`${input} font-mono`} />
</label>
<label className="space-y-1">
<span className={label}>Map pin longitude</span>
<input type="text" value={form.mapLongitude} onChange={(e) => setForm({ ...form, mapLongitude: e.target.value})} placeholder="36.817223" className={`${input} font-mono`} />
</label>
</div>
</div>

      {/* Team assignments */}
      {!showCreate && selected && (
<div className="border border-slate-200 rounded-xl p-4 space-y-3">
<h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Project team (PM / Architect / QS)</h4>
<div className="space-y-1.5">
            {selected.members.length === 0 &&<p className="text-xs text-slate-500">No members assigned yet.</p>}
            {selected.members.map((m) => (
<div key={m.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
<div>
<span className="font-semibold text-slate-800">{m.user.full_name}</span>
<span className="text-slate-400 ml-2">{m.user.email}</span>
</div>
<div className="flex items-center gap-2">
<span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full">{m.role}</span>
                  {m.role !== 'PROJECT_LEAD' && (
<button onClick={() => void removeMember(m.user.id)} className="text-rose-500 hover:text-rose-700 text-[11px] font-semibold">Remove</button>
)}
</div>
</div>
))}
</div>
<div className="flex items-center gap-2 pt-1">
<select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className={`${input} max-w-xs`}>
<option value="">Assign team member…</option>
              {companyMembers.map((m) => (
<option key={m.user_id} value={m.user_id}>{m.full_name} ({m.email})</option>
))}
</select>
<select value={assignRole} onChange={(e) => setAssignRole(e.target.value)} className={input}>
              {ASSIGNMENT_ROLES.map((r) =><option key={r} value={r}>{r.replace('_', ' ')}</option>)}
</select>
<button
              onClick={() => void assignMember()}
              disabled={saving || !assignUserId}
              className="px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              Assign
</button>
</div>
</div>
)}

<div className="flex justify-end gap-2 pt-1">
<button
          onClick={() => void (showCreate ? createProject() : save())}
          disabled={saving || !form.name || !form.code}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving…' : showCreate ? 'Create Project' : 'Save Changes'}
</button>
</div>
</div>
);
}
