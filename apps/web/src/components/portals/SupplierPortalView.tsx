import React, { useEffect, useState} from 'react';
import { PortalLinkNotice, PortalExpiryBanner, portalErrorKind, type PortalLinkKind } from './PortalErrorState';
import { PRODUCT_NAME } from '../../lib/product';
import { formatKes, SavedDataNotice, formatDate } from '../../ui';
import { fetchJsonCached } from '../../services/offline-cache';

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

interface SupplierPoItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
}

interface SupplierPoInvoice {
  id: string;
  reference: string;
  amount: string;
  status: string;
  note?: string | null;
  createdAt: string;
}

interface SupplierPurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  statusLabel: string;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  totalAmount: string;
  items: SupplierPoItem[];
  invoices: SupplierPoInvoice[];
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
}: SupplierPortalViewProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PortalLinkKind>('error');
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [stakeholder, setStakeholder] = useState({ name: supplierName || '', category: supplierCategory || '' });
  const [proj, setProj] = useState({ name: projectName || '', code: projectCode || '' });
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'RECEIVED' | 'REJECTED'>('ALL');
  const [showPoModal, setShowPoModal] = useState(false);
  const [actionInputs, setActionInputs] = useState<Record<string, { invoiceRef: string; note: string }>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<SupplierPurchaseOrder[]>([]);
  const [poBusy, setPoBusy] = useState<string | null>(null);
  const [acceptDate, setAcceptDate] = useState<Record<string, string>>({});
  const [invForm, setInvForm] = useState<Record<string, { reference: string; amount: string; itemId: string; note: string; open: boolean }>>({});
  const [showAllPos, setShowAllPos] = useState(false);
  const [showFinishedPos, setShowFinishedPos] = useState(false);
  const [showConfirmedDeliveries, setShowConfirmedDeliveries] = useState(false);
  const [showAllDeliveries, setShowAllDeliveries] = useState(false);
  const PAGE_SIZE = 10;

  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = async () => {
    if (!token) { setLoading(false); setLoadError('Missing portal token.'); return; }
    try {
      const { body, savedAt: staleAt } = await fetchJsonCached(
        `/api/v1/portals/supplier/${token}`,
        `portal:supplier:${token}`,
      );
      if (staleAt) setSavedAt(staleAt);
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
      setPurchaseOrders(d.purchaseOrders || []);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load portal'); setErrorKind(portalErrorKind(e));
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

  const acceptPo = async (poId: string) => {
    const expectedDeliveryDate = acceptDate[poId];
    if (!expectedDeliveryDate) { setFeedback('Pick an expected delivery date first.'); return; }
    setPoBusy(poId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/portals/supplier/${token}/purchase-orders/${poId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedDeliveryDate }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Accept failed');
      setFeedback('Purchase order accepted — the contractor has been notified.');
      await load();
    } catch (e: any) {
      setFeedback(e.message || 'Network error — acceptance not recorded.');
    } finally {
      setPoBusy(null);
    }
  };

  const submitPoInvoice = async (poId: string) => {
    const f = invForm[poId];
    if (!f?.reference?.trim() || !f?.amount) { setFeedback('Invoice reference and amount are required.'); return; }
    setPoBusy(poId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/portals/supplier/${token}/purchase-orders/${poId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: f.reference.trim(),
          amount: Number(f.amount),
          purchaseOrderItemId: f.itemId || null,
          note: f.note || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Invoice submission failed');
      setFeedback('Invoice submitted — the contractor will review it against deliveries.');
      setInvForm((prev) => ({ ...prev, [poId]: { reference: '', amount: '', itemId: '', note: '', open: false } }));
      await load();
    } catch (e: any) {
      setFeedback(e.message || 'Network error — invoice not submitted.');
    } finally {
      setPoBusy(null);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-sm text-slate-400">Loading portal…</div>;
  }
  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto">
        <PortalLinkNotice kind={errorKind} message={loadError || undefined} />
      </div>
    );
  }

  // Action-first ordering: things awaiting the supplier float to the top;
  // completed records collapse behind a count / "show more".
  const actionPos = purchaseOrders.filter((po) => po.status === 'ISSUED');
  const settledPos = purchaseOrders.filter((po) => po.status !== 'ISSUED');
  // J3: truly finished orders collapse behind a count — the page was
  // ~10,000px on a phone. Still-open settled orders (accepted, part
  // delivered) stay visible because they may still need an invoice.
  const isFinishedPo = (po: SupplierPurchaseOrder) => ['DELIVERED', 'CLOSED', 'CANCELLED'].includes(po.status);
  const openSettledPos = settledPos.filter((po) => !isFinishedPo(po));
  const finishedPos = settledPos.filter(isFinishedPo);
  const pendingDeliveries = deliveries.filter((d) => d.status === 'PENDING');
  const settledDeliveries = deliveries.filter((d) => d.status !== 'PENDING');
  const filteredSettled = settledDeliveries.filter((d) => {
    if (filter === 'ALL') return true;
    if (filter === 'RECEIVED') return d.status === 'RECEIVED';
    if (filter === 'REJECTED') return d.status === 'REJECTED';
    return true;
  });

  // An invoice is only "due" while the PO still has uninvoiced value —
  // accepted-but-fully-invoiced orders must not show a Submit invoice button.
  const invoiceStillDue = (po: SupplierPurchaseOrder): boolean => {
    if (!['ACCEPTED', 'PART_DELIVERED', 'DELIVERED'].includes(po.status)) return false;
    const invoiced = po.invoices
      .filter((iv) => iv.status !== 'REJECTED')
      .reduce((sum, iv) => sum + Number(iv.amount || 0), 0);
    return Number(po.totalAmount) - invoiced > 0.004;
  };

  const renderPoCard = (po: SupplierPurchaseOrder) => {
    const f = invForm[po.id] || { reference: '', amount: '', itemId: '', note: '', open: false };
    const canInvoice = invoiceStillDue(po);
    const canAccept = po.status === 'ISSUED';
    return (
<div key={po.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4" data-testid={`supplier-po-${po.poNumber}`}>
<div className="flex flex-wrap items-start justify-between gap-2">
<div>
<div className="flex items-center gap-2">
<span className="tabular-nums font-bold text-slate-900">{po.poNumber}</span>
<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{po.statusLabel}</span>
</div>
<p className="text-[11px] text-slate-500 mt-1">
                      Ordered {po.orderDate ? formatDate(po.orderDate) : '—'}
                      {po.expectedDeliveryDate ? ` · expected ${formatDate(po.expectedDeliveryDate)}` : ''}
</p>
</div>
<span className="tabular-nums font-bold text-slate-900">{formatKes(po.totalAmount)}</span>
</div>

<ul className="mt-3 space-y-1">
                  {po.items.map((it) => (
<li key={it.id} className="text-xs text-slate-600 flex justify-between gap-3">
<span>{it.description} <span className="text-slate-400">({it.unit})</span></span>
<span className="font-mono tabular-nums">{it.quantity} × {formatKes(it.rate)}</span>
</li>
))}
</ul>

                {po.invoices.length > 0 && (
<div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                    {po.invoices.map((iv) => (
<div key={iv.id} className="flex items-center justify-between text-[11px]">
<span className="font-mono tabular-nums text-slate-700">{iv.reference}</span>
<span className="text-slate-500">
                          {formatKes(iv.amount)} · {iv.status === 'ACCEPTED' ? 'Accepted' : iv.status === 'REJECTED' ? 'Rejected' : iv.status === 'REVIEW_REQUIRED' ? 'Under review' : 'Submitted'}
</span>
</div>
))}
</div>
)}

                {canAccept && (
<div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2" data-testid={`po-accept-${po.poNumber}`}>
<label className="text-[11px] font-semibold text-slate-600">
                      Expected delivery date
<input
                        type="date"
                        className="mt-1 block px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                        value={acceptDate[po.id] || ''}
                        onChange={(e) => setAcceptDate((prev) => ({ ...prev, [po.id]: e.target.value }))}
                        data-testid={`po-accept-date-${po.poNumber}`}
                      />
</label>
<button
                      type="button"
                      disabled={poBusy === po.id}
                      onClick={() => void acceptPo(po.id)}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50"
                      data-testid={`po-accept-submit-${po.poNumber}`}
                    >
                      {poBusy === po.id ? 'Accepting…' : 'Accept PO'}
</button>
</div>
)}

                {canInvoice && (
<div className="mt-3 pt-3 border-t border-slate-100">
                    {!f.open ? (
<button
                        type="button"
                        onClick={() => setInvForm((prev) => ({ ...prev, [po.id]: { reference: '', amount: '', itemId: '', note: '', open: true } }))}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50"
                        data-testid={`po-invoice-open-${po.poNumber}`}
                      >
                        {po.invoices.some((iv) => iv.status !== 'REJECTED') ? 'Submit another invoice' : 'Submit invoice'}
</button>
) : (
<div className="space-y-2" data-testid={`po-invoice-form-${po.poNumber}`}>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
<input
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                            placeholder="Invoice reference *"
                            value={f.reference}
                            onChange={(e) => setInvForm((prev) => ({ ...prev, [po.id]: { ...f, reference: e.target.value } }))}
                            data-testid={`po-invoice-ref-${po.poNumber}`}
                          />
<input
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                            type="number" min="0" step="0.01"
                            placeholder="Amount (KES) *"
                            value={f.amount}
                            onChange={(e) => setInvForm((prev) => ({ ...prev, [po.id]: { ...f, amount: e.target.value } }))}
                            data-testid={`po-invoice-amount-${po.poNumber}`}
                          />
<select
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                            value={f.itemId}
                            onChange={(e) => setInvForm((prev) => ({ ...prev, [po.id]: { ...f, itemId: e.target.value } }))}
                            data-testid={`po-invoice-item-${po.poNumber}`}
                          >
                            <option value="">Whole PO (unallocated)</option>
                            {po.items.map((it) => <option key={it.id} value={it.id}>{it.description}</option>)}
</select>
</div>
<input
                          className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                          placeholder="Note (optional)"
                          value={f.note}
                          onChange={(e) => setInvForm((prev) => ({ ...prev, [po.id]: { ...f, note: e.target.value } }))}
                        />
<div className="flex gap-2">
<button
                            type="button"
                            disabled={poBusy === po.id}
                            onClick={() => void submitPoInvoice(po.id)}
                            className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
                            data-testid={`po-invoice-submit-${po.poNumber}`}
                          >
                            {poBusy === po.id ? 'Submitting…' : po.invoices.some((iv) => iv.status !== 'REJECTED') ? 'Submit another invoice' : 'Submit invoice'}
</button>
<button
                            type="button"
                            onClick={() => setInvForm((prev) => ({ ...prev, [po.id]: { ...f, open: false } }))}
                            className="px-3 py-1.5 text-[11px] font-bold text-slate-500"
                          >
                            Cancel
</button>
</div>
</div>
)}
</div>
)}

                {!canInvoice && !canAccept && ['ACCEPTED', 'PART_DELIVERED', 'DELIVERED'].includes(po.status) && (() => {
                  const submitted = po.invoices.filter((iv) => iv.status !== 'REJECTED');
                  const latest = submitted[submitted.length - 1];
                  if (!latest) return null;
                  const invLabel = latest.status === 'ACCEPTED' ? 'Accepted' : latest.status === 'REJECTED' ? 'Rejected' : latest.status === 'REVIEW_REQUIRED' ? 'Under review' : 'Submitted';
                  return (
<div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2" data-testid={`po-invoice-submitted-${po.poNumber}`}>
<span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Invoice submitted
</span>
<span className="text-[11px] text-slate-500">
                        {latest.reference} · {formatKes(latest.amount)} · {invLabel} — awaiting contractor review
</span>
</div>
                  );
                })()}
</div>
    );
  };

  const renderDeliveryCard = (del: SupplierDelivery) => (
<div
      key={del.id}
      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
      data-testid={`supplier-delivery-${del.delivery_note_number}`}
    >
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div className="flex items-center gap-2">
<span className="font-mono tabular-nums text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                {del.delivery_note_number}
</span>
<span className="text-xs text-slate-500">
                Site Date: {formatDate(del.siteDate)}
</span>
</div>

<span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            del.status === 'RECEIVED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : del.status === 'REJECTED'
              ? 'bg-rose-100 text-rose-800 border border-rose-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}
        >
          {del.status === 'RECEIVED' ? 'Site Acknowledged & Cast' : del.status === 'REJECTED' ? 'Disputed' : 'Scheduled / Dispatched'}
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
  );

  return (
<div className="w-full max-w-5xl mx-auto space-y-6" data-testid="supplier-portal-view">
      {savedAt && <SavedDataNotice savedAt={savedAt} />}
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
{pendingDeliveries.length > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500">Awaiting Confirmation</p>
<p className="text-2xl font-bold text-amber-700 mt-1">{pendingDeliveries.length}</p>
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

      {/* Needs your action — orders awaiting acceptance, deliveries awaiting confirmation */}
{(actionPos.length > 0 || pendingDeliveries.length > 0) && (
<div className="space-y-3" data-testid="supplier-action-needed">
<h2 className="text-sm font-bold text-slate-800">
            Needs your action ({actionPos.length + pendingDeliveries.length})
</h2>
          {actionPos.map(renderPoCard)}
          {pendingDeliveries.map(renderDeliveryCard)}
</div>
)}

      {/* Purchase orders — open settled orders paginated; finished ones collapsed */}
      {settledPos.length > 0 && (
<div className="space-y-3" data-testid="supplier-po-list">
<h2 className="text-sm font-bold text-slate-800">Your purchase orders</h2>
          {(showAllPos ? openSettledPos : openSettledPos.slice(0, PAGE_SIZE)).map(renderPoCard)}
          {openSettledPos.length > PAGE_SIZE && (
<button
              type="button"
              onClick={() => setShowAllPos((v) => !v)}
              className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              data-testid="show-all-pos-btn"
            >
              {showAllPos ? 'Show fewer' : `Show all ${openSettledPos.length} open orders`}
</button>
)}
          {finishedPos.length > 0 && (
<div className="pt-1">
<button
                type="button"
                onClick={() => setShowFinishedPos((v) => !v)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                data-testid="show-finished-pos-btn"
              >
                {showFinishedPos ? 'Hide completed orders' : `${finishedPos.length} completed order${finishedPos.length === 1 ? '' : 's'} — show`}
</button>
              {showFinishedPos && <div className="mt-3 space-y-3">{finishedPos.map(renderPoCard)}</div>}
</div>
)}
</div>
)}

      <p className="text-[11px] text-slate-400">
        Accept each purchase order and submit invoices against it above — the contractor's
        quantity surveyor reviews them against confirmed deliveries. Confirm each delivery
        above so the site diary stays accurate.
</p>

      {/* Delivery history — completed deliveries only, filterable + paginated */}
<div className="space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<div className="flex gap-2">
          {(['ALL', 'RECEIVED', 'REJECTED'] as const).map((mode) => (
<button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
}`}
            >
              {mode === 'ALL' ? 'All Deliveries' : mode === 'RECEIVED' ? 'Site Verified' : 'Disputed'}
</button>
))}
</div>

<p className="text-xs text-slate-500">
          Electronic delivery notes cross-checked with Site Supervisor daily diary.
</p>
</div>

        {filteredSettled.length === 0 && (
<div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-sm text-slate-400">
            {settledDeliveries.length === 0
              ? 'No completed deliveries yet — confirmed and disputed deliveries will appear here.'
              : 'No deliveries match this filter.'}
</div>
)}
        {(() => {
          const confirmedCount = filteredSettled.filter((d) => d.status === 'RECEIVED').length;
          const visible = filteredSettled.filter(
            (d) => d.status !== 'RECEIVED' || showConfirmedDeliveries || filter === 'RECEIVED',
          );
          return (
            <>
              {(showAllDeliveries ? visible : visible.slice(0, PAGE_SIZE)).map(renderDeliveryCard)}
              {confirmedCount > 0 && filter !== 'RECEIVED' && (
<button
                  type="button"
                  onClick={() => setShowConfirmedDeliveries((v) => !v)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                  data-testid="show-confirmed-deliveries-btn"
                >
                  {showConfirmedDeliveries ? 'Hide confirmed deliveries' : `${confirmedCount} confirmed deliver${confirmedCount === 1 ? 'y' : 'ies'} — show`}
</button>
              )}
              {visible.length > PAGE_SIZE && !showConfirmedDeliveries && (
<button
                type="button"
                onClick={() => setShowAllDeliveries((v) => !v)}
                className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                data-testid="show-all-deliveries-btn"
              >
                {showAllDeliveries ? 'Show fewer' : `Show all ${visible.length} deliveries`}
</button>
              )}
            </>
          );
        })()}
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
            Your purchase orders appear above — accept them and submit invoices there.
            GRN valuations and payment settlement are managed by the contractor's quantity
            surveyor and finance team inside {PRODUCT_NAME}. Your confirmed deliveries
            above form the GRN record used for certification.
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
