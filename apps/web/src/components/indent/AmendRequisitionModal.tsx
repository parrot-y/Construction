import React, { useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import type { MaterialRequisitionItem } from '../MaterialRequisitionView';
import { DeliveryScheduleEditor, type ScheduleRow } from './DeliveryScheduleEditor';

/** CB1 — amend-material dialog: mandatory reason, editable indent fields,
 *  and delivery-schedule replacement. Mirrors the API amend contract. */
export const AmendRequisitionModal: React.FC<{
  requisition: MaterialRequisitionItem;
  projectId: string;
  isLive: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}> = ({ requisition: req, projectId, isLive, onClose, onSaved }) => {
  const [reason, setReason] = useState('');
  const [itemDescription, setItemDescription] = useState(req.itemDescription);
  const [requestedQuantity, setRequestedQuantity] = useState(req.requestedQuantity);
  const [unitOfMeasure, setUnitOfMeasure] = useState(req.unitOfMeasure);
  const [storeLocation, setStoreLocation] = useState(req.storeLocation ?? '');
  const [floorRef, setFloorRef] = useState(req.floorRef ?? '');
  const [unitRef, setUnitRef] = useState(req.unitRef ?? '');
  const [workOrderRef, setWorkOrderRef] = useState(req.workOrderRef ?? '');
  const [indentCategory, setIndentCategory] = useState(req.indentCategory ?? '');
  const [materialType, setMaterialType] = useState(req.materialType ?? '');
  const [materialSubType, setMaterialSubType] = useState(req.materialSubType ?? '');
  const [leadTimeDays, setLeadTimeDays] = useState(req.leadTimeDays?.toString() ?? '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(req.expectedDeliveryDate ?? '');
  const [notes, setNotes] = useState(req.notes ?? '');
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(
    (req.deliverySchedule ?? []).map((b) => ({ batchDate: b.batchDate, quantity: b.quantity })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('A reason is required for every amendment.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      reason: reason.trim(),
      itemDescription,
      requestedQuantity,
      unitOfMeasure,
      storeLocation: storeLocation || null,
      floorRef: floorRef || null,
      unitRef: unitRef || null,
      workOrderRef: workOrderRef || null,
      indentCategory: indentCategory || null,
      materialType: materialType || null,
      materialSubType: materialSubType || null,
      leadTimeDays: leadTimeDays ? parseInt(leadTimeDays, 10) : null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes: notes || null,
      deliverySchedule: scheduleRows
        .filter((r) => r.batchDate && Number(r.quantity) > 0)
        .map((r) => ({ batchDate: r.batchDate, quantity: r.quantity })),
    };
    try {
      await api.patch(`/api/v1/projects/${projectId}/material-requisitions/${req.id}/amend`, payload);
      await onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Amend failed'));
      setSaving(false);
    }
  };

  const field = 'w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900">Amend {req.requisitionNo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold" aria-label="Close amend dialog">✕</button>
        </div>
        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div>
            <label className={lbl}>Reason for amendment *</label>
            <input type="text" aria-label="Reason for amendment" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Quantity revised after design change" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Item description</label><input type="text" aria-label="Item description" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Quantity</label><input type="number" step="0.01" aria-label="Quantity" value={requestedQuantity} onChange={(e) => setRequestedQuantity(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Unit</label><input type="text" aria-label="Unit" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Store</label><input type="text" aria-label="Store" value={storeLocation} onChange={(e) => setStoreLocation(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Floor / Level</label><input type="text" aria-label="Floor / Level" value={floorRef} onChange={(e) => setFloorRef(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Unit ref</label><input type="text" aria-label="Unit ref" value={unitRef} onChange={(e) => setUnitRef(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Work order</label><input type="text" aria-label="Work order" value={workOrderRef} onChange={(e) => setWorkOrderRef(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Category</label><input type="text" aria-label="Category" value={indentCategory} onChange={(e) => setIndentCategory(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Material type</label><input type="text" aria-label="Material type" value={materialType} onChange={(e) => setMaterialType(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Material subtype</label><input type="text" aria-label="Material subtype" value={materialSubType} onChange={(e) => setMaterialSubType(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Lead time (days)</label><input type="number" min="0" aria-label="Lead time (days)" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className={field} /></div>
            <div><label className={lbl}>Expected delivery</label><input type="date" aria-label="Expected delivery" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className={field} /></div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <input type="text" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </div>
          <DeliveryScheduleEditor
            rows={scheduleRows}
            onChange={setScheduleRows}
            emptyHint="No batches — clears the schedule."
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" disabled={saving || !isLive} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save amendment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
