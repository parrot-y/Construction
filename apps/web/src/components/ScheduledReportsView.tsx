import React, { useCallback, useEffect, useState } from 'react';

interface ScheduledReport {
  id: string; name: string; report_type: string; frequency: string;
  day_of_week?: number | null; day_of_month?: number | null;
  recipients: string[]; format: string; status: string;
  project?: { id: string; name: string; code: string } | null;
  next_run_at?: string | null; last_run_at?: string | null;
  runs?: { id: string; ran_at: string; status: string; error?: string | null }[];
}

const TYPES = ['FINANCIAL', 'OPERATIONAL', 'BY_PROJECT', 'BY_REGION', 'CUSTOM'];
const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduledReportsView({ canManage = true }: { canManage?: boolean }): React.JSX.Element {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({ name: '', reportType: 'FINANCIAL', frequency: 'WEEKLY', dayOfWeek: '1', dayOfMonth: '1', recipients: '', format: 'PDF' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/reports/scheduled', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load scheduled reports');
      const json = await res.json();
      setReports(json.data || []);
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/reports/scheduled', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          reportType: form.reportType,
          frequency: form.frequency,
          dayOfWeek: form.frequency === 'WEEKLY' ? parseInt(form.dayOfWeek, 10) : null,
          dayOfMonth: form.frequency === 'MONTHLY' ? parseInt(form.dayOfMonth, 10) : null,
          recipients: form.recipients.split(',').map((r) => r.trim()).filter(Boolean),
          format: form.format,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowForm(false);
      setForm({ name: '', reportType: 'FINANCIAL', frequency: 'WEEKLY', dayOfWeek: '1', dayOfMonth: '1', recipients: '', format: 'PDF' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/v1/reports/scheduled/${id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch { /* ignore */ }
  };

  const runNow = async (id: string) => {
    setRunning(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/scheduled/${id}/run`, { method: 'POST', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Run failed (${res.status})`);
      await load();
      // refresh expanded runs
      if (expandedRuns === id) await toggleRuns(id);
    } catch (err: any) {
      setError(err?.message || 'Run failed');
    } finally {
      setRunning(null);
    }
  };

  const toggleRuns = async (id: string) => {
    if (expandedRuns === id) { setExpandedRuns(null); return; }
    setExpandedRuns(id);
    if (!runs[id]) {
      const res = await fetch(`/api/v1/reports/scheduled/${id}/runs`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setRuns((prev) => ({ ...prev, [id]: json.data || [] }));
      }
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading scheduled reports…</div>;
  }

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Scheduled reports</h3>
          <p className="text-xs text-slate-500">Recurring financial, operational & project digests</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
            {showForm ? 'Cancel' : '+ Schedule report'}
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showForm && canManage && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 space-y-1"><span className={label}>Report name *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekly financial digest" className={input} /></label>
          <label className="space-y-1"><span className={label}>Type</span>
            <select value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })} className={input}>
              {TYPES.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase().replace(/_/g, ' ')}</option>)}
            </select></label>
          <label className="space-y-1"><span className={label}>Frequency</span>
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={input}>
              {FREQS.map((f) => <option key={f} value={f}>{f[0] + f.slice(1).toLowerCase()}</option>)}
            </select></label>
          {form.frequency === 'WEEKLY' && (
            <label className="space-y-1"><span className={label}>Day of week</span>
              <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className={input}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select></label>
          )}
          {form.frequency === 'MONTHLY' && (
            <label className="space-y-1"><span className={label}>Day of month</span>
              <input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} className={input} /></label>
          )}
          <label className="space-y-1"><span className={label}>Format</span>
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className={input}>
              {['PDF', 'EXCEL', 'JSON'].map((f) => <option key={f} value={f}>{f}</option>)}
            </select></label>
          <label className="sm:col-span-2 space-y-1"><span className={label}>Recipients (emails or role names, comma-separated) *</span>
            <input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="finance@company.co.ke, PM_QS, EXECUTIVE" className={input} /></label>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={() => void create()} disabled={saving || form.name.length < 3 || !form.recipients.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Schedule'}
            </button>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No scheduled reports{canManage ? ' — schedule your first digest' : ''}.</p>
      ) : (
        <div className="space-y-2.5">
          {reports.map((r) => (
            <div key={r.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{r.name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${r.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full">{r.report_type[0] + r.report_type.slice(1).toLowerCase().replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400">{r.frequency[0] + r.frequency.slice(1).toLowerCase()}{r.frequency === 'WEEKLY' && r.day_of_week != null ? ` · ${DAYS[r.day_of_week]}` : ''}{r.frequency === 'MONTHLY' && r.day_of_month ? ` · day ${r.day_of_month}` : ''} · {r.format}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {r.project ? `${r.project.code} — ${r.project.name}` : 'All projects'} · → {r.recipients.join(', ')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Next: {r.next_run_at ? new Date(r.next_run_at).toLocaleString() : '—'} · Last: {r.last_run_at ? new Date(r.last_run_at).toLocaleString() : 'never'}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {canManage && (
                    <>
                      <button onClick={() => void runNow(r.id)} disabled={running === r.id}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg disabled:opacity-50">
                        {running === r.id ? 'Running…' : '▶ Run now'}
                      </button>
                      <button onClick={() => void setStatus(r.id, r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                        {r.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                    </>
                  )}
                  <button onClick={() => void toggleRuns(r.id)} className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700">
                    {expandedRuns === r.id ? 'Hide runs' : `Runs (${r.runs?.length ?? 0})`}
                  </button>
                </div>
              </div>
              {expandedRuns === r.id && (
                <div className="mt-3 border-t border-slate-100 pt-2 space-y-1">
                  {(runs[r.id] || []).length === 0 ? (
                    <p className="text-[11px] text-slate-400">No runs yet.</p>
                  ) : (
                    (runs[r.id] || []).map((run: any) => (
                      <div key={run.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{new Date(run.ran_at).toLocaleString()}</span>
                        <span className={`font-bold ${run.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}`}>{run.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
