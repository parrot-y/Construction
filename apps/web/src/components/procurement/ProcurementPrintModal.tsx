import React from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import { formatKes } from '../../ui';
import { formatDate } from '../../lib/format';

/**
 * CB7 — printable purchase order / goods-received note. Rendered inside a
 * fixed overlay; the @media print rules in index.css isolate [data-print-root]
 * so window.print() outputs only this document.
 */

const fmtDate = (iso?: string | null) => formatDate(iso);

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1 border-b border-slate-200">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <span className="text-xs text-slate-900 text-right">{value ?? '—'}</span>
  </div>
);

interface PoItem { id: string; description: string; unit: string; quantity: string; rate: string; lineTotal: string }
interface PoDetail {
  id: string; poNumber: string; supplierName: string | null; statusLabel: string;
  orderDate: string | null; expectedDeliveryDate: string | null;
  totalAmount: string | null; notes?: string | null; storeLocation?: string | null;
  issuedAt: string | null; items: PoItem[];
}
interface GrnDetail {
  id: string; materialName: string; quantity: string | null; unit: string | null;
  deliveryNote: string | null; storeLocation: string | null; deliveryStatus: string;
  confirmedAt: string | null; confirmedByName: string | null;
  supplierInvoiceRef: string | null; disputeReason: string | null;
  supplierName: string | null; poNumber: string | null; poStatus: string | null;
  deliveryDate: string | null; projectName: string | null; projectCode: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  RECORDED: 'Recorded', CONFIRMED: 'Confirmed', DISPUTED: 'Disputed',
};

export const ProcurementPrintModal: React.FC<{
  kind: 'PO' | 'GRN';
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  onClose: () => void;
}> = ({ kind, id, projectId, projectName, onClose }) => {
  const [po, setPo] = React.useState<PoDetail | null>(null);
  const [grn, setGrn] = React.useState<GrnDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (kind === 'PO') {
          if (!projectId) throw new Error('This purchase order has no linked project.');
          const json = await api.get<{ data?: PoDetail } | PoDetail>(`/api/v1/projects/${projectId}/purchase-orders/${id}`);
          const detail = (json as { data?: PoDetail }).data ?? (json as PoDetail);
          if (!cancelled) setPo(detail);
        } else {
          const json = await api.get<{ data?: GrnDetail } | GrnDetail>(`/api/v1/material-deliveries/${id}`);
          const detail = (json as { data?: GrnDetail }).data ?? (json as GrnDetail);
          if (!cancelled) setGrn(detail);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, id, projectId]);

  const title = kind === 'PO'
    ? `PURCHASE ORDER — ${po?.poNumber ?? '…'}`
    : `GOODS RECEIVED NOTE — ${grn?.deliveryNote ?? grn?.poNumber ?? '…'}`;
  const shownProject = kind === 'GRN' ? (grn?.projectName ?? projectName) : projectName;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full my-8" data-print-root data-testid="procurement-print-modal">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || !!error}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-600 py-8 text-center">Loading document…</p>
          ) : error ? (
            <p className="text-sm font-semibold text-rose-700 py-8 text-center">{apiErrorMessage(error, 'Failed to load the document.')}</p>
          ) : kind === 'PO' && po ? (
            <>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <Row label="Project" value={shownProject} />
                  <Row label="Supplier" value={po.supplierName} />
                  <Row label="Order date" value={fmtDate(po.orderDate)} />
                  <Row label="Expected delivery" value={fmtDate(po.expectedDeliveryDate)} />
                </div>
                <div>
                  <Row label="Status" value={po.statusLabel} />
                  <Row label="Store / site" value={po.storeLocation} />
                  <Row label="Issued at" value={fmtDate(po.issuedAt)} />
                  <Row label="Total (KES)" value={po.totalAmount != null ? formatKes(po.totalAmount) : null} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Items</p>
                <table className="w-full text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-600">Description</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Qty</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-600">Unit</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Rate (KES)</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Total (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-800">{item.description}</td>
                        <td className="px-3 py-1.5 text-right text-slate-800 tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-1.5 text-slate-600">{item.unit}</td>
                        <td className="px-3 py-1.5 text-right text-slate-800 tabular-nums">{formatKes(item.rate)}</td>
                        <td className="px-3 py-1.5 text-right text-slate-800 tabular-nums">{formatKes(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50">
                      <td colSpan={4} className="px-3 py-1.5 text-right font-bold text-slate-700">Total</td>
                      <td className="px-3 py-1.5 text-right font-bold text-slate-900 tabular-nums">{po.totalAmount != null ? formatKes(po.totalAmount) : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {po.notes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{po.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-8">
                <div>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="text-[11px] text-slate-500">Authorized by</p>
                    <p className="text-xs font-semibold text-slate-800">—</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="text-[11px] text-slate-500">Supplier acknowledgement</p>
                    <p className="text-xs font-semibold text-slate-800">—</p>
                  </div>
                </div>
              </div>
            </>
          ) : grn ? (
            <>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <Row label="Project" value={shownProject ?? grn.projectCode} />
                  <Row label="Supplier" value={grn.supplierName} />
                  <Row label="Delivery date" value={fmtDate(grn.deliveryDate)} />
                  <Row label="Store / site" value={grn.storeLocation} />
                </div>
                <div>
                  <Row label="Delivery note" value={grn.deliveryNote} />
                  <Row label="Status" value={STATUS_LABELS[grn.deliveryStatus] ?? grn.deliveryStatus} />
                  <Row label="Linked PO" value={grn.poNumber} />
                  <Row label="Supplier invoice ref" value={grn.supplierInvoiceRef} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Received material</p>
                <table className="w-full text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-600">Material</th>
                      <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Quantity</th>
                      <th className="text-left px-3 py-1.5 font-semibold text-slate-600">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-800">{grn.materialName}</td>
                      <td className="px-3 py-1.5 text-right text-slate-800 tabular-nums">{grn.quantity ?? '—'}</td>
                      <td className="px-3 py-1.5 text-slate-600">{grn.unit ?? '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <Row label="Confirmed by" value={grn.confirmedByName ? `${grn.confirmedByName} · ${fmtDate(grn.confirmedAt)}` : null} />
                </div>
                <div>
                  {grn.disputeReason && <Row label="Dispute" value={grn.disputeReason} />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8">
                <div>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="text-[11px] text-slate-500">Received by (site)</p>
                    <p className="text-xs font-semibold text-slate-800">—</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="text-[11px] text-slate-500">Supplier acknowledgement</p>
                    <p className="text-xs font-semibold text-slate-800">—</p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
