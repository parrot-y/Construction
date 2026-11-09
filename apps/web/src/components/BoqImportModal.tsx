import React, { useState} from 'react';
import { formatKes } from '../ui';

export interface BOQItemPreview {
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
  totalAmount: string;
  isProvisional: boolean;
  status: 'VALID' | 'WARNING' | 'REJECTED';
  rejectionReason?: string;
}

export interface BOQSectionPreview {
  title: string;
  orderIdx: number;
  subtotal: string;
  items: BOQItemPreview[];
}

export interface BOQPreviewData {
  sourceFilename: string;
  totalSections: number;
  totalItems: number;
  validItemsCount: number;
  warningItemsCount: number;
  rejectedItemsCount: number;
  calculatedGrandTotal: string;
  sections: BOQSectionPreview[];
}

interface BoqImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (boq: any) => void;
  projectId: string;
  projectName: string;
}

export default function BoqImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  projectId,
  projectName,
}: BoqImportModalProps): React.JSX.Element | null {
  const [step, setStep] = useState<'UPLOAD' | 'PARSING' | 'PREVIEW' | 'COMMITTING'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excludeRejected, setExcludeRejected] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sample or parsed preview data
  const [previewData, setPreviewData] = useState<BOQPreviewData | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg(null);
}
};

  const handleParse = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select an Excel (.xlsx) or CSV file to parse');
      return;
    }
    setStep('PARSING');
    setErrorMsg(null);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const res = await fetch(`/api/v1/projects/${projectId}/boq/preview`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Parse failed');
      setPreviewData(json.data);
      setStep('PREVIEW');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse workbook');
      setStep('UPLOAD');
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;
    setStep('COMMITTING');
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/boq/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFilename: previewData.sourceFilename,
          sections: previewData.sections,
          excludeRejected,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Import failed');
      onImportSuccess(json.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit BOQ import');
      setStep('PREVIEW');
    }
  };


  return (
<div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
<div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 ">
                EASMM 2008 Standard Pipeline
</span>
<span className="text-xs text-slate-400">• ADR-003 Staged Import</span>
</div>
<h2 className="text-lg font-bold text-slate-900 mt-1">Import Bill of Quantities (BOQ)</h2>
<p className="text-xs text-slate-500">Project: {projectName} ({projectId})</p>
</div>
<button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
          >
            
</button>
</div>

        {/* Modal Body */}
<div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
<div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
              {errorMsg}
</div>
)}

          {step === 'UPLOAD' && (
<div className="space-y-6">
              {/* Dropzone Area */}
<div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-purple-500 transition bg-slate-50/50 space-y-3">
<div className="text-4xl text-purple-600"></div>
<div>
<label className="cursor-pointer font-semibold text-purple-700 hover:text-purple-800 text-sm">
                    Click to select Excel spreadsheet
<input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
</label>
<p className="text-xs text-slate-500 mt-1">
                    Supports Microsoft Excel (.xlsx) files up to 15MB
</p>
</div>
                {selectedFile && (
<div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-900">
<span> {selectedFile.name}</span>
<span className="text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
</div>
)}
</div>

              {/* Kenyan Format Guidance */}
<div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
<h4 className="font-bold text-slate-800 text-[11px]">
                  Kenyan Quantity Surveying Standard Compliance (EASMM 2008)
</h4>
<ul className="list-disc pl-4 space-y-1">
<li>Auto-detects Item Code, Description, Unit, Quantity, Rate, and Amount columns.</li>
<li>Merged header cells (Preliminaries, Substructure, Superstructure) are normalized.</li>
<li>Provisional and Prime Cost (PC) sums without rates are classified automatically.</li>
<li>Server calculates and verifies arithmetic totals (`qty × rate = amount`) before database commit.</li>
</ul>
</div>
</div>
)}

          {(step === 'PREVIEW' || step === 'COMMITTING') && previewData && (
<div className="space-y-5">
              {/* Preview Metrics Summary Bar */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-[10px] font-semibold text-slate-500 block">Grand Total</span>
<span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                    {formatKes(previewData.calculatedGrandTotal)}
</span>
</div>
<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
<span className="text-[10px] font-semibold text-emerald-700 block">Valid Items</span>
<span className="text-base font-bold text-emerald-900 mt-0.5 block">
                    {previewData.validItemsCount} Items 
</span>
</div>
<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
<span className="text-[10px] font-semibold text-amber-700 block">Warnings / Rounding</span>
<span className="text-base font-bold text-amber-900 mt-0.5 block">
                    {previewData.warningItemsCount} Flagged
</span>
</div>
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-[10px] font-semibold text-slate-500 block">EASMM Sections</span>
<span className="text-base font-bold text-slate-900 mt-0.5 block">
                    {previewData.totalSections} Sections
</span>
</div>
</div>

              {/* Sections & Items Hierarchy Table */}
<div className="space-y-4">
                {previewData.sections.map((section) => (
<div key={section.orderIdx} className="border border-slate-200 rounded-lg overflow-hidden">
<div className="bg-slate-100 px-4 py-2.5 flex justify-between items-center text-xs border-b border-slate-200">
<span className="font-bold text-slate-800">{section.title}</span>
<span className="font-mono font-semibold text-slate-900">
                        Subtotal: {formatKes(section.subtotal)}
</span>
</div>
<table className="w-full text-left text-xs">
<thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px]">
<tr>
<th className="p-2.5">Code</th>
<th className="p-2.5">Description</th>
<th className="p-2.5">Unit</th>
<th className="p-2.5 text-right">Qty</th>
<th className="p-2.5 text-right">Rate (KES)</th>
<th className="p-2.5 text-right">Total (KES)</th>
<th className="p-2.5 text-center">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
                        {section.items.map((item, idx) => (
<tr key={idx} className="hover:bg-slate-50/50">
<td className="p-2.5 font-mono text-slate-500">{item.itemCode}</td>
<td className="p-2.5 max-w-xs font-medium">
                              {item.description}
                              {item.isProvisional && (
<span className="ml-1.5 px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-800 rounded font-bold">
                                  PROVISIONAL
</span>
)}
                              {item.rejectionReason && (
<p className="text-[10px] text-amber-700 mt-0.5"> {item.rejectionReason}</p>
)}
</td>
<td className="p-2.5 font-mono text-slate-500">{item.unit}</td>
<td className="p-2.5 text-right font-mono">{item.quantity}</td>
<td className="p-2.5 text-right font-mono">{formatKes(item.unitRate)}</td>
<td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                              {formatKes(item.totalAmount)}
</td>
<td className="p-2.5 text-center">
                              {item.status === 'VALID' && (
<span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                                  VALID
</span>
)}
                              {item.status === 'WARNING' && (
<span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">
                                  WARN
</span>
)}
                              {item.status === 'REJECTED' && (
<span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800">
                                  REJECTED
</span>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
))}
</div>

              {/* Exclude Rejected Option */}
<div className="flex items-center gap-2 pt-2">
<input
                  type="checkbox"
                  id="excludeRejected"
                  checked={excludeRejected}
                  onChange={(e) => setExcludeRejected(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
<label htmlFor="excludeRejected" className="text-xs text-slate-700 font-medium">
                  Exclude rejected line items during import (prevents bad data from entering the database)
</label>
</div>
</div>
)}
</div>

        {/* Modal Footer */}
<div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          {step === 'UPLOAD' ? (
<>
<button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
</button>
<button
                type="button"
                onClick={handleParse}
                className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition"
              >
                Parse &amp; Preview BOQ
</button>
</>
) : (
<>
<button
                type="button"
                onClick={() => setStep('UPLOAD')}
                disabled={step === 'COMMITTING'}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ← Back to Upload
</button>
<button
                type="button"
                onClick={handleConfirmImport}
                disabled={step === 'COMMITTING'}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                {step === 'COMMITTING' ? 'Importing...' : 'Confirm & Commit BOQ Baseline'}
</button>
</>
)}
</div>
</div>
</div>
);
}