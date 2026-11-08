import React, { useCallback, useEffect, useState } from 'react';
import { toCurrencyString } from '@construction/money';

interface CoItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  total_amount: string;
}

interface CoEvent {
  id: string;
  actor_name: string;
  event: string;
  note?: string | null;
  created_at: string;
}

interface ChangeOrder {
  id: string;
  variation_no: number;
  title: string;
  reason: string;
  status: string;
  net_amount: string;
  time_extension_days: number;
  created_at: string;
  items?: CoItem[];
  events?: CoEvent[];
}

interface PortalPayload {
  stakeholder: { name: string; role: string };
  project: { id: string; name: string; code: string; status: string } | null;
  changeOrders: ChangeOrder[];
}

interface ClientPortalViewProps {
  token: string;
  onBackToDashboard?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PM_REVIEW: 'bg-amber-50 text-amber-700',
  OWNER_REVIEW: 'bg-orange-50 text-orange-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  VOID: 'bg-slate-100 text-slate-400',
};

export default function ClientPortalView({ token, onBackToDashboard }: ClientPortalViewProps): React.JSX.Element {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/portals/client/${encodeURIComponent(token)}/change-orders`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Invalid or expired access link');
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load change orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (co: ChangeOrder, action: 'APPROVE' | 'REJECT') => {
    setFeedback(null);
    const signedName = window.prompt('Type your full name to sign this decision:', data?.stakeholder.name || '');
    if (!signedName || signedName.trim().length < 2) return;

    const comments =
      action === 'REJECT'
        ? window.prompt('Reason for rejection (required):', '')
        : window.prompt('Approval comments (optional):', '');
    if (action === 'REJECT' && (!comments || comments.trim().length < 3)) {
      setFeedback('A rejection reason is required.');
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/portals/client/${encodeURIComponent(token)}/change-orders/${co.id}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, signedName: signedName.trim(), comments: comments || undefined }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || `Request failed (${res.status})`);
      }
      setFeedback(`CO-${String(co.variation_no).padStart(4, '0')} ${action === 'APPROVE' ? 'approved' : 'rejected'} — thank you.`);
      await load();
    } catch (err: any) {
      setFeedback(err?.message || 'Failed to submit decision');
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">Loading your project portal…</div>;
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-600">{error || 'Portal unavailable'}</p>
        <p className="text-xs text-slate-500">This link may have expired. Ask your contractor for a new one.</p>
        {onBackToDashboard && (
          <button onClick={onBackToDashboard} className="text-xs text-purple-600 hover:underline">Back</button>
        )}
      </div>
    );
  }

  const pending = data.changeOrders.filter((c) => c.status === 'OWNER_REVIEW');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Client Portal</p>
          <h2 className="text-lg font-bold text-slate-900">{data.project?.name || 'Project'}</h2>
          <p className="text-xs text-slate-500">
            {data.stakeholder.name} · {data.stakeholder.role}
            {data.project?.code ? ` · ${data.project.code}` : ''}
          </p>
        </div>
        {onBackToDashboard && (
          <button onClick={onBackToDashboard} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
        )}
      </div>

      {feedback && (
        <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 text-xs font-medium rounded-lg">{feedback}</div>
      )}

      {pending.length > 0 && (
        <div className="p-3 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-semibold rounded-lg">
          {pending.length} change order{pending.length > 1 ? 's' : ''} awaiting your approval
        </div>
      )}

      <div className="space-y-3">
        {data.changeOrders.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No change orders on this project yet.</p>
        )}
        {data.changeOrders.map((co) => {
          const isNegative = co.net_amount.trim().startsWith('-');
          const absAmount = isNegative ? co.net_amount.trim().slice(1) : co.net_amount.trim();
          return (
            <div key={co.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">
                    CO-{String(co.variation_no).padStart(4, '0')}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{co.title}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_STYLES[co.status] || STATUS_STYLES.DRAFT}`}>
                    {co.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className={`text-sm font-mono font-bold ${isNegative ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {isNegative ? '-' : '+'}KES {toCurrencyString(absAmount)}
                </span>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">{co.reason}</p>

              {co.items && co.items.length > 0 && (
                <ul className="text-[11px] text-slate-600 space-y-0.5 pl-2">
                  {co.items.map((it) => (
                    <li key={it.id}>
                      • {it.description} — {it.quantity} {it.unit} ({it.total_amount})
                    </li>
                  ))}
                </ul>
              )}

              {co.time_extension_days > 0 && (
                <p className="text-[11px] text-slate-500">Schedule impact: +{co.time_extension_days} days</p>
              )}

              {co.status === 'OWNER_REVIEW' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void respond(co, 'APPROVE')}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void respond(co, 'REJECT')}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
