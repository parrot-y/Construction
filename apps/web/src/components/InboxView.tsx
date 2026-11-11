import React, { useCallback, useEffect, useState} from 'react';

interface InboxMessage {
  id: string;
  project_id: string | null;
  sender_id: string;
  sender_name: string;
  body: string;
  audience: string;
  parent_id: string | null;
  created_at: string;
  read_count: number;
  read_by_me: boolean;
}

interface ProjectOpt { id: string; name: string; code: string}

const AUDIENCE_LABEL: Record<string, string> = {
  PROJECT_TEAM: 'Project team',
  ALL_MEMBERS: 'All members',
  ROLE: 'Specific roles',
};

export default function InboxView({ currentUserId}: { currentUserId?: string}): React.JSX.Element {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<InboxMessage | null>(null);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('PROJECT_TEAM');
  const [projectId, setProjectId] = useState('');
  const [targetRoles, setTargetRoles] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`/api/v1/inbox${unreadOnly ? '?unread=true' : ''}`, { credentials: 'include'}),
        fetch('/api/v1/projects', { credentials: 'include'}).catch(() => null),
      ]);
      if (!mRes.ok) throw new Error('Failed to load inbox');
      const mJson = await mRes.json();
      setMessages(mJson.data || []);
      if (pRes?.ok) {
        const pJson = await pRes.json();
        setProjects((pJson.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code})));
}
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [unreadOnly]);

  useEffect(() => { void load();}, [load]);

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/v1/inbox/${id}/read`, { method: 'POST', credentials: 'include'});
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_by_me: true} : m)));
} catch { /* best effort */}
};

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/inbox', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          body: body.trim(),
          projectId: projectId || null,
          audience,
          targetRoles: audience === 'ROLE' ? targetRoles.split(',').map((r) => r.trim()).filter(Boolean) : undefined,
          parentId: replyTo?.id ?? null,
}),
});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Send failed (${res.status})`);
      setBody('');
      setReplyTo(null);
      setShowCompose(false);
      await load();
} catch (err: any) {
      setError(err?.message || 'Send failed');
} finally {
      setSending(false);
}
};

  const byId = new Map(messages.map((m) => [m.id, m]));
  const roots = messages.filter((m) => !m.parent_id || !byId.has(m.parent_id));
  const repliesOf = (id: string) => messages.filter((m) => m.parent_id === id);

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading inbox…</div>;
}

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex items-center justify-between flex-wrap gap-2">
<div>
<h3 className="text-base font-bold text-slate-900">Team Inbox</h3>
<p className="text-xs text-slate-500">Messages to your project teams — replies keep threads together</p>
</div>
<div className="flex items-center gap-2">
<button
            onClick={() => setUnreadOnly((v) => !v)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg ${unreadOnly ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Unread only
</button>
<button
            onClick={() => { setReplyTo(null); setShowCompose((v) => !v);}}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            {showCompose ? 'Cancel' : '+ Message'}
</button>
</div>
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {(showCompose || replyTo) && (
<div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-2.5">
          {replyTo && (
<div className="text-[11px] text-slate-500 bg-white/70 rounded-lg px-3 py-2">
              Replying to<span className="font-semibold">{replyTo.sender_name}</span>: “{replyTo.body.slice(0, 80)}{replyTo.body.length > 80 ? '…' : ''}”
</div>
)}
<textarea
            rows={3}
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs resize-none"
          />
          {!replyTo && (
<div className="grid grid-cols-3 gap-2">
<select value={audience} onChange={(e) => setAudience(e.target.value)} className={input}>
                {Object.entries(AUDIENCE_LABEL).map(([v, l]) =><option key={v} value={v}>{l}</option>)}
</select>
<select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input}>
<option value="">No project (tenant-wide)</option>
                {projects.map((p) =><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
</select>
              {audience === 'ROLE' && (
<input type="text" placeholder="Roles (comma-sep)" value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} className={input} />
)}
</div>
)}
<div className="flex justify-end gap-2">
            {replyTo &&<button onClick={() => setReplyTo(null)} className="px-3 py-1.5 text-[11px] font-semibold text-slate-500">Cancel reply</button>}
<button
              onClick={() => void send()}
              disabled={sending || !body.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {sending ? 'Sending…' : replyTo ? 'Send reply' : 'Send'}
</button>
</div>
</div>
)}

      {roots.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">No messages{unreadOnly ? ' unread' : ''}.</p>
) : (
<div className="space-y-3">
          {roots.map((m) => {
            const replies = repliesOf(m.id);
            const unread = !m.read_by_me && m.sender_id !== currentUserId;
            return (
<div key={m.id} className="space-y-1.5">
<MessageCard
                  m={m}
                  unread={unread}
                  onRead={() => void markRead(m.id)}
                  onReply={() => { setReplyTo(m); setShowCompose(true);}}
                />
                {replies.map((r) => (
<div key={r.id} className="ml-8">
<MessageCard
                      m={r}
                      unread={!r.read_by_me && r.sender_id !== currentUserId}
                      onRead={() => void markRead(r.id)}
                      onReply={() => { setReplyTo(r); setShowCompose(true);}}
                    />
</div>
))}
</div>
);
})}
</div>
)}
</div>
);
}

function MessageCard({ m, unread, onRead, onReply}: { m: InboxMessage; unread: boolean; onRead: () => void; onReply: () => void}): React.JSX.Element {
  return (
<div className={`border rounded-xl p-3.5 ${unread ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>
<div className="flex items-start justify-between gap-3">
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
            {unread &&<span className="w-2 h-2 rounded-full bg-indigo-500" title="Unread" />}
<span className="text-xs font-bold text-slate-800">{m.sender_name}</span>
<span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded-full">{AUDIENCE_LABEL[m.audience] || m.audience}</span>
<span className="text-[10px] text-slate-400 tabular-nums">{new Date(m.created_at).toLocaleString()}</span>
</div>
<p className="text-xs text-slate-700 mt-1.5 whitespace-pre-wrap">{m.body}</p>
<p className="text-[10px] text-slate-400 mt-1">{m.read_count} read{m.read_count === 1 ? '' : 's'}</p>
</div>
<div className="flex flex-col gap-1 shrink-0">
          {unread && (
<button onClick={onRead} className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg">Mark read</button>
)}
<button onClick={onReply} className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Reply</button>
</div>
</div>
</div>
);
}
