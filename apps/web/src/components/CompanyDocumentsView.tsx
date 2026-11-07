import React, { useCallback, useEffect, useState } from 'react';

interface CompanyDoc {
  id: string; title: string; category?: string | null; reference_no?: string | null;
  file_name?: string | null; expiry_date?: string | null; expiry_status?: string;
  status: string; uploaded_by_name: string; notes?: string | null; created_at: string;
}

const CATEGORIES = ['POLICY', 'TEMPLATE', 'CERTIFICATION', 'INSURANCE', 'HR', 'LEGAL', 'OTHER'];
const CAT_LABEL: Record<string, string> = {
  POLICY: 'Policies', TEMPLATE: 'Templates', CERTIFICATION: 'Certifications',
  INSURANCE: 'Insurance', HR: 'HR', LEGAL: 'Legal', OTHER: 'Other',
};
const EXPIRY_STYLE: Record<string, string> = {
  EXPIRED: 'bg-rose-50 text-rose-700',
  EXPIRING_SOON: 'bg-amber-50 text-amber-700',
  VALID: 'bg-emerald-50 text-emerald-700',
};

export default function CompanyDocumentsView({ canManage = false }: { canManage?: boolean }): React.JSX.Element {
  const [docs, setDocs] = useState<CompanyDoc[]>([]);
  const [tab, setTab] = useState<string>('ALL'); // ALL | UNFILED | category
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CompanyDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', referenceNo: '', expiryDate: '', fileName: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab === 'UNFILED') params.set('unfiled', '1');
      else if (tab !== 'ALL') params.set('category', tab);
      if (expiringOnly) params.set('expiring', '1');
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/v1/company/documents?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load documents');
      const json = await res.json();
      setDocs(json.data || []);
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [tab, expiringOnly, q]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        title: form.title,
        referenceNo: form.referenceNo || null,
        expiryDate: form.expiryDate || null,
        notes: form.notes || null,
      };
      if (form.category) payload.category = form.category;
      if (form.fileName) payload.fileName = form.fileName;

      const res = editing
        ? await fetch(`/api/v1/company/documents/${editing.id}`, {
            method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: form.title, category: form.category || null, referenceNo: form.referenceNo || null, expiryDate: form.expiryDate || null, notes: form.notes || null }),
          })
        : await fetch('/api/v1/company/documents', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowForm(false);
      setEditing(null);
      setForm({ title: '', category: '', referenceNo: '', expiryDate: '', fileName: '', notes: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    try {
      await fetch(`/api/v1/company/documents/${id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      await load();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading documents…</div>;
  }

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Company documents</h3>
          <p className="text-xs text-slate-500">{docs.length} document{docs.length === 1 ? '' : 's'} — certifications, insurance, policies & legal</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditing(null); setForm({ title: '', category: '', referenceNo: '', expiryDate: '', fileName: '', notes: '' }); setShowForm((v) => !v); }}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
            {showForm ? 'Cancel' : '+ Upload'}
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or reference…"
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <button onClick={() => setExpiringOnly((v) => !v)}
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg ${expiringOnly ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Expiring soon
        </button>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-slate-100 pb-2">
        {['ALL', 'UNFILED', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setTab(c)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md ${tab === c ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {c === 'ALL' ? 'All' : c === 'UNFILED' ? 'Unfiled' : CAT_LABEL[c]}
          </button>
        ))}
      </div>

      {showForm && canManage && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 space-y-1"><span className={label}>Title *</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. NCA Registration Certificate" className={input} /></label>
          <label className="space-y-1"><span className={label}>Category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input}>
              <option value="">— Unfiled —</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select></label>
          <label className="space-y-1"><span className={label}>Reference no.</span>
            <input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="e.g. NCA/2026/00417" className={input} /></label>
          <label className="space-y-1"><span className={label}>Expiry date</span>
            <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={input} /></label>
          <label className="space-y-1"><span className={label}>File name</span>
            <input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="certificate.pdf" className={input} /></label>
          <label className="sm:col-span-2 space-y-1"><span className={label}>Notes</span>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} resize-none`} /></label>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={() => void submit()} disabled={saving || form.title.length < 2}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Upload document'}
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No documents{tab === 'UNFILED' ? ' waiting to be filed' : ''}.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="border border-slate-200 rounded-xl p-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">{d.title}</span>
                  {d.category
                    ? <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full">{CAT_LABEL[d.category] || d.category}</span>
                    : <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 rounded-full">Unfiled</span>}
                  {d.expiry_status && d.expiry_status !== 'NONE' && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${EXPIRY_STYLE[d.expiry_status]}`}>
                      {d.expiry_status === 'EXPIRED' ? 'Expired' : d.expiry_status === 'EXPIRING_SOON' ? `Expires ${d.expiry_date}` : `Valid to ${d.expiry_date}`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {d.reference_no ? `Ref: ${d.reference_no} · ` : ''}{d.file_name ? `${d.file_name} · ` : ''}{d.uploaded_by_name} · {new Date(d.created_at).toLocaleDateString()}
                </p>
                {d.notes && <p className="text-[11px] text-slate-600 mt-1">{d.notes}</p>}
              </div>
              {canManage && (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => {
                    setEditing(d);
                    setForm({ title: d.title, category: d.category || '', referenceNo: d.reference_no || '', expiryDate: d.expiry_date || '', fileName: d.file_name || '', notes: d.notes || '' });
                    setShowForm(true);
                  }} className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Edit</button>
                  <button onClick={() => void archive(d.id)} className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">Archive</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
