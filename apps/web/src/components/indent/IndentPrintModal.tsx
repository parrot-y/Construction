import React from 'react';
import { formatKes } from '../../ui';
import { formatDate } from '../../lib/format';
import type { MaterialRequisitionItem } from '../MaterialRequisitionView';

const fmtDate = (iso?: string | null) => formatDate(iso);

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1 border-b border-slate-200">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <span className="text-xs text-slate-900 text-right">{value ?? '—'}</span>
  </div>
);

/**
 * CB1 — printable indent document. Rendered inside a fixed overlay; the
 * @media print rules in index.css isolate [data-print-root] so window.print()
 * outputs only this document.
 */
export const IndentPrintModal: React.FC<{
  requisition: MaterialRequisitionItem;
  projectName: string;
  onClose: () => void;
}> = ({ requisition: req, projectName, onClose }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full my-8" data-print-root>
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
          <p className="text-sm font-bold text-slate-900">
            {req.indentKind === 'SERVICE' ? 'SERVICE INDENT' : 'MATERIAL INDENT'} — {req.requisitionNo}
          </p>
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg"
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
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <Row label="Project" value={projectName} />
              <Row label="Indent date" value={fmtDate(req.createdAt)} />
              <Row label="Kind" value={req.indentKind ?? 'MATERIAL'} />
              <Row label="Status" value={`${req.status.replace('_', ' ')} · ${req.fulfilment ?? 'UNFULFILLED'}`} />
            </div>
            <div>
              <Row label="Requested by" value={req.requestedBy} />
              <Row label="Approved by" value={req.approvedBy ? `${req.approvedBy} · ${fmtDate(req.approvedAt)}` : '—'} />
              <Row label="Urgency" value={req.urgency} />
              <Row label="Required by" value={fmtDate(req.requiredByDate)} />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Item</p>
            <p className="text-sm font-semibold text-slate-900">{req.materialName}</p>
            <p className="text-xs text-slate-600">{req.itemDescription}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <Row label="Quantity" value={`${req.requestedQuantity} ${req.unitOfMeasure}`} />
              {req.supplierName && <Row label="Supplier" value={req.supplierName} />}
              <Row label="Unit cost" value={formatKes(req.estimatedUnitCostKes)} />
              <Row label="Est. total" value={formatKes(req.estimatedTotalCostKes)} />
            </div>
            <div>
              <Row label="Store" value={req.storeLocation} />
              <Row label="Floor / Level" value={req.floorRef} />
              <Row label="Unit" value={req.unitRef} />
              <Row label="Work order" value={req.workOrderRef} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-8">
            <div>
              <Row label="Category" value={req.indentCategory} />
              <Row label="Material type" value={req.materialType} />
              <Row label="Subtype" value={req.materialSubType} />
            </div>
            <div>
              <Row label="Lead time" value={req.leadTimeDays != null ? `${req.leadTimeDays} days` : null} />
              <Row label="Expected delivery" value={fmtDate(req.expectedDeliveryDate)} />
              <Row label="Issued qty" value={Number(req.issuedQuantity) > 0 ? `${req.issuedQuantity} ${req.unitOfMeasure}` : null} />
            </div>
            <div>
              {req.linkedPurchaseOrders && req.linkedPurchaseOrders.length > 0 && (
                <Row label="Linked POs" value={req.linkedPurchaseOrders.map((p) => p.poNumber).join(', ')} />
              )}
            </div>
          </div>

          {req.deliverySchedule && req.deliverySchedule.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Delivery schedule</p>
              <table className="w-full text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-1.5 font-semibold text-slate-600">Batch date</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-slate-600">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {req.deliverySchedule.map((b, i) => (
                    <tr key={b.id ?? i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-800">{fmtDate(b.batchDate)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-800">{b.quantity} {req.unitOfMeasure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {req.notes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes</p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{req.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8 pt-8">
            <div>
              <div className="border-t border-slate-400 pt-1">
                <p className="text-[11px] text-slate-500">Requested by</p>
                <p className="text-xs font-semibold text-slate-800">{req.requestedBy}</p>
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">
                <p className="text-[11px] text-slate-500">Approved by</p>
                <p className="text-xs font-semibold text-slate-800">{req.approvedBy ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
