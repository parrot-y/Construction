import React, { useCallback, useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

interface QuoteItem {
  id?: string;
  section?: string | null;
  description: string;
  unit: string;
  quantity: string | number;
  unit_rate: string | number;
  total_amount?: string | number;
}

interface QuoteEvent {
  id: string;
  actor_type: string;
  actor_name?: string | null;
  event: string;
  note?: string | null;
  created_at: string;
}

interface Quote {
  id: string;
  quote_no: number;
  title: string;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  site_location?: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CONVERTED';
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
  converted_project_id?: string | null;
  created_at: string;
  items?: QuoteItem[];
  events?: QuoteEvent[];
  project?: { id: string; name: string; code: string} | null;
}

interface DraftItem {
  section: string;
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
}

const QUOTE_LINE_TEMPLATES: Record<string, { section: string; description: string; unit: string; quantity: string; unitRate: string}[]> = {
  'Kitchen remodel': [
    { section: 'Demolition', description: 'Strip-out existing kitchen units, tiles & services', unit: 'lot', quantity: '1', unitRate: ''},
    { section: 'Carpentry', description: 'Supply & install base & wall units (melamine)', unit: 'lm', quantity: '', unitRate: ''},
    { section: 'Plumbing', description: 'Relocate water & waste points', unit: 'point', quantity: '', unitRate: ''},
    { section: 'Electrical', description: 'New power & lighting points', unit: 'point', quantity: '', unitRate: ''},
    { section: 'Finishes', description: 'Wall tiling, flooring & silicone', unit: 'm²', quantity: '', unitRate: ''},
  ],
  'Bathroom remodel': [
    { section: 'Demolition', description: 'Strip-out existing bathroom', unit: 'lot', quantity: '1', unitRate: ''},
    { section: 'Plumbing', description: 'New WC, basin & shower rough-in', unit: 'lot', quantity: '1', unitRate: ''},
    { section: 'Waterproofing', description: 'Tanking & flood test', unit: 'm²', quantity: '', unitRate: ''},
    { section: 'Finishes', description: 'Wall & floor tiling', unit: 'm²', quantity: '', unitRate: ''},
  ],
  'Tiling works': [
    { section: 'Finishes', description: 'Floor tiles supply & install', unit: 'm²', quantity: '', unitRate: ''},
    { section: 'Finishes', description: 'Wall tiles supply & install', unit: 'm²', quantity: '', unitRate: ''},
  ],
  'Painting & decor': [
    { section: 'Finishes', description: 'Wall preparation (filler, sand, primer)', unit: 'm²', quantity: '', unitRate: ''},
    { section: 'Finishes', description: 'Two-coat emulsion paint', unit: 'm²', quantity: '', unitRate: ''},
    { section: 'Finishes', description: 'Ceiling paint', unit: 'm²', quantity: '', unitRate: ''},
  ],
  'Electrical works': [
    { section: 'Electrical', description: 'DB & breaker upgrade', unit: 'lot', quantity: '1', unitRate: ''},
    { section: 'Electrical', description: 'New power points & switches', unit: 'point', quantity: '', unitRate: ''},
    { section: 'Electrical', description: 'LED downlights & fittings', unit: 'point', quantity: '', unitRate: ''},
  ],
};

const UNITS = ['item', 'sum', 'm', 'm2', 'm3', 'no', 'kg', 'day', 'hr', 'lot'];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SENT: 'bg-blue-50 text-blue-800 border-blue-300',
  ACCEPTED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  DECLINED: 'bg-rose-50 text-rose-800 border-rose-300',
  EXPIRED: 'bg-amber-50 text-amber-800 border-amber-300',
  CONVERTED: 'bg-purple-50 text-purple-800 border-purple-300',
};

export default function QuotesManagementView(): React.JSX.Element {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Quote | null>(null);
  const [shareInfo, setShareInfo] = useState<{ quoteId: string; url: string; token: string} | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    siteLocation: '',
    currency: 'KES',
    taxPct: '16',
    depositPct: '50',
    validDays: '30',
    terms: '',
});
  const [items, setItems] = useState<DraftItem[]>([
    { section: '', description: '', unit: 'item', quantity: '1', unitRate: ''},
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/quotes', { credentials: 'include'});
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

  const openDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
}
    setExpandedId(id);
    setDetail(null);
    try {
      const res = await fetch(`/api/v1/quotes/${id}`, { credentials: 'include'});
      if (res.ok) setDetail((await res.json()).quote);
} catch {
      // detail is best-effort
}
};

  const addItem = () =>
    setItems((prev) => [...prev, { section: '', description: '', unit: 'item', quantity: '1', unitRate: ''}]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const setItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch} : it)));

  const itemSubtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitRate) || 0), 0);
  const taxPctNum = parseFloat(form.taxPct) || 0;
  const depositPctNum = parseFloat(form.depositPct) || 0;
  const taxAmt = itemSubtotal * (taxPctNum / 100);
  const total = itemSubtotal + taxAmt;
  const depositAmt = total * (depositPctNum / 100);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId('create');
    setError(null);
    try {
      const res = await fetch('/api/v1/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          ...form,
          taxPct: taxPctNum,
          depositPct: depositPctNum,
          validDays: parseInt(form.validDays, 10) || null,
          items: items
            .filter((it) => it.description.trim())
            .map((it) => ({
              section: it.section || undefined,
              description: it.description,
              unit: it.unit,
              quantity: parseFloat(it.quantity) || 0,
              unitRate: parseFloat(it.unitRate) || 0,
})),
}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to create quote');
      setShowForm(false);
      setNotice(`Quote Q-${String(body.quote.quote_no).padStart(4, '0')} created as draft`);
      setForm({ title: '', clientName: '', clientEmail: '', clientPhone: '', siteLocation: '', currency: 'KES', taxPct: '16', depositPct: '50', validDays: '30', terms: ''});
      setItems([{ section: '', description: '', unit: 'item', quantity: '1', unitRate: ''}]);
      load();
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const handleSend = async (q: Quote) => {
    setBusyId(q.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${q.id}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ channel: 'link'}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to send quote');
      const absolute = `${window.location.origin}/?portal=quote&token=${body.shareToken}`;
      setShareInfo({ quoteId: q.id, url: absolute, token: body.shareToken});
      setNotice(`Quote Q-${String(q.quote_no).padStart(4, '0')} sent — share link ready (shown once)`);
      load();
      openDetail(q.id);
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const handleConvert = async (q: Quote) => {
    setBusyId(q.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${q.id}/convert`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ createDepositInvoice: true}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to convert quote');
      setNotice(
        body.depositInvoice
          ? `Quote converted to project ${body.project.code} — deposit invoice INV-${String(body.depositInvoice.invoice_no).padStart(5, '0')} drafted`
          : `Quote converted to project ${body.project.code} (${body.project.name})`,
);
      load();
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const copyShare = async () => {
    if (!shareInfo) return;
    try {
      await navigator.clipboard.writeText(shareInfo.url);
      setNotice('Share link copied to clipboard');
} catch {
      setNotice(shareInfo.url);
}
};

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div>
<span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            Quotes-to-Cash
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Quotations & Proposals</h3>
<p className="text-xs text-slate-500">
            Create quotes, share secure client links, track acceptance, and convert won quotes into projects.
</p>
</div>
<button
          onClick={() => setShowForm((v) => !v)}
          className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
        >
          {showForm ? 'Close Form' : '+ New Quote'}
</button>
</div>

      {error && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>
)}
      {notice && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {notice}</span>
<button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
</div>
)}

      {shareInfo && (
<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-2">
<p className="font-semibold text-blue-900">Share link (shown once — copy now):</p>
<div className="flex flex-col sm:flex-row gap-2">
<code className="flex-1 bg-white border border-blue-200 rounded px-2 py-1.5 text-[11px] font-mono tabular-nums break-all">{shareInfo.url}</code>
<button onClick={copyShare} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shrink-0">
              Copy link
</button>
</div>
<button onClick={() => setShareInfo(null)} className="text-blue-600 hover:text-blue-900 font-semibold">Dismiss</button>
</div>
)}

      {showForm && (
<form onSubmit={handleCreate} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div className="sm:col-span-3">
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Quote Title *</label>
<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value})}
                placeholder="e.g. Boundary wall construction — Phase 1"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Client Name *</label>
<input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Client Email</label>
<input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Client Phone</label>
<input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Site Location</label>
<input value={form.siteLocation} onChange={(e) => setForm({ ...form, siteLocation: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Currency</label>
<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg">
<option>KES</option><option>USD</option><option>EUR</option><option>GBP</option>
</select>
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax % (VAT)</label>
<input type="number" step="0.01" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Deposit %</label>
<input type="number" step="0.01" value={form.depositPct} onChange={(e) => setForm({ ...form, depositPct: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Valid (days)</label>
<input type="number" value={form.validDays} onChange={(e) => setForm({ ...form, validDays: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div className="sm:col-span-3">
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Terms & Conditions</label>
<textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value})} rows={2}
                placeholder="e.g. 50% deposit to mobilize; 30-day payment terms; prices exclude transport unless stated"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
</div>

<div className="space-y-2">
<div className="flex justify-between items-center">
<span className="text-[11px] font-bold text-slate-700 ">Line Items</span>
<div className="flex items-center gap-2">
<select onChange={(e) => {
                  const t = QUOTE_LINE_TEMPLATES[e.target.value];
                  if (t) { setItems((prev) => [...prev.filter((i) => i.description.trim()), ...t]);}
                  e.target.value = '';
}} className="text-[11px] p-1 border border-slate-300 rounded bg-white" defaultValue="">
<option value="">+ Add lines from a template…</option>
                  {Object.keys(QUOTE_LINE_TEMPLATES).map((k) =><option key={k} value={k}>{k}</option>)}
</select>
<button type="button" onClick={addItem} className="text-[11px] font-semibold text-blue-700 hover:text-blue-900">+ Add item</button>
</div>
</div>
            {items.map((it, idx) => (
<div key={idx} className="grid grid-cols-12 gap-2 items-center">
<input value={it.section} onChange={(e) => setItem(idx, { section: e.target.value})} placeholder="Section"
                  className="col-span-2 text-[11px] p-1.5 border border-slate-300 rounded" />
<input required value={it.description} onChange={(e) => setItem(idx, { description: e.target.value})} placeholder="Description *"
                  className="col-span-4 text-[11px] p-1.5 border border-slate-300 rounded" />
<select value={it.unit} onChange={(e) => setItem(idx, { unit: e.target.value})}
                  className="col-span-1 text-[11px] p-1.5 border border-slate-300 rounded">
                  {UNITS.map((u) =><option key={u} value={u}>{u}</option>)}
</select>
<input type="number" step="0.0001" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value})} placeholder="Qty"
                  className="col-span-2 text-[11px] p-1.5 border border-slate-300 rounded" />
<input type="number" step="0.01" value={it.unitRate} onChange={(e) => setItem(idx, { unitRate: e.target.value})} placeholder="Rate"
                  className="col-span-2 text-[11px] p-1.5 border border-slate-300 rounded" />
<button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1}
                  className="col-span-1 text-[11px] text-rose-600 hover:text-rose-800 font-bold disabled:opacity-30"></button>
</div>
))}
</div>

<div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
<span className="text-slate-600">
              Subtotal:<strong>{form.currency} {toCurrencyString(itemSubtotal)}</strong>
              {' • '}Tax ({taxPctNum}%):<strong>{toCurrencyString(taxAmt)}</strong>
              {' • '}Total:<strong>{form.currency} {toCurrencyString(total)}</strong>
              {' • '}Deposit ({depositPctNum}%):<strong>{toCurrencyString(depositAmt)}</strong>
</span>
<button type="submit" disabled={busyId === 'create'}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg disabled:opacity-50">
              {busyId === 'create' ? 'Saving…' : 'Save Draft Quote'}
</button>
</div>
</form>
)}

      {loading ? (
<p className="text-xs text-slate-400 text-center py-6">Loading quotes…</p>
) : quotes.length === 0 ? (
<p className="text-xs text-slate-400 text-center py-6">No quotes yet. Create your first quotation to start the quotes-to-cash flow.</p>
) : (
<div className="overflow-x-auto">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-[10px] text-slate-400 border-b border-slate-200">
<th className="py-2 pr-3">Quote</th>
<th className="py-2 pr-3">Client</th>
<th className="py-2 pr-3">Total</th>
<th className="py-2 pr-3">Deposit</th>
<th className="py-2 pr-3">Status</th>
<th className="py-2 pr-3">Valid Until</th>
<th className="py-2">Actions</th>
</tr>
</thead>
<tbody>
              {quotes.map((q) => (
<React.Fragment key={q.id}>
<tr className="border-b border-slate-100 hover:bg-slate-50">
<td className="py-2.5 pr-3">
<button onClick={() => openDetail(q.id)} className="font-bold text-blue-700 hover:text-blue-900">
                        Q-{String(q.quote_no).padStart(4, '0')}
</button>
<span className="block text-[11px] text-slate-500 truncate max-w-[220px]">{q.title}</span>
</td>
<td className="py-2.5 pr-3">
<span className="font-medium text-slate-800">{q.client_name}</span>
                      {q.client_email &&<span className="block text-[10px] text-slate-400">{q.client_email}</span>}
</td>
<td className="py-2.5 pr-3 tabular-nums font-semibold text-slate-800">{q.currency} {toCurrencyString(q.total)}</td>
<td className="py-2.5 pr-3 tabular-nums text-slate-600">{q.currency} {toCurrencyString(q.deposit_amount)}</td>
<td className="py-2.5 pr-3">
<span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[q.status] ?? STATUS_STYLES.DRAFT}`}>
                        {q.status}
</span>
                      {q.responded_by &&<span className="block text-[10px] text-slate-400 mt-0.5">by {q.responded_by}</span>}
</td>
<td className="py-2.5 pr-3 text-slate-500">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</td>
<td className="py-2.5 space-x-1.5 whitespace-nowrap">
                      {(q.status === 'DRAFT' || q.status === 'SENT') && (
<button onClick={() => handleSend(q)} disabled={busyId === q.id}
                          className="px-2 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
                          {q.status === 'DRAFT' ? 'Send' : 'Resend'}
</button>
)}
                      {q.status === 'ACCEPTED' && !q.converted_project_id && (
<button onClick={() => handleConvert(q)} disabled={busyId === q.id}
                          className="px-2 py-1 text-[10px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded disabled:opacity-50">
                          Start project
</button>
)}
                      {q.status === 'CONVERTED' && q.project && (
<span className="text-[10px] font-semibold text-purple-700">→ {q.project.code}</span>
)}
</td>
</tr>
                  {expandedId === q.id && (
<tr className="bg-slate-50">
<td colSpan={7} className="p-4">
                        {!detail ? (
<p className="text-[11px] text-slate-400">Loading detail…</p>
) : (
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
<div className="lg:col-span-2 space-y-2">
<p className="font-semibold text-slate-800">{detail.title}</p>
                              {detail.site_location &&<p className="text-slate-500"> {detail.site_location}</p>}
                              {detail.terms &&<p className="text-slate-600 whitespace-pre-wrap">{detail.terms}</p>}
<table className="w-full text-[11px] mt-2">
<thead>
<tr className="text-left text-slate-400 border-b border-slate-200">
<th className="py-1 pr-2">Item</th>
<th className="py-1 pr-2">Unit</th>
<th className="py-1 pr-2 text-right">Qty</th>
<th className="py-1 pr-2 text-right">Rate</th>
<th className="py-1 text-right">Amount</th>
</tr>
</thead>
<tbody>
                                  {(detail.items ?? []).map((it) => (
<tr key={it.id} className="border-b border-slate-100">
<td className="py-1 pr-2 text-slate-700">
                                        {it.section &&<span className="text-slate-400">[{it.section}]</span>}
                                        {it.description}
</td>
<td className="py-1 pr-2 text-slate-500">{it.unit}</td>
<td className="py-1 pr-2 text-right tabular-nums">{it.quantity}</td>
<td className="py-1 pr-2 text-right tabular-nums">{it.unit_rate}</td>
<td className="py-1 text-right tabular-nums font-semibold">{toCurrencyString(it.total_amount ?? '0')}</td>
</tr>
))}
</tbody>
</table>
<div className="text-right space-y-0.5 pt-1">
<p className="text-slate-600">Subtotal:<span className="tabular-nums">{detail.currency} {toCurrencyString(detail.subtotal)}</span></p>
<p className="text-slate-600">Tax ({detail.tax_pct}%):<span className="tabular-nums">{detail.currency} {toCurrencyString(detail.tax_amount)}</span></p>
<p className="font-bold text-slate-900">Total:<span className="tabular-nums">{detail.currency} {toCurrencyString(detail.total)}</span></p>
<p className="text-emerald-700 font-semibold">Deposit due ({detail.deposit_pct}%):<span className="tabular-nums">{detail.currency} {toCurrencyString(detail.deposit_amount)}</span></p>
</div>
</div>
<div>
<p className="font-semibold text-slate-800 mb-2">Activity</p>
<ul className="space-y-1.5">
                                {(detail.events ?? []).map((ev) => (
<li key={ev.id} className="text-[11px] text-slate-600 border-l-2 border-slate-200 pl-2">
<span className="font-bold text-slate-800">{ev.event}</span>
                                    {ev.actor_name ? ` — ${ev.actor_name}` : ''}
<span className="block text-[10px] text-slate-400">
                                      {ev.actor_type} • {new Date(ev.created_at).toLocaleString()}
                                      {ev.note ? ` • ${ev.note}` : ''}
</span>
</li>
))}
</ul>
</div>
</div>
)}
</td>
</tr>
)}
</React.Fragment>
))}
</tbody>
</table>
</div>
)}
</div>
);
}
