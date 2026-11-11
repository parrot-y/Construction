import React, { useCallback, useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

interface ClientQuoteItem {
  id: string;
  section?: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_rate: string;
  total_amount: string;
}

interface ClientQuote {
  id: string;
  quote_no: number;
  title: string;
  status: string;
  currency: string;
  subtotal: string;
  tax_pct: string;
  tax_amount: string;
  total: string;
  deposit_pct: string;
  deposit_amount: string;
  terms?: string | null;
  valid_until?: string | null;
  responded_by?: string | null;
  responded_at?: string | null;
  created_at: string;
  items?: ClientQuoteItem[];
  project?: { id: string; name: string; code: string} | null;
}

const STATUS_STYLES: Record<string, string> = {
  SENT: 'bg-blue-50 text-blue-800 border-blue-300',
  ACCEPTED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  DECLINED: 'bg-rose-50 text-rose-800 border-rose-300',
  EXPIRED: 'bg-amber-50 text-amber-800 border-amber-300',
  CONVERTED: 'bg-purple-50 text-purple-800 border-purple-300',
};

export default function ClientQuotesView(): React.JSX.Element {
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/client/quotes', { credentials: 'include'});
      if (!res.ok) throw new Error(`Failed to load quotes (${res.status})`);
      const body = await res.json();
      setQuotes(body.quotes ?? []);
} catch (e: any) {
      setError(e.message);
} finally {
      setLoading(false);
}
}, []);

  useEffect(() => {
    load();
}, [load]);

  const respond = async (q: ClientQuote, action: 'accept' | 'decline') => {
    setRespondingId(q.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/client/quotes/${q.id}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ action, typedName: typedName || undefined, note: note || undefined}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Response failed');
      setNotice(action === 'accept' ? `Quote Q-${String(q.quote_no).padStart(4, '0')} accepted — the contractor has been notified` : `Quote Q-${String(q.quote_no).padStart(4, '0')} declined`);
      setRespondingId(null);
      setTypedName('');
      setNote('');
      load();
} catch (e: any) {
      setError(e.message);
      setRespondingId(null);
}
};

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          Quotes & Proposals
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Quotes addressed to you</h3>
<p className="text-xs text-slate-500">
          Review quotations from your contractor. Type your full name to accept — this acts as your electronic signature.
</p>
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}
      {notice && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {notice}</span>
<button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
</div>
)}

      {loading ? (
<p className="text-xs text-slate-400 text-center py-6">Loading your quotes…</p>
) : quotes.length === 0 ? (
<p className="text-xs text-slate-400 text-center py-6">No quotes yet. When your contractor sends you a quotation it will appear here.</p>
) : (
<div className="space-y-4">
          {quotes.map((q) => (
<div key={q.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<p className="font-bold text-slate-900">
                    Q-{String(q.quote_no).padStart(4, '0')} — {q.title}
</p>
<p className="text-[11px] text-slate-500">
                    Issued {new Date(q.created_at).toLocaleDateString()}
                    {q.valid_until ? ` • Valid until ${new Date(q.valid_until).toLocaleDateString()}` : ''}
                    {q.responded_by ? ` • Responded by ${q.responded_by}` : ''}
</p>
</div>
<span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[q.status] ?? 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                  {q.status}
</span>
</div>

<table className="w-full text-[11px]">
<tbody>
                  {(q.items ?? []).map((it) => (
<tr key={it.id} className="border-b border-slate-100">
<td className="py-1.5 pr-2 text-slate-700">
                        {it.section &&<span className="text-slate-400">[{it.section}]</span>}
                        {it.description}
</td>
<td className="py-1.5 pr-2 text-slate-500 text-right">{it.quantity} {it.unit}</td>
<td className="py-1.5 text-right tabular-nums font-semibold text-slate-800">
                        {q.currency} {toCurrencyString(it.total_amount)}
</td>
</tr>
))}
</tbody>
</table>

<div className="text-right space-y-0.5 text-xs">
<p className="text-slate-600">Subtotal:<span className="tabular-nums">{q.currency} {toCurrencyString(q.subtotal)}</span></p>
<p className="text-slate-600">Tax ({q.tax_pct}%):<span className="tabular-nums">{q.currency} {toCurrencyString(q.tax_amount)}</span></p>
<p className="font-bold text-slate-900">Total:<span className="tabular-nums">{q.currency} {toCurrencyString(q.total)}</span></p>
<p className="text-emerald-700 font-semibold">Deposit required ({q.deposit_pct}%):<span className="tabular-nums">{q.currency} {toCurrencyString(q.deposit_amount)}</span></p>
</div>

              {q.terms &&<p className="text-[11px] text-slate-500 whitespace-pre-wrap border-t border-slate-100 pt-2">{q.terms}</p>}

              {q.status === 'SENT' && (
<div className="border-t border-slate-100 pt-3 space-y-2">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
<input
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Type your full legal name to sign *"
                      className="text-xs p-2 border border-slate-300 rounded-lg"
                    />
<input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note / comment"
                      className="text-xs p-2 border border-slate-300 rounded-lg"
                    />
</div>
<div className="flex gap-2">
<button
                      onClick={() => respond(q, 'accept')}
                      disabled={respondingId === q.id || typedName.trim().length< 2}
                      className="px-4 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg disabled:opacity-40"
                    >
                      {respondingId === q.id ? 'Submitting…' : 'Accept Quote'}
</button>
<button
                      onClick={() => respond(q, 'decline')}
                      disabled={respondingId === q.id}
                      className="px-4 py-1.5 text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg disabled:opacity-40"
                    >
                      Decline
</button>
</div>
<p className="text-[10px] text-slate-400">Accepting confirms you agree to the quoted scope, prices and terms. Your typed name is recorded as your signature.</p>
</div>
)}

              {q.status === 'ACCEPTED' && (
<p className="text-[11px] font-semibold text-emerald-700 border-t border-slate-100 pt-2">
                   Accepted{q.responded_at ? ` on ${new Date(q.responded_at).toLocaleDateString()}` : ''}
                  {q.responded_by ? ` by ${q.responded_by}` : ''}. The contractor will commence project setup.
</p>
)}
              {q.status === 'DECLINED' && (
<p className="text-[11px] font-semibold text-rose-700 border-t border-slate-100 pt-2">This quote was declined.</p>
)}
</div>
))}
</div>
)}
</div>
);
}
