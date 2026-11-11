import React, { useState} from 'react';

interface CostCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCostCreated?: (cost: any) => void;
  boqItems?: Array<{ id: string; item_code: string; description: string}>;
}

export default function CostCaptureModal({
  isOpen,
  onClose,
  projectId,
  onCostCreated,
  boqItems = [],
}: CostCaptureModalProps): React.JSX.Element | null {
  const [costCategory, setCostCategory] = useState<'MATERIAL' | 'LABOR' | 'PLANT' | 'SUBCONTRACT' | 'PRELIMINARY'>('MATERIAL');
  const [amount, setAmount] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBoqItem, setSelectedBoqItem] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount<= 0) {
      setError('Amount must be a valid positive number in KES.');
      return;
}

    if (!description.trim()) {
      setError('A concise description of the expense is required.');
      return;
}

    setIsSubmitting(true);

    try {
      const payload: any = {
        costCategory,
        amount: parsedAmount.toFixed(2),
        vendorName: vendorName.trim() || undefined,
        invoiceRef: invoiceRef.trim() || undefined,
        description: description.trim(),
        boqItemId: selectedBoqItem || undefined,
};

      if (receiptFile) {
        payload.receipts = [
          {
            filename: receiptFile.name,
            fileSize: receiptFile.size,
            mimeType: receiptFile.type || 'application/octet-stream',
            storageKey: `receipts/${projectId}/${Date.now()}-${receiptFile.name}`,
},
        ];
}

      const res = await fetch(`/api/v1/projects/${projectId}/costs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
},
        body: JSON.stringify(payload),
});

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to log cost (HTTP ${res.status})`);
}

      const resData = await res.json();
      if (onCostCreated) {
        onCostCreated(resData.data);
}
      onClose();
} catch (err: any) {
      setError(err.message || 'Failed to submit cost entry');
} finally {
      setIsSubmitting(false);
}
};

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
<div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
<div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
<div>
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
<h3 className="font-bold text-slate-900 text-base">Log Site Cost Entry</h3>
</div>
<p className="text-xs text-slate-500 mt-0.5">
              Append-only financial ledger record. Enters in<span className="font-semibold text-amber-700">PENDING</span> status.
</p>
</div>
<button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition text-lg leading-none"
            aria-label="Close modal"
          >
            
</button>
</div>

        {/* Modal Form */}
<form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
<span className="font-bold"></span>
<span>{error}</span>
</div>
)}

          {/* Amount & Category Grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (KES)<span className="text-red-500">*</span>
</label>
<div className="relative">
<span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">KES</span>
<input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-12 pr-3 py-2 text-sm tabular-nums font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                />
</div>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Cost Category<span className="text-red-500">*</span>
</label>
<select
                value={costCategory}
                onChange={(e) => setCostCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden bg-white"
              >
<option value="MATERIAL">Materials (Cement, Steel, Aggregates)</option>
<option value="LABOR">Labor & Wages (Casuals, Fundis)</option>
<option value="PLANT">Plant & Equipment Hire</option>
<option value="SUBCONTRACT">Subcontractor Payout</option>
<option value="PRELIMINARY">Preliminaries & Permits</option>
</select>
</div>
</div>

          {/* Vendor Name & Invoice Ref */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor / Payee Name
</label>
<input
                type="text"
                placeholder="e.g. Bamburi Cement Ltd, Hardi Quary"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
              />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice / Voucher Ref #
</label>
<input
                type="text"
                placeholder="e.g. INV-2026-0042, DN-901"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
              />
</div>
</div>

          {/* Linked BOQ Item (Optional) */}
          {boqItems.length > 0 && (
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to BOQ Item (Optional)
</label>
<select
                value={selectedBoqItem}
                onChange={(e) => setSelectedBoqItem(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden bg-white"
              >
<option value="">-- General Project Cost (Not linked to item) --</option>
                {boqItems.map((item) => (
<option key={item.id} value={item.id}>
                    [{item.item_code}] {item.description.slice(0, 50)}...
</option>
))}
</select>
</div>
)}

          {/* Description */}
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Description of Works / Materials<span className="text-red-500">*</span>
</label>
<textarea
              required
              rows={2}
              placeholder="Provide specific details of the expenditure, quantity purchased, and where used on site..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
            />
</div>

          {/* Receipt Photo / PDF Attachment */}
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Attach Receipt / Delivery Note (Photo or PDF)
</label>
<div className="border border-dashed border-slate-300 rounded-lg p-3 text-center hover:bg-slate-50 transition cursor-pointer">
<input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {receiptFile && (
<div className="mt-2 text-xs font-medium text-emerald-700 flex items-center justify-center gap-1">
<span> Attached: {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)</span>
</div>
)}
</div>
</div>

          {/* Submit Actions */}
<div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
<button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
</button>
<button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? 'Recording...' : ' Submit Cost for Approval'}
</button>
</div>
</form>
</div>
</div>
);
}
