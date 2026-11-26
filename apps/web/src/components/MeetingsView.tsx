import React, { useCallback, useEffect, useState} from 'react';
import { formatDateTime } from '../lib/format';
import { api, apiErrorMessage } from '../lib/api';

interface Meeting {
  id: string; title: string; description?: string | null; location?: string | null;
  startsAt: string; endsAt: string; attendees: string[]; status: string;
}

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function MeetingsView({ projectId, canManage = true}: { projectId?: string; canManage?: boolean}): React.JSX.Element {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [form, setForm] = useState(() => {
    const start = new Date(Date.now() + 24 * 3600 * 1000);
    start.setMinutes(0, 0);
    const end = new Date(start.getTime() + 3600 * 1000);
    return { title: '', location: '', description: '', startsAt: toLocalInput(start), endsAt: toLocalInput(end), attendees: '' };
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = projectId ? `?projectId=${projectId}` : '';
      const json: any = await api.get(`/api/v1/meetings${qs}`);
      setMeetings(json?.data || []);
} catch (err) {
      setError(apiErrorMessage(err, 'Load failed'));
} finally {
      setLoading(false);
}
  }, [projectId]);

  useEffect(() => { void load();}, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/meetings', {
        title: form.title,
        projectId: projectId || null,
        description: form.description || null,
        location: form.location || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        attendees: form.attendees.split(',').map((a) => a.trim()).filter(Boolean),
});
      setShowForm(false);
      await load();
} catch (err) {
      setError(apiErrorMessage(err, 'Create failed'));
} finally {
      setSaving(false);
}
};

  const cancel = async (id: string) => {
    setCancelling(id);
    setError(null);
    try {
      await api.patch(`/api/v1/meetings/${id}`, { status: 'CANCELLED' });
      await load();
} catch (err) {
      setError(apiErrorMessage(err, 'Cancel failed'));
} finally {
      setCancelling(null);
}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading meetings…</div>;
}

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';
  const now = Date.now();

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex items-center justify-between flex-wrap gap-2">
<div>
<h3 className="text-base font-bold text-slate-900">Meetings</h3>
<p className="text-xs text-slate-500">Site and team meetings — export any meeting to your calendar (.ics)</p>
</div>
        {canManage && (
<button onClick={() => setShowForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
            {showForm ? 'Cancel' : '+ Schedule meeting'}
</button>
)}
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showForm && canManage && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
<label className="sm:col-span-2 space-y-1"><span className={label}>Title *</span>
<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value})} placeholder="e.g. Weekly site coordination meeting" className={input} /></label>
<label className="space-y-1"><span className={label}>Starts *</span>
<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Ends *</span>
<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value})} className={input} /></label>
<label className="space-y-1"><span className={label}>Location</span>
<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value})} placeholder="Site office, Block B" className={input} /></label>
<label className="sm:col-span-2 space-y-1"><span className={label}>Attendees (emails or names, comma-separated)</span>
<input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value})} placeholder="site.manager@company.co.ke, client@example.com" className={input} /></label>
<label className="sm:col-span-2 space-y-1"><span className={label}>Description</span>
<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value})} rows={2} className={input} /></label>
<div className="sm:col-span-2 flex justify-end">
<button onClick={() => void create()} disabled={saving || form.title.trim().length < 3}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Schedule'}
</button>
</div>
</div>
)}

      {meetings.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No meetings scheduled{canManage ? ' — schedule the first one' : ''}.</p>
) : (
<div className="space-y-2.5">
          {meetings.map((m) => {
            const cancelled = m.status === 'CANCELLED';
            const past = new Date(m.endsAt).getTime() < now && !cancelled;
            return (
<div key={m.id} data-testid="meeting-card" className={`border rounded-xl p-4 ${cancelled ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
<span className="text-sm font-bold text-slate-900">{m.title}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${cancelled ? 'bg-rose-50 text-rose-600' : past ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {cancelled ? 'Cancelled' : past ? 'Held' : 'Scheduled'}
</span>
</div>
<p className="text-[11px] text-slate-600 mt-1">
                    {formatDateTime(new Date(m.startsAt))} → {formatDateTime(new Date(m.endsAt))}
                    {m.location ? ` · ${m.location}` : ''}
</p>
                {m.description &&<p className="text-[11px] text-slate-500 mt-1">{m.description}</p>}
                {m.attendees.length > 0 &&<p className="text-[10px] text-slate-400 mt-1">With: {m.attendees.join(', ')}</p>}
</div>
<div className="flex flex-col gap-1 shrink-0">
<a href={`/api/v1/meetings/${m.id}/ics`} download
                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-center">
                    .ics
</a>
                  {canManage && !cancelled && (
<button onClick={() => void cancel(m.id)} disabled={cancelling === m.id}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg disabled:opacity-50">
                        {cancelling === m.id ? 'Cancelling…' : 'Cancel'}
</button>
)}
</div>
</div>
</div>
);
})}
</div>
)}
</div>
);
}
