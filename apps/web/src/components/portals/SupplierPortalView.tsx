import React, { useEffect, useState} from 'react';
import { PortalLinkNotice, PortalExpiryBanner } from './PortalErrorState';

export interface SupplierDelivery {
  id: string;
  delivery_note_number: string;
  material_description: string;
  quantity: string | number;
  unit: string;
  supplier_name: string;
  status: 'PENDING' | 'RECEIVED' | 'REJECTED';
  siteDate: string;
  received_by?: string;
  notes?: string;
  delivery_status?: string;
  confirmed_at?: string | null;
  confirmed_by_name?: string | null;
  supplier_invoice_ref?: string | null;
}

export interface SupplierPoSummary {
  poNumber: string;
  totalPoCommitmentKes: string;
  deliveredGrnTotalKes: string;
  paidAmountKes: string;
  pendingPaymentKes: string;
  remainingCommitmentKes: string;
  paymentTerms: string;
}

interface SupplierPortalViewProps {
  token?: string;
  supplierName?: string;
  supplierCategory?: string;
  projectName?: string;
  projectCode?: string;
  onBackToDashboard?: () => void;
}

export default function SupplierPortalView({
  token,
  supplierName,
  supplierCategory,
  projectName,
  projectCode,
  onBackToDashboard,
}: SupplierPortalViewProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [stakeholder, setStakeholder] = useState({ name: supplierName || '', category: supplierCategory || '' });
  const [proj, setProj] = useState({ name: projectName || '', code: projectCode || '' });
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'RECEIVED' | 'PENDING'>('ALL');
  const [showPoModal, setShowPoModal] = useState(false);
  const [actionInputs, setActionInputs] = useState<Record<string, { invoiceRef: string; note: string }>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    if (!token) { setLoading(false); setLoadError('Missing portal token.'); return; }
    try {
      const res = await fetch(`/api/v1/portals/supplier/${token}`, { credentials: 'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'This portal link is invalid or has expired');
      const d = body.data || body;
      if (d.stakeholder) setStakeholder({ name: d.stakeholder.name || '', category: d.stakeholder.vendorType || '' });
      if (d.linkExpiresAt) setLinkExpiresAt(d.linkExpiresAt);
        if (d.project) setProj({ name: d.project.name || '', code: d.project.code || '' });
      setDeliveries((d.deliveries || []).map((m: any) => ({
        id: m.id,
        delivery_note_number: m.deliveryNote || m.id.slice(0, 8).toUpperCase(),
        material_description: m.materialName,
        quantity: Number(m.quantity),
        unit: m.unit,
        supplier_name: m.supplierName || stakeholder.name,
        status: m.deliveryStatus === 'CONFIRMED' ? 'RECEIVED' : m.deliveryStatus === 'DISPUTED' ? 'REJECTED' : 'PENDING',
        siteDate: m.siteDate,
        delivery_status: m.deliveryStatus,
        confirmed_at: m.confirmedAt,
        confirmed_by_name: m.confirmedByName,
        supplier_invoice_ref: m.supplierInvoiceRef,
        dispute_reason: m.disputeReason,
      })));
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const confirmDelivery = async (deliveryId: string, action: 'CONFIRM' | 'DISPUTE') => {
    setActionBusy(deliveryId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/portals/supplier/${token}/deliveries/${deliveryId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          invoiceRef: actionInputs[deliveryId]?.invoiceRef || undefined,
          note: actionInputs[deliveryId]?.note || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Action failed');
      setFeedback(action === 'CONFIRM' ? 'Delivery confirmed.' : 'Delivery disputed — the site team has been notified.');
      await load();
    } catch (e: any) {
      setFeedback(e.message || 'Network error — action not recorded.');
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-sm text-slate-400">Loading portal…</div>;
  }
  if (loadError) {
    const isExpired = /expired/i.test(loadError);
    const isRevoked = /revoked|invalid/i.test(loadError);
    return (
      <div className="max-w-5xl mx-auto">
        <PortalLinkNotice kind={isExpired ? 'expired' : isRevoked ? 'revoked' : 'error'} message={loadError} />
        {onBackToDashboard && <div className="text-center pb-8"><button onClick={onBackToDashboard} className="text-xs text-blue-600 hover:underline">Back</button></div>}
      </div>
    );
  }

  const filteredDeliveries = deliveries.filter((d) => {
    if (filter === 'ALL') return true;
    return d.status === filter;
});

  return (
<div className="max-w-5xl mx-auto space-y-6" data-testid="supplier-portal-view">
      <PortalExpiryBanner expiresAt={linkExpiresAt} />
      {/* Header */}
<header className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-2">
<span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Material Supplier &amp; Batching Portal
</span>
<span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Secured project link
</span>
</div>
<h1 className="text-xl font-bold mt-2 text-slate-900">{proj.name} ({proj.code})</h1>
<p className="text-xs text-slate-500">
            Vendor:<span className="text-slate-700 font-semibold">{stakeholder.name}</span> • {stakeholder.category}
</p>
</div>

<div className="flex items-center gap-3">
<button
            onClick={() => setShowPoModal(true)}
            data-testid="view-po-ledger-btn"
            className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 rounded-lg transition"
          >
             PO &amp; Invoicing Ledger
</button>
          {onBackToDashboard && (
<button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              ← Back to Project
</button>
)}
</div>
</header>
      {/* What you can do here */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-bold text-slate-500 mb-2">What you can do here</p>
<ul className="text-xs text-slate-600 space-y-1">
            <li>• Confirm deliveries or dispute them with a reason</li>
            <li>• Submit invoice references against confirmed deliveries</li>
            <li>• Track your purchase orders and delivery schedule</li>
</ul>
</div>


      {/* Delivery status summary — real counts from site diary records */}
{deliveries.length > 0 && (
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500">Total Deliveries</p>
<p className="text-2xl font-bold text-slate-900 mt-1">{deliveries.length}</p>
</div>
{deliveries.filter((d) => d.status === 'RECEIVED').length > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500">Confirmed by You</p>
<p className="text-2xl font-bold text-emerald-700 mt-1">{deliveries.filter((d) => d.status === 'RECEIVED').length}</p>
</div>
)}
{deliveries.filter((d) => d.status === 'PENDING').length > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500">Awaiting Confirmation</p>
<p className="text-2xl font-bold text-amber-700 mt-1">{deliveries.filter((d) => d.status === 'PENDING').length}</p>
</div>
)}
{deliveries.filter((d) => d.status === 'REJECTED').length > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500">Disputed</p>
<p className="text-2xl font-bold text-rose-700 mt-1">{deliveries.filter((d) => d.status === 'REJECTED').length}</p>
</div>
)}
</div>
)}

      {feedback && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">{feedback}</div>
)}

      <p className="text-[11px] text-slate-400">
        Purchase orders and invoice settlement are managed by the contractor's finance team.
        Confirm each delivery below so the site diary stays accurate.
      </p>

      {/* Filter and stats */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<div className="flex gap-2">
          {(['ALL', 'RECEIVED', 'PENDING'] as const).map((mode) => (
<button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
}`}
            >
              {mode === 'ALL' ? 'All Deliveries' : mode === 'RECEIVED' ? 'Site Verified' : 'Scheduled / En Route'}
</button>
))}
</div>

<p className="text-xs text-slate-500">
          Electronic delivery notes cross-checked with Site Supervisor daily diary.
</p>
</div>

      {/* Deliveries List */}
<div className="space-y-4">
        {filteredDeliveries.length === 0 && (
<div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-sm text-slate-400">
            No deliveries recorded for this project yet — purchase orders and site deliveries will appear here for confirmation.
</div>
)}
        {filteredDeliveries.map((del) => (
<div
            key={del.id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
            data-testid={`supplier-delivery-${del.delivery_note_number}`}
          >
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div className="flex items-center gap-2">
<span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {del.delivery_note_number}
</span>
<span className="text-xs text-slate-500">
                  Site Date: {new Date(del.siteDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric'})}
</span>
</div>

<span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  del.status === 'RECEIVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
}`}
              >
                {del.status === 'RECEIVED' ? 'Site Acknowledged & Cast' : 'Scheduled / Dispatched'}
</span>
</div>

<div>
<h3 className="text-sm font-bold text-slate-900">{del.material_description}</h3>
<p className="text-xs font-semibold text-slate-600 mt-0.5">
                Quantity:<span className="text-slate-900 font-bold">{del.quantity} {del.unit}</span>
</p>
</div>

            {del.notes && (
<div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
<span className="font-semibold text-slate-900">Site Inspection Note:</span> {del.notes}
</div>
)}

            {del.received_by && (
<p className="text-[11px] text-slate-500 flex items-center gap-1">
<span className="text-emerald-600 font-bold"></span> Received &amp; Slump Tested by: {del.received_by}
</p>
)}
            {del.supplier_invoice_ref && (
<p className="text-[11px] text-slate-500">Invoice ref: {del.supplier_invoice_ref}</p>
)}
            {del.status === 'PENDING' && (
<div className="space-y-2 pt-1">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
<input
                    type="text"
                    placeholder="Supplier invoice ref (optional)"
                    value={actionInputs[del.id]?.invoiceRef || ''}
                    onChange={(e) => setActionInputs((prev) => ({ ...prev, [del.id]: { ...prev[del.id], invoiceRef: e.target.value, note: prev[del.id]?.note || '' } }))}
                    className="text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
<input
                    type="text"
                    placeholder="Dispute reason (required to dispute)"
                    value={actionInputs[del.id]?.note || ''}
                    onChange={(e) => setActionInputs((prev) => ({ ...prev, [del.id]: { ...prev[del.id], note: e.target.value, invoiceRef: prev[del.id]?.invoiceRef || '' } }))}
                    className="text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
</div>
<div className="flex gap-2">
<button
                    type="button"
                    disabled={actionBusy === del.id}
                    onClick={() => confirmDelivery(del.id, 'CONFIRM')}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg disabled:opacity-50"
                  >
                    {actionBusy === del.id ? 'Saving…' : 'Confirm Delivery'}
</button>
<button
                    type="button"
                    disabled={actionBusy === del.id}
                    onClick={() => confirmDelivery(del.id, 'DISPUTE')}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                  >
                    Dispute
</button>
</div>
</div>
)}
</div>
))}
</div>

      {/* PO Invoicing Modal */}
      {showPoModal && (
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
<div className="flex justify-between items-start border-b border-slate-100 pb-3">
<div>
<span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Commercial Purchase Order Ledger
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
                  {proj.name} • Deliveries
</h3>
</div>
<button onClick={() => setShowPoModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                
</button>
</div>

<div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
            Purchase orders, GRN valuations and invoice settlement are issued and managed by the
            contractor's quantity surveyor and finance team inside Site Safi. Your confirmed
            deliveries above form the GRN record used for certification.
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">

<button
                type="button"
                onClick={() => setShowPoModal(false)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                Close
</button>
</div>
</div>
</div>
)}
</div>
);
}
