import React, { useCallback, useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

interface InvoiceItem {
  id?: string;
  section?: string | null;
  description: string;
  unit: string;
  quantity: string | number;
  unit_rate: string | number;
  total_amount?: string | number;
}

interface InvoicePayment {
  id: string;
  amount: string;
  method: string;
  reference?: string | null;
  paid_at: string;
  note?: string | null;
}

interface Invoice {
  id: string;
  invoice_no: number;
  title: string;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  bill_to?: string | null;
  po_number?: string | null;
  status: 'DRAFT' | 'SENT' | 'PART_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
  stored_status?: string;
  currency: string;
  subtotal: string;
  tax_pct: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  balance_due: string;
  amount_paid_num?: number;
  balance_due_num?: number;
  issue_date: string;
  due_date: string;
  terms?: string | null;
  notes?: string | null;
  paybill?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  created_at: string;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  project?: { id: string; name: string; code: string} | null;
  _count?: { payments: number};
}

interface ProjectOption {
  id: string;
  name: string;
  code: string;
}

interface DraftItem {
  section: string;
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
}

const UNITS = ['item', 'sum', 'm', 'm2', 'm3', 'no', 'kg', 'day', 'hr', 'lot'];
const PAYMENT_METHODS = ['M_PESA', 'BANK', 'CASH', 'CHEQUE', 'CARD', 'OTHER'];
const FILTERS = ['ALL', 'DRAFT', 'SENT', 'PART_PAID', 'PAID', 'OVERDUE', 'VOID'] as const;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SENT: 'bg-blue-50 text-blue-800 border-blue-300',
  PART_PAID: 'bg-amber-50 text-amber-800 border-amber-300',
  PAID: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  OVERDUE: 'bg-rose-50 text-rose-800 border-rose-300',
  VOID: 'bg-slate-100 text-slate-500 border-slate-300 line-through',
};

export default function InvoicingView(): React.JSX.Element {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    billTo: '',
    poNumber: '',
    projectId: '',
    currency: 'KES',
    taxPct: '16',
    issueDate: '',
    dueDays: '30',
    terms: '',
    notes: '',
    paybill: '',
});
  const [items, setItems] = useState<DraftItem[]>([
    { section: '', description: '', unit: 'item', quantity: '1', unitRate: ''},
  ]);
  const [payForm, setPayForm] = useState({ amount: '', method: 'M_PESA', reference: '', note: ''});
  const [showPayForm, setShowPayForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/v1/invoices${qs}`, { credentials: 'include'});
      if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
      const body = await res.json();
      setInvoices(body.invoices ?? []);
} catch (e: any) {
      setError(e.message);
} finally {
      setLoading(false);
}
}, [statusFilter]);

  useEffect(() => {
    load();
}, [load]);

  useEffect(() => {
    fetch('/api/v1/projects', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : { data: []}))
      .then((b) => setProjects((b.data ?? []).map((p: any) => ({ id: p.id, name: p.name, code: p.code}))))
      .catch(() => setProjects([]));
}, []);

  const openDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      setShowPayForm(false);
      return;
}
    setExpandedId(id);
    setDetail(null);
    setShowPayForm(false);
    try {
      const res = await fetch(`/api/v1/invoices/${id}`, { credentials: 'include'});
      if (res.ok) setDetail((await res.json()).invoice);
} catch {
      // detail is best-effort
}
};

  const refreshDetail = async (id: string) => {
    const res = await fetch(`/api/v1/invoices/${id}`, { credentials: 'include'});
    if (res.ok) setDetail((await res.json()).invoice);
};

  const addItem = () =>
    setItems((prev) => [...prev, { section: '', description: '', unit: 'item', quantity: '1', unitRate: ''}]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const setItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch} : it)));

  const itemSubtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitRate) || 0), 0);
  const taxPctNum = parseFloat(form.taxPct) || 0;
  const taxAmt = itemSubtotal * (taxPctNum / 100);
  const total = itemSubtotal + taxAmt;

  const resetForm = () => {
    setForm({ title: '', clientName: '', clientEmail: '', clientPhone: '', billTo: '', poNumber: '', projectId: '', currency: 'KES', taxPct: '16', issueDate: '', dueDays: '30', terms: '', notes: '', paybill: ''});
    setItems([{ section: '', description: '', unit: 'item', quantity: '1', unitRate: ''}]);
};

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId('create');
    setError(null);
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: form.title,
          clientName: form.clientName,
          clientEmail: form.clientEmail || null,
          clientPhone: form.clientPhone || null,
          billTo: form.billTo || null,
          poNumber: form.poNumber || null,
          projectId: form.projectId || null,
          currency: form.currency,
          taxPct: taxPctNum,
          issueDate: form.issueDate || undefined,
          dueDays: parseInt(form.dueDays, 10) || 30,
          terms: form.terms || null,
          notes: form.notes || null,
          paybill: form.paybill || null,
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
      if (!res.ok) throw new Error(body.message || 'Failed to create invoice');
      setShowForm(false);
      resetForm();
      setNotice(`Invoice INV-${String(body.invoice.invoice_no).padStart(5, '0')} created as draft`);
      load();
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const handleSend = async (inv: Invoice) => {
    setBusyId(inv.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/invoices/${inv.id}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to send invoice');
      setNotice(`Invoice INV-${String(inv.invoice_no).padStart(5, '0')} marked as sent`);
      load();
      if (expandedId === inv.id) refreshDetail(inv.id);
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const handleVoid = async (inv: Invoice) => {
    const reason = window.prompt('Reason for voiding this invoice?');
    if (!reason) return;
    setBusyId(inv.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/invoices/${inv.id}/void`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ reason}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to void invoice');
      setNotice(`Invoice INV-${String(inv.invoice_no).padStart(5, '0')} voided`);
      load();
      if (expandedId === inv.id) refreshDetail(inv.id);
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const handlePayment = async (inv: Invoice) => {
    setBusyId(inv.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/invoices/${inv.id}/payments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          amount: parseFloat(payForm.amount),
          method: payForm.method,
          reference: payForm.reference || null,
          note: payForm.note || null,
}),
});
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to record payment');
      setPayForm({ amount: '', method: 'M_PESA', reference: '', note: ''});
      setShowPayForm(false);
      setNotice(
        body.invoice.status === 'PAID'
          ? `Invoice INV-${String(inv.invoice_no).padStart(5, '0')} fully paid`
          : `Payment recorded — balance ${inv.currency} ${toCurrencyString(body.invoice.balance_due)}`,
);
      load();
      refreshDetail(inv.id);
} catch (err: any) {
      setError(err.message);
} finally {
      setBusyId(null);
}
};

  const downloadPdf = (id: string) => {
    window.open(`/api/v1/invoices/${id}/pdf`, '_blank');
};

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Accounts Receivable
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Invoicing & Payments</h3>
<p className="text-xs text-slate-500">
            Issue invoices, track balances, record M-Pesa/bank payments, and download PDF tax invoices.
</p>
</div>
<button
          onClick={() => setShowForm((v) => !v)}
          className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition"
        >
          {showForm ? 'Close Form' : '+ New Invoice'}
</button>
</div>

<div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
<button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition ${
              statusFilter === f
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
}`}
          >
            {f.replace('_', ' ')}
</button>
))}
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

      {showForm && (
<form onSubmit={handleCreate} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div className="sm:col-span-3">
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Title *</label>
<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value})}
                placeholder="e.g. Progress claim — Foundation works"
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
<div className="sm:col-span-2">
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Bill To (address block)</label>
<input value={form.billTo} onChange={(e) => setForm({ ...form, billTo: e.target.value})}
                placeholder="P.O. Box …, Nairobi"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">PO / Ref Number</label>
<input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Project</label>
<select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg">
<option value="">— General / no project —</option>
                {projects.map((p) => (
<option key={p.id} value={p.id}>{p.code} — {p.name}</option>
))}
</select>
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Currency</label>
<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg">
<option>KES</option><option>USD</option>
</select>
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">VAT %</label>
<input type="number" step="0.01" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Issue Date</label>
<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Due in (days)</label>
<select value={form.dueDays} onChange={(e) => setForm({ ...form, dueDays: e.target.value})}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg">
<option value="7">Net 7</option>
<option value="14">Net 14</option>
<option value="30">Net 30</option>
<option value="60">Net 60</option>
<option value="0">Due on receipt</option>
</select>
</div>
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">M-Pesa Paybill/Till</label>
<input value={form.paybill} onChange={(e) => setForm({ ...form, paybill: e.target.value})}
                placeholder="e.g. 5221234"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div className="sm:col-span-3">
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Terms</label>
<textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value})} rows={2}
                placeholder="e.g. Payment within terms via M-Pesa Paybill 5221234, account = invoice number. 1.5% monthly interest on overdue balances."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
<div className="sm:col-span-3">
<label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes (internal or client-facing)</label>
<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value})} rows={1}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg" />
</div>
</div>

<div className="space-y-2">
<div className="flex justify-between items-center">
<span className="text-[11px] font-bold text-slate-700 ">Line Items</span>
<button type="button" onClick={addItem} className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900">+ Add item</button>
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
              {' • '}VAT ({taxPctNum}%):<strong>{toCurrencyString(taxAmt)}</strong>
              {' • '}Total:<strong>{form.currency} {toCurrencyString(total)}</strong>
</span>
<button type="submit" disabled={busyId === 'create'}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg disabled:opacity-50">
              {busyId === 'create' ? 'Saving…' : 'Save Draft Invoice'}
</button>
</div>
</form>
)}

      {loading ? (
<p className="text-xs text-slate-400 text-center py-6">Loading invoices…</p>
) : invoices.length === 0 ? (
<p className="text-xs text-slate-400 text-center py-6">No invoices yet. Create your first invoice to start tracking accounts receivable.</p>
) : (
<div className="overflow-x-auto">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-[10px] text-slate-400 border-b border-slate-200">
<th className="py-2 pr-3">Invoice</th>
<th className="py-2 pr-3">Client</th>
<th className="py-2 pr-3">Total</th>
<th className="py-2 pr-3">Balance</th>
<th className="py-2 pr-3">Due</th>
<th className="py-2 pr-3">Status</th>
<th className="py-2">Actions</th>
</tr>
</thead>
<tbody>
              {invoices.map((inv) => (
<React.Fragment key={inv.id}>
<tr className="border-b border-slate-100 hover:bg-slate-50">
<td className="py-2.5 pr-3">
<button onClick={() => openDetail(inv.id)} className="font-bold text-emerald-700 hover:text-emerald-900">
                        INV-{String(inv.invoice_no).padStart(5, '0')}
</button>
<span className="block text-[11px] text-slate-500 truncate max-w-[220px]">{inv.title}</span>
</td>
<td className="py-2.5 pr-3">
<span className="font-medium text-slate-800">{inv.client_name}</span>
                      {inv.client_email &&<span className="block text-[10px] text-slate-400">{inv.client_email}</span>}
</td>
<td className="py-2.5 pr-3 tabular-nums font-semibold text-slate-800">{inv.currency} {toCurrencyString(inv.total)}</td>
<td className="py-2.5 pr-3 tabular-nums text-slate-600">{inv.currency} {toCurrencyString(inv.balance_due)}</td>
<td className="py-2.5 pr-3 text-slate-500">{fmtDate(inv.due_date)}</td>
<td className="py-2.5 pr-3">
<span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[inv.status] ?? STATUS_STYLES.DRAFT}`}>
                        {inv.status.replace('_', ' ')}
</span>
</td>
<td className="py-2.5 space-x-1.5 whitespace-nowrap">
                      {inv.status === 'DRAFT' && (
<button onClick={() => handleSend(inv)} disabled={busyId === inv.id}
                          className="px-2 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
                          Send
</button>
)}
                      {(inv.status === 'SENT' || inv.status === 'PART_PAID' || inv.status === 'OVERDUE') && (
<button onClick={async () => { await openDetail(inv.id); setShowPayForm(true); }}
                          className="px-2 py-1 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded">
                          Record payment
</button>
)}
<button onClick={() => downloadPdf(inv.id)}
                        className="px-2 py-1 text-[10px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded">
                        PDF
</button>
</td>
</tr>
                  {expandedId === inv.id && (
<tr className="border-b border-slate-100 bg-slate-50">
<td colSpan={7} className="py-3 px-2">
                        {!detail ? (
<p className="text-[11px] text-slate-400 py-2">Loading detail…</p>
) : (
<div className="space-y-3">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
<div><span className="text-slate-400">Issue:</span><strong>{fmtDate(detail.issue_date)}</strong></div>
<div><span className="text-slate-400">Due:</span><strong>{fmtDate(detail.due_date)}</strong></div>
<div><span className="text-slate-400">Paid:</span><strong>{detail.currency} {toCurrencyString(detail.amount_paid)}</strong></div>
<div><span className="text-slate-400">Balance:</span><strong className="text-rose-700">{detail.currency} {toCurrencyString(detail.balance_due)}</strong></div>
</div>
                            {detail.po_number &&<p className="text-[11px] text-slate-500">PO Ref: {detail.po_number}</p>}
                            {detail.bill_to &&<p className="text-[11px] text-slate-500 whitespace-pre-line">Bill to: {detail.bill_to}</p>}
                            {detail.paybill &&<p className="text-[11px] text-slate-500">M-Pesa Paybill/Till: {detail.paybill}</p>}
                            {detail.project &&<p className="text-[11px] text-slate-500">Project: {detail.project.code} — {detail.project.name}</p>}

<table className="w-full text-[11px]">
<thead>
<tr className="text-left text-[9px] text-slate-400 border-b border-slate-200">
<th className="py-1 pr-2">Description</th>
<th className="py-1 pr-2">Unit</th>
<th className="py-1 pr-2 text-right">Qty</th>
<th className="py-1 pr-2 text-right">Rate</th>
<th className="py-1 text-right">Amount</th>
</tr>
</thead>
<tbody>
                                {(detail.items ?? []).map((it, i) => (
<tr key={it.id ?? i} className="border-b border-slate-100">
<td className="py-1 pr-2">{it.section ? `[${it.section}] ` : ''}{it.description}</td>
<td className="py-1 pr-2">{it.unit}</td>
<td className="py-1 pr-2 text-right font-mono tabular-nums">{it.quantity}</td>
<td className="py-1 pr-2 text-right tabular-nums">{toCurrencyString(it.unit_rate)}</td>
<td className="py-1 text-right tabular-nums font-semibold">{detail.currency} {toCurrencyString(it.total_amount ?? 0)}</td>
</tr>
))}
</tbody>
</table>

<div className="text-[11px] text-slate-600 space-x-3">
<span>Subtotal:<strong>{detail.currency} {toCurrencyString(detail.subtotal)}</strong></span>
<span>VAT ({detail.tax_pct}%):<strong>{detail.currency} {toCurrencyString(detail.tax_amount)}</strong></span>
<span>Total:<strong>{detail.currency} {toCurrencyString(detail.total)}</strong></span>
</div>

                            {(detail.payments ?? []).length > 0 && (
<div>
<p className="text-[10px] font-bold text-slate-400 mb-1">Payments received</p>
<div className="space-y-1">
                                  {detail.payments!.map((p) => (
<div key={p.id} className="flex justify-between text-[11px] text-slate-600">
<span>{fmtDate(p.paid_at)} • {p.method.replace('_', ' ')}{p.reference ? ` • ${p.reference}` : ''}{p.note ? ` — ${p.note}` : ''}</span>
<span className="font-mono tabular-nums font-semibold">{detail.currency} {toCurrencyString(p.amount)}</span>
</div>
))}
</div>
</div>
)}

                            {detail.terms &&<p className="text-[11px] text-slate-500 whitespace-pre-line"><span className="font-semibold">Terms:</span> {detail.terms}</p>}
                            {detail.void_reason &&<p className="text-[11px] text-rose-700">Voided: {detail.void_reason}</p>}

<div className="flex flex-wrap gap-2 pt-1">
                              {detail.status === 'DRAFT' && (
<button onClick={() => handleSend(detail)} disabled={busyId === detail.id}
                                  className="px-2.5 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
                                  Mark as Sent
</button>
)}
                              {(detail.status === 'SENT' || detail.status === 'PART_PAID' || detail.status === 'OVERDUE') && (
<button onClick={() => setShowPayForm((v) => !v)}
                                  className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded">
                                  {showPayForm ? 'Cancel payment' : 'Record payment'}
</button>
)}
                              {(detail.status === 'DRAFT' || detail.status === 'SENT') && (
<button onClick={() => handleVoid(detail)} disabled={busyId === detail.id}
                                  className="px-2.5 py-1 text-[10px] font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 rounded disabled:opacity-50">
                                  Void
</button>
)}
<button onClick={() => downloadPdf(detail.id)}
                                className="px-2.5 py-1 text-[10px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded">
                                Download PDF
</button>
</div>

                            {showPayForm && (detail.status === 'SENT' || detail.status === 'PART_PAID' || detail.status === 'OVERDUE') && (
<div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
<div>
<label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Amount *</label>
<input type="number" step="0.01" value={payForm.amount}
                                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value})}
                                    placeholder={String(detail.balance_due_num ?? '')}
                                    className="w-full text-[11px] p-1.5 border border-slate-300 rounded" />
</div>
<div>
<label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Method</label>
<select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value})}
                                    className="w-full text-[11px] p-1.5 border border-slate-300 rounded">
                                    {PAYMENT_METHODS.map((m) =><option key={m} value={m}>{m.replace('_', ' ')}</option>)}
</select>
</div>
<div>
<label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Reference</label>
<input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value})}
                                    placeholder="M-Pesa code / cheque no"
                                    className="w-full text-[11px] p-1.5 border border-slate-300 rounded" />
</div>
<div className="sm:col-span-1">
<label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Note</label>
<input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value})}
                                    className="w-full text-[11px] p-1.5 border border-slate-300 rounded" />
</div>
<button onClick={() => handlePayment(detail)} disabled={busyId === detail.id || !payForm.amount}
                                  className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded disabled:opacity-50">
                                  {busyId === detail.id ? 'Saving…' : 'Save payment'}
</button>
</div>
)}
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
