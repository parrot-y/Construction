import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/apiClient';
import { formatKes } from '../ui';
import { formatDate } from '../lib/format';

/**
 * G1 — "Payments to review" panel for money-approval roles. Lists provider
 * charges stuck in NEEDS_REVIEW (verified money that could not be applied
 * automatically) and lets an admin resolve each exactly once:
 *   APPLY    → post to another open invoice of the same tenant
 *   REFUNDED → money returned outside SiteSafi (note + refund reference)
 *   KEEP     → reviewed, deliberately left flagged
 */

interface HeldCharge {
  id: string;
  provider: string;
  reference: string;
  amountMinor: number;
  currency: string;
  amount: string;
  reason: string | null;
  createdAt: string;
  invoiceId: string;
  invoiceNo: string | null;
}

interface InvoiceOption {
  id: string;
  invoice_no: number | string;
  client_name?: string | null;
  balance_due?: string | number | null;
  status?: string;
}

const inputCls = 'w-full text-xs p-2 border border-slate-300 rounded-lg';
const btnCls = 'px-3 py-2 text-[11px] font-bold rounded-lg border transition min-h-[44px]';

function plainReason(reason: string | null): string {
  if (!reason) return 'The payment could not be applied automatically.';
  return reason.replace(/^settlement rejected:\s*/i, '');
}

export default function PaymentReviewPanel({
  invoices,
  onChanged,
}: {
  invoices: InvoiceOption[];
  onChanged?: () => void;
}): React.JSX.Element | null {
  const [charges, setCharges] = useState<HeldCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<'apply' | 'refund' | 'keep' | null>(null);
  const [targetId, setTargetId] = useState('');
  const [note, setNote] = useState('');
  const [refundRef, setRefundRef] = useState('');

  const load = useCallback(async () => {
    try {
      const body = await api.get<{ data?: HeldCharge[] }>('/api/v1/payments/charges/review');
      setCharges(body.data ?? []);
      setError(null);
    } catch {
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openInvoices = invoices.filter((i) => i.status === 'SENT' || i.status === 'PART_PAID');

  const submit = async (charge: HeldCharge) => {
    if (!mode) return;
    const payload =
      mode === 'apply'
        ? { action: 'APPLY', invoiceId: targetId }
        : mode === 'refund'
          ? { action: 'REFUNDED', note, refundReference: refundRef }
          : { action: 'KEEP' };
    if (mode === 'apply' && !targetId) { setError('Choose the invoice to apply this payment to.'); return; }
    if (mode === 'refund' && (note.replace(/\s+/g, '').length < 15 || !refundRef.trim())) {
      setError('Refund needs a note of at least 15 characters and the refund reference.');
      return;
    }
    setBusyId(charge.id);
    setError(null);
    try {
      await api.post(`/api/v1/payments/charges/${charge.id}/resolve`, payload);
      setOpenId(null); setMode(null); setTargetId(''); setNote(''); setRefundRef('');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Resolution failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || charges.length === 0) return null;

  return (
<div className="border border-amber-300 bg-amber-50/60 rounded-xl p-4 space-y-3">
<div className="flex items-center justify-between gap-2">
<h4 className="text-xs font-bold text-amber-900">Payments to review ({charges.length})</h4>
<p className="text-[10px] text-amber-700">Money received online that could not be applied automatically.</p>
</div>
      {error && <p className="text-[11px] font-semibold text-rose-700">{error}</p>}
      {charges.map((c) => {
        const open = openId === c.id;
        return (
<div key={c.id} className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
<span className="text-sm font-bold text-slate-900">{formatKes(c.amount)}</span>
<span className="text-[10px] text-slate-400 uppercase font-bold">{c.provider}</span>
</div>
<p className="text-[11px] text-slate-600">
              Invoice #{c.invoiceNo ?? c.invoiceId.slice(0, 8)} · ref {c.reference} · {formatDate(new Date(c.createdAt))}
</p>
<p className="text-[11px] text-amber-800"><span className="font-bold">Held because:</span> {plainReason(c.reason)}</p>

            {!open ? (
<div className="flex flex-wrap gap-2 pt-1">
<button className={`${btnCls} border-slate-300 text-slate-700 hover:border-amber-500`} onClick={() => { setOpenId(c.id); setMode('apply'); setTargetId(''); }}>Apply to invoice</button>
<button className={`${btnCls} border-slate-300 text-slate-700 hover:border-amber-500`} onClick={() => { setOpenId(c.id); setMode('refund'); }}>Mark refunded</button>
<button className={`${btnCls} border-slate-300 text-slate-500 hover:border-slate-400`} onClick={() => { setOpenId(c.id); setMode('keep'); }}>Keep flagged</button>
</div>
) : (
<div className="space-y-2 pt-1 border-t border-slate-100">
                {mode === 'apply' && (
<>
<label className="block text-[10px] font-bold text-slate-500">Apply to invoice</label>
<select className={inputCls} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
<option value="">— choose an open invoice —</option>
                      {openInvoices.map((i) => (
<option key={i.id} value={i.id}>
                          #{i.invoice_no} — {i.client_name || 'client'} — balance {formatKes(i.balance_due)}
</option>
))}
</select>
</>
)}
                {mode === 'refund' && (
<>
<label className="block text-[10px] font-bold text-slate-500">Refund note (what happened outside SiteSafi)</label>
<textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Refunded to client via M-Pesa reversal on 15 Nov 2026" />
<label className="block text-[10px] font-bold text-slate-500 mt-1">Refund reference</label>
<input className={inputCls} value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="e.g. MPESA-REV-88231" />
</>
)}
                {mode === 'keep' && (
<p className="text-[11px] text-slate-600">This charge stays flagged as needing review and will be recorded as reviewed.</p>
)}
<div className="flex gap-2">
<button
                    disabled={busyId === c.id}
                    onClick={() => submit(c)}
                    className="px-3 py-2 text-[11px] font-bold rounded-lg bg-amber-700 hover:bg-amber-800 text-white min-h-[44px] disabled:opacity-50"
                  >
                    {busyId === c.id ? 'Saving…' : mode === 'apply' ? 'Apply payment' : mode === 'refund' ? 'Confirm refund' : 'Confirm — keep flagged'}
</button>
<button onClick={() => { setOpenId(null); setMode(null); }} className={`${btnCls} border-slate-300 text-slate-500`}>Cancel</button>
</div>
</div>
)}
</div>
);
})}
</div>
);
}
