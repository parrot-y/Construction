import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// New project — the console's primary creation path (was a dead button).
export default function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id?: string) => void }): React.JSX.Element {
  const [form, setForm] = useState({ name: '', code: '', location: '', description: '', contractValue: '', contractCurrency: 'KES', ncaProjectNo: '', startDate: '', targetEndDate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { setError('Name and project code are required.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          location: form.location.trim() || undefined,
          description: form.description.trim() || undefined,
          contractValue: form.contractValue.trim() || undefined,
          contractCurrency: form.contractCurrency || 'KES',
          ncaProjectNo: form.ncaProjectNo.trim() || undefined,
          startDate: form.startDate || undefined,
          targetEndDate: form.targetEndDate || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not create the project');
      onCreated(body.data?.id || body.id);
    } catch (err: any) {
      setError(err.message || 'Could not create the project');
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-orange-500';
  const lbl = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1';

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
<div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
<div className="flex items-center justify-between mb-4">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">New project</h3>
<button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
</div>
<form onSubmit={submit} className="space-y-3">
<div>
<label className={lbl} htmlFor="np-name">Project name *</label>
<input id="np-name" className={input} value={form.name} onChange={set('name')} placeholder="e.g. Kilimani Office Fit-Out" required />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className={lbl} htmlFor="np-code">Project code *</label>
<input id="np-code" className={input} value={form.code} onChange={set('code')} placeholder="e.g. KIL-001" required />
</div>
<div>
<label className={lbl} htmlFor="np-location">Location</label>
<input id="np-location" className={input} value={form.location} onChange={set('location')} placeholder="e.g. Kilimani, Nairobi" />
</div>
</div>
<div>
<label className={lbl} htmlFor="np-desc">Description</label>
<input id="np-desc" className={input} value={form.description} onChange={set('description')} placeholder="Short scope summary" />
</div>
<div className="grid grid-cols-3 gap-3">
<div className="col-span-2">
<label className={lbl} htmlFor="np-value">Contract value</label>
<input id="np-value" className={input} inputMode="decimal" value={form.contractValue} onChange={set('contractValue')} placeholder="e.g. 84500000" />
</div>
<div>
<label className={lbl} htmlFor="np-currency">Currency</label>
<select id="np-currency" className={input} value={form.contractCurrency} onChange={(e) => setForm((f) => ({ ...f, contractCurrency: e.target.value }))}>
<option value="KES">KES</option>
<option value="USD">USD</option>
</select>
</div>
</div>
<div>
<label className={lbl} htmlFor="np-nca">NCA project no. (optional)</label>
<input id="np-nca" className={input} value={form.ncaProjectNo} onChange={set('ncaProjectNo')} placeholder="NCA-PRJ-2026-XXXX" />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className={lbl} htmlFor="np-start">Start date</label>
<input type="date" id="np-start" className={input} value={form.startDate} onChange={set('startDate')} />
</div>
<div>
<label className={lbl} htmlFor="np-end">Target end</label>
<input type="date" id="np-end" className={input} value={form.targetEndDate} onChange={set('targetEndDate')} />
</div>
</div>
{error &&<p className="text-xs font-semibold text-rose-600">{error}</p>}
<div className="flex justify-end gap-2 pt-2">
<button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
<button type="submit" disabled={busy} className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
{busy ? 'Creating…' : 'Create project'}
</button>
</div>
</form>
</div>
</div>
);
}
