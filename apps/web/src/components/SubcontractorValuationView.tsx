import React, { useState } from 'react';

export interface SubcontractorValuationItem {
  id: string;
  certificateNo: string;
  subcontractorPackageId: string;
  subcontractorFirm: string;
  tradeCategory: string;
  valuationDate: string;
  grossWorkCertifiedKes: string;
  retentionRatePct: string;
  retentionDeductedKes: string;
  previousPaymentsDeductedKes: string;
  withholdingTaxPct: string;
  withholdingTaxDeductedKes: string;
  netPayableKes: string;
  paymentStatus: 'SUBMITTED' | 'QS_VERIFIED' | 'APPROVED_FOR_PAYMENT' | 'PAID' | 'REJECTED';
  paymentReference?: string | null;
  paidAt?: string | null;
  approvedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface SubcontractorValuationSummary {
  totalValuations: number;
  totalGrossCertifiedKes: string;
  totalRetentionHeldKes: string;
  totalWhtDeductedKes: string;
  totalNetPayableKes: string;
}

interface SubcontractorValuationViewProps {
  projectId: string;
  projectName?: string;
  valuations?: SubcontractorValuationItem[];
  summary?: SubcontractorValuationSummary;
  subcontractorPackages?: Array<{ id: string; firmName: string; tradeCategory: string }>;
  userRole?: string;
  onCreateValuation?: (data: any) => Promise<void>;
  onReviewValuation?: (valId: string, status: string, paymentRef?: string) => Promise<void>;
}

export const SubcontractorValuationView: React.FC<SubcontractorValuationViewProps> = ({
  projectId: _projectId,
  projectName = 'Current Project',
  valuations: initialValuations,
  summary: initialSummary,
  subcontractorPackages = [
    { id: 'sub-01', firmName: 'Amani Mechanical & Plumbing Ltd', tradeCategory: 'PLUMBING' },
    { id: 'sub-02', firmName: 'VoltMasters Electrical Engineering Ltd', tradeCategory: 'ELECTRICAL' },
    { id: 'sub-03', firmName: 'Rift Valley Structural Steel Erectors', tradeCategory: 'STEEL' },
  ],
  userRole = 'PM_QS',
  onCreateValuation,
  onReviewValuation,
}) => {
  const [valuations, setValuations] = useState<SubcontractorValuationItem[]>(
    initialValuations || [
      {
        id: 'val-01',
        certificateNo: 'SC-VAL-001',
        subcontractorPackageId: 'sub-01',
        subcontractorFirm: 'Amani Mechanical & Plumbing Ltd',
        tradeCategory: 'PLUMBING',
        valuationDate: '2026-10-31',
        grossWorkCertifiedKes: '1500000.00',
        retentionRatePct: '10.00',
        retentionDeductedKes: '150000.00',
        previousPaymentsDeductedKes: '0.00',
        withholdingTaxPct: '3.00',
        withholdingTaxDeductedKes: '45000.00',
        netPayableKes: '1305000.00',
        paymentStatus: 'PAID',
        paymentReference: 'KCB-RTGS-20261102-88192',
        paidAt: '2026-11-02T15:00:00Z',
        approvedBy: 'Director P. Kamau',
        notes: 'Valuation #1: First fix rough-in piping complete across basement and ground floor',
        createdAt: '2026-10-31T12:00:00Z',
      },
      {
        id: 'val-02',
        certificateNo: 'SC-VAL-002',
        subcontractorPackageId: 'sub-02',
        subcontractorFirm: 'VoltMasters Electrical Engineering Ltd',
        tradeCategory: 'ELECTRICAL',
        valuationDate: '2026-11-02',
        grossWorkCertifiedKes: '2200000.00',
        retentionRatePct: '10.00',
        retentionDeductedKes: '220000.00',
        previousPaymentsDeductedKes: '0.00',
        withholdingTaxPct: '3.00',
        withholdingTaxDeductedKes: '66000.00',
        netPayableKes: '1914000.00',
        paymentStatus: 'APPROVED_FOR_PAYMENT',
        approvedBy: 'Lead QS David Kiprono',
        notes: 'Conduit laying and main distribution board risers inspected and passed',
        createdAt: '2026-11-02T16:00:00Z',
      },
    ]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedValId, setSelectedValId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [subPkgId, setSubPkgId] = useState(subcontractorPackages[0]?.id || '');
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [grossWorkCertifiedKes, setGrossWorkCertifiedKes] = useState('');
  const [retentionRatePct, setRetentionRatePct] = useState('10.00');
  const [previousPaymentsDeductedKes, setPreviousPaymentsDeductedKes] = useState('0.00');
  const [withholdingTaxPct, setWithholdingTaxPct] = useState('3.00');
  const [notes, setNotes] = useState('');

  // Derived Calculations
  const gross = parseFloat(grossWorkCertifiedKes) || 0;
  const retPct = parseFloat(retentionRatePct) || 10;
  const prevPay = parseFloat(previousPaymentsDeductedKes) || 0;
  const whtPct = parseFloat(withholdingTaxPct) || 3;

  const retDeducted = gross * (retPct / 100);
  const curGross = gross - prevPay;
  const whtDeducted = curGross > 0 ? curGross * (whtPct / 100) : 0;
  const netPayable = gross - retDeducted - prevPay - whtDeducted;

  // Summaries
  const totalGross = valuations.reduce((sum, v) => sum + Number(v.grossWorkCertifiedKes || 0), 0);
  const totalRetention = valuations.reduce((sum, v) => sum + Number(v.retentionDeductedKes || 0), 0);
  const totalWht = valuations.reduce((sum, v) => sum + Number(v.withholdingTaxDeductedKes || 0), 0);
  const totalNet = valuations.reduce((sum, v) => sum + Number(v.netPayableKes || 0), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grossWorkCertifiedKes || !subPkgId) return;

    setIsSubmitting(true);
    const newCertNo = `SC-VAL-${String(valuations.length + 1).padStart(3, '0')}`;
    const selectedPkg = subcontractorPackages.find((p) => p.id === subPkgId);

    const payload = {
      subcontractorPackageId: subPkgId,
      certificateNo: newCertNo,
      valuationDate,
      grossWorkCertifiedKes,
      retentionRatePct,
      previousPaymentsDeductedKes: previousPaymentsDeductedKes || '0.00',
      withholdingTaxPct,
      notes,
    };

    if (onCreateValuation) {
      await onCreateValuation(payload);
    } else {
      const newVal: SubcontractorValuationItem = {
        id: `val-${Date.now()}`,
        certificateNo: newCertNo,
        subcontractorPackageId: subPkgId,
        subcontractorFirm: selectedPkg?.firmName || 'Specialist Subcontractor',
        tradeCategory: selectedPkg?.tradeCategory || 'GENERAL',
        valuationDate: valuationDate || (new Date().toISOString().split('T')[0] as string),
        grossWorkCertifiedKes,
        retentionRatePct,
        retentionDeductedKes: retDeducted.toFixed(2),
        previousPaymentsDeductedKes: prevPay.toFixed(2),
        withholdingTaxPct,
        withholdingTaxDeductedKes: whtDeducted.toFixed(2),
        netPayableKes: netPayable.toFixed(2),
        paymentStatus: 'SUBMITTED',
        notes,
        createdAt: new Date().toISOString(),
      };
      setValuations([newVal, ...valuations]);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    setGrossWorkCertifiedKes('');
    setNotes('');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedValId || !paymentReference) return;

    setIsSubmitting(true);
    if (onReviewValuation) {
      await onReviewValuation(selectedValId, 'PAID', paymentReference);
    } else {
      setValuations((prev) =>
        prev.map((v) =>
          v.id === selectedValId
            ? {
                ...v,
                paymentStatus: 'PAID',
                paymentReference,
                paidAt: new Date().toISOString(),
              }
            : v
        )
      );
    }

    setIsSubmitting(false);
    setIsPayModalOpen(false);
    setSelectedValId(null);
    setPaymentReference('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg text-lg">📑</span>
            <h2 className="text-xl font-bold text-slate-900">Subcontractor Valuations & Retention Ledger</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            JBC 1999 Agreement and Conditions of Sub-Contract progress claims & KRA Cap 470 WHT for {projectName}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
          <span>+</span> New Subcontractor Claim
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Work Certified</p>
          <p className="text-xl font-bold text-slate-800 mt-1">
            KES {(initialSummary?.totalGrossCertifiedKes ? Number(initialSummary.totalGrossCertifiedKes) : totalGross).toLocaleString('en-KE')}
          </p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Retention Held (10%)</p>
          <p className="text-xl font-bold text-amber-900 mt-1">
            KES {(initialSummary?.totalRetentionHeldKes ? Number(initialSummary.totalRetentionHeldKes) : totalRetention).toLocaleString('en-KE')}
          </p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">KRA WHT Deducted (3%)</p>
          <p className="text-xl font-bold text-indigo-900 mt-1">
            KES {(initialSummary?.totalWhtDeductedKes ? Number(initialSummary.totalWhtDeductedKes) : totalWht).toLocaleString('en-KE')}
          </p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Net Amount Payable</p>
          <p className="text-xl font-bold text-emerald-900 mt-1">
            KES {(initialSummary?.totalNetPayableKes ? Number(initialSummary.totalNetPayableKes) : totalNet).toLocaleString('en-KE')}
          </p>
        </div>
      </div>

      {/* Valuations Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Cert No</th>
              <th className="py-3 px-4">Subcontractor Firm</th>
              <th className="py-3 px-4">Trade</th>
              <th className="py-3 px-4">Gross Certified</th>
              <th className="py-3 px-4">Retention (10%)</th>
              <th className="py-3 px-4">WHT (3%)</th>
              <th className="py-3 px-4">Net Payable</th>
              <th className="py-3 px-4">Payment Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {valuations.map((val) => (
              <tr key={val.id} className="hover:bg-slate-50/80 transition">
                <td className="py-3 px-4 font-mono font-semibold text-slate-900">{val.certificateNo}</td>
                <td className="py-3 px-4">
                  <p className="font-semibold text-slate-900">{val.subcontractorFirm}</p>
                  <p className="text-xs text-slate-400">Date: {val.valuationDate}</p>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                    {val.tradeCategory}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium text-slate-900">
                  KES {Number(val.grossWorkCertifiedKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-amber-700">
                  KES {Number(val.retentionDeductedKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-indigo-700">
                  KES {Number(val.withholdingTaxDeductedKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 font-bold text-slate-900">
                  KES {Number(val.netPayableKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      val.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : val.paymentStatus === 'APPROVED_FOR_PAYMENT'
                        ? 'bg-indigo-100 text-indigo-800'
                        : val.paymentStatus === 'QS_VERIFIED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {val.paymentStatus.replace(/_/g, ' ')}
                  </span>
                  {val.paymentReference && (
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{val.paymentReference}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {val.paymentStatus !== 'PAID' && (userRole === 'ADMIN' || userRole === 'PM_QS') && (
                    <button
                      onClick={() => {
                        setSelectedValId(val.id);
                        setIsPayModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition"
                    >
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Generate Subcontractor Valuation</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subcontractor Trade Package *</label>
                <select
                  value={subPkgId}
                  onChange={(e) => setSubPkgId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {subcontractorPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.firmName} ({pkg.tradeCategory})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Valuation Date *</label>
                  <input
                    type="date"
                    required
                    value={valuationDate}
                    onChange={(e) => setValuationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Gross Certified (KES) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 1500000"
                    value={grossWorkCertifiedKes}
                    onChange={(e) => setGrossWorkCertifiedKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Retention Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={retentionRatePct}
                    onChange={(e) => setRetentionRatePct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Prev. Paid (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={previousPaymentsDeductedKes}
                    onChange={(e) => setPreviousPaymentsDeductedKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">KRA WHT (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={withholdingTaxPct}
                    onChange={(e) => setWithholdingTaxPct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Calculation Breakdown */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Work Certified:</span>
                  <span className="font-semibold text-slate-900">KES {gross.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Less: Retention ({retPct}%):</span>
                  <span className="font-semibold text-amber-700">- KES {retDeducted.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-700">Less: KRA WHT ({whtPct}%):</span>
                  <span className="font-semibold text-indigo-700">- KES {whtDeducted.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm">
                  <span className="text-slate-900">Net Amount Payable:</span>
                  <span className="text-emerald-700">KES {netPayable.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">QS Valuation Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scope inspected on site, materials verified"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Generating...' : 'Issue Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Record Settlement / RTGS</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Bank Reference / M-Pesa B2B Paybill Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KCB-RTGS-891029 or MPESA-B2B-98124"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
