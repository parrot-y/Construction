import React, { useCallback, useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

interface PublicQuoteItem {
  id: string;
  section?: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_rate: string;
  total_amount: string;
}

interface PublicQuote {
  id: string;
  quote_no: number;
  title: string;
  client_name: string;
  site_location?: string | null;
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
  items?: PublicQuoteItem[];
}

interface PublicQuoteViewProps {
  token: string;
  onBack?: () => void;
}

export default function PublicQuoteView({ token, onBack}: PublicQuoteViewProps): React.JSX.Element {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [contractor, setContractor] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [typedName, setTypedName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${token}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'This quote link is invalid or has expired');
      setQuote(body.quote);
      setContractor(body.contractor?.name ?? '');
} catch (e: any) {
      setError(e.message);
} finally {
      setLoading(false);
}
}, [token]);

  useEffect(() => {
    load();
}, [load]);

  const respond = async () => {
    if (!action) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ action, typedName: typedName || undefined, note: note || undefined}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Submission failed');
      setDone(action === 'accept' ? 'accepted' : 'declined');
      setQuote(body.quote);
} catch (e: any) {
      setError(e.message);
} finally {
      setSubmitting(false);
}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">Loading quotation…</div>;
}

  if (error && !quote) {
    return (
<div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
<p className="text-sm font-semibold text-rose-700">{error}</p>
        {onBack &&<button onClick={onBack} className="text-xs text-blue-600 hover:underline">Back</button>}
</div>
);
}

  if (!quote) {
    return (
<div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
<p className="text-sm font-semibold text-rose-700">This quotation could not be loaded.</p>
        <button onClick={load} className="text-xs font-semibold text-blue-600 hover:underline">Retry</button>
        {onBack &&<button onClick={onBack} className="text-xs text-slate-500 hover:underline ml-3">Back</button>}
</div>
);
}

  const responded = quote.status !== 'SENT';

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto overflow-hidden">
<div className="bg-slate-900 text-white px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<p className="text-[10px] text-slate-400">Quotation</p>
<h1 className="text-lg font-bold">Q-{String(quote.quote_no).padStart(4, '0')} — {quote.title}</h1>
<p className="text-xs text-slate-400 mt-0.5">
            {contractor &&<>From {contractor} •</>}
            Prepared for {quote.client_name}
            {quote.site_location ? ` • ${quote.site_location}` : ''}
</p>
</div>
<span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${
          quote.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
          : quote.status === 'DECLINED' ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
          : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
}`}>
          {quote.status}
</span>
</div>

<div className="p-6 space-y-5">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-[10px] text-slate-400 border-b border-slate-200">
<th className="py-2 pr-3">Description</th>
<th className="py-2 pr-3">Unit</th>
<th className="py-2 pr-3 text-right">Qty</th>
<th className="py-2 pr-3 text-right">Rate</th>
<th className="py-2 text-right">Amount</th>
</tr>
</thead>
<tbody>
            {(quote.items ?? []).map((it) => (
<tr key={it.id} className="border-b border-slate-100">
<td className="py-2 pr-3 text-slate-700">
                  {it.section &&<span className="text-slate-400">[{it.section}]</span>}
                  {it.description}
</td>
<td className="py-2 pr-3 text-slate-500">{it.unit}</td>
<td className="py-2 pr-3 text-right font-mono">{it.quantity}</td>
<td className="py-2 pr-3 text-right font-mono">{it.unit_rate}</td>
<td className="py-2 text-right font-mono font-semibold">{quote.currency} {toCurrencyString(it.total_amount)}</td>
</tr>
))}
</tbody>
</table>

<div className="text-right space-y-1 text-xs ml-auto max-w-xs">
<p className="text-slate-600">Subtotal:<span className="font-mono">{quote.currency} {toCurrencyString(quote.subtotal)}</span></p>
<p className="text-slate-600">Tax ({quote.tax_pct}%):<span className="font-mono">{quote.currency} {toCurrencyString(quote.tax_amount)}</span></p>
<p className="text-base font-bold text-slate-900">Total:<span className="font-mono">{quote.currency} {toCurrencyString(quote.total)}</span></p>
<p className="text-emerald-700 font-semibold">Deposit required ({quote.deposit_pct}%):<span className="font-mono">{quote.currency} {toCurrencyString(quote.deposit_amount)}</span></p>
          {quote.valid_until && (
<p className="text-[11px] text-slate-400 pt-1">Valid until {new Date(quote.valid_until).toLocaleDateString()}</p>
)}
</div>

        {quote.terms && (
<div className="border-t border-slate-100 pt-4">
<p className="text-[11px] font-bold text-slate-400 mb-1">Terms & Conditions</p>
<p className="text-xs text-slate-600 whitespace-pre-wrap">{quote.terms}</p>
</div>
)}

        {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

        {responded ? (
<div className={`p-4 rounded-lg border text-center text-sm font-semibold ${
            quote.status === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : quote.status === 'DECLINED' ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-slate-50 border-slate-200 text-slate-700'
}`}>
            {quote.status === 'ACCEPTED' &&<> Quote accepted{quote.responded_by ? ` by ${quote.responded_by}` : ''}. Thank you — the contractor will be in touch to commence works.</>}
            {quote.status === 'DECLINED' &&<>Quote declined{quote.responded_by ? ` by ${quote.responded_by}` : ''}.</>}
            {(quote.status === 'CONVERTED' || quote.status === 'EXPIRED') &&<>This quote is {quote.status.toLowerCase()}.</>}
</div>
) : done ? (
<div className="p-4 rounded-lg border text-center text-sm font-semibold bg-emerald-50 border-emerald-200 text-emerald-800">
            {done === 'accepted' ? ' Quote accepted. Thank you!' : 'Quote declined.'}
</div>
) : (
<div className="border-t border-slate-100 pt-4 space-y-3">
<p className="text-xs font-semibold text-slate-700">Your response</p>
            {!action ? (
<div className="flex gap-2">
<button onClick={() => setAction('accept')}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">
                  Accept Quote
</button>
<button onClick={() => setAction('decline')}
                  className="px-5 py-2 text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg">
                  Decline
</button>
</div>
) : (
<div className="space-y-2">
<input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={action === 'accept' ? 'Type your full legal name to sign *' : 'Your name (optional)'}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                />
<textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Optional comment"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                />
<div className="flex gap-2">
<button onClick={respond} disabled={submitting || (action === 'accept' && typedName.trim().length< 2)}
                    className={`px-5 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40 ${
                      action === 'accept' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-600 hover:bg-rose-700'
}`}>
                    {submitting ? 'Submitting…' : action === 'accept' ? 'Confirm Acceptance' : 'Confirm Decline'}
</button>
<button onClick={() => setAction(null)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
                    Back
</button>
</div>
                {action === 'accept' && (
<p className="text-[10px] text-slate-400">Your typed name is recorded as your electronic signature on this quotation.</p>
)}
</div>
)}
</div>
)}

        {onBack && (
<div className="border-t border-slate-100 pt-3">
<button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-800">← Back</button>
</div>
)}
</div>
</div>
);
}
