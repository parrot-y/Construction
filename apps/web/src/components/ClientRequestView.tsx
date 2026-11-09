import React, { useEffect, useState} from 'react';

const PROJECT_TYPES = [
  'New house / bungalow', 'Maisonette or villa', 'Apartments / flats',
  'Commercial building', 'Renovation / remodeling', 'Kitchen or bathroom remodel',
  'Interior design & finishes', 'Fencing & gates', 'Borehole / water works',
  'Solar / electrical installation', 'CCTV & security', 'Landscaping & gardening',
  'Roads, drainage or civil works', 'Land clearing & surveying', 'Other',
];
const BUDGET_RANGES = ['Below KES 1M', 'KES 1M - 5M', 'KES 5M - 20M', 'KES 20M - 50M', 'Above KES 50M', 'Not sure yet'];
const START_TFRAMES = ['As soon as possible', 'Within 3 months', 'In 3 - 6 months', 'In 6 - 12 months', 'Just planning for now'];

interface ClientRequest { id: string; project_type: string; location_text: string; budget_range?: string | null; start_timeframe?: string | null; description: string; status: string; created_at: string}

const input = 'w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';
const label = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1';

export default function ClientRequestView(): React.JSX.Element {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [form, setForm] = useState({ projectType: '', locationText: '', budgetRange: '', startTimeframe: '', description: '', contactPhone: ''});
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = () => {
    fetch('/api/v1/client/project-requests', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : { data: []}))
      .then((j) => setRequests(j.data || []))
      .catch(() => {});
};
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/client/project-requests', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(form),
});
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message || 'Failed to send request');
      setSent(true); setShowForm(false);
      setForm({ projectType: '', locationText: '', budgetRange: '', startTimeframe: '', description: '', contactPhone: ''});
      load();
} catch (err: any) {
      setError(err.message);
} finally {
      setSaving(false);
}
};

  const statusStyle: Record<string, string> = {
    NEW: 'bg-sky-50 text-sky-700 border-sky-200',
    REVIEWING: 'bg-amber-50 text-amber-700 border-amber-200',
    CONVERTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

  return (
<div className="space-y-4">
<div className="flex items-start justify-between gap-3 flex-wrap">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Request a project</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">Tell us what you want done — we find qualified, vetted contractors for you, anywhere in Kenya.</p>
</div>
<button onClick={() => { setShowForm((v) => !v); setSent(false);}}
          className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg">
          {showForm ? 'Cancel' : '+ New request'}
</button>
</div>

      {sent && (
<div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          Request sent — we&apos;ll call you within one working day.
</div>
)}

      {showForm && (
<form onSubmit={submit} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
<label className={label}>What do you want done? *</label>
<select required value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value})} className={input}>
<option value="">Choose the type of project…</option>
                {PROJECT_TYPES.map((t) =><option key={t} value={t}>{t}</option>)}
</select>
</div>
<div>
<label className={label}>Where is the site? *</label>
<input required value={form.locationText} onChange={(e) => setForm({ ...form, locationText: e.target.value})} placeholder="e.g. Kilimani, Nairobi" className={input} />
</div>
<div>
<label className={label}>Budget</label>
<select value={form.budgetRange} onChange={(e) => setForm({ ...form, budgetRange: e.target.value})} className={input}>
<option value="">Select a range…</option>
                {BUDGET_RANGES.map((b) =><option key={b} value={b}>{b}</option>)}
</select>
</div>
<div>
<label className={label}>When do you want to start?</label>
<select value={form.startTimeframe} onChange={(e) => setForm({ ...form, startTimeframe: e.target.value})} className={input}>
<option value="">Select…</option>
                {START_TFRAMES.map((t) =><option key={t} value={t}>{t}</option>)}
</select>
</div>
</div>
<div>
<label className={label}>Describe the work *</label>
<textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value})}
              placeholder="Sizes, finishes, timeline constraints, anything that helps us match you with the right contractor…" className={input} />
</div>
<div className="sm:max-w-xs">
<label className={label}>Phone or WhatsApp, so we can call you *</label>
<input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value})} placeholder="+254…" className={input} />
</div>
          {error &&<p className="text-xs font-semibold text-red-600">{error}</p>}
<button type="submit" disabled={saving}
            className="px-5 py-2.5 text-sm font-bold bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg">
            {saving ? 'Sending…' : 'Send request'}
</button>
<p className="text-[11px] text-slate-400">Free, with no obligation. We call you within one working day.</p>
</form>
)}

<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<p className="px-5 py-3 text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">My requests</p>
        {requests.length === 0 ? (
<p className="px-5 py-8 text-xs text-slate-400 text-center">No requests yet — send your first one above.</p>
) : (
<div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {requests.map((r) => (
<div key={r.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
<div className="min-w-0">
<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.project_type}</p>
<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{r.location_text}{r.budget_range ? ` · ${r.budget_range}` : ''}{r.start_timeframe ? ` · ${r.start_timeframe}` : ''}</p>
<p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{r.description}</p>
</div>
<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusStyle[r.status] || statusStyle.NEW}`}>
                  {r.status}
</span>
</div>
))}
</div>
)}
</div>
</div>
);
}
