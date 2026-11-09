import React, { useCallback, useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

interface PaymentApplication {
  id: string;
  application_no: number;
  period_start: string | null;
  period_end: string | null;
  gross_claimed: string;
  retention_withheld: string;
  advance_recovered: string;
  wht_amount: string;
  net_payable: string;
  status: string;
  paid_reference?: string | null;
}

interface Commitment {
  id: string;
  commitment_no: number;
  vendor_name: string;
  vendor_type: string;
  scope_description?: string | null;
  contract_value: string;
  retention_pct: string;
  advance_paid: string;
  advance_recover_pct: string;
  status: string;
  certified_to_date?: string;
  retention_held?: string;
  advance_outstanding?: string;
  net_amount_owed?: string;
  applications: PaymentApplication[];
}

const APP_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-50 text-rose-700',
};

const COMMITMENT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  TERMINATED: 'bg-rose-50 text-rose-700',
};

interface Props {
  projectId: string;
  canManage?: boolean;
}

const emptyCommitment = {
  vendorName: '',
  vendorType: 'SUBCONTRACTOR',
  scopeDescription: '',
  contractValue: '',
  retentionPct: '5',
  retentionCapPct: '5',
  advanceAmount: '0',
  advancePaid: '0',
  advanceRecoverPct: '0',
  costCode: '',
  notes: '',
};

const emptyApplication = {
  periodStart: '',
  periodEnd: '',
  grossClaimed: '',
  whtPct: '0',
  previousBalance: '0',
  notes: '',
};

export default function CommitmentsView({ projectId, canManage = true}: Props): React.JSX.Element {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);
  const [commitmentForm, setCommitmentForm] = useState(emptyCommitment);
  const [appFormFor, setAppFormFor] = useState<string | null>(null);
  const [appForm, setAppForm] = useState(emptyApplication);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/commitments`, { credentials: 'include'});
      if (!res.ok) throw new Error('Failed to load commitments');
      const json = await res.json();
      setCommitments(json.data || []);
} catch (err: any) {
      setError(err?.message || 'Load failed');
} finally {
      setLoading(false);
}
}, [projectId]);

  useEffect(() => {
    void load();
}, [load]);

  const createCommitment = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/commitments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          vendorName: commitmentForm.vendorName,
          vendorType: commitmentForm.vendorType,
          scopeDescription: commitmentForm.scopeDescription || undefined,
          contractValue: commitmentForm.contractValue,
          retentionPct: commitmentForm.retentionPct || '5',
          retentionCapPct: commitmentForm.retentionCapPct || '5',
          advanceAmount: commitmentForm.advanceAmount || '0',
          advancePaid: commitmentForm.advancePaid || '0',
          advanceRecoverPct: commitmentForm.advanceRecoverPct || '0',
          costCode: commitmentForm.costCode || undefined,
          notes: commitmentForm.notes || undefined,
}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
      setFeedback(`Commitment COM-${String(body.data.commitment_no).padStart(3, '0')} created`);
      setShowCommitmentForm(false);
      setCommitmentForm(emptyCommitment);
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const createApplication = async (commitmentId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/commitments/${commitmentId}/applications`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          periodStart: appForm.periodStart,
          periodEnd: appForm.periodEnd,
          grossClaimed: appForm.grossClaimed,
          whtPct: appForm.whtPct || '0',
          previousBalance: appForm.previousBalance || '0',
          notes: appForm.notes || undefined,
}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
      setFeedback(`Application #${body.data.application_no} drafted`);
      setAppFormFor(null);
      setAppForm(emptyApplication);
      await load();
} catch (err: any) {
      setError(err?.message || 'Create failed');
} finally {
      setSaving(false);
}
};

  const appAction = async (commitmentId: string, app: PaymentApplication, action: string) => {
    let comments: string | undefined;
    let paidReference: string | undefined;
    if (action === 'REJECT') {
      const entered = window.prompt('Reason for rejection (required):', '');
      if (!entered || entered.trim().length< 3) {
        setError('A rejection reason is required.');
        return;
}
      comments = entered;
} else if (action === 'MARK_PAID') {
      paidReference = window.prompt('Payment reference (M-Pesa / EFT / cheque):', '') || undefined;
}
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/commitments/${commitmentId}/applications/${app.id}/action`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ action, comments, paidReference}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
      setFeedback(`Application #${app.application_no} → ${body.data.status}`);
      await load();
} catch (err: any) {
      setError(err?.message || 'Action failed');
}
};

  const updateCommitmentStatus = async (c: Commitment, status: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/commitments/${c.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ status}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed (${res.status})`);
      await load();
} catch (err: any) {
      setError(err?.message || 'Update failed');
}
};

  if (loading) {
    return<div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">Loading commitments…</div>;
}

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex items-center justify-between">
<div>
<h3 className="text-base font-bold text-slate-900">Commitments &amp; Payment Applications</h3>
<p className="text-xs text-slate-500">Contract → claim → owed: vendor commitments with retention, advance recovery and WHT</p>
</div>
        {canManage && (
<button
            onClick={() => setShowCommitmentForm((v) => !v)}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition"
          >
            {showCommitmentForm ? 'Cancel' : '+ New Commitment'}
</button>
)}
</div>

      {error &&<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}
      {feedback &&<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg">{feedback}</div>}

      {showCommitmentForm && (
<div className="border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
<label className="space-y-1">
<span className="font-semibold text-slate-600">Vendor name *</span>
<input type="text" value={commitmentForm.vendorName} onChange={(e) => setCommitmentForm({ ...commitmentForm, vendorName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Type</span>
<select value={commitmentForm.vendorType} onChange={(e) => setCommitmentForm({ ...commitmentForm, vendorType: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5">
              {['SUBCONTRACTOR', 'SUPPLIER', 'CONSULTANT', 'OTHER'].map((t) =><option key={t} value={t}>{t}</option>)}
</select>
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Contract value (KES) *</span>
<input type="number" min="0" step="0.01" value={commitmentForm.contractValue} onChange={(e) => setCommitmentForm({ ...commitmentForm, contractValue: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Retention %</span>
<input type="number" min="0" max="100" step="0.01" value={commitmentForm.retentionPct} onChange={(e) => setCommitmentForm({ ...commitmentForm, retentionPct: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Retention cap %</span>
<input type="number" min="0" max="100" step="0.01" value={commitmentForm.retentionCapPct} onChange={(e) => setCommitmentForm({ ...commitmentForm, retentionCapPct: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Advance amount</span>
<input type="number" min="0" step="0.01" value={commitmentForm.advanceAmount} onChange={(e) => setCommitmentForm({ ...commitmentForm, advanceAmount: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Advance paid</span>
<input type="number" min="0" step="0.01" value={commitmentForm.advancePaid} onChange={(e) => setCommitmentForm({ ...commitmentForm, advancePaid: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Advance recover %/claim</span>
<input type="number" min="0" max="100" step="0.01" value={commitmentForm.advanceRecoverPct} onChange={(e) => setCommitmentForm({ ...commitmentForm, advanceRecoverPct: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="col-span-2 space-y-1">
<span className="font-semibold text-slate-600">Scope</span>
<input type="text" value={commitmentForm.scopeDescription} onChange={(e) => setCommitmentForm({ ...commitmentForm, scopeDescription: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<label className="col-span-2 space-y-1">
<span className="font-semibold text-slate-600">Cost code</span>
<input type="text" value={commitmentForm.costCode} onChange={(e) => setCommitmentForm({ ...commitmentForm, costCode: e.target.value})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
</label>
<div className="col-span-2 sm:col-span-4 flex justify-end">
<button
              onClick={() => void createCommitment()}
              disabled={saving || !commitmentForm.vendorName || !commitmentForm.contractValue}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create Commitment'}
</button>
</div>
</div>
)}

<div className="space-y-3">
        {commitments.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8">No commitments yet — register a subcontractor, supplier or consultant package first.</p>
)}
        {commitments.map((c) => (
<div key={c.id} className="border border-slate-200 rounded-xl overflow-hidden">
<button
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 text-left hover:bg-slate-50 transition"
            >
<div className="space-y-1">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">COM-{String(c.commitment_no).padStart(3, '0')}</span>
<span className="text-sm font-bold text-slate-900">{c.vendor_name}</span>
<span className="text-[10px] font-semibold text-slate-500 ">{c.vendor_type}</span>
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${COMMITMENT_STATUS_STYLES[c.status] || COMMITMENT_STATUS_STYLES.ACTIVE}`}>
                    {c.status}
</span>
</div>
<div className="text-[11px] text-slate-600">
                  Contract<strong>KES {toCurrencyString(c.contract_value)}</strong>
                  {c.certified_to_date ? ` · Certified<strong>KES ${toCurrencyString(c.certified_to_date)}</strong>` : ''}
                  {c.retention_held ? ` · Retention<strong>KES ${toCurrencyString(c.retention_held)}</strong>` : ''}
                  {c.advance_outstanding && c.advance_outstanding !== '0.00' ? ` · Advance outstanding<strong>KES ${toCurrencyString(c.advance_outstanding)}</strong>` : ''}
</div>
</div>
<div className="flex items-center gap-3">
                {c.net_amount_owed && c.net_amount_owed !== '0.00' && (
<span className="text-xs font-mono font-bold text-amber-700">Owed KES {toCurrencyString(c.net_amount_owed)}</span>
)}
<span className="text-[11px] text-slate-400">{c.applications.length} claim{c.applications.length === 1 ? '' : 's'} {expanded === c.id ? '▾' : '▸'}</span>
</div>
</button>

            {expanded === c.id && (
<div className="border-t border-slate-200 p-4 space-y-3 bg-slate-50/50">
                {c.scope_description &&<p className="text-xs text-slate-600">{c.scope_description}</p>}

                {c.applications.length === 0 && (
<p className="text-xs text-slate-500">No payment applications yet.</p>
)}
                {c.applications.map((a) => (
<div key={a.id} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div className="space-y-0.5">
<div className="flex items-center gap-2">
<span className="font-mono text-[11px] font-bold">#{a.application_no}</span>
<span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${APP_STATUS_STYLES[a.status]}`}>{a.status}</span>
<span className="text-[10px] text-slate-500">{a.period_start} → {a.period_end}</span>
</div>
<div className="text-[11px] text-slate-600">
                        Gross<strong>KES {toCurrencyString(a.gross_claimed)}</strong>
                        {' · '}Retention −<strong>KES {toCurrencyString(a.retention_withheld)}</strong>
                        {a.advance_recovered !== '0.00' ? ` · Advance −KES ${toCurrencyString(a.advance_recovered)}` : ''}
                        {a.wht_amount !== '0.00' ? ` · WHT −KES ${toCurrencyString(a.wht_amount)}` : ''}
                        {a.paid_reference ? ` · Ref ${a.paid_reference}` : ''}
</div>
</div>
<div className="flex items-center gap-2">
<span className="text-xs font-mono font-bold text-emerald-700">KES {toCurrencyString(a.net_payable)}</span>
                      {canManage && (
<div className="flex gap-1.5">
                          {a.status === 'DRAFT' && (
<button onClick={() => void appAction(c.id, a, 'SUBMIT')} className="px-2 py-1 text-[10px] font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded">Submit</button>
)}
                          {a.status === 'SUBMITTED' && (
<>
<button onClick={() => void appAction(c.id, a, 'APPROVE')} className="px-2 py-1 text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded">Approve</button>
<button onClick={() => void appAction(c.id, a, 'REJECT')} className="px-2 py-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded">Reject</button>
</>
)}
                          {a.status === 'APPROVED' && (
<button onClick={() => void appAction(c.id, a, 'MARK_PAID')} className="px-2 py-1 text-[10px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded">Mark Paid</button>
)}
</div>
)}
</div>
</div>
))}

                {canManage && appFormFor === c.id ? (
<div className="border border-slate-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-white">
<label className="space-y-1">
<span className="font-semibold text-slate-600">Period start</span>
<input type="date" value={appForm.periodStart} onChange={(e) => setAppForm({ ...appForm, periodStart: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Period end</span>
<input type="date" value={appForm.periodEnd} onChange={(e) => setAppForm({ ...appForm, periodEnd: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Gross claimed (KES)</span>
<input type="number" min="0" step="0.01" value={appForm.grossClaimed} onChange={(e) => setAppForm({ ...appForm, grossClaimed: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">WHT %</span>
<input type="number" min="0" max="100" step="0.01" value={appForm.whtPct} onChange={(e) => setAppForm({ ...appForm, whtPct: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Previous balance</span>
<input type="number" step="0.01" value={appForm.previousBalance} onChange={(e) => setAppForm({ ...appForm, previousBalance: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" />
</label>
<label className="space-y-1">
<span className="font-semibold text-slate-600">Notes</span>
<input type="text" value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value})} className="w-full border border-slate-300 rounded px-2 py-1" />
</label>
<div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
<button onClick={() => setAppFormFor(null)} className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded">Cancel</button>
<button
                        onClick={() => void createApplication(c.id)}
                        disabled={saving || !appForm.periodStart || !appForm.periodEnd || !appForm.grossClaimed}
                        className="px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Draft Application'}
</button>
</div>
</div>
) : canManage ? (
<div className="flex gap-2">
<button
                      onClick={() => { setAppFormFor(c.id); setAppForm(emptyApplication);}}
                      className="px-3 py-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded"
                    >
                      + New Payment Application
</button>
                    {c.status === 'ACTIVE' && (
<button onClick={() => void updateCommitmentStatus(c, 'COMPLETED')} className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded">Mark Completed</button>
)}
                    {c.status !== 'TERMINATED' && (
<button onClick={() => void updateCommitmentStatus(c, 'TERMINATED')} className="px-3 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded">Terminate</button>
)}
</div>
) : null}
</div>
)}
</div>
))}
</div>
</div>
);
}
