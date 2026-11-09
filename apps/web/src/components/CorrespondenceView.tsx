import React, { useCallback, useEffect, useState} from 'react';

interface CorrItem {
  id: string; ref: string; type: string; direction: string; subject: string;
  from_name: string; to_name: string; reference?: string | null;
  letter_date?: string | null; status: string; body?: string | null;
  attachment_name?: string | null; created_at: string;
}
interface ProjectOpt { id: string; name: string; code: string}

const TYPES = ['LETTER', 'SUBMITTAL', 'TRANSMITTAL', 'NOTICE'];
const STATUSES = ['DRAFT', 'SENT', 'RECEIVED', 'RESPONDED', 'FILED'];
const TYPE_STYLE: Record<string, string> = {
  LETTER: 'bg-sky-50 text-sky-700', SUBMITTAL: 'bg-violet-50 text-violet-700',
  TRANSMITTAL: 'bg-indigo-50 text-indigo-700', NOTICE: 'bg-amber-50 text-amber-700',
};
const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', SENT: 'bg-sky-50 text-sky-700',
  RECEIVED: 'bg-indigo-50 text-indigo-700', RESPONDED: 'bg-emerald-50 text-emerald-700', FILED: 'bg-slate-100 text-slate-500',
};

export default function CorrespondenceView({ canManage = true}: { canManage?: boolean}): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState<CorrItem[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'LETTER', direction: 'OUTGOING', subject: '', fromName: '', toName: '', reference: '', letterDate: '', body: ''});

  useEffect(() => {
    fetch('/api/v1/projects', { credentials: 'include'})
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code}));
        setProjects(list);
        if (list.length) setProjectId(list[0].id);
})
      .catch(() => setProjects([]));
}, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (directionFilter) params.set('direction', directionFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/projects/${projectId}/correspondence?${params}`, { credentials: 'include'});
      if (!res.ok) throw new Error('Failed to load correspondence');
      const json = await res.json();
      setItems(json.data || []);
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [projectId, typeFilter, directionFilter, statusFilter]);

  useEffect(() => { void load();}, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/correspondence`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: form.type, direction: form.direction, subject: form.subject,
          fromName: form.fromName, toName: form.toName,
          reference: form.reference || null, letterDate: form.letterDate || null,
          body: form.body || null,
}),
});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowForm(false);
      setForm({ type: 'LETTER', direction: 'OUTGOING', subject: '', fromName: '', toName: '', reference: '', letterDate: '', body: ''});
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const setStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/v1/projects/${projectId}/correspondence/${id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ status}),
});
      await load();
} catch { /* ignore */}
};

  if (loading && !items.length) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading correspondence…</div>;
}

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex items-center justify-between flex-wrap gap-2">
<div>
<h3 className="text-base font-bold text-slate-900">Correspondence</h3>
<p className="text-xs text-slate-500">Formal project letters, submittals, transmittals & notices</p>
</div>
<div className="flex items-center gap-2">
<select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${input} max-w-[200px]`}>
            {projects.map((p) =><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
</select>
          {canManage && (
<button onClick={() => setShowForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              {showForm ? 'Cancel' : '+ Log correspondence'}
</button>
)}
</div>
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

<div className="flex gap-2 flex-wrap">
<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${input} max-w-[140px]`}>
<option value="">All types</option>
          {TYPES.map((t) =><option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
</select>
<select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} className={`${input} max-w-[140px]`}>
<option value="">Both directions</option>
<option value="OUTGOING">Outgoing</option>
<option value="INCOMING">Incoming</option>
</select>
<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${input} max-w-[140px]`}>
<option value="">All statuses</option>
          {STATUSES.map((s) =><option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
</select>
</div>

      {showForm && canManage && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
<label className="space-y-1"><span className={label}>Type *</span>
<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value})} className={input}>
              {TYPES.map((t) =><option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
</select></label>
<label className="space-y-1"><span className={label}>Direction</span>
<select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value})} className={input}>
<option value="OUTGOING">Outgoing (we sent)</option>
<option value="INCOMING">Incoming (we received)</option>
</select></label>
<label className="sm:col-span-2 space-y-1"><span className={label}>Subject *</span>
<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>From *</span>
<input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>To *</span>
<input value={form.toName} onChange={(e) => setForm({ ...form, toName: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Reference</span>
<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value})} placeholder="e.g. VO/2026/014" className={input} /></label>
<label className="space-y-1"><span className={label}>Letter date</span>
<input type="date" value={form.letterDate} onChange={(e) => setForm({ ...form, letterDate: e.target.value})} className={input} /></label>
<label className="sm:col-span-2 space-y-1"><span className={label}>Body / summary</span>
<textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value})} className={`${input} resize-none`} /></label>
<div className="sm:col-span-2 flex justify-end">
<button onClick={() => void create()} disabled={saving || form.subject.length< 3 || form.fromName.length< 2 || form.toName.length< 2}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Log item'}
</button>
</div>
</div>
)}

      {items.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No correspondence{typeFilter || directionFilter || statusFilter ? ' matching filters' : ''}.</p>
) : (
<div className="space-y-2">
          {items.map((c) => (
<div key={c.id} className="border border-slate-200 rounded-xl p-3.5">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-mono text-[10px] font-bold text-slate-400">{c.ref}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${TYPE_STYLE[c.type] || 'bg-slate-100 text-slate-600'}`}>{c.type[0] + c.type.slice(1).toLowerCase()}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${c.direction === 'OUTGOING' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>{c.direction === 'OUTGOING' ? '→ Out' : '← In'}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_STYLE[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status[0] + c.status.slice(1).toLowerCase()}</span>
                    {c.letter_date &&<span className="text-[10px] text-slate-400">{c.letter_date}</span>}
</div>
<h4 className="text-sm font-bold text-slate-900 mt-1">{c.subject}</h4>
<p className="text-[11px] text-slate-500 mt-0.5">
                    {c.from_name} → {c.to_name}{c.reference ? ` · ref ${c.reference}` : ''}{c.attachment_name ? ` ·  ${c.attachment_name}` : ''}
</p>
                  {c.body &&<p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{c.body}</p>}
</div>
                {canManage && c.status !== 'FILED' && (
<div className="flex flex-col gap-1 shrink-0">
                    {c.status === 'DRAFT' && (
<button onClick={() => void setStatus(c.id, 'SENT')} className="px-2.5 py-1 text-[11px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg">Mark sent</button>
)}
                    {(c.status === 'SENT' || c.status === 'RECEIVED') && (
<button onClick={() => void setStatus(c.id, 'RESPONDED')} className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg">Mark responded</button>
)}
<button onClick={() => void setStatus(c.id, 'FILED')} className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">File</button>
</div>
)}
</div>
</div>
))}
</div>
)}
</div>
);
}
