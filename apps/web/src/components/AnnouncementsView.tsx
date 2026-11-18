import React, { useCallback, useEffect, useState} from 'react';
import { formatDate, formatDateTime } from '../lib/format';
import { api, apiErrorMessage } from '../lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: string;
  audience: string;
  status: string;
  published_at: string | null;
  expires_at: string | null;
  read_by_me: boolean;
  read_count: number;
  created_at: string | null;
}

interface Reader {
  user_id: string;
  read_at: string;
  user: { full_name: string; email: string} | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-sky-50 text-sky-700',
  HIGH: 'bg-amber-50 text-amber-700',
  URGENT: 'bg-rose-50 text-rose-700',
};

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'Everyone',
  INTERNAL: 'Internal team',
  CLIENTS: 'Clients only',
  FIELD_TEAM: 'Field team',
};

export default function AnnouncementsView({ canManage = true}: { canManage?: boolean}): React.JSX.Element {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [readers, setReaders] = useState<Record<string, Reader[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL', audience: 'ALL', expiresAt: ''});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.get<{ data?: Announcement[] }>('/api/v1/announcements');
      setItems(json.data || []);
} catch (err) {
      setError(apiErrorMessage(err));
} finally {
      setLoading(false);
}
}, []);

  useEffect(() => { void load();}, [load]);

  const markRead = async (id: string) => {
    try {
      await api.post(`/api/v1/announcements/${id}/read`);
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, read_by_me: true, read_count: a.read_count + 1} : a)));
} catch { /* best-effort */}
};

  const toggleReaders = async (id: string) => {
    if (expanded === id) { setExpanded(null); return;}
    setExpanded(id);
    if (!readers[id]) {
      try {
        const json = await api.get<{ data?: Reader[] }>(`/api/v1/announcements/${id}/readers`);
        setReaders((prev) => ({ ...prev, [id]: json.data || []}));
} catch { /* ignore */}
}
};

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/announcements', {
        title: form.title,
        body: form.body,
        priority: form.priority,
        audience: form.audience,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
});
      setShowCompose(false);
      setForm({ title: '', body: '', priority: 'NORMAL', audience: 'ALL', expiresAt: ''});
      await load();
} catch (err) {
      setError(apiErrorMessage(err));
} finally {
      setSaving(false);
}
};

  const archive = async (id: string) => {
    try {
      await api.patch(`/api/v1/announcements/${id}`, { status: 'ARCHIVED'});
      await load();
} catch { /* ignore */}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading announcements…</div>;
}

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex items-center justify-between">
<div>
<h3 className="text-base font-bold text-slate-900">Announcements</h3>
<p className="text-xs text-slate-500">Broadcasts with audience targeting and read receipts</p>
</div>
        {canManage && (
<button
            onClick={() => setShowCompose((v) => !v)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition"
          >
            {showCompose ? 'Cancel' : '+ New Announcement'}
</button>
)}
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showCompose && canManage && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
<input
            type="text"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value})}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
          />
<textarea
            rows={3}
            placeholder="Message body…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value})}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs resize-none"
          />
<div className="grid grid-cols-3 gap-3">
<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value})} className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) =><option key={p} value={p}>{p}</option>)}
</select>
<select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value})} className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
              {Object.entries(AUDIENCE_LABEL).map(([v, l]) =><option key={v} value={v}>{l}</option>)}
</select>
<input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value})}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
              title="Expires at (optional)"
            />
</div>
<div className="flex justify-end">
<button
              onClick={() => void publish()}
              disabled={saving || form.title.length< 3 || form.body.length< 3}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Publishing…' : 'Publish'}
</button>
</div>
</div>
)}

      {items.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No announcements yet.</p>
) : (
<div className="space-y-3">
          {items.map((a) => (
<div key={a.id} className={`border rounded-xl p-4 ${a.read_by_me ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/30'}`}>
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
                    {!a.read_by_me &&<span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" title="Unread" />}
<h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.NORMAL}`}>{a.priority}</span>
<span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-full">{AUDIENCE_LABEL[a.audience] || a.audience}</span>
</div>
<p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{a.body}</p>
<p className="text-[10px] text-slate-400 mt-2">
                    {a.published_at ? formatDateTime(new Date(a.published_at)) : 'Draft'}
                    {a.expires_at ? ` · expires ${formatDate(new Date(a.expires_at))}` : ''}
                    {' · '}{a.read_count} read{a.read_count === 1 ? '' : 's'}
</p>
</div>
<div className="flex flex-col items-end gap-1.5 shrink-0">
                  {!a.read_by_me && (
<button onClick={() => void markRead(a.id)} className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg">
                      Mark read
</button>
)}
                  {canManage && (
<>
<button onClick={() => void toggleReaders(a.id)} className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                        {expanded === a.id ? 'Hide readers' : 'Readers'}
</button>
<button onClick={() => void archive(a.id)} className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg">
                        Archive
</button>
</>
)}
</div>
</div>
              {expanded === a.id && (
<div className="mt-3 border-t border-slate-200 pt-2.5">
                  {(readers[a.id] || []).length === 0 ? (
<p className="text-[11px] text-slate-500">No reads yet.</p>
) : (
<ul className="space-y-1">
                      {(readers[a.id] || []).map((r) => (
<li key={r.user_id} className="text-[11px] text-slate-600 flex justify-between">
<span>{r.user?.full_name || r.user?.email || r.user_id.slice(0, 8)}</span>
<span className="font-mono tabular-nums text-slate-400">{formatDateTime(new Date(r.read_at))}</span>
</li>
))}
</ul>
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
