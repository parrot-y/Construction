import React, { useCallback, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';

interface EntityComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
}

interface EntityCommentsProps {
  entityType: string;
  entityId: string;
  /** Optional label shown above the thread, e.g. "INV-00042". */
  title?: string;
}

/**
 * P5.6 — shared comment thread for site/commercial entities. `@mention`
 * tokens resolve server-side against tenant members and notify them via
 * the inbox (with the live SSE hint).
 */
export default function EntityComments({ entityType, entityId, title }: EntityCommentsProps): React.JSX.Element {
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: EntityComment[] }>(
        `/api/v1/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      );
      setComments(res.data || []);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load comments'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ data: { notifiedCount?: number } }>(
        `/api/v1/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { body: text },
      );
      setBody('');
      const n = res.data?.notifiedCount ?? 0;
      setNotice(n > 0 ? `Posted — ${n} teammate${n === 1 ? '' : 's'} notified.` : 'Posted.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not post the comment'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="entity-comments">
      {title && <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Comments — {title}</p>}

      {loading ? (
        <p className="text-[11px] text-slate-600">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-[11px] text-slate-600">No comments yet.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="border border-slate-200 rounded-lg p-2.5 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-800">{c.authorName}</span>
                <span className="text-[10px] text-slate-600 tabular-nums">{formatDateTime(new Date(c.createdAt))}</span>
              </div>
              <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Write a comment… type @name to mention a teammate"
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
          data-testid="entity-comment-input"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-600">@mention notifies that teammate in their Inbox.</p>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || !body.trim()}
            className="px-3 py-1.5 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg disabled:opacity-50 transition"
            data-testid="entity-comment-submit"
          >
            {sending ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p role="alert" className="text-[11px] font-semibold text-rose-700">{error}</p>}
        {notice && <p role="status" className="text-[11px] font-semibold text-emerald-700">{notice}</p>}
      </div>
    </div>
  );
}
