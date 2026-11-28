import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';
import { api, apiErrorMessage } from '../lib/api';
import { AmendRequisitionModal } from './indent/AmendRequisitionModal';
import { CreateRequisitionModal, type RequisitionFormPayload } from './indent/CreateRequisitionModal';
import { IndentPrintModal } from './indent/IndentPrintModal';
import { hasPermission, Permissions, type Role } from '@construction/permissions';

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
  // CB1 indent depth
  indentKind?: 'MATERIAL' | 'SERVICE';
  storeLocation?: string | null;
  floorRef?: string | null;
  unitRef?: string | null;
  workOrderRef?: string | null;
  indentCategory?: string | null;
  materialType?: string | null;
  materialSubType?: string | null;
  leadTimeDays?: number | null;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  fulfilment?: 'UNFULFILLED' | 'PO_RAISED' | 'PO_FULFILLED' | 'ISSUED' | 'FULFILLED';
  issuedQuantity?: string;
  linkedPurchaseOrders?: { id: string; poNumber: string; status: string }[];
  deliverySchedule?: { id?: string; batchDate: string; quantity: string }[];
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
      const json = await api.get<any>(`/api/v1/projects/${projectId}/material-requisitions`);
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
        indentKind: r.indentKind ?? 'MATERIAL',
        storeLocation: r.storeLocation ?? null,
        floorRef: r.floorRef ?? null,
        unitRef: r.unitRef ?? null,
        workOrderRef: r.workOrderRef ?? null,
        indentCategory: r.indentCategory ?? null,
        materialType: r.materialType ?? null,
        materialSubType: r.materialSubType ?? null,
        leadTimeDays: r.leadTimeDays ?? null,
        expectedDeliveryDate: r.expectedDeliveryDate ?? null,
        notes: r.notes ?? null,
        fulfilment: r.fulfilment ?? 'UNFULFILLED',
        issuedQuantity: r.issuedQuantity ?? '0.0000',
        linkedPurchaseOrders: r.linkedPurchaseOrders ?? [],
        deliverySchedule: r.deliverySchedule ?? [],
})));
} catch {
      setRequisitions([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const [filter, setFilter] = useState<string>('ALL');
  const [kindFilter, setKindFilter] = useState<string>('ALL');
  const [fulfilmentFilter, setFulfilmentFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [amendTarget, setAmendTarget] = useState<MaterialRequisitionItem | null>(null);
  const [printTarget, setPrintTarget] = useState<MaterialRequisitionItem | null>(null);
  const [formError, setFormError] = useState('');

  const filteredRequisitions = requisitions.filter((r) => {
    if (filter !== 'ALL' && r.status !== filter) return false;
    if (kindFilter !== 'ALL' && (r.indentKind ?? 'MATERIAL') !== kindFilter) return false;
    if (fulfilmentFilter !== 'ALL' && (r.fulfilment ?? 'UNFULFILLED') !== fulfilmentFilter) return false;
    if (storeFilter && !(r.storeLocation ?? '').toLowerCase().includes(storeFilter.toLowerCase())) return false;
    return true;
});

  const totalCount = requisitions.length;
  const pendingCount = requisitions.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const approvedCount = requisitions.filter((r) => r.status === 'APPROVED' || r.status === 'PO_ISSUED').length;
  const totalEstimatedKes = requisitions
    .reduce((sum, r) => sum + Number(r.estimatedTotalCostKes || 0), 0);

  const handleCreatePayload = async (p: RequisitionFormPayload): Promise<string | null> => {
    const newReqNo = `REQ-2026-${String(requisitions.length + 1).padStart(3, '0')}`;
    const payload = { requisitionNo: newReqNo, ...p };

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/material-requisitions`, payload);
        await reload();
        return null;
} catch (err) {
        return apiErrorMessage(err, 'Could not save the requisition.');
}
}

    if (onCreateRequisition) {
      await onCreateRequisition(payload);
} else {
      const totalCost = (parseFloat(p.requestedQuantity) * parseFloat(p.estimatedUnitCostKes)).toFixed(2);
      const newReq: MaterialRequisitionItem = {
        id: `req-${Date.now()}`,
        requisitionNo: newReqNo,
        materialName: p.itemDescription,
        itemDescription: p.itemDescription,
        unitOfMeasure: p.unitOfMeasure,
        requestedQuantity: p.requestedQuantity,
        estimatedUnitCostKes: p.estimatedUnitCostKes,
        estimatedTotalCostKes: totalCost,
        urgency: p.urgency,
        requiredByDate: p.requiredByDate,
        supplierName: p.supplierName,
        status: 'PENDING_APPROVAL',
        requestedBy: p.requestedBy,
        createdAt: new Date().toISOString(),
};
      setRequisitions([newReq, ...requisitions]);
}
    return null;
};

  const role = userRole as Role;
  const canCreate = hasPermission(role, Permissions.COST_CREATE);
  const canApprove = hasPermission(role, Permissions.COST_APPROVE);
  const canAmend = (r: MaterialRequisitionItem) =>
    canApprove && r.status !== 'REJECTED' && r.fulfilment !== 'FULFILLED';

  const fulfilmentStyle = (f?: string) =>
    f === 'FULFILLED' ? 'bg-emerald-100 text-emerald-800'
    : f === 'ISSUED' ? 'bg-teal-100 text-teal-800'
    : f === 'PO_FULFILLED' ? 'bg-indigo-100 text-indigo-800'
    : f === 'PO_RAISED' ? 'bg-blue-100 text-blue-800'
    : 'bg-slate-100 text-slate-700';

  const fulfilmentLabel = (f?: string) =>
    (f ?? 'UNFULFILLED').replace('_', ' ');

  const handleStatusChange = async (reqId: string, newStatus: 'APPROVED' | 'PO_ISSUED' | 'REJECTED') => {
    if (isLive) {
      try {
        await api.patch(`/api/v1/projects/${projectId}/material-requisitions/${reqId}`, { status: newStatus, approvedBy: null, rejectionReason: null});
        setFormError('');
        await reload(); return;
} catch (err) {
        setFormError(apiErrorMessage(err, 'Status change failed.'));
        return;
}
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
{canCreate && (
<button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
<span>+</span> New Material Request
</button>
)}
</div>

      {formError && (
<p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{formError}</p>
)}

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
            aria-pressed={filter === tab}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filter === tab
                ? 'bg-amber-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
}`}
          >
            {tab.replace('_', ' ')}
</button>
))}
</div>

      {/* CB1 filters — kind, fulfilment bucket, store */}
<div className="flex flex-wrap gap-2 items-center text-sm">
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          aria-label="Indent kind"
          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
        >
<option value="ALL">All kinds</option>
<option value="MATERIAL">Material</option>
<option value="SERVICE">Service</option>
</select>
        <select
          value={fulfilmentFilter}
          onChange={(e) => setFulfilmentFilter(e.target.value)}
          aria-label="Fulfilment"
          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
        >
<option value="ALL">All fulfilment</option>
<option value="UNFULFILLED">Unfulfilled</option>
<option value="PO_RAISED">PO raised</option>
<option value="PO_FULFILLED">PO fulfilled</option>
<option value="ISSUED">Part issued</option>
<option value="FULFILLED">Fulfilled</option>
</select>
        <input
          type="text"
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          placeholder="Store…"
          aria-label="Filter by store"
          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs w-32"
        />
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
<td colSpan={8} className="py-8 text-center text-slate-600">
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
<div className="flex items-center gap-1.5">
<span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${req.indentKind === 'SERVICE' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
                        {req.indentKind ?? 'MATERIAL'}
</span>
<button
                        onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                        className="text-slate-600 hover:text-slate-700 text-xs"
                        aria-label={expandedId === req.id ? 'Hide indent details' : 'Show indent details'}
                        aria-expanded={expandedId === req.id}
                      >
                        {expandedId === req.id ? '▾' : '▸'}
</button>
</div>
<p className="font-semibold text-slate-800 mt-1">{req.materialName}</p>
<p className="text-xs text-slate-500">{req.itemDescription}</p>
                    {req.supplierName && (
<p className="text-xs text-indigo-700 mt-0.5">Supplier: {req.supplierName}</p>
)}
                    {(req.storeLocation || req.floorRef || req.unitRef || req.workOrderRef) && (
<p className="text-xs text-slate-500 mt-0.5">
                        {[req.storeLocation, req.floorRef, req.unitRef, req.workOrderRef].filter(Boolean).join(' · ')}
</p>
)}
                    {expandedId === req.id && (
<div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
                        {req.indentCategory && <p>Category: {req.indentCategory}{req.materialType ? ` · ${req.materialType}${req.materialSubType ? ` / ${req.materialSubType}` : ''}` : ''}</p>}
                        {req.leadTimeDays != null && <p>Lead time: {req.leadTimeDays} days{req.expectedDeliveryDate ? ` · Expected ${req.expectedDeliveryDate}` : ''}</p>}
                        {req.notes && <p>Notes: {req.notes}</p>}
                        {req.deliverySchedule && req.deliverySchedule.length > 0 && (
<p>
                            Delivery schedule: {req.deliverySchedule.map((b) => `${b.batchDate} ×${b.quantity}`).join(', ')}
</p>
)}
                        {req.linkedPurchaseOrders && req.linkedPurchaseOrders.length > 0 && (
<p>POs: {req.linkedPurchaseOrders.map((p) => `${p.poNumber} (${p.status})`).join(', ')}</p>
)}
                        {Number(req.issuedQuantity) > 0 && <p>Issued: {req.issuedQuantity} {req.unitOfMeasure}</p>}
                        <button
                          type="button"
                          onClick={() => setPrintTarget(req)}
                          className="mt-1 px-2 py-1 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-white"
                        >
                          Print indent
                        </button>
</div>
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
<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ml-1 ${fulfilmentStyle(req.fulfilment)}`}>
                      {fulfilmentLabel(req.fulfilment)}
</span>
</td>
<td className="py-3 px-4 text-right">
                    {canAmend(req) && isLive && (
<button
                        onClick={() => setAmendTarget(req)}
                        className="px-2 py-1 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 mr-1"
                        title="Amend material / schedule"
                      >
                        Amend
</button>
)}
                    {req.status === 'PENDING_APPROVAL' && canApprove && (
<div className="inline-flex gap-1">
<button
                          onClick={() => handleStatusChange(req.id, 'APPROVED')}
                          className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-medium"
                          title="Approve Requisition"
                        >
                          Approve
</button>
<button
                          onClick={() => handleStatusChange(req.id, 'REJECTED')}
                          className="px-2 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-medium"
                          title="Reject Requisition"
                        >
                          Reject
</button>
</div>
)}
                    {req.status === 'APPROVED' && canApprove && (
<button
                        onClick={() => handleStatusChange(req.id, 'PO_ISSUED')}
                        className="px-2 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-medium"
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
<CreateRequisitionModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreatePayload}
        />
)}


      {/* CB1 — Amend indent modal */}
      {amendTarget && (
<AmendRequisitionModal
          requisition={amendTarget}
          projectId={projectId}
          isLive={isLive}
          onClose={() => setAmendTarget(null)}
          onSaved={async () => { setAmendTarget(null); await reload(); }}
        />
)}
      {printTarget && (
<IndentPrintModal
          requisition={printTarget}
          projectName={projectName}
          onClose={() => setPrintTarget(null)}
        />
)}
</div>
);
};
