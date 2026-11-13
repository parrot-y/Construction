import React, { useCallback, useEffect, useMemo, useState} from 'react';
import { formatKes, CopyWhatsAppButton } from '../ui';
import { useAppDialog } from './AppDialog';
import { PRODUCT_NAME } from '../lib/product';
import { api } from '../lib/apiClient';

interface PaymentCertificate {
  id: string;
  certificate_no: number;
  period_start: string | null;
  period_end: string | null;
  this_period_amount: string;
  cumulative_certified: string;
  retention_held: string;
  net_payable: string;
  status: string;
  paid_reference?: string | null;
  invoice_id?: string | null;
  vat_pct?: string;
  vat_amount?: string;
  wht_pct?: string;
  wht_amount?: string;
}

interface PreviewLine {
  boqItemId: string;
  description: string;
  unit: string | null;
  progressPct: string;
  unitRate: string;
  amount: string;
}

interface CloseoutData {
  stage: string;
  practical_completion_date: string | null;
  nextStage: string | null;
  checklist: {
    practicalCompletionCertificate: boolean;
    defectsLiabilityPeriodActive: boolean;
    defectsLiabilityExpired: boolean;
    openSnagItems: number;
    pendingPaymentCertificates: number;
};
  gates: Record<string, boolean>;
}

const STAGES = ['IN_PROGRESS', 'HANDED_OVER', 'DEFECTS_LIABILITY', 'DEFECTS_EXPIRED', 'CLOSED'];
const STAGE_LABELS: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  HANDED_OVER: 'Handed Over',
  DEFECTS_LIABILITY: 'Defects Liability',
  DEFECTS_EXPIRED: 'Defects Expired',
  CLOSED: 'Closed',
};

const CERT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-50 text-amber-700',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700',
  CERTIFIED: 'bg-emerald-50 text-emerald-700',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-50 text-rose-700',
};

interface Props {
  projectId: string;
  canManage?: boolean;
}

export default function CertificatesCloseoutView({ projectId, canManage = true}: Props): React.JSX.Element {
  const dialog = useAppDialog();
  const [certs, setCerts] = useState<PaymentCertificate[]>([]);
  const [closeout, setCloseout] = useState<CloseoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Certificate builder (progress -> editable review -> DRAFT)
  const [builderOpen, setBuilderOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLines, setPreviewLines] = useState<PreviewLine[]>([]);
  const [builder, setBuilder] = useState({
    periodStart: '',
    periodEnd: '',
    retentionPct: '5',
    retentionReleased: '',
    advanceRecovery: '',
    amountDuePrevious: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Invoice creation from a CERTIFIED certificate
  const [invoiceFor, setInvoiceFor] = useState<PaymentCertificate | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ clientName: '', clientEmail: '', dueDays: '30', notes: ''});
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cJson, xJson] = await Promise.all([
        api.get<{ data?: PaymentCertificate[] }>(`/api/v1/projects/${projectId}/payment-certificates`),
        api.get<{ data: CloseoutData }>(`/api/v1/projects/${projectId}/closeout`),
      ]);
      setCerts(cJson.data || []);
      setCloseout(xJson.data);
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [projectId]);

  useEffect(() => {
    void load();
}, [load]);

  const openBuilder = async () => {
    setBuilderOpen(true);
    setPreviewLoading(true);
    setError(null);
    try {
      const body = await api.get<{ data?: { lines?: PreviewLine[] } }>(`/api/v1/projects/${projectId}/payment-certificates/preview`);
      const data = body.data || {};
      setPreviewLines((data.lines || []).map((l: PreviewLine) => ({ ...l })));
      const today = new Date().toISOString().slice(0, 10);
      setBuilder((b) => ({ ...b, periodStart: b.periodStart || today, periodEnd: b.periodEnd || today }));
} catch (err: any) {
      setError(err?.message || 'Could not build certificate preview');
      setPreviewLines([]);
} finally {
      setPreviewLoading(false);
}
};

  const linesTotal = useMemo(
    () => previewLines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0),
    [previewLines],
  );

  // "1234.50" without .toFixed — keeps the currency guard clean.
  const toAmountString = (n: number) => {
    const cents = Math.round(n * 100);
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  };

  const updateLineAmount = (idx: number, amount: string) => {
    setPreviewLines((lines) => lines.map((l, i) => (i === idx ? { ...l, amount } : l)));
  };

  const createCert = async () => {
    setSaving(true);
    setError(null);
    try {
      const lines = previewLines
        .filter((l) => Number(l.amount) > 0)
        .map((l) => ({
          boqItemId: l.boqItemId,
          description: l.description,
          unit: l.unit,
          progressPct: l.progressPct,
          unitRate: l.unitRate,
          amount: l.amount,
        }));
      const body = await api.post<{ data: { certificate_no: number } }>(`/api/v1/projects/${projectId}/payment-certificates`, {
          periodStart: builder.periodStart,
          periodEnd: builder.periodEnd,
          lines,
          thisPeriodAmount: toAmountString(linesTotal),
          retentionPct: builder.retentionPct || '5',
          retentionReleased: builder.retentionReleased || '0',
          advanceRecovery: builder.advanceRecovery || '0',
          amountDuePrevious: builder.amountDuePrevious || '0',
          notes: builder.notes || undefined,
});
      setFeedback(`IPC-${String(body.data.certificate_no).padStart(3, '0')} drafted from progress`);
      setBuilderOpen(false);
      setPreviewLines([]);
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const certAction = async (cert: PaymentCertificate, action: string) => {
    let comments: string | undefined;
    let paidReference: string | undefined;
    if (action === 'REJECT') {
      const entered = await dialog.prompt({
        title: 'Reject payment certificate',
        inputLabel: 'Reason for rejection (required)',
        confirmLabel: 'Reject', danger: true, minLength: 3,
      });
      if (!entered || entered.trim().length< 3) {
        setError('A rejection reason is required.');
        return;
}
      comments = entered;
} else if (action === 'CERTIFY') {
      const c = await dialog.prompt({ title: 'Certify payment certificate', inputLabel: 'Certification comments (optional)', confirmLabel: 'Certify' });
      if (c === null) return;
      comments = c || undefined;
} else if (action === 'MARK_PAID') {
      const pr = await dialog.prompt({ title: 'Mark certificate paid', inputLabel: 'Payment reference (M-Pesa code / EFT / cheque no)', confirmLabel: 'Mark paid' });
      if (pr === null) return;
      paidReference = pr || undefined;
}

    try {
      const body = await api.post<{ data: { status: string } }>(`/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, { action, comments, paidReference });
      setFeedback(`IPC-${String(cert.certificate_no).padStart(3, '0')} → ${body.data.status}`);
      await load();
} catch (err: any) {
      setError(err?.message || 'Action failed');
}
};

  const createInvoice = async () => {
    if (!invoiceFor) return;
    setInvoiceSaving(true);
    setError(null);
    try {
      const body = await api.post<{ data?: { invoice?: { invoiceNo: number } } }>(`/api/v1/projects/${projectId}/payment-certificates/${invoiceFor.id}/create-invoice`, {
          clientName: invoiceForm.clientName,
          clientEmail: invoiceForm.clientEmail || undefined,
          dueDays: Number(invoiceForm.dueDays) || 30,
          notes: invoiceForm.notes || undefined,
});
      const inv = body.data?.invoice;
      setFeedback(
        inv
          ? `Invoice INV-${String(inv.invoiceNo).padStart(4, '0')} created from IPC-${String(invoiceFor.certificate_no).padStart(3, '0')} — record payment under Money → Invoices`
          : 'Invoice created from certificate',
      );
      setInvoiceFor(null);
      setInvoiceForm({ clientName: '', clientEmail: '', dueDays: '30', notes: ''});
      await load();
} catch (err: any) {
      setError(err?.message || 'Invoice creation failed');
} finally {
      setInvoiceSaving(false);
}
};

  const advanceCloseout = async () => {
    if (!closeout?.nextStage) return;
    const notes = await dialog.prompt({
      title: `Advance closeout to ${STAGE_LABELS[closeout.nextStage]}?`,
      inputLabel: 'Notes (optional)', confirmLabel: 'Advance',
    });
    if (notes === null) return;
    try {
      await api.post(`/api/v1/projects/${projectId}/closeout/transition`, { stage: closeout.nextStage, notes: notes || undefined });
      setFeedback(`Closeout → ${STAGE_LABELS[closeout.nextStage]}`);
      await load();
} catch (err: any) {
      setError(err?.message || 'Transition failed');
}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">Loading certificates &amp; closeout…</div>;
}

  const stageIdx = closeout ? STAGES.indexOf(closeout.stage) : 0;
  const gateOk = closeout?.nextStage ? closeout.gates[closeout.nextStage] : false;

  return (
<div className="space-y-4">
      {error && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>
)}
      {feedback && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg">{feedback}</div>
)}

      {/* Closeout stage tracker */}
      {closeout && (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex items-center justify-between">
<div>
<h3 className="text-base font-bold text-slate-900">Project Closeout</h3>
<p className="text-xs text-slate-500">Practical completion → defects liability → closed, per JBC 1999</p>
</div>
            {canManage && closeout.nextStage && (
<button
                onClick={() => void advanceCloseout()}
                disabled={!gateOk}
                title={gateOk ? `Advance to ${STAGE_LABELS[closeout.nextStage]}` : 'Prerequisites not met — see checklist'}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
                  gateOk
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
}`}
              >
                Advance to {closeout.nextStage ? STAGE_LABELS[closeout.nextStage] : ''}
</button>
)}
</div>

<div className="flex items-center gap-1">
            {STAGES.map((s, i) => (
<React.Fragment key={s}>
<div className={`flex-1 text-center px-2 py-2 rounded-lg text-[10px] font-bold ${
                  i< stageIdx ? 'bg-emerald-50 text-emerald-700' : i === stageIdx ? 'bg-purple-600 text-white' : 'bg-slate-50 text-slate-400'
}`}>
                  {STAGE_LABELS[s]}
</div>
                {i< STAGES.length - 1 &&<span className="text-slate-300">→</span>}
</React.Fragment>
))}
</div>

<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
<div className={`p-2 rounded-lg border ${closeout.checklist.practicalCompletionCertificate ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
<span className="font-bold">{closeout.checklist.practicalCompletionCertificate ? '' : '○'}</span> PC certificate
</div>
<div className={`p-2 rounded-lg border ${closeout.checklist.defectsLiabilityPeriodActive ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
<span className="font-bold">{closeout.checklist.defectsLiabilityPeriodActive ? '' : '○'}</span> DLP active
</div>
<div className={`p-2 rounded-lg border ${closeout.checklist.defectsLiabilityExpired ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
<span className="font-bold">{closeout.checklist.defectsLiabilityExpired ? '' : '○'}</span> DLP expired
</div>
<div className={`p-2 rounded-lg border ${closeout.checklist.openSnagItems === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
<span className="font-bold">{closeout.checklist.openSnagItems === 0 ? '' : '!'}</span> {closeout.checklist.openSnagItems} open snags
</div>
<div className={`p-2 rounded-lg border ${closeout.checklist.pendingPaymentCertificates === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
<span className="font-bold">{closeout.checklist.pendingPaymentCertificates === 0 ? '' : '!'}</span> {closeout.checklist.pendingPaymentCertificates} pending IPCs
</div>
</div>
</div>
)}

      {/* Payment certificates */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex items-center justify-between">
<div>
<h3 className="text-base font-bold text-slate-900">Interim Payment Certificates</h3>
<p className="text-xs text-slate-500">Built from BoQ progress — certified amounts minus previously certified, with VAT &amp; withholding tax</p>
</div>
          {canManage && !builderOpen && (
<button
              onClick={() => void openBuilder()}
              className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition"
            >
              + New IPC from progress
</button>
)}
</div>

        {builderOpen && (
<div className="border border-slate-200 rounded-xl p-4 space-y-4">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
<label className="space-y-1">
<span className="font-semibold text-slate-600">Period start</span>
<input type="date" value={builder.periodStart} onChange={(e) => setBuilder({ ...builder, periodStart: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Period end</span>
<input type="date" value={builder.periodEnd} onChange={(e) => setBuilder({ ...builder, periodEnd: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Retention %</span>
<input type="number" min="0" max="100" step="0.01" value={builder.retentionPct} onChange={(e) => setBuilder({ ...builder, retentionPct: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Retention released (KES)</span>
<input type="number" min="0" step="0.01" value={builder.retentionReleased} onChange={(e) => setBuilder({ ...builder, retentionReleased: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Advance recovery (KES)</span>
<input type="number" min="0" step="0.01" value={builder.advanceRecovery} onChange={(e) => setBuilder({ ...builder, advanceRecovery: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Amount due previous (KES)</span>
<input type="number" step="0.01" value={builder.amountDuePrevious} onChange={(e) => setBuilder({ ...builder, amountDuePrevious: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1 col-span-2">
<span className="font-semibold text-slate-600">Notes</span>
<input type="text" value={builder.notes} onChange={(e) => setBuilder({ ...builder, notes: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
</div>

{previewLoading ? (
<p className="text-sm text-slate-500 text-center py-6">Building certificate from recorded progress…</p>
) : previewLines.length === 0 ? (
<p className="text-sm text-slate-500 text-center py-6">
            No uncertified progress found — record BoQ progress first, then build the certificate.
</p>
) : (
<div className="space-y-2">
<div className="overflow-x-auto">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-slate-500 border-b border-slate-200">
<th className="py-1.5 pr-2">BoQ item</th>
<th className="py-1.5 pr-2">Progress</th>
<th className="py-1.5 pr-2 text-right">Rate</th>
<th className="py-1.5 pr-2 text-right">This period (KES)</th>
</tr>
</thead>
<tbody>
                  {previewLines.map((l, i) => (
<tr key={l.boqItemId} className="border-b border-slate-100">
<td className="py-1.5 pr-2 text-slate-700 max-w-[280px] truncate" title={l.description}>{l.description}</td>
<td className="py-1.5 pr-2 text-slate-500">{Number(l.progressPct).toFixed(0)}%</td>
<td className="py-1.5 pr-2 text-right text-slate-500">{formatKes(l.unitRate)}</td>
<td className="py-1.5 pr-2 text-right">
<input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.amount}
                        onChange={(e) => updateLineAmount(i, e.target.value)}
                        className="w-32 border border-slate-300 rounded px-2 py-1 text-right min-h-[36px]"
                        aria-label={`Amount for ${l.description}`}
/>
</td>
</tr>
))}
</tbody>
<tfoot>
<tr>
<td colSpan={3} className="py-2 text-right font-semibold text-slate-700">Total this period</td>
<td className="py-2 text-right font-bold text-emerald-700">{formatKes(linesTotal)}</td>
</tr>
</tfoot>
</table>
</div>
<p className="text-[11px] text-slate-500">Edit any line amount before drafting — the total is recomputed from the lines. VAT and withholding tax are applied from company tax settings on certification.</p>
</div>
)}

<div className="flex justify-end gap-2">
<button
                onClick={() => { setBuilderOpen(false); setPreviewLines([]); }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
</button>
<button
                onClick={() => void createCert()}
                disabled={saving || previewLoading || linesTotal <= 0 || !builder.periodStart || !builder.periodEnd}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Draft IPC'}
</button>
</div>
</div>
)}

        {invoiceFor && (
<div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3">
<h4 className="text-sm font-bold text-slate-900">
              Create invoice from IPC-{String(invoiceFor.certificate_no).padStart(3, '0')}
</h4>
<p className="text-[11px] text-slate-500">
              The invoice copies the certificate lines plus VAT and withholding tax. Certificate paid status will follow the invoice payments.
</p>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
<label className="space-y-1">
<span className="font-semibold text-slate-600">Client name *</span>
<input type="text" value={invoiceForm.clientName} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Client email</span>
<input type="email" value={invoiceForm.clientEmail} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Due in (days)</span>
<input type="number" min="0" max="365" value={invoiceForm.dueDays} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDays: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 min-h-[44px]" />
</label>
</div>
<div className="flex justify-end gap-2">
<button onClick={() => setInvoiceFor(null)} className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg">Cancel</button>
<button
                onClick={() => void createInvoice()}
                disabled={invoiceSaving || invoiceForm.clientName.trim().length< 2}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {invoiceSaving ? 'Creating…' : 'Create invoice'}
</button>
</div>
</div>
)}

<div className="space-y-2">
          {certs.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8">No payment certificates yet — build the first IPC from recorded BoQ progress.</p>
)}
          {certs.map((c) => (
<div key={c.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
<div className="space-y-1">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-mono tabular-nums text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">IPC-{String(c.certificate_no).padStart(3, '0')}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${CERT_STATUS_STYLES[c.status] || CERT_STATUS_STYLES.DRAFT}`}>
                    {c.status.replace(/_/g, ' ')}
</span>
<span className="text-[11px] text-slate-500">
                    {c.period_start} → {c.period_end}
</span>
{c.invoice_id && (
<span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Invoiced</span>
)}
</div>
<div className="text-[11px] text-slate-600">
                  This period<strong>{formatKes(c.this_period_amount)}</strong>
                  {' · '}Cumulative<strong>{formatKes(c.cumulative_certified)}</strong>
                  {' · '}Retention held<strong>{formatKes(c.retention_held)}</strong>
                  {c.vat_amount && Number(c.vat_amount) > 0 && <> · VAT <strong>{formatKes(c.vat_amount)}</strong></>}
                  {c.wht_amount && Number(c.wht_amount) > 0 && <> · WHT <strong>−{formatKes(c.wht_amount)}</strong></>}
                  {c.paid_reference ? ` · Ref ${c.paid_reference}` : ''}
</div>
</div>
<div className="flex items-center gap-3">
<span className="text-sm tabular-nums font-bold text-emerald-700">{formatKes(c.net_payable)}</span>
                {canManage && (
<div className="flex gap-1.5 flex-wrap">
                    {c.status === 'DRAFT' && (
<button onClick={() => void certAction(c, 'SUBMIT')} className="px-2.5 py-1 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md min-h-[36px]">Submit</button>
)}
                    {c.status === 'SUBMITTED' && (
<>
<button onClick={() => void certAction(c, 'REVIEW')} className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md min-h-[36px]">Review</button>
<button onClick={() => void certAction(c, 'REJECT')} className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md min-h-[36px]">Reject</button>
</>
)}
                    {c.status === 'UNDER_REVIEW' && (
<>
<button onClick={() => void certAction(c, 'CERTIFY')} className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md min-h-[36px]">Certify</button>
<button onClick={() => void certAction(c, 'REJECT')} className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md min-h-[36px]">Reject</button>
</>
)}
                    {c.status === 'CERTIFIED' && !c.invoice_id && (
<button
                        onClick={() => { setInvoiceFor(c); setInvoiceForm({ clientName: '', clientEmail: '', dueDays: '30', notes: ''}); }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md min-h-[36px]"
                      >
                        Create invoice
</button>
)}
                    {c.status === 'CERTIFIED' && !c.invoice_id && (
<button onClick={() => void certAction(c, 'MARK_PAID')} className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md min-h-[36px]">Mark paid (no invoice)</button>
)}
</div>
)}
{c.invoice_id && c.status === 'CERTIFIED' && (
<span className="text-[11px] text-slate-500">Awaiting invoice payment</span>
)}
<CopyWhatsAppButton
                        message={`Payment certificate IPC-${String(c.certificate_no).padStart(3, '0')} (${c.period_start} → ${c.period_end}) is ${c.status.replace(/_/g, ' ').toLowerCase()} — net payable ${formatKes(c.net_payable)}${c.invoice_id ? ' (invoice raised, awaiting payment)' : c.status === 'CERTIFIED' ? ' — invoice can now be raised' : ''}. — ${PRODUCT_NAME}`}
                      />
</div>
</div>
))}
</div>
</div>
{dialog.element}
</div>
);
}
