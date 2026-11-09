import React, { useCallback, useEffect, useState} from 'react';
import { formatKes } from '../ui';

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
  const [certs, setCerts] = useState<PaymentCertificate[]>([]);
  const [closeout, setCloseout] = useState<CloseoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    periodStart: '',
    periodEnd: '',
    thisPeriodAmount: '',
    retentionPct: '5',
    retentionReleased: '',
    advanceRecovery: '',
    amountDuePrevious: '',
    notes: '',
});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, xRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/payment-certificates`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/closeout`, { credentials: 'include'}),
      ]);
      if (!cRes.ok || !xRes.ok) throw new Error('Failed to load certificates & closeout');
      const cJson = await cRes.json();
      const xJson = await xRes.json();
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

  const createCert = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/payment-certificates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          thisPeriodAmount: form.thisPeriodAmount || '0',
          retentionPct: form.retentionPct || '5',
          retentionReleased: form.retentionReleased || '0',
          advanceRecovery: form.advanceRecovery || '0',
          amountDuePrevious: form.amountDuePrevious || '0',
          notes: form.notes || undefined,
}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
      setFeedback(`IPC-${String(body.data.certificate_no).padStart(3, '0')} drafted`);
      setShowForm(false);
      setForm({ periodStart: '', periodEnd: '', thisPeriodAmount: '', retentionPct: '5', retentionReleased: '', advanceRecovery: '', amountDuePrevious: '', notes: ''});
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
      const entered = window.prompt('Reason for rejection (required):', '');
      if (!entered || entered.trim().length< 3) {
        setError('A rejection reason is required.');
        return;
}
      comments = entered;
} else if (action === 'CERTIFY') {
      comments = window.prompt('Certification comments (optional):', '') || undefined;
} else if (action === 'MARK_PAID') {
      paidReference = window.prompt('Payment reference (M-Pesa code / EFT / cheque no):', '') || undefined;
}

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/payment-certificates/${cert.id}/action`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ action, comments, paidReference}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
      setFeedback(`IPC-${String(cert.certificate_no).padStart(3, '0')} → ${body.data.status}`);
      await load();
} catch (err: any) {
      setError(err?.message || 'Action failed');
}
};

  const advanceCloseout = async () => {
    if (!closeout?.nextStage) return;
    const notes = window.prompt(`Advance closeout to ${STAGE_LABELS[closeout.nextStage]}? Notes (optional):`, '');
    if (notes === null) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/closeout/transition`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ stage: closeout.nextStage, notes: notes || undefined}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
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
<p className="text-xs text-slate-500">Period valuations with JBC retention (5% cap) and net payable</p>
</div>
          {canManage && (
<button
              onClick={() => setShowForm((v) => !v)}
              className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition"
            >
              {showForm ? 'Cancel' : '+ New IPC'}
</button>
)}
</div>

        {showForm && (
<div className="border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
<label className="space-y-1">
<span className="font-semibold text-slate-600">Period start</span>
<input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Period end</span>
<input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">This period (KES)</span>
<input type="number" min="0" step="0.01" value={form.thisPeriodAmount} onChange={(e) => setForm({ ...form, thisPeriodAmount: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Retention %</span>
<input type="number" min="0" max="100" step="0.01" value={form.retentionPct} onChange={(e) => setForm({ ...form, retentionPct: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Retention released (KES)</span>
<input type="number" min="0" step="0.01" value={form.retentionReleased} onChange={(e) => setForm({ ...form, retentionReleased: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Advance recovery (KES)</span>
<input type="number" min="0" step="0.01" value={form.advanceRecovery} onChange={(e) => setForm({ ...form, advanceRecovery: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Amount due previous (KES)</span>
<input type="number" step="0.01" value={form.amountDuePrevious} onChange={(e) => setForm({ ...form, amountDuePrevious: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Notes</span>
<input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<div className="col-span-2 sm:col-span-4 flex justify-end">
<button
                onClick={() => void createCert()}
                disabled={saving || !form.periodStart || !form.periodEnd}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Draft IPC'}
</button>
</div>
</div>
)}

<div className="space-y-2">
          {certs.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8">No payment certificates yet — draft the first IPC for this project.</p>
)}
          {certs.map((c) => (
<div key={c.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
<div className="space-y-1">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">IPC-{String(c.certificate_no).padStart(3, '0')}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${CERT_STATUS_STYLES[c.status] || CERT_STATUS_STYLES.DRAFT}`}>
                    {c.status.replace(/_/g, ' ')}
</span>
<span className="text-[11px] text-slate-500">
                    {c.period_start} → {c.period_end}
</span>
</div>
<div className="text-[11px] text-slate-600">
                  This period<strong>{formatKes(c.this_period_amount)}</strong>
                  {' · '}Cumulative<strong>{formatKes(c.cumulative_certified)}</strong>
                  {' · '}Retention held<strong>{formatKes(c.retention_held)}</strong>
                  {c.paid_reference ? ` · Ref ${c.paid_reference}` : ''}
</div>
</div>
<div className="flex items-center gap-3">
<span className="text-sm font-mono font-bold text-emerald-700">{formatKes(c.net_payable)}</span>
                {canManage && (
<div className="flex gap-1.5">
                    {c.status === 'DRAFT' && (
<button onClick={() => void certAction(c, 'SUBMIT')} className="px-2.5 py-1 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md">Submit</button>
)}
                    {c.status === 'SUBMITTED' && (
<>
<button onClick={() => void certAction(c, 'REVIEW')} className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md">Review</button>
<button onClick={() => void certAction(c, 'REJECT')} className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md">Reject</button>
</>
)}
                    {c.status === 'UNDER_REVIEW' && (
<>
<button onClick={() => void certAction(c, 'CERTIFY')} className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md">Certify</button>
<button onClick={() => void certAction(c, 'REJECT')} className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md">Reject</button>
</>
)}
                    {c.status === 'CERTIFIED' && (
<button onClick={() => void certAction(c, 'MARK_PAID')} className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md">Mark Paid</button>
)}
</div>
)}
</div>
</div>
))}
</div>
</div>
</div>
);
}
