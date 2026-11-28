import React, { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { InlineError } from './feedback/InlineError';

/**
 * Project settings — edit name/code/location/contract sum and the Kenyan
 * retention terms (rate %, cap %, first moiety %) via PATCH /projects/:id.
 * Retention fields are admin/PM-QS only on the API; the form surfaces the
 * server's 403 message inline if a lesser role somehow opens it.
 */
export default function ProjectSettingsModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const [form, setForm] = useState({ name: '', code: '', location: '', ncaProjectNo: '', contractValue: '', retentionRatePct: '', retentionCapPct: '', retentionFirstMoietyPct: '', startDate: '', targetEndDate: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<any>(`/api/v1/projects/${projectId}`)
      .then((j) => {
        if (!alive) return;
        const p = j?.data || {};
        setForm({
          name: p.name || '',
          code: p.code || '',
          location: p.location || '',
          ncaProjectNo: p.nca_project_no || '',
          contractValue: p.original_contract_sum != null ? String(p.original_contract_sum) : '',
          retentionRatePct: p.retention_rate_pct != null ? String(p.retention_rate_pct) : '',
          retentionCapPct: p.retention_cap_pct != null ? String(p.retention_cap_pct) : '',
          retentionFirstMoietyPct: p.retention_first_moiety_pct != null ? String(p.retention_first_moiety_pct) : '',
          startDate: p.start_date ? String(p.start_date).slice(0, 10) : '',
          targetEndDate: p.target_end_date ? String(p.target_end_date).slice(0, 10) : '',
        });
        setLoading(false);
      })
      .catch(() => { if (alive) { setError('Could not load project settings.'); setLoading(false); } });  // intentionally kept generic on load
    return () => { alive = false; };
  }, [projectId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || loading) return;
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        location: form.location.trim() || null,
        ncaProjectNo: form.ncaProjectNo.trim() || null,
        contractValue: form.contractValue.trim() === '' ? null : form.contractValue.trim(),
        retentionRatePct: form.retentionRatePct.trim() === '' ? null : form.retentionRatePct.trim(),
        retentionCapPct: form.retentionCapPct.trim() === '' ? null : form.retentionCapPct.trim(),
        retentionFirstMoietyPct: form.retentionFirstMoietyPct.trim() === '' ? null : form.retentionFirstMoietyPct.trim(),
        startDate: form.startDate || null,
        targetEndDate: form.targetEndDate || null,
      };
      await api.patch(`/api/v1/projects/${projectId}`, body);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not save project settings'));
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-orange-500';
  const lbl = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1';

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
<div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
<div className="flex items-center justify-between mb-4">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Project settings</h3>
<button onClick={onClose} className="text-slate-600 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
</div>
        {loading ? (
<p className="text-xs text-slate-600 py-6 text-center">Loading project…</p>
) : (
<form onSubmit={submit} className="space-y-3">
<div>
<label className={lbl} htmlFor="ps-name">Project name *</label>
<input id="ps-name" className={input} value={form.name} onChange={set('name')} required />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className={lbl} htmlFor="ps-code">Project code *</label>
<input id="ps-code" className={input} value={form.code} onChange={set('code')} required />
</div>
<div>
<label className={lbl} htmlFor="ps-location">Location</label>
<input id="ps-location" className={input} value={form.location} onChange={set('location')} />
</div>
</div>
<div>
<label className={lbl} htmlFor="ps-value">Contract sum (KES)</label>
<input id="ps-value" className={input} inputMode="decimal" value={form.contractValue} onChange={set('contractValue')} placeholder="e.g. 84500000" />
</div>
<div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Retention (Kenya standard terms)</p>
<div className="grid grid-cols-3 gap-3">
<div>
<label className={lbl} htmlFor="ps-rr">Rate %</label>
<input id="ps-rr" className={input} inputMode="decimal" value={form.retentionRatePct} onChange={set('retentionRatePct')} placeholder="5" />
</div>
<div>
<label className={lbl} htmlFor="ps-rc">Cap %</label>
<input id="ps-rc" className={input} inputMode="decimal" value={form.retentionCapPct} onChange={set('retentionCapPct')} placeholder="5" />
</div>
<div>
<label className={lbl} htmlFor="ps-rm">First moiety %</label>
<input id="ps-rm" className={input} inputMode="decimal" value={form.retentionFirstMoietyPct} onChange={set('retentionFirstMoietyPct')} placeholder="50" />
</div>
</div>
<p className="text-[10px] text-slate-600">Rate held on each certificate; cap limits total retention; first moiety is released at practical completion.</p>
</div>
<div>
<label className={lbl} htmlFor="ps-nca">NCA project no.</label>
<input id="ps-nca" className={input} value={form.ncaProjectNo} onChange={set('ncaProjectNo')} />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className={lbl} htmlFor="ps-start">Start date</label>
<input type="date" id="ps-start" className={input} value={form.startDate} onChange={set('startDate')} />
</div>
<div>
<label className={lbl} htmlFor="ps-end">Target end</label>
<input type="date" id="ps-end" className={input} value={form.targetEndDate} onChange={set('targetEndDate')} />
</div>
</div>
{error && <InlineError error={error} />}
<div className="flex justify-end gap-2 pt-2">
<button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
<button type="submit" disabled={busy || loading} className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-700 hover:bg-orange-800 text-white disabled:opacity-50">
            {busy ? 'Saving…' : 'Save settings'}
</button>
</div>
</form>
)}
</div>
</div>
  );
}
