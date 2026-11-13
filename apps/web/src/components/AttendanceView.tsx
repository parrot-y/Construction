import React, { useCallback, useEffect, useState} from 'react';

interface Laborer { id: string; full_name: string; worker_code: string; trade_category: string}
interface AttRow {
  id: string; laborer_id: string; work_date: string; status: string;
  check_in_at?: string | null; check_out_at?: string | null;
  hours_worked?: string | null; notes?: string | null;
  laborer?: { full_name: string; worker_code: string; trade_category: string};
  crew?: { id: string; name: string; trade: string} | null;
  recorded_by_name?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  HALF_DAY: 'bg-amber-50 text-amber-700',
  LEAVE: 'bg-sky-50 text-sky-700',
  OFF_DAY: 'bg-slate-100 text-slate-600',
  ABSENT: 'bg-rose-50 text-rose-700',
};
const MARK_STATUSES = ['PRESENT', 'HALF_DAY', 'LEAVE', 'OFF_DAY', 'ABSENT'];
const TRADES = ['MASON', 'CARPENTER', 'STEEL_FIXER', 'PLUMBER', 'ELECTRICIAN', 'PAINTER', 'TILER', 'CASUAL_LABORER', 'SCAFFOLDER', 'FOREMAN'];
const SKILLS = ['CASUAL_MTU_WA_MKONO', 'SEMI_SKILLED', 'ARTISAN_FUNDI', 'CHARGEHAND_FOREMAN'];

export default function AttendanceView({ projectId, canManage = true}: { projectId?: string; canManage?: boolean}): React.JSX.Element {
  const [projects, setProjects] = useState<{ id: string; name: string; code: string}[]>([]);
  const [pid, setPid] = useState(projectId || '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttRow[]>([]);
  const [laborers, setLaborers] = useState<Laborer[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLaborerForm, setShowLaborerForm] = useState(false);
  const [labForm, setLabForm] = useState({ workerCode: '', fullName: '', nationalIdNo: '', phoneNumber: '', tradeCategory: 'CASUAL_LABORER', skillLevel: 'SEMI_SKILLED', dailyRateKes: '800'});
  const [labSaving, setLabSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) return;
    fetch('/api/v1/projects', { credentials: 'include'})
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code}));
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
      const res = await fetch(`/api/v1/projects/${pid}/attendance?date=${date}`, { credentials: 'include'});
      if (!res.ok) throw new Error('Failed to load attendance');
      const json = await res.json();
      setRows(json.data || []);
      setLaborers(json.laborers || []);
      setSummary(json.summary || null);
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [pid, date]);

  useEffect(() => { void load();}, [load]);

  const byLaborer = new Map(rows.map((r) => [r.laborer_id, r]));

  const act = async (kind: 'check-in' | 'check-out' | 'record', laborerId: string, status?: string) => {
    setBusy(`${kind}-${laborerId}`);
    setError(null);
    try {
      const url = kind === 'record' ? `/api/v1/projects/${pid}/attendance` : `/api/v1/projects/${pid}/attendance/${kind}`;
      const res = await fetch(url, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(kind === 'record' ? { laborerId, status, workDate: date} : { laborerId, workDate: date}),
});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      await load();
} catch (err: any) {
      setError(err?.message || 'Action failed');
} finally {
      setBusy(null);
}
};

  if (loading && !rows.length) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading attendance…</div>;
}

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex items-center justify-between flex-wrap gap-2">
<div>
<h3 className="text-base font-bold text-slate-900">Attendance</h3>
<p className="text-xs text-slate-500">Daily site register — check-ins, leave & off-days</p>
</div>
<div className="flex items-center gap-2">
          {!projectId && (
<select value={pid} onChange={(e) => setPid(e.target.value)} className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs max-w-[200px]">
              {projects.map((p) =><option key={p.id} value={p.id}>{p.code}</option>)}
</select>
)}
<input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs" />
</div>
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {canManage && (
<div className="flex justify-end">
<button onClick={() => setShowLaborerForm((v) => !v)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
            {showLaborerForm ? '− Cancel' : '+ Register laborer'}
</button>
</div>
)}

      {showLaborerForm && canManage && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {([
            ['workerCode', 'Worker code *', 'e.g. WK-014'],
            ['fullName', 'Full name *', 'e.g. Joseph Otieno'],
            ['nationalIdNo', 'National ID *', 'e.g. 12345678'],
            ['phoneNumber', 'Phone (07…/254…) *', 'e.g. 0712345678'],
          ] as const).map(([k, ph, hint]) => (
<label key={k} className="space-y-1">
<span className="block text-[10px] font-semibold text-slate-500">{ph}</span>
<input value={labForm[k]} onChange={(e) => setLabForm({ ...labForm, [k]: e.target.value})} placeholder={hint}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
</label>
))}
<label className="space-y-1">
<span className="block text-[10px] font-semibold text-slate-500">Trade</span>
<select value={labForm.tradeCategory} onChange={(e) => setLabForm({ ...labForm, tradeCategory: e.target.value})}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
              {TRADES.map((t) =><option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
</select>
</label>
<label className="space-y-1">
<span className="block text-[10px] font-semibold text-slate-500">Skill level</span>
<select value={labForm.skillLevel} onChange={(e) => setLabForm({ ...labForm, skillLevel: e.target.value})}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
              {SKILLS.map((t) =><option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
</select>
</label>
<label className="space-y-1">
<span className="block text-[10px] font-semibold text-slate-500">Daily rate (KES)</span>
<input value={labForm.dailyRateKes} onChange={(e) => setLabForm({ ...labForm, dailyRateKes: e.target.value})}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
</label>
<div className="col-span-2 sm:col-span-3 flex justify-end">
<button
              disabled={labSaving || !labForm.workerCode || !labForm.fullName || !labForm.nationalIdNo || !labForm.phoneNumber}
              onClick={async () => {
                setLabSaving(true); setError(null);
                try {
                  const res = await fetch(`/api/v1/projects/${pid}/laborers`, {
                    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
                    body: JSON.stringify(labForm),
});
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
                  setShowLaborerForm(false);
                  setLabForm({ workerCode: '', fullName: '', nationalIdNo: '', phoneNumber: '', tradeCategory: 'CASUAL_LABORER', skillLevel: 'SEMI_SKILLED', dailyRateKes: '800'});
                  await load();
} catch (err: any) {
                  setError(err?.message || 'Registration failed');
} finally {
                  setLabSaving(false);
}
}}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {labSaving ? 'Saving…' : 'Save laborer'}
</button>
</div>
</div>
)}

      {summary && (
<div className="grid grid-cols-3 gap-2 text-center">
<div className="bg-emerald-50 rounded-lg py-2"><p className="text-lg font-bold text-emerald-700">{summary.present}</p><p className="text-[10px] font-semibold text-emerald-600">Present</p></div>
<div className="bg-sky-50 rounded-lg py-2"><p className="text-lg font-bold text-sky-700">{summary.on_leave}</p><p className="text-[10px] font-semibold text-sky-600">Leave / off</p></div>
<div className="bg-rose-50 rounded-lg py-2"><p className="text-lg font-bold text-rose-700">{summary.absent}</p><p className="text-[10px] font-semibold text-rose-600">Absent</p></div>
</div>
)}

      {laborers.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No active laborers on this project — add them under People → Labor.</p>
) : (
<div className="space-y-1.5">
          {laborers.map((l) => {
            const row = byLaborer.get(l.id);
            return (
<div key={l.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
<div className="min-w-0">
<p className="text-xs font-bold text-slate-900">{l.full_name}<span className="text-slate-400 font-mono tabular-nums">{l.worker_code}</span></p>
<p className="text-[10px] text-slate-500">{l.trade_category}{row?.crew ? ` · ${row.crew.name}` : ''}</p>
</div>
<div className="flex items-center gap-2 flex-wrap">
                  {row && (
<>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_STYLE[row.status] || 'bg-slate-100 text-slate-600'}`}>{row.status.replace('_', ' ')}</span>
                      {row.check_in_at &&<span className="text-[10px] text-slate-400">in {new Date(row.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</span>}
                      {row.check_out_at &&<span className="text-[10px] text-slate-400">out {new Date(row.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}{row.hours_worked ? ` (${row.hours_worked}h)` : ''}</span>}
</>
)}
                  {canManage && !row?.check_in_at && (
<button onClick={() => void act('check-in', l.id)} disabled={busy !== null}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg disabled:opacity-50">Check in</button>
)}
                  {canManage && row?.check_in_at && !row.check_out_at && (
<button onClick={() => void act('check-out', l.id)} disabled={busy !== null}
                      className="px-2.5 py-1 text-[11px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg disabled:opacity-50">Check out</button>
)}
                  {canManage && (
<select
                      value=""
                      onChange={(e) => { if (e.target.value) void act('record', l.id, e.target.value);}}
                      disabled={busy !== null}
                      className="border border-slate-300 rounded px-1.5 py-1 text-[10px] text-slate-500"
                    >
<option value="">Mark…</option>
                      {MARK_STATUSES.map((s) =><option key={s} value={s}>{s.replace('_', ' ')}</option>)}
</select>
)}
</div>
</div>
);
})}
</div>
)}
</div>
);
}
