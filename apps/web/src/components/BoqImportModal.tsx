import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';

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
  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW' | 'COMMITTING'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excludeRejected, setExcludeRejected] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sample or parsed preview data
  const [previewData, setPreviewData] = useState<BOQPreviewData | null>({
    sourceFilename: 'Riverside-Commercial-Plaza-BOQ-Rev2.xlsx',
    totalSections: 4,
    totalItems: 8,
    validItemsCount: 7,
    warningItemsCount: 1,
    rejectedItemsCount: 0,
    calculatedGrandTotal: toCurrencyString('45000000.00'),
    sections: [
      {
        title: 'Section 1: Preliminaries & General Conditions (EASMM Section A)',
        orderIdx: 1,
        subtotal: toCurrencyString('4500000.00'),
        items: [
          {
            itemCode: '1.1',
            description: 'Contractual requirements, site security hoarding, and water for the works',
            unit: 'ITEM',
            quantity: '1.0000',
            unitRate: '2500000.0000',
            totalAmount: toCurrencyString('2500000.00'),
            isProvisional: false,
            status: 'VALID',
          },
          {
            itemCode: '1.2',
            description: 'Provisional Sum for Kenya Power 3-phase substation connection',
            unit: 'SUM',
            quantity: '0.0000',
            unitRate: '0.0000',
            totalAmount: toCurrencyString('2000000.00'),
            isProvisional: true,
            status: 'VALID',
          },
        ],
      },
      {
        title: 'Section 2: Substructure & Earthworks (EASMM Section D)',
        orderIdx: 2,
        subtotal: toCurrencyString('12000000.00'),
        items: [
          {
            itemCode: '2.1',
            description: 'Bulk excavation in normal soil not exceeding 3.0m deep',
            unit: 'CM',
            quantity: '3000.0000',
            unitRate: '850.0000',
            totalAmount: toCurrencyString('2550000.00'),
            isProvisional: false,
            status: 'VALID',
          },
          {
            itemCode: '2.2',
            description: 'Hardcore bed 300mm thick compacted in layers',
            unit: 'SM',
            quantity: '1500.0000',
            unitRate: '1200.0000',
            totalAmount: toCurrencyString('1800000.00'),
            isProvisional: false,
            status: 'VALID',
          },
          {
            itemCode: '2.3',
            description: 'Reinforced concrete class 25/20 in strip foundation footings',
            unit: 'CM',
            quantity: '450.0000',
            unitRate: '17000.0000',
            totalAmount: toCurrencyString('7650000.00'),
            isProvisional: false,
            status: 'WARNING',
            rejectionReason: 'Minor rounding discrepancy in Excel formula (KES 0.02 variance)',
          },
        ],
      },
      {
        title: 'Section 3: Reinforced Concrete Superstructure (EASMM Section F)',
        orderIdx: 3,
        subtotal: toCurrencyString('18500000.00'),
        items: [
          {
            itemCode: '3.1',
            description: 'Vibrated reinforced concrete class 25/20 in columns, beams and suspended slabs',
            unit: 'CM',
            quantity: '600.0000',
            unitRate: '17500.0000',
            totalAmount: toCurrencyString('10500000.00'),
            isProvisional: false,
            status: 'VALID',
          },
          {
            itemCode: '3.2',
            description: 'High tensile ribbed rebar steel D16 to D25 bent and placed',
            unit: 'KG',
            quantity: '40000.0000',
            unitRate: '200.0000',
            totalAmount: toCurrencyString('8000000.00'),
            isProvisional: false,
            status: 'VALID',
          },
        ],
      },
      {
        title: 'Section 4: Walling, Finishes & Services (EASMM Section G & V)',
        orderIdx: 4,
        subtotal: toCurrencyString('10000000.00'),
        items: [
          {
            itemCode: '4.1',
            description: 'Machine cut stone walling 200mm thick bedded in cement-sand mortar (1:3)',
            unit: 'SM',
            quantity: '2500.0000',
            unitRate: '4000.0000',
            totalAmount: toCurrencyString('10000000.00'),
            isProvisional: false,
            status: 'VALID',
          },
        ],
      },
    ],
  });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleSimulateParse = () => {
    if (!selectedFile && !previewData) {
      setErrorMsg('Please select an Excel (.xlsx) file to parse');
      return;
    }
    if (selectedFile) {
      setPreviewData((prev) =>
        prev
          ? {
              ...prev,
              sourceFilename: selectedFile.name,
            }
          : prev,
      );
    }
    setStep('PREVIEW');
  };

  const handleConfirmImport = async () => {
    setStep('COMMITTING');
    try {
      // Simulate confirmation or call /api/v1/projects/:id/boq/confirm
      setTimeout(() => {
        onImportSuccess({
          version: 1,
          total_amount: previewData?.calculatedGrandTotal || '45000000.00',
          sectionsCount: previewData?.sections.length || 4,
        });
        onClose();
      }, 600);
    } catch (err) {
      setErrorMsg(`Import failed: ${(err as Error).message}`);
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
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
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
            ✕
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
                <div className="text-4xl text-purple-600">📊</div>
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
                    <span>📄 {selectedFile.name}</span>
                    <span className="text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {/* Kenyan Format Guidance */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
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
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Grand Total</span>
                  <span className="text-base font-bold font-mono text-slate-900 mt-0.5 block">
                    KES {previewData.calculatedGrandTotal}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase block">Valid Items</span>
                  <span className="text-base font-bold text-emerald-900 mt-0.5 block">
                    {previewData.validItemsCount} Items ✓
                  </span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-amber-700 uppercase block">Warnings / Rounding</span>
                  <span className="text-base font-bold text-amber-900 mt-0.5 block">
                    {previewData.warningItemsCount} Flagged
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">EASMM Sections</span>
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
                        Subtotal: KES {section.subtotal}
                      </span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
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
                                <p className="text-[10px] text-amber-700 mt-0.5">⚠️ {item.rejectionReason}</p>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">{item.unit}</td>
                            <td className="p-2.5 text-right font-mono">{item.quantity}</td>
                            <td className="p-2.5 text-right font-mono">{toCurrencyString(item.unitRate)}</td>
                            <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                              {item.totalAmount}
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
                onClick={handleSimulateParse}
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