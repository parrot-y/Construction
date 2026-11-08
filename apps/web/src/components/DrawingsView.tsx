import React, { useCallback, useEffect, useState } from 'react';

interface Drawing {
  id: string; title: string; category: string; drawing_reference?: string | null;
  revision_code: string; status: string; uploaded_by_name: string;
  notes?: string | null; created_at: string;
}
interface ProjectOpt { id: string; name: string; code: string }

// Observed disciplines: Architectural / Mechanical / Structural /
// Electrical / Civil — mapped onto document categories.
const DISCIPLINES = [
  { key: 'ALL', label: 'All', categories: [] as string[] },
  { key: 'ARCH', label: 'Architectural', categories: ['ARCHITECTURAL_DRAWING'] },
  { key: 'STR', label: 'Structural', categories: ['STRUCTURAL_DRAWING'] },
  { key: 'MEP', label: 'MEP', categories: ['MEP_DRAWING'] },
  { key: 'CIVIL', label: 'Civil', categories: ['CIVIL_DRAWING'] },
  { key: 'ELEC', label: 'Electrical', categories: ['ELECTRICAL_DRAWING'] },
];
const CATEGORY_LABEL: Record<string, string> = {
  ARCHITECTURAL_DRAWING: 'Architectural', STRUCTURAL_DRAWING: 'Structural',
  MEP_DRAWING: 'MEP', CIVIL_DRAWING: 'Civil', ELECTRICAL_DRAWING: 'Electrical',
};
const STATUS_STYLE: Record<string, string> = {
  APPROVED_FOR_CONSTRUCTION: 'bg-emerald-50 text-emerald-700',
  FOR_REVIEW: 'bg-amber-50 text-amber-700',
  SUPERSEDED: 'bg-slate-100 text-slate-500',
  INFORMATION_ONLY: 'bg-sky-50 text-sky-700',
};
const DRAWING_CATS = ['ARCHITECTURAL_DRAWING', 'STRUCTURAL_DRAWING', 'MEP_DRAWING', 'CIVIL_DRAWING', 'ELECTRICAL_DRAWING'];

export default function DrawingsView({ projectId, canManage = true }: { projectId?: string; canManage?: boolean }): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [pid, setPid] = useState(projectId || '');
  const [discipline, setDiscipline] = useState('ALL');
  const [docs, setDocs] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'ARCHITECTURAL_DRAWING', drawingReference: '', revisionCode: 'Rev 0', storageKey: '', notes: '' });

  useEffect(() => {
    if (projectId) return;
    fetch('/api/v1/projects', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code }));
        setProjects(list);
        if (list.length) setPid(list[0].id);
      })
      .catch(() => setProjects([]));
  }, [projectId]);

  const load = useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/documents`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load drawings');
      const json = await res.json();
      setDocs(((json.documents || []) as any[]).filter((d) => DRAWING_CATS.includes(d.category)));
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const filtered = discipline === 'ALL'
    ? docs
    : docs.filter((d) => DISCIPLINES.find((x) => x.key === discipline)?.categories.includes(d.category));

  const register = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/documents`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          drawingReference: form.drawingReference || null,
          revisionCode: form.revisionCode || 'Rev 0',
          storageKey: form.storageKey,
          uploadedByName: 'Site team',
          notes: form.notes || null,
          status: 'APPROVED_FOR_CONSTRUCTION',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowForm(false);
      setForm({ title: '', category: 'ARCHITECTURAL_DRAWING', drawingReference: '', revisionCode: 'Rev 0', storageKey: '', notes: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Register failed');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Plans & Drawings</h3>
          <p className="text-xs text-slate-500">Drawing register by discipline — architectural, structural, MEP, civil, electrical</p>
        </div>
        <div className="flex items-center gap-2">
          {!projectId && (
            <select value={pid} onChange={(e) => setPid(e.target.value)} className={`${input} max-w-[180px]`}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          )}
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500 border border-slate-200" title="AI-assisted design generation — coming soon">AI Design · SOON</span>
          {canManage && (
            <button onClick={() => setShowForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              {showForm ? 'Cancel' : '+ Upload drawing'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {DISCIPLINES.map((d) => (
          <button key={d.key} onClick={() => setDiscipline(d.key)}
            className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition ${discipline === d.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'}`}>
            {d.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showForm && canManage && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 space-y-1"><span className={label}>Drawing title *</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Foundation layout — Grid A-F" className={input} /></label>
          <label className="space-y-1"><span className={label}>Discipline</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input}>
              {DRAWING_CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select></label>
          <label className="space-y-1"><span className={label}>Drawing reference</span>
            <input value={form.drawingReference} onChange={(e) => setForm({ ...form, drawingReference: e.target.value })} placeholder="e.g. A-102, S-201" className={input} /></label>
          <label className="space-y-1"><span className={label}>Revision</span>
            <input value={form.revisionCode} onChange={(e) => setForm({ ...form, revisionCode: e.target.value })} placeholder="Rev 0 / Rev A" className={input} /></label>
          <label className="space-y-1"><span className={label}>Storage key / file path *</span>
            <input value={form.storageKey} onChange={(e) => setForm({ ...form, storageKey: e.target.value })} placeholder="drawings/block-a/foundation-rev-a.pdf" className={input} /></label>
          <label className="sm:col-span-2 space-y-1"><span className={label}>Notes</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} /></label>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={() => void register()} disabled={saving || form.title.length < 2 || form.storageKey.length < 3}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Registering…' : 'Register drawing'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading drawings…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No {discipline === 'ALL' ? '' : DISCIPLINES.find((d) => d.key === discipline)?.label.toLowerCase() + ' '}drawings{canManage ? ' — register the first set' : ''}.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <div key={d.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-indigo-200 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{d.title}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {d.drawing_reference || '—'} · {d.revision_code}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap ${STATUS_STYLE[d.status] || 'bg-slate-100 text-slate-600'}`}>
                  {d.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full">
                  {CATEGORY_LABEL[d.category] || d.category}
                </span>
                <span className="text-[10px] text-slate-400">{d.uploaded_by_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
