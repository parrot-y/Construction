import { formatKes} from '../ui';
import React, { useEffect, useState, useMemo} from 'react';
import { calculateLineTotal, Decimal} from '@construction/money';

export interface VariationItemDraft {
  id: string;
  type: 'ADDITION' | 'OMISSION';
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
  boqItemId?: string;
}

interface CreateVariationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onVariationCreated?: (variation: any) => void;
  boqItems?: Array<{ id: string; item_code: string; description: string}>;
}

const COMMON_UNITS = ['SM', 'CM', 'LM', 'KG', 'TONS', 'NO', 'ITEM', 'BAGS', 'DAYS', 'HRS'];

export default function CreateVariationModal({
  isOpen,
  onClose,
  projectId,
  projectName = '',
  onVariationCreated,
  boqItems = [],
}: CreateVariationModalProps): React.JSX.Element | null {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [triggerType, setTriggerType] = useState('OTHER');
  const [timeExtensionDays, setTimeExtensionDays] = useState('0');
  const [items, setItems] = useState<VariationItemDraft[]>([
    {
      id: 'item-1',
      type: 'ADDITION',
      description: '',
      unit: 'CM',
      quantity: '',
      unitRate: '',
},
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedRfiId, setLinkedRfiId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [rfis, setRfis] = useState<{ id: string; subject?: string; reference_no?: string; status?: string}[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; role?: string}[]>([]);

  useEffect(() => {
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return;
    fetch(`/api/v1/projects/${projectId}/rfis`, { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : { data: []}))
      .then((j) => setRfis(j.data || j || []))
      .catch(() => {});
    fetch(`/api/v1/projects/${projectId}`, { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.data || j;
        setMembers((p?.members || []).map((m: any) => ({
          id: m.id,
          name: m.user?.full_name || m.user?.email || 'Member',
          role: m.role,
})));
})
      .catch(() => {});
}, [projectId]);

  // Compute line total for each item and overall live net amount
  const itemCalculations = useMemo(() => {
    let net = new Decimal(0);
    const lineTotals = items.map((item) => {
      const rawQty = parseFloat(item.quantity);
      const rawRate = parseFloat(item.unitRate);

      if (isNaN(rawQty) || isNaN(rawRate) || rawQty === 0 || rawRate< 0) {
        return { lineTotal: new Decimal(0), formatted: formatKes(0)};
}

      const signedQty = item.type === 'OMISSION' ? -Math.abs(rawQty) : Math.abs(rawQty);
      try {
        const total = calculateLineTotal(signedQty, Math.abs(rawRate));
        net = net.plus(total);
        const prefix = total.isNegative() ? '-' : total.isPositive() ? '+' : '';
        return {
          lineTotal: total,
          formatted: `${prefix}${formatKes(total.abs().toString())}`,
};
} catch {
        return { lineTotal: new Decimal(0), formatted: formatKes(0)};
}
});

    return { lineTotals, netAmount: net};
}, [items]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}-${items.length + 1}`,
        type: 'ADDITION',
        description: '',
        unit: 'SM',
        quantity: '',
        unitRate: '',
},
    ]);
};

  const handleRemoveItem = (index: number) => {
    if (items.length<= 1) return;
    setItems(items.filter((_, i) => i !== index));
};

  const handleItemChange = (index: number, field: keyof VariationItemDraft, value: any) => {
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value};
}),
);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.trim().length< 3) {
      setError('Variation order title must be at least 3 characters.');
      return;
}

    if (!reason.trim() || reason.trim().length< 5) {
      setError('Detailed architectural/engineering reason must be provided (at least 5 characters).');
      return;
}

    const parsedDays = parseInt(timeExtensionDays, 10);
    if (isNaN(parsedDays) || parsedDays< 0) {
      setError('Time extension must be a non-negative number of days.');
      return;
}

    let itemIdx = 0;
    for (const item of items) {
      itemIdx++;
      if (!item.description.trim()) {
        setError(`Item #${itemIdx} requires a clear description.`);
        return;
}
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty<= 0) {
        setError(`Item #${itemIdx} quantity must be a positive number.`);
        return;
}
      const rate = parseFloat(item.unitRate);
      if (isNaN(rate) || rate< 0) {
        setError(`Item #${itemIdx} unit rate must be a non-negative rate in KES.`);
        return;
}
}

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        reason: reason.trim(),
        triggerType,
        timeExtensionDays: parsedDays,
        linkedRfiId: linkedRfiId || null,
        assigneeIds,
        items: items.map((item) => {
          const qty = Math.abs(parseFloat(item.quantity));
          const signedQty = item.type === 'OMISSION' ? `-${qty.toFixed(4)}` : `${qty.toFixed(4)}`;
          return {
            boqItemId: item.boqItemId || undefined,
            description: item.description.trim(),
            unit: item.unit,
            quantity: signedQty,
            unitRate: Math.abs(parseFloat(item.unitRate)).toFixed(4),
};
}),
};

      const res = await fetch(`/api/v1/projects/${projectId}/variations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
},
        body: JSON.stringify(payload),
});

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to submit variation order (HTTP ${res.status})`);
}

      const resData = await res.json();
      if (onVariationCreated) {
        onVariationCreated(resData.data);
}
      onClose();
} catch (err: any) {
      setError(err.message || 'Failed to submit variation order');
} finally {
      setIsSubmitting(false);
}
};

  const isNetPositive = itemCalculations.netAmount.greaterThanOrEqualTo(0);

  return (
<div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
    >
<div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 transition-all">
        {/* Header */}
<div className="flex justify-between items-start pb-4 border-b border-slate-100">
<div>
<span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full ">
              Milestone M8 • Variations Workflow
</span>
<h3 id="modal-headline" className="text-lg font-bold text-slate-900 mt-1">
              Request Variation Order (VO)
</h3>
<p className="text-xs text-slate-500">
              Formally request project additions or omissions with verified quantity takeoff for {projectName}
</p>
</div>
<button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
            aria-label="Close"
          >
            
</button>
</div>

        {error && (
<div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center justify-between">
<span> {error}</span>
<button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2">×</button>
</div>
)}

<form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Order Title, Trigger & Time Extension */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div className="sm:col-span-2">
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Change Order Title *
</label>
<input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Raft Foundation Deepening & Perimeter Wall Spec"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Trigger
</label>
<select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
              >
<option value="CLIENT_REQUEST">Client request</option>
<option value="DESIGN_CLARIFICATION">Design clarification</option>
<option value="OWNER_REQUEST">Owner request</option>
<option value="UNFORESEEN_CONDITION">Unforeseen condition</option>
<option value="CODE_COMPLIANCE">Code compliance</option>
<option value="STRUCTURAL_REVIEW">Structural review</option>
<option value="WEATHER_DELAY">Weather / delay</option>
<option value="OTHER">Other</option>
</select>
</div>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Linked RFI</label>
<select value={linkedRfiId} onChange={(e) => setLinkedRfiId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white">
<option value="">None</option>
                {rfis.map((r) =><option key={r.id} value={r.id}>{r.reference_no || r.subject || r.id.slice(0, 8)}</option>)}
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Assignees (reviewers/approvers)</label>
<select multiple size={Math.min(4, Math.max(2, members.length))} value={assigneeIds}
                onChange={(e) => setAssigneeIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white">
                {members.map((m) =><option key={m.id} value={m.id}>{m.name}{m.role ? ` · ${m.role}` : ''}</option>)}
</select>
<p className="text-[10px] text-slate-400 mt-0.5">Ctrl/Cmd-click to select multiple</p>
</div>
</div>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div className="sm:col-span-2" />
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Time Extension (Days)
</label>
<input
                type="number"
                min="0"
                value={timeExtensionDays}
                onChange={(e) => setTimeExtensionDays(e.target.value)}
                placeholder="0"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
</div>
</div>

          {/* Reason / Justification */}
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Technical Justification *
</label>
<textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cite site instruction, architect memo, or geotechnical condition warranting this scope adjustment..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
</div>

          {/* Variation Line Items Section */}
<div className="space-y-3 pt-2">
<div className="flex justify-between items-center">
<span className="text-xs font-bold text-slate-900 ">
                Scope Items (Additions &amp; Omissions)
</span>
<button
                type="button"
                onClick={handleAddItem}
                className="text-xs px-2.5 py-1 font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
              >
                + Add Item
</button>
</div>

<div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {items.map((item, index) => (
<div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                >
<div className="flex items-center justify-between gap-2">
<div className="flex items-center gap-1.5">
<span className="font-bold text-slate-600">#{index + 1}</span>
                      {/* Addition / Omission Toggle */}
<div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-white">
<button
                          type="button"
                          onClick={() => handleItemChange(index, 'type', 'ADDITION')}
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition ${
                            item.type === 'ADDITION'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
}`}
                        >
                          + Addition
</button>
<button
                          type="button"
                          onClick={() => handleItemChange(index, 'type', 'OMISSION')}
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition ${
                            item.type === 'OMISSION'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
}`}
                        >
                          - Omission
</button>
</div>
</div>

<div className="flex items-center gap-2">
<span className="font-mono font-bold text-slate-800">
                        Line Total: {itemCalculations.lineTotals[index]?.formatted || formatKes(0)}
</span>
                      {items.length > 1 && (
<button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded"
                          title="Remove item"
                        >
                          
</button>
)}
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
<div className="sm:col-span-2">
<input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Item description (e.g. Extra over excavation in rock)"
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                      />
</div>
<div>
<select
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                      >
                        {COMMON_UNITS.map((u) => (
<option key={u} value={u}>
                            {u}
</option>
))}
</select>
</div>
                    {boqItems.length > 0 && (
<div>
<select
                          value={item.boqItemId || ''}
                          onChange={(e) => handleItemChange(index, 'boqItemId', e.target.value || undefined)}
                          className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                        >
<option value="">Link BOQ Item (Opt)</option>
                          {boqItems.map((b) => (
<option key={b.id} value={b.id}>
                              {b.item_code} - {b.description.substring(0, 20)}...
</option>
))}
</select>
</div>
)}
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Quantity ({item.type === 'OMISSION' ? 'Negative' : 'Positive'})
</label>
<input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                      />
</div>
<div>
<label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Unit Rate (KES)
</label>
<input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={item.unitRate}
                        onChange={(e) => handleItemChange(index, 'unitRate', e.target.value)}
                        placeholder="e.g. 3500.00"
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                      />
</div>
</div>
</div>
))}
</div>
</div>

          {/* Live Net Amount Summary Card */}
<div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
<div>
<span className="text-[10px] font-bold text-slate-400 block">
                Calculated Net Amount
</span>
<span className="text-xs text-slate-300">
                Sum of all additions and omissions
</span>
</div>
<div className="text-right">
<span
                className={`text-lg font-mono font-bold ${
                  isNetPositive ? 'text-emerald-400' : 'text-amber-400'
}`}
              >
                {isNetPositive ? '+' : '-'} {formatKes(itemCalculations.netAmount.abs().toString())}
</span>
<span className="block text-[10px] text-slate-400">
                {isNetPositive ? 'Net Budget Addition' : 'Net Budget Omission'}
</span>
</div>
</div>

          {/* Action Buttons */}
<div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
<button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
</button>
<button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Variation Order'}
</button>
</div>
</form>
</div>
</div>
);
}
