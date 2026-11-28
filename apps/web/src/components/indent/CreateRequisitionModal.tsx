import React, { useState } from 'react';
import { formatKes } from '../../ui';
import { DeliveryScheduleEditor } from './DeliveryScheduleEditor';

/**
 * CB1 — create-indent modal extracted from MaterialRequisitionView.
 * Owns all form state; the parent supplies the persistence callback which
 * returns an error message string on failure or null on success.
 */

export interface RequisitionFormPayload {
  itemDescription: string;
  indentKind: 'MATERIAL' | 'SERVICE';
  unitOfMeasure: string;
  requestedQuantity: string;
  estimatedUnitCostKes: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  requiredByDate: string | null;
  supplierName: string | null;
  requestedBy: string;
  storeLocation: string | null;
  floorRef: string | null;
  unitRef: string | null;
  workOrderRef: string | null;
  indentCategory: string | null;
  materialType: string | null;
  materialSubType: string | null;
  leadTimeDays: number | null;
  expectedDeliveryDate: string | null;
  notes: string | null;
  deliverySchedule: { batchDate: string; quantity: string }[];
}

interface CreateRequisitionModalProps {
  onClose: () => void;
  onSubmit: (payload: RequisitionFormPayload) => Promise<string | null>;
}

export const CreateRequisitionModal: React.FC<CreateRequisitionModalProps> = ({ onClose, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [itemDescription, setItemDescription] = useState('');
  const [indentKind, setIndentKind] = useState<'MATERIAL' | 'SERVICE'>('MATERIAL');
  const [unitOfMeasure, setUnitOfMeasure] = useState('BAGS');
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [estimatedUnitCostKes, setEstimatedUnitCostKes] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY'>('NORMAL');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  // CB1 depth fields
  const [storeLocation, setStoreLocation] = useState('');
  const [floorRef, setFloorRef] = useState('');
  const [unitRef, setUnitRef] = useState('');
  const [workOrderRef, setWorkOrderRef] = useState('');
  const [indentCategory, setIndentCategory] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [materialSubType, setMaterialSubType] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduleRows, setScheduleRows] = useState<{ batchDate: string; quantity: string }[]>([]);

  const calculatedTotal =
    (parseFloat(requestedQuantity) || 0) * (parseFloat(estimatedUnitCostKes) || 0);

  const resetForm = () => {
    setItemDescription('');
    setIndentKind('MATERIAL');
    setRequestedQuantity('');
    setEstimatedUnitCostKes('');
    setSupplierName('');
    setRequiredByDate('');
    setUrgency('NORMAL');
    setRequestedBy('');
    setStoreLocation('');
    setFloorRef('');
    setUnitRef('');
    setWorkOrderRef('');
    setIndentCategory('');
    setMaterialType('');
    setMaterialSubType('');
    setLeadTimeDays('');
    setExpectedDeliveryDate('');
    setNotes('');
    setScheduleRows([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDescription || !requestedQuantity || !estimatedUnitCostKes) return;

    setIsSubmitting(true);
    setFormError('');
    const payload: RequisitionFormPayload = {
      itemDescription,
      indentKind,
      unitOfMeasure,
      requestedQuantity,
      estimatedUnitCostKes,
      urgency,
      requiredByDate: requiredByDate || null,
      supplierName: supplierName || null,
      requestedBy: requestedBy || 'Site Officer',
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

    const err = await onSubmit(payload);
    setIsSubmitting(false);
    if (err) {
      setFormError(err);
      return;
    }
    resetForm();
    onClose();
  };

  return (
<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 className="text-lg font-bold text-slate-900">New Material Purchase Request</h3>
<button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 font-bold"
        >

</button>
</div>

<form onSubmit={handleCreate} className="space-y-4 text-sm">
{formError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{formError}</p>}
<div>
<label className="block font-medium text-slate-700 mb-1">
            Item Description / Material Name *
</label>
<input
            type="text"
            required
            placeholder="e.g. Simba Portland Cement 42.5N, River Sand, D16 Rebar"
            aria-label="Item description"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
</div>

<div>
<label className="block font-medium text-slate-700 mb-1">Indent Kind</label>
<select
            value={indentKind}
            onChange={(e) => setIndentKind(e.target.value as 'MATERIAL' | 'SERVICE')}
            aria-label="Indent kind"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
<option value="MATERIAL">Material / Asset</option>
<option value="SERVICE">Service</option>
</select>
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
              aria-label="Requested quantity"
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
              aria-label="Estimated unit cost"
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
              aria-label="Required by date"
              onChange={(e) => setRequiredByDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Requested By</label>
<input
              type="text"
              placeholder="e.g. Site Supervisor J. Mwangi"
              aria-label="Requested by"
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
            aria-label="Preferred supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
</div>

        {/* CB1 — site targeting & delivery schedule */}
<div className="rounded-lg border border-slate-200 p-3 space-y-3">
<p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Site targeting</p>
<div className="grid grid-cols-2 gap-3">
{([
              ['storeLocation', 'Store', storeLocation, setStoreLocation, 'e.g. Nairobi Main Store'],
              ['floorRef', 'Floor / Level', floorRef, setFloorRef, 'e.g. Level 3'],
              ['unitRef', 'Unit', unitRef, setUnitRef, 'e.g. Unit 12B'],
              ['workOrderRef', 'Work order', workOrderRef, setWorkOrderRef, 'e.g. WO-STR-014'],
              ['indentCategory', 'Category', indentCategory, setIndentCategory, 'e.g. STRUCTURAL'],
              ['materialType', 'Material type', materialType, setMaterialType, 'e.g. Aggregate'],
] as const).map(([key, label, val, setter, ph]) => (
<div key={key}>
<label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
<input
                  type="text"
                  value={val}
                  placeholder={ph}
                  aria-label={label}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
</div>
))}
<div>
<label className="block text-xs font-medium text-slate-600 mb-1">Material subtype</label>
<input
                  type="text"
                  value={materialSubType}
                  placeholder="e.g. Ballast"
                  aria-label="Material subtype"
                  onChange={(e) => setMaterialSubType(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
</div>
<div>
<label className="block text-xs font-medium text-slate-600 mb-1">Lead time (days)</label>
<input
                  type="number"
                  min="0"
                  value={leadTimeDays}
                  aria-label="Lead time (days)"
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
</div>
<div>
<label className="block text-xs font-medium text-slate-600 mb-1">Expected delivery</label>
<input
                  type="date"
                  value={expectedDeliveryDate}
                  aria-label="Expected delivery"
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
</div>
</div>
<div>
<label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
<input
              type="text"
              value={notes}
              aria-label="Notes"
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
</div>
</div>

        {/* Delivery schedule batches */}
<DeliveryScheduleEditor rows={scheduleRows} onChange={setScheduleRows} />

<div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
<button
            type="button"
            onClick={onClose}
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
);
};
