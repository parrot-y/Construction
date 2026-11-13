import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';
import CostCaptureModal from './CostCaptureModal';
import { useAppDialog } from './AppDialog';
import { api, ApiError } from '../lib/apiClient';

export interface CostItem {
  id: string;
  cost_category: string;
  amount: string;
  vendor_name?: string | null;
  invoice_ref?: string | null;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  self_approved?: boolean;
  created_at: string;
  receipts?: Array<{ id?: string; filename: string; mime_type?: string}>;
  boq_item?: { id: string; item_code: string; description: string} | null;
  created_by?: { id: string; full_name: string; email: string} | null;
  approvals?: Array<{ id: string; action: string; comments?: string | null; reviewer?: { full_name: string}}>;
}

interface CostManagementViewProps {
  projectId: string;
  canApprove?: boolean;
  canCreate?: boolean;
  userRole?: string;
  initialCosts?: CostItem[];
  boqItems?: Array<{ id: string; item_code: string; description: string}>;
}

export default function CostManagementView({
  projectId,
  canApprove = true,
  canCreate = true,
  userRole,
  initialCosts = [],
  boqItems = [],
}: CostManagementViewProps): React.JSX.Element {
  const dialog = useAppDialog();
  const [costs, setCosts] = useState<CostItem[]>(initialCosts);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const rows = await api.get<CostItem[] | { data?: CostItem[] }>(`/api/v1/projects/${projectId}/costs`);
        setCosts(Array.isArray(rows) ? rows : (rows.data || []));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load costs');
      }
    })();
  }, [projectId]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED'>('ALL');
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleCostCreated = (newCost: CostItem) => {
    setCosts([newCost, ...costs]);
    setActionFeedback(`Cost entry for ${formatKes(newCost.amount)} logged successfully in PENDING status`);
};

  const postApproval = (costId: string, comments: string, selfApprovalReason?: string) =>
    api.post<{ data?: { updated?: { selfApproved?: boolean; self_approved?: boolean } } }>(`/api/v1/projects/${projectId}/costs/${costId}/approve`, { action: 'APPROVED', comments, ...(selfApprovalReason ? { selfApprovalReason } : {}) });

  const handleApprove = async (costId: string) => {
    const comments = await dialog.prompt({ title: 'Approve cost entry', inputLabel: 'QS/PM approval comments', defaultValue: 'Verified and approved against site delivery note', confirmLabel: 'Approve' });
    if (comments === null) return;

    try {
      let body;
      try {
        body = await postApproval(costId, comments);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && /selfApprovalReason|different approver/i.test(err.message)) {
          const canSelfApprove = ['COMPANY_ADMIN', 'ADMIN'].includes(userRole || '');
          if (!canSelfApprove) {
            setActionFeedback('A different approver is required.');
            return;
          }
          const reason = await dialog.prompt({ title: 'Self-approval reason required', inputLabel: 'Self-approval reason (min 15 characters)', confirmLabel: 'Approve anyway', minLength: 15 });
          if (!reason || !reason.trim()) { setActionFeedback('Self-approval cancelled — a reason is required.'); return; }
          body = await postApproval(costId, comments, reason.trim());
        } else {
          throw err;
        }
      }
      const selfApproved = !!(body?.data?.updated?.selfApproved ?? body?.data?.updated?.self_approved);
      setCosts(costs.map((c) => (c.id === costId ? { ...c, status: 'APPROVED', self_approved: selfApproved || c.self_approved } : c)));
      setActionFeedback(selfApproved ? 'Cost entry self-approved with recorded reason' : 'Cost entry APPROVED successfully');
} catch (e) {
      setActionFeedback(e instanceof Error ? e.message : 'Network error — approval not recorded.');
}
};

  const handleReject = async (costId: string) => {
    const comments = await dialog.prompt({ title: 'Reject cost entry', inputLabel: 'Reason for rejection', confirmLabel: 'Reject', danger: true });
    if (!comments) return;

    try {
      await api.post(`/api/v1/projects/${projectId}/costs/${costId}/approve`, { action: 'REJECTED', comments });
      {
        setCosts(costs.map((c) => (c.id === costId ? { ...c, status: 'REJECTED'} : c)));
        setActionFeedback('Cost entry marked as REJECTED');
}
} catch (e) {
      setActionFeedback((e instanceof Error ? e.message : undefined) || 'Network error — rejection not recorded.');
}
};

  const handleVoid = async (costId: string) => {
    const reason = await dialog.prompt({ title: 'Void cost entry', message: 'This entry stays in the append-only audit trail.', inputLabel: 'Reason for voiding', confirmLabel: 'Void', danger: true });
    if (!reason) return;

    try {
      await api.post(`/api/v1/projects/${projectId}/costs/${costId}/void`, { reason });
      {
        setCosts(costs.map((c) => (c.id === costId ? { ...c, status: 'VOIDED'} : c)));
        setActionFeedback('Cost entry VOIDED with immutable audit record');
}
} catch (e) {
      setActionFeedback((e instanceof Error ? e.message : undefined) || 'Network error — void not recorded.');
}
};

  const filteredCosts = costs.filter((c) => {
    if (activeFilter === 'ALL') return true;
    return c.status === activeFilter;
});

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
      {/* View Header */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div>
<span className="text-[11px] font-bold text-slate-500">
            Append-Only Financial Ledger
</span>
<h3 className="text-base font-bold text-slate-900 mt-0.5">Project Cost Entries & Approvals</h3>
</div>

        {canCreate && (
<button
            onClick={() => setShowCaptureModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
             Log Cost Entry
</button>
)}
</div>

      {loadError && (
<div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{loadError}</div>
)}

      {actionFeedback && (
<div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {actionFeedback}</span>
<button onClick={() => setActionFeedback(null)} className="text-emerald-700 font-bold ml-2">×</button>
</div>
)}

      {/* Filter Tabs */}
<div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'VOIDED'] as const).map((filter) => (
<button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              activeFilter === filter
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
}`}
          >
            {filter} {filter === 'PENDING' ? `(${costs.filter((c) => c.status === 'PENDING').length})` : ''}
</button>
))}
</div>

      {/* Cost Table */}
<div className="overflow-x-auto">
<table className="w-full text-left text-xs border-collapse">
<thead>
<tr className="border-b border-slate-200 text-slate-500 bg-slate-50/75">
<th className="py-2.5 px-3 font-semibold">Date & Vendor</th>
<th className="py-2.5 px-3 font-semibold">Category</th>
<th className="py-2.5 px-3 font-semibold">Description</th>
<th className="py-2.5 px-3 font-semibold text-right">Amount (KES)</th>
<th className="py-2.5 px-3 font-semibold text-center">Status</th>
              {canApprove &&<th className="py-2.5 px-3 font-semibold text-center">Actions</th>}
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
            {filteredCosts.length === 0 ? (
<tr>
<td colSpan={canApprove ? 6 : 5} className="py-6 text-center text-slate-400 font-sans">
                  No cost records match the selected filter.
</td>
</tr>
) : (
              filteredCosts.map((cost) => (
<tr key={cost.id} className="hover:bg-slate-50/50 transition">
<td className="py-3 px-3 font-sans">
<span className="font-semibold text-slate-900 block">{cost.vendor_name || 'Direct Site Expense'}</span>
<span className="text-[10px] text-slate-400 block font-mono tabular-nums">
                      {new Date(cost.created_at).toLocaleDateString()} {cost.invoice_ref ? `• ${cost.invoice_ref}` : ''}
</span>
</td>
<td className="py-3 px-3 font-sans">
<span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                      {cost.cost_category}
</span>
</td>
<td className="py-3 px-3 font-sans max-w-xs truncate">
<span className="text-slate-700 block truncate">{cost.description}</span>
                    {cost.receipts && cost.receipts.length > 0 && cost.receipts[0] && (
<span className="text-[10px] text-emerald-600 block mt-0.5">
                         {cost.receipts[0].filename}
</span>
)}
</td>
<td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatKes(cost.amount)}
</td>
<td className="py-3 px-3 text-center font-sans">
<span
                      className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                        cost.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : cost.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : cost.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-200 text-slate-600 line-through'
}`}
                    >
                      {cost.status}
</span>
                    {cost.self_approved && (
<span className="ml-1 inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-violet-100 text-violet-800 border border-violet-200" title="Approved by the person who entered it, with a recorded reason">
                         Self-approved
</span>
)}
</td>
                  {canApprove && (
<td className="py-3 px-3 text-center font-sans">
                      {cost.status === 'PENDING' ? (
<div className="flex items-center justify-center gap-1">
<button
                            onClick={() => handleApprove(cost.id)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 transition"
                            title="Approve cost"
                          >
                             Approve
</button>
<button
                            onClick={() => handleReject(cost.id)}
                            className="px-2 py-1 text-[11px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 rounded-md border border-red-200 transition"
                            title="Reject cost"
                          >
                             Reject
</button>
</div>
) : cost.status !== 'VOIDED' ? (
<button
                          onClick={() => handleVoid(cost.id)}
                          className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition"
                          title="Void cost with audit trail"
                        >
                          Void
</button>
) : (
<span className="text-[10px] text-slate-400">Voided</span>
)}
</td>
)}
</tr>
))
)}
</tbody>
</table>
</div>

<CostCaptureModal
        isOpen={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        projectId={projectId}
        onCostCreated={handleCostCreated}
        boqItems={boqItems}
      />
{dialog.element}
</div>
);
}
