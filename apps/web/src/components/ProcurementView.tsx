import { useCallback, useEffect, useState } from 'react';
import { formatKes } from '../ui';

/**
 * Procurement — purchase orders, three-way match and supplier-invoice review.
 * API contract (apps/api/src/routes/procurement.ts):
 *  GET/POST /projects/:id/purchase-orders            (COST_VIEW / COST_CREATE)
 *  POST     /projects/:id/purchase-orders/:poId/issue (DRAFT → ISSUED, posts commitment + pending cost entry)
 *  GET      /projects/:id/purchase-orders/:poId/match (ordered/delivered/invoiced + status)
 *  POST     /projects/:id/purchase-orders/:poId/invoices/:invoiceId/review (COST_APPROVE; ACCEPT posts actuals)
 *  GET      /suppliers                               (COST_VIEW)
 */

interface PoItem {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  lineTotal: string;
}

interface PoInvoice {
  id: string;
  reference: string;
  amount: string;
  status: string;
  statusLabel: string;
  note?: string | null;
  reviewReason?: string | null;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string | null;
  status: string;
  statusLabel: string;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  totalAmount: string | null;
  notes?: string | null;
  issuedAt: string | null;
  items: PoItem[];
  invoices: PoInvoice[];
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  isActive: boolean;
}

interface MatchLine {
  itemId: string;
  description: string;
  unit: string;
  orderedQuantity: string;
  deliveredQuantity: string;
  invoicedQuantity: string;
  orderedAmount: string;
  deliveredAmount: string;
  invoicedAmount: string;
  status: string;
}

interface PoMatch {
  purchaseOrderId: string;
  poNumber: string;
  status: string;
  poStatus: string;
  orderedTotal: string;
  deliveredTotal: string;
  invoicedTotal: string;
  unallocatedInvoicedAmount: string;
  lines: MatchLine[];
  invoices: { id: string; reference: string; amount: string; status: string }[];
}

const PO_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-blue-50 text-blue-700',
  ACCEPTED: 'bg-indigo-50 text-indigo-700',
  PART_DELIVERED: 'bg-amber-50 text-amber-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-700',
};

const MATCH_STYLES: Record<string, string> = {
  MATCHED: 'bg-emerald-100 text-emerald-800',
  PART_DELIVERED: 'bg-amber-100 text-amber-800',
  OVER_INVOICED: 'bg-rose-100 text-rose-800',
  MISMATCH: 'bg-slate-200 text-slate-700',
};

const INV_STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700',
  REVIEW_REQUIRED: 'bg-rose-50 text-rose-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-slate-200 text-slate-600',
};

const LINE_STATUS_LABELS: Record<string, string> = {
  PENDING_DELIVERY: 'Awaiting delivery',
  PART_DELIVERED: 'Part delivered',
  DELIVERED: 'Delivered',
};

interface Props {
  projectId: string;
  canManage?: boolean;
}

interface DraftLine {
  description: string;
  unit: string;
  quantity: string;
  rate: string;
}

const emptyLine = (): DraftLine => ({ description: '', unit: 'No', quantity: '1', rate: '0' });

export default function ProcurementView({ projectId, canManage = false }: Props) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [match, setMatch] = useState<PoMatch | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // create form
  const [supplierId, setSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  // invoice review form (per invoice)
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [approveOver, setApproveOver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poRes, supRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/purchase-orders`, { credentials: 'include' }),
        fetch('/api/v1/suppliers', { credentials: 'include' }),
      ]);
      if (!poRes.ok) throw new Error(`Purchase orders failed (${poRes.status})`);
      const poBody = await poRes.json();
      setPos(poBody.data || poBody || []);
      if (supRes.ok) {
        const supBody = await supRes.json();
        setSuppliers((supBody.data || supBody || []).filter((s: Supplier) => s.isActive));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const openMatch = async (poId: string) => {
    if (matchFor === poId) { setMatchFor(null); setMatch(null); return; }
    setMatchFor(poId);
    setMatch(null);
    setMatchLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/purchase-orders/${poId}/match`, { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        setMatch(body.data || body);
      }
    } finally {
      setMatchLoading(false);
    }
  };

  const createPo = async () => {
    setBusyId('create');
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/purchase-orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          expectedDeliveryDate: expectedDelivery || null,
          notes: notes || null,
          items: lines
            .filter((l) => l.description.trim())
            .map((l) => ({
              description: l.description.trim(),
              unit: l.unit.trim() || 'No',
              quantity: Number(l.quantity) || 0,
              rate: Number(l.rate) || 0,
            })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Create failed (${res.status})`);
      setShowCreate(false);
      setSupplierId(''); setExpectedDelivery(''); setNotes(''); setLines([emptyLine()]);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create purchase order');
    } finally {
      setBusyId(null);
    }
  };

  const issuePo = async (po: PurchaseOrder) => {
    setBusyId(po.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/purchase-orders/${po.id}/issue`, {
        method: 'POST', credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Issue failed (${res.status})`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to issue purchase order');
    } finally {
      setBusyId(null);
    }
  };

  const reviewInvoice = async (po: PurchaseOrder, invoice: PoInvoice, action: 'ACCEPT' | 'REJECT') => {
    setBusyId(invoice.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/projects/${projectId}/purchase-orders/${po.id}/invoices/${invoice.id}/review`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            reason: reviewReason || null,
            approveOverInvoice: approveOver || undefined,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Review failed (${res.status})`);
      setReviewFor(null); setReviewReason(''); setApproveOver(false);
      await load();
      if (matchFor === po.id) {
        setMatchLoading(true);
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/purchase-orders/${po.id}/match`, { credentials: 'include' });
          if (res.ok) {
            const body = await res.json();
            setMatch(body.data || body);
          }
        } finally {
          setMatchLoading(false);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to review invoice');
    } finally {
      setBusyId(null);
    }
  };

  const setLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const draftTotal = lines.reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading purchase orders…</div>;
  }

  return (
    <div className="space-y-4" data-testid="procurement-view">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Procurement</h2>
          <p className="text-xs text-slate-500">Purchase orders, deliveries and supplier invoices — three-way match.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
            data-testid="new-po-btn"
          >
            {showCreate ? 'Close' : 'New purchase order'}
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm" data-testid="procurement-error">{error}</div>}

      {showCreate && canManage && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3" data-testid="po-create-form">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Supplier
              <select
                className="mt-1 w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                data-testid="po-supplier-select"
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Expected delivery
              <input type="date" className="mt-1 w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Notes
              <input className="mt-1 w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <input
                  className="col-span-5 px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  placeholder="Line description"
                  value={l.description}
                  onChange={(e) => setLine(idx, { description: e.target.value })}
                  data-testid={`po-line-desc-${idx}`}
                />
                <input
                  className="col-span-2 px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  placeholder="Unit"
                  value={l.unit}
                  onChange={(e) => setLine(idx, { unit: e.target.value })}
                />
                <input
                  className="col-span-2 px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  type="number" min="0" step="0.01"
                  placeholder="Qty"
                  value={l.quantity}
                  onChange={(e) => setLine(idx, { quantity: e.target.value })}
                  data-testid={`po-line-qty-${idx}`}
                />
                <input
                  className="col-span-2 px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                  type="number" min="0" step="0.01"
                  placeholder="Rate (KES)"
                  value={l.rate}
                  onChange={(e) => setLine(idx, { rate: e.target.value })}
                  data-testid={`po-line-rate-${idx}`}
                />
                <button
                  type="button"
                  className="col-span-1 text-xs text-rose-600 font-bold"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={lines.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-bold text-brand-700"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              data-testid="po-add-line"
            >
              + Add line
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-sm font-bold text-slate-800">Total: {formatKes(draftTotal)}</span>
            <button
              type="button"
              disabled={!supplierId || !lines.some((l) => l.description.trim()) || busyId === 'create'}
              onClick={() => void createPo()}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50"
              data-testid="po-create-submit"
            >
              {busyId === 'create' ? 'Creating…' : 'Create draft PO'}
            </button>
          </div>
        </div>
      )}

      {pos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No purchase orders yet.{canManage ? ' Create one to start procurement.' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po) => (
            <div key={po.id} className="bg-white rounded-xl border border-slate-200 shadow-sm" data-testid={`po-card-${po.poNumber}`}>
              <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900">{po.poNumber}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PO_STATUS_STYLES[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.statusLabel}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{po.supplierName || 'Unknown supplier'}</p>
                  {po.items.length > 0 && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={po.items.map((i) => i.description).join(' · ')}>
                      {po.items.slice(0, 2).map((i) => i.description).join(' · ')}{po.items.length > 2 ? ` +${po.items.length - 2} more` : ''}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {po.items.length} line{po.items.length === 1 ? '' : 's'}
                    {po.expectedDeliveryDate ? ` · expected ${po.expectedDeliveryDate}` : ''}
                    {po.issuedAt ? ` · issued ${String(po.issuedAt).slice(0, 10)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-slate-900">{po.totalAmount ? formatKes(po.totalAmount) : '—'}</p>
                  <div className="flex gap-2 mt-2 justify-end">
                    <button
                      type="button"
                      onClick={() => void openMatch(po.id)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      data-testid={`po-match-btn-${po.poNumber}`}
                    >
                      {matchFor === po.id ? 'Hide match' : 'Three-way match'}
                    </button>
                    {canManage && po.status === 'DRAFT' && (
                      <button
                        type="button"
                        disabled={busyId === po.id}
                        onClick={() => void issuePo(po)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
                        data-testid={`po-issue-btn-${po.poNumber}`}
                      >
                        {busyId === po.id ? 'Issuing…' : 'Issue to supplier'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {matchFor === po.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/60" data-testid={`po-match-${po.poNumber}`}>
                  {matchLoading ? (
                    <p className="text-xs text-slate-500">Loading match…</p>
                  ) : match ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${MATCH_STYLES[match.status] || 'bg-slate-200 text-slate-700'}`} data-testid="po-match-status">
                          {match.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Ordered {match.orderedTotal} · Delivered {match.deliveredTotal} · Invoiced {match.invoicedTotal}
                          {Number(match.unallocatedInvoicedAmount) > 0 ? ` · Unallocated ${match.unallocatedInvoicedAmount}` : ''}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200">
                              <th className="py-1.5 pr-3">Item</th>
                              <th className="py-1.5 pr-3">Ordered</th>
                              <th className="py-1.5 pr-3">Delivered</th>
                              <th className="py-1.5 pr-3">Invoiced</th>
                              <th className="py-1.5 pr-3">Ordered amt</th>
                              <th className="py-1.5 pr-3">Delivered amt</th>
                              <th className="py-1.5 pr-3">Invoiced amt</th>
                              <th className="py-1.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {match.lines.map((l) => (
                              <tr key={l.itemId}>
                                <td className="py-1.5 pr-3 font-medium text-slate-800">{l.description}</td>
                                <td className="py-1.5 pr-3 font-mono">{l.orderedQuantity} {l.unit}</td>
                                <td className="py-1.5 pr-3 font-mono">{l.deliveredQuantity} {l.unit}</td>
                                <td className="py-1.5 pr-3 font-mono">{l.invoicedQuantity} {l.unit}</td>
                                <td className="py-1.5 pr-3 font-mono">{l.orderedAmount}</td>
                                <td className="py-1.5 pr-3 font-mono">{l.deliveredAmount}</td>
                                <td className="py-1.5 pr-3 font-mono">{l.invoicedAmount}</td>
                                <td className="py-1.5 text-slate-600">{LINE_STATUS_LABELS[l.status] || l.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {match.invoices.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Supplier invoices</p>
                          {match.invoices.map((inv) => {
                            const full = po.invoices.find((i) => i.id === inv.id);
                            const reviewable = full && ['SUBMITTED', 'REVIEW_REQUIRED'].includes(full.status);
                            return (
                              <div key={inv.id} className="bg-white rounded-lg border border-slate-200 p-3" data-testid={`po-invoice-${inv.reference}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-800">{inv.reference}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${INV_STATUS_STYLES[full?.status || inv.status] || 'bg-slate-100'}`}>
                                      {full?.statusLabel || inv.status}
                                    </span>
                                  </div>
                                  <span className="font-mono text-sm font-bold text-slate-900">{formatKes(inv.amount)}</span>
                                </div>
                                {full?.reviewReason && <p className="text-[11px] text-rose-600 mt-1">Review note: {full.reviewReason}</p>}
                                {full?.note && <p className="text-[11px] text-slate-500 mt-1">{full.note}</p>}

                                {canManage && reviewable && reviewFor !== inv.id && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      type="button"
                                      onClick={() => { setReviewFor(inv.id); setApproveOver(false); }}
                                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white"
                                      data-testid={`invoice-accept-${inv.reference}`}
                                    >
                                      Review &amp; accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setReviewFor(inv.id); }}
                                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50"
                                      data-testid={`invoice-reject-${inv.reference}`}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}

                                {canManage && reviewFor === inv.id && (
                                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-2" data-testid={`invoice-review-form-${inv.reference}`}>
                                    <input
                                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                                      placeholder="Review reason (required for over-invoice approval / rejection)"
                                      value={reviewReason}
                                      onChange={(e) => setReviewReason(e.target.value)}
                                      data-testid="invoice-review-reason"
                                    />
                                    <label className="flex items-center gap-2 text-[11px] text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={approveOver}
                                        onChange={(e) => setApproveOver(e.target.checked)}
                                        data-testid="invoice-approve-over"
                                      />
                                      Approve over-invoice (invoice exceeds PO total — posts actuals anyway)
                                    </label>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={busyId === inv.id}
                                        onClick={() => void reviewInvoice(po, full!, 'ACCEPT')}
                                        className="px-3 py-1 text-[11px] font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50"
                                        data-testid="invoice-review-accept-submit"
                                      >
                                        Accept invoice
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyId === inv.id}
                                        onClick={() => void reviewInvoice(po, full!, 'REJECT')}
                                        className="px-3 py-1 text-[11px] font-bold rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                        data-testid="invoice-review-reject-submit"
                                      >
                                        Reject invoice
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Match data unavailable.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
