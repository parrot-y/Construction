import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';

export interface MaterialRequisitionItem {
  id: string;
  requisitionNo: string;
  inventoryItemId?: string | null;
  materialName: string;
  itemDescription: string;
  unitOfMeasure: string;
  requestedQuantity: string;
  estimatedUnitCostKes: string;
  estimatedTotalCostKes: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  requiredByDate?: string | null;
  supplierName?: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PO_ISSUED' | 'FULFILLED' | 'REJECTED';
  rejectionReason?: string | null;
  requestedBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface MaterialRequisitionSummary {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  totalEstimatedKes: string;
}

interface MaterialRequisitionViewProps {
  projectId: string;
  projectName?: string;
  requisitions?: MaterialRequisitionItem[];
  summary?: MaterialRequisitionSummary;
  userRole?: string;
  onCreateRequisition?: (data: any) => Promise<void>;
  onReviewRequisition?: (requisitionId: string, status: string, notes?: string) => Promise<void>;
}

export const MaterialRequisitionView: React.FC<MaterialRequisitionViewProps> = ({
  projectId,
  projectName = 'Current Project',
  requisitions: initialRequisitions,
  summary: initialSummary,
  userRole = 'PM_QS',
  onCreateRequisition,
  onReviewRequisition,
}) => {
  const [requisitions, setRequisitions] = useState<MaterialRequisitionItem[]>(
    initialRequisitions || (import.meta.env.DEV ? [
      {
        id: 'req-01',
        requisitionNo: 'REQ-2026-001',
        materialName: 'Simba Portland Cement 42.5N',
        itemDescription: 'Simba Portland Cement 42.5N for 2nd floor columns',
        unitOfMeasure: 'BAGS',
        requestedQuantity: '300.00',
        estimatedUnitCostKes: '780.00',
        estimatedTotalCostKes: '234000.00',
        urgency: 'HIGH',
        requiredByDate: '2026-11-10',
        supplierName: 'Bamburi Special Products Ltd',
        status: 'PENDING_APPROVAL',
        requestedBy: 'Site Foreman J. Mwangi',
        createdAt: '2026-11-03T08:30:00Z',
},
      {
        id: 'req-02',
        requisitionNo: 'REQ-2026-002',
        materialName: 'D16 High-Yield Rebar (Y16)',
        itemDescription: 'High yield deformed bars Y16 (12m lengths)',
        unitOfMeasure: 'TONNES',
        requestedQuantity: '8.50',
        estimatedUnitCostKes: '140000.00',
        estimatedTotalCostKes: '1190000.00',
        urgency: 'NORMAL',
        requiredByDate: '2026-11-15',
        supplierName: 'Apex Steel Kenya Ltd',
        status: 'APPROVED',
        requestedBy: 'Site Supervisor Peter Otieno',
        approvedBy: 'Lead QS David Kiprono',
        approvedAt: '2026-11-03T11:00:00Z',
        createdAt: '2026-11-02T14:15:00Z',
},
    ] : [])
);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/material-requisitions`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.requisitions || json.data || []) as any[];
      setRequisitions(list.map((r) => ({
        id: r.id,
        requisitionNo: r.requisitionNo,
        inventoryItemId: r.inventoryItemId ?? null,
        materialName: r.materialName,
        itemDescription: r.itemDescription,
        unitOfMeasure: r.unitOfMeasure,
        requestedQuantity: r.requestedQuantity?.toString?.() ?? String(r.requestedQuantity ?? 0),
        estimatedUnitCostKes: r.estimatedUnitCostKes?.toString?.() ?? String(r.estimatedUnitCostKes ?? 0),
        estimatedTotalCostKes: r.estimatedTotalCostKes?.toString?.() ?? String(r.estimatedTotalCostKes ?? 0),
        urgency: r.urgency,
        requiredByDate: r.requiredByDate ?? null,
        supplierName: r.supplierName ?? null,
        status: r.status,
        rejectionReason: r.rejectionReason ?? null,
        requestedBy: r.requestedBy,
        approvedBy: r.approvedBy ?? null,
        approvedAt: r.approvedAt ?? null,
        createdAt: r.createdAt ?? '',
})));
} catch {
      setRequisitions([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const [filter, setFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [itemDescription, setItemDescription] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('BAGS');
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [estimatedUnitCostKes, setEstimatedUnitCostKes] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY'>('NORMAL');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [requestedBy, setRequestedBy] = useState('');

  const filteredRequisitions = requisitions.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
});

  const totalCount = requisitions.length;
  const pendingCount = requisitions.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const approvedCount = requisitions.filter((r) => r.status === 'APPROVED' || r.status === 'PO_ISSUED').length;
  const totalEstimatedKes = requisitions
    .reduce((sum, r) => sum + Number(r.estimatedTotalCostKes || 0), 0);

  const calculatedTotal =
    (parseFloat(requestedQuantity) || 0) * (parseFloat(estimatedUnitCostKes) || 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDescription || !requestedQuantity || !estimatedUnitCostKes) return;

    setIsSubmitting(true);
    const newReqNo = `REQ-2026-${String(requisitions.length + 1).padStart(3, '0')}`;
    const totalCost = (parseFloat(requestedQuantity) * parseFloat(estimatedUnitCostKes)).toFixed(2);

    const payload = {
      requisitionNo: newReqNo,
      itemDescription,
      unitOfMeasure,
      requestedQuantity,
      estimatedUnitCostKes,
      urgency,
      requiredByDate: requiredByDate || null,
      supplierName: supplierName || null,
      requestedBy: requestedBy || 'Site Officer',
};

    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/material-requisitions`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
});
        if (res.ok) {
          await reload();
          setIsSubmitting(false);
          setIsModalOpen(false);
          setItemDescription('');
          setRequestedQuantity('');
          setEstimatedUnitCostKes('');
          setSupplierName('');
          return;
}
} catch { /* fall through to local */}
}

    if (onCreateRequisition) {
      await onCreateRequisition(payload);
} else {
      const newReq: MaterialRequisitionItem = {
        id: `req-${Date.now()}`,
        requisitionNo: newReqNo,
        materialName: itemDescription,
        itemDescription,
        unitOfMeasure,
        requestedQuantity,
        estimatedUnitCostKes,
        estimatedTotalCostKes: totalCost,
        urgency,
        requiredByDate: requiredByDate || null,
        supplierName: supplierName || null,
        status: 'PENDING_APPROVAL',
        requestedBy: requestedBy || 'Site Officer',
        createdAt: new Date().toISOString(),
};
      setRequisitions([newReq, ...requisitions]);
}

    setIsSubmitting(false);
    setIsModalOpen(false);
    setItemDescription('');
    setRequestedQuantity('');
    setEstimatedUnitCostKes('');
    setSupplierName('');
};

  const handleStatusChange = async (reqId: string, newStatus: 'APPROVED' | 'PO_ISSUED' | 'REJECTED') => {
    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/material-requisitions/${reqId}`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ status: newStatus, approvedBy: null, rejectionReason: null}),
});
        if (res.ok) { await reload(); return;}
} catch { /* fall through to local */}
}
    if (onReviewRequisition) {
      await onReviewRequisition(reqId, newStatus);
} else {
      setRequisitions((prev) =>
        prev.map((r) =>
          r.id === reqId
            ? {
                ...r,
                status: newStatus,
                approvedBy: newStatus === 'APPROVED' ? 'Current User' : r.approvedBy,
                approvedAt: newStatus === 'APPROVED' ? new Date().toISOString() : r.approvedAt,
}
            : r
)
);
}
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading material requisitions...</div>;
}

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
<div>
<div className="flex items-center gap-2">
<span className="p-2 bg-amber-50 text-amber-700 rounded-lg text-lg"></span>
<h2 className="text-xl font-bold text-slate-900">Site Material Requisitions & Orders</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
            Store reorder workflows, bulk site purchases, and supplier RFQ orders for {projectName}
</p>
</div>
<button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
<span>+</span> New Material Request
</button>
</div>

      {/* Summary KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
<p className="text-xs font-semibold text-slate-500 ">Total Requisitions</p>
<p className="text-2xl font-bold text-slate-800 mt-1">
            {initialSummary?.totalCount ?? totalCount}
</p>
</div>
<div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
<p className="text-xs font-semibold text-amber-700 ">Pending Review</p>
<p className="text-2xl font-bold text-amber-900 mt-1">
            {initialSummary?.pendingCount ?? pendingCount}
</p>
</div>
<div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
<p className="text-xs font-semibold text-emerald-700 ">Approved / PO Issued</p>
<p className="text-2xl font-bold text-emerald-900 mt-1">
            {initialSummary?.approvedCount ?? approvedCount}
</p>
</div>
<div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
<p className="text-xs font-semibold text-indigo-700 ">Total Value (KES)</p>
<p className="text-2xl font-bold text-indigo-900 mt-1">
            {formatKes(initialSummary?.totalEstimatedKes ?? totalEstimatedKes)}
</p>
</div>
</div>

      {/* Filters */}
<div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-sm">
        {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'PO_ISSUED', 'REJECTED'] as const).map((tab) => (
<button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filter === tab
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
}`}
          >
            {tab.replace('_', ' ')}
</button>
))}
</div>

      {/* Requisitions Table */}
<div className="overflow-x-auto">
<table className="w-full text-left text-sm text-slate-600">
<thead className="bg-slate-50 text-slate-700 font-semibold text-xs border-b border-slate-200">
<tr>
<th className="py-3 px-4">Req No</th>
<th className="py-3 px-4">Item & Description</th>
<th className="py-3 px-4">Quantity</th>
<th className="py-3 px-4">Est. Unit (KES)</th>
<th className="py-3 px-4">Total Value</th>
<th className="py-3 px-4">Urgency</th>
<th className="py-3 px-4">Status</th>
<th className="py-3 px-4 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
            {filteredRequisitions.length === 0 ? (
<tr>
<td colSpan={8} className="py-8 text-center text-slate-400">
                  No material requisitions found matching selected filter.
</td>
</tr>
) : (
              filteredRequisitions.map((req) => (
<tr key={req.id} className="hover:bg-slate-50/80 transition">
<td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-900">
                    {req.requisitionNo}
</td>
<td className="py-3 px-4">
<p className="font-semibold text-slate-800">{req.materialName}</p>
<p className="text-xs text-slate-500">{req.itemDescription}</p>
                    {req.supplierName && (
<p className="text-xs text-indigo-600 mt-0.5">Supplier: {req.supplierName}</p>
)}
</td>
<td className="py-3 px-4 font-medium text-slate-900">
                    {req.requestedQuantity}<span className="text-xs text-slate-500">{req.unitOfMeasure}</span>
</td>
<td className="py-3 px-4">
                    {formatKes(req.estimatedUnitCostKes)}
</td>
<td className="py-3 px-4 font-bold text-slate-900">
                    {formatKes(req.estimatedTotalCostKes)}
</td>
<td className="py-3 px-4">
<span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        req.urgency === 'EMERGENCY'
                          ? 'bg-rose-100 text-rose-800 animate-pulse'
                          : req.urgency === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : req.urgency === 'NORMAL'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
}`}
                    >
                      {req.urgency}
</span>
</td>
<td className="py-3 px-4">
<span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'PO_ISSUED'
                          ? 'bg-indigo-100 text-indigo-800'
                          : req.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-100 text-amber-800'
                          : req.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
}`}
                    >
                      {req.status.replace('_', ' ')}
</span>
</td>
<td className="py-3 px-4 text-right">
                    {req.status === 'PENDING_APPROVAL' && (userRole === 'PM_QS' || userRole === 'ADMIN') && (
<div className="inline-flex gap-1">
<button
                          onClick={() => handleStatusChange(req.id, 'APPROVED')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                          title="Approve Requisition"
                        >
                          Approve
</button>
<button
                          onClick={() => handleStatusChange(req.id, 'REJECTED')}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium"
                          title="Reject Requisition"
                        >
                          Reject
</button>
</div>
)}
                    {req.status === 'APPROVED' && (
<button
                        onClick={() => handleStatusChange(req.id, 'PO_ISSUED')}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                      >
                        Issue PO
</button>
)}
</td>
</tr>
))
)}
</tbody>
</table>
</div>

      {/* Creation Modal */}
      {isModalOpen && (
<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 className="text-lg font-bold text-slate-900">New Material Purchase Request</h3>
<button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                
</button>
</div>

<form onSubmit={handleCreate} className="space-y-4 text-sm">
<div>
<label className="block font-medium text-slate-700 mb-1">
                  Item Description / Material Name *
</label>
<input
                  type="text"
                  required
                  placeholder="e.g. Simba Portland Cement 42.5N, River Sand, D16 Rebar"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Unit of Measure *</label>
<select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
<option value="BAGS">BAGS (50kg)</option>
<option value="TONNES">TONNES</option>
<option value="TRIPS">TRIPS (Tippers)</option>
<option value="PIECES">PIECES</option>
<option value="METRES">METRES</option>
<option value="LITRES">LITRES</option>
<option value="M3">CUBIC METRES (M³)</option>
</select>
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Urgency Priority</label>
<select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
<option value="LOW">Low</option>
<option value="NORMAL">Normal</option>
<option value="HIGH">High</option>
<option value="EMERGENCY">Emergency (Site Stopping)</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Requested Quantity *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 200"
                    value={requestedQuantity}
                    onChange={(e) => setRequestedQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Est. Unit Cost (KES) *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 780"
                    value={estimatedUnitCostKes}
                    onChange={(e) => setEstimatedUnitCostKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
</div>
</div>

              {/* Dynamic Total Preview */}
<div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex justify-between items-center">
<span className="font-semibold text-amber-900">Calculated Commitment:</span>
<span className="text-base font-bold text-amber-900 tabular-nums">{formatKes(calculatedTotal)}</span>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Required By Date</label>
<input
                    type="date"
                    value={requiredByDate}
                    onChange={(e) => setRequiredByDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Requested By</label>
<input
                    type="text"
                    placeholder="e.g. Site Supervisor J. Mwangi"
                    value={requestedBy}
                    onChange={(e) => setRequestedBy(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
</div>
</div>

<div>
<label className="block font-medium text-slate-700 mb-1">Preferred Supplier (Optional)</label>
<input
                  type="text"
                  placeholder="e.g. Bamburi Special Products, Apex Steel, Devki"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
</div>

<div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Submit Requisition'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
