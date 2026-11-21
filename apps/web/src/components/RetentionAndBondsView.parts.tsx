import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { formatKes, ResponsiveTable } from '../ui';
import { statusLabel } from '../lib/status-labels';

export interface RetentionReleaseItem {
  id: string;
  releaseNo: string;
  subcontractorPackageId: string;
  firmName: string;
  tradeCategory: string;
  moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION' | 'SECOND_MOIETY_FINAL_COMPLETION';
  totalRetentionHeld: string;
  releasePercentage: string;
  releaseAmount: string;
  qsRecommendationNotes?: string | null;
  defectClearanceVerified: boolean;
  status: 'PENDING_QS_REVIEW' | 'QS_RECOMMENDED' | 'APPROVED_BY_DIRECTOR' | 'PAID' | 'REJECTED';
  requestedByUserId?: string | null;
  recommendedByUserId?: string | null;
  approvedByUserId?: string | null;
  disbursementRef?: string | null;
  disbursedAt?: string | null;
  createdAt: string;
}

export interface ContractorBondItem {
  id: string;
  bondType: 'PERFORMANCE_BOND' | 'ADVANCE_PAYMENT_GUARANTEE' | 'RETENTION_BOND' | 'BID_TENDER_BOND';
  issuingInstitution: string;
  bondReferenceNo: string;
  bondAmount: string;
  effectiveDate: string;
  expiryDate: string;
  claimStatus: 'ACTIVE' | 'RELEASED' | 'CALLED_CLAIMED' | 'EXPIRED';
  dischargeCertificateRef?: string | null;
  createdAt: string;
}

export interface RetentionSummary {
  totalReleasesCount: number;
  totalRetentionHeld: string;
  totalReleasedAmount: string;
}

export const demoRetentionReleases = (): RetentionReleaseItem[] => [
  {
    id: 'rel-1',
    releaseNo: 'RET-REL-001',
    subcontractorPackageId: 'sub-pkg-1',
    firmName: 'Nairobi Volt Electricals Ltd',
    tradeCategory: 'ELECTRICAL',
    moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
    totalRetentionHeld: '150000.00',
    releasePercentage: '50.00',
    releaseAmount: '75000.00',
    qsRecommendationNotes: 'Practical completion achieved; 50% release verified.',
    defectClearanceVerified: false,
    status: 'PAID',
    disbursementRef: 'MPESA-B2C-QA99824',
    disbursedAt: '2026-11-03T16:00:00Z',
    createdAt: '2026-11-03T15:30:00Z',
},
  {
    id: 'rel-2',
    releaseNo: 'RET-REL-002',
    subcontractorPackageId: 'sub-pkg-2',
    firmName: 'Athi River Plumbing Services',
    tradeCategory: 'PLUMBING',
    moietyStage: 'SECOND_MOIETY_FINAL_COMPLETION',
    totalRetentionHeld: '120000.00',
    releasePercentage: '50.00',
    releaseAmount: '60000.00',
    qsRecommendationNotes: 'Final completion achieved; DLP snags certified cleared.',
    defectClearanceVerified: true,
    status: 'APPROVED_BY_DIRECTOR',
    disbursementRef: null,
    disbursedAt: null,
    createdAt: '2026-11-04T09:00:00Z',
},
];

export const demoContractorBonds = (): ContractorBondItem[] => [
  {
    id: 'bnd-1',
    bondType: 'PERFORMANCE_BOND',
    issuingInstitution: 'Kenya Commercial Bank (KCB Bank)',
    bondReferenceNo: 'KCB-PB-2026-0041',
    bondAmount: '18500000.00',
    effectiveDate: '2026-01-10',
    expiryDate: '2027-01-10',
    claimStatus: 'ACTIVE',
    dischargeCertificateRef: null,
    createdAt: '2026-01-10T08:00:00Z',
},
  {
    id: 'bnd-2',
    bondType: 'ADVANCE_PAYMENT_GUARANTEE',
    issuingInstitution: 'Equity Bank Kenya',
    bondReferenceNo: 'EQ-APG-2026-9812',
    bondAmount: '37000000.00',
    effectiveDate: '2026-01-15',
    expiryDate: '2026-07-15',
    claimStatus: 'RELEASED',
    dischargeCertificateRef: 'DISCH-APG-001',
    createdAt: '2026-01-15T09:00:00Z',
},
];

interface RetentionPct {
  first: string;
  second: string;
}

interface RetentionReleasesTableProps {
  releases: RetentionReleaseItem[];
  pct: RetentionPct;
  canReviewRelease: boolean;
  canDirectRelease: boolean;
  reviewError: string | null;
  onReview: (releaseId: string, action: 'RECOMMEND' | 'APPROVE' | 'REJECT' | 'MARK_PAID', extra?: Record<string, unknown>) => Promise<void>;
  onDisburse: (releaseId: string) => Promise<void>;
}

export function RetentionReleasesTable({
  releases,
  pct,
  canReviewRelease,
  canDirectRelease,
  reviewError,
  onReview,
  onDisburse,
}: RetentionReleasesTableProps) {
  return (
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
<div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Subcontractor Dual-Moiety Retention Schedule (JBC 1999)
</h3>
<span className="text-xs text-slate-500">
              Moiety 1: {pct.first}% at PC | Moiety 2: {pct.second}% post-DLP Snags Cleared
</span>
</div>
{reviewError && (
<div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {reviewError}
</div>
)}
<ResponsiveTable
            head={['Certificate #', 'Subcontractor Firm', 'Trade', 'Moiety Stage', 'Retention Held (KES)', 'Release %', 'Release Sum (KES)', 'Status', 'Action']}
            className="text-sm"
            headClassName="bg-slate-50"
            bodyClassName="text-slate-700"
            cellClassName=""
            rows={releases.map((rel) => ({
              key: rel.id,
              className: 'hover:bg-slate-50/50 transition-colors',
              cells: [
                { content: rel.releaseNo, className: 'font-mono tabular-nums font-semibold text-slate-900' },
                { content: rel.firmName, className: 'font-bold' },
                { content: rel.tradeCategory, className: 'text-xs' },
                {
                  content: (
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium text-xs">
                      {rel.moietyStage === 'FIRST_MOIETY_PRACTICAL_COMPLETION' ? '1st Moiety (PC)' : '2nd Moiety (Final DLP)'}
</span>
                  ),
                  className: 'text-xs',
                },
                { content: formatKes(rel.totalRetentionHeld), className: 'text-right font-medium' },
                { content: `${rel.releasePercentage}%`, className: 'text-center font-bold text-blue-600' },
                { content: formatKes(rel.releaseAmount), className: 'text-right font-bold text-emerald-600' },
                {
                  content: (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        rel.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rel.status === 'APPROVED_BY_DIRECTOR'
                          ? 'bg-blue-100 text-blue-800'
                          : rel.status === 'QS_RECOMMENDED'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {statusLabel(rel.status)}
</span>
                  ),
                  className: 'text-center',
                },
                {
                  content:
                    rel.status === 'PAID' ? (
                      <span className="text-[10px] tabular-nums text-slate-500">{rel.disbursementRef}</span>
                    ) : rel.status === 'REJECTED' ? (
                      <span className="text-[10px] text-slate-400">{statusLabel(rel.status)}</span>
                    ) : !canReviewRelease ? (
                      <span className="text-[10px] text-slate-400">QS or director review required</span>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        {(() => {
                          const needsDirector = rel.status === 'QS_RECOMMENDED' || rel.status === 'APPROVED_BY_DIRECTOR';
                          const allowed = needsDirector ? canDirectRelease : canReviewRelease;
                          if (!allowed) {
                            return (
                              <span className="text-[10px] text-slate-400">
                                {needsDirector ? 'Waiting for a director' : 'Waiting for QS review'}
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() =>
                                rel.status === 'APPROVED_BY_DIRECTOR'
                                  ? onDisburse(rel.id)
                                  : onReview(rel.id, rel.status === 'PENDING_QS_REVIEW' ? 'RECOMMEND' : 'APPROVE')
                              }
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors shadow"
                            >
                              {rel.status === 'PENDING_QS_REVIEW'
                                ? 'QS Recommend'
                                : rel.status === 'QS_RECOMMENDED'
                                ? 'Director Approve'
                                : 'Disburse M-Pesa B2C'}
                            </button>
                          );
                        })()}
                        {rel.status !== 'APPROVED_BY_DIRECTOR' && canReviewRelease && (
<button
                            onClick={() => onReview(rel.id, 'REJECT')}
                            className="text-[10px] text-rose-600 hover:underline"
                          >
                            Reject
</button>
)}
</div>
                    ),
                  className: 'text-center',
                },
              ],
            }))}
          />
</div>
  );
}

interface ContractorBondsTableProps {
  bonds: ContractorBondItem[];
}

export function ContractorBondsTable({ bonds }: ContractorBondsTableProps) {
  return (
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
<div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Commercial Bank Performance Bonds &amp; Advance Guarantees
</h3>
<span className="text-xs text-slate-500">
              Standard 10% Contractor Security under JBC 1999
</span>
</div>
<ResponsiveTable
            head={['Bond Reference #', 'Bond Type', 'Guarantor (Bank / Insurer)', 'Guaranteed Sum (KES)', 'Effective Date', 'Expiry Date', 'Claim Status']}
            className="text-sm"
            headClassName="bg-slate-50"
            bodyClassName="text-slate-700"
            rows={bonds.map((bnd) => ({
              key: bnd.id,
              className: 'hover:bg-slate-50/50 transition-colors',
              cells: [
                { content: bnd.bondReferenceNo, className: 'font-mono tabular-nums font-bold text-slate-900' },
                {
                  content: <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{statusLabel(bnd.bondType)}</span>,
                  className: 'text-xs',
                },
                { content: bnd.issuingInstitution, className: 'font-semibold' },
                { content: formatKes(bnd.bondAmount), className: 'text-right font-bold text-slate-900' },
                { content: bnd.effectiveDate, className: 'tabular-nums text-xs' },
                { content: bnd.expiryDate, className: 'tabular-nums text-xs' },
                {
                  content: (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        bnd.claimStatus === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {statusLabel(bnd.claimStatus)}
</span>
                  ),
                  className: 'text-center',
                },
              ],
            }))}
          />
</div>
  );
}

interface ReleaseRetentionModalProps {
  isLive: boolean;
  subPkgs: Array<{ id: string; firm_name: string }>;
  pct: RetentionPct;
  moietyMaxPct: string;
  releasePackageId: string;
  setReleasePackageId: Dispatch<SetStateAction<string>>;
  releaseNo: string;
  setReleaseNo: Dispatch<SetStateAction<string>>;
  firmName: string;
  setFirmName: Dispatch<SetStateAction<string>>;
  moietyStage: RetentionReleaseItem['moietyStage'];
  setMoietyStage: Dispatch<SetStateAction<RetentionReleaseItem['moietyStage']>>;
  totalHeld: string;
  setTotalHeld: Dispatch<SetStateAction<string>>;
  releasePct: string;
  setReleasePct: Dispatch<SetStateAction<string>>;
  defectVerified: boolean;
  setDefectVerified: Dispatch<SetStateAction<boolean>>;
  qsNotes: string;
  setQsNotes: Dispatch<SetStateAction<string>>;
  onSubmit: (e: FormEvent) => Promise<void>;
  onClose: () => void;
}

export function ReleaseRetentionModal({
  isLive,
  subPkgs,
  pct,
  moietyMaxPct,
  releasePackageId,
  setReleasePackageId,
  releaseNo,
  setReleaseNo,
  firmName,
  setFirmName,
  moietyStage,
  setMoietyStage,
  totalHeld,
  setTotalHeld,
  releasePct,
  setReleasePct,
  defectVerified,
  setDefectVerified,
  qsNotes,
  setQsNotes,
  onSubmit,
  onClose,
}: ReleaseRetentionModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Issue Subcontractor Retention Release
</h3>
<p className="text-xs text-slate-500 mb-4">
              Dual-moiety retention release under JBC 1999 Clause 30 ({pct.first}% on PC, {pct.second}% post-DLP).
</p>
<form onSubmit={onSubmit} className="space-y-4 text-sm">
              {isLive && (
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subcontractor Package
</label>
<select
                    value={releasePackageId}
                    onChange={(e) => setReleasePackageId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  >
<option value="">Select subcontractor package…</option>
                    {subPkgs.map((p) => (
<option key={p.id} value={p.id}>{p.firm_name}</option>
))}
</select>
</div>
)}
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Release Certificate #
</label>
<input
                    type="text"
                    value={releaseNo}
                    onChange={(e) => setReleaseNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 tabular-nums"
                    required
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subcontractor Firm
</label>
<input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
</div>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Moiety Release Stage
</label>
<select
                  value={moietyStage}
                  onChange={(e: any) => setMoietyStage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
<option value="FIRST_MOIETY_PRACTICAL_COMPLETION">First Moiety (Practical Completion - {pct.first}%)</option>
<option value="SECOND_MOIETY_FINAL_COMPLETION">Second Moiety (Final Completion Post-DLP - {pct.second}%)</option>
</select>
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Retention Held (KES)
</label>
<input
                    type="number"
                    step="0.01"
                    value={totalHeld}
                    onChange={(e) => setTotalHeld(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 tabular-nums"
                    required
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Release % (Max {moietyMaxPct}%)
</label>
<input
                    type="number"
                    step="0.01"
                    value={releasePct}
                    onChange={(e) => setReleasePct(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 tabular-nums"
                    required
                  />
</div>
</div>

              {moietyStage === 'SECOND_MOIETY_FINAL_COMPLETION' && (
<div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg">
<input
                    type="checkbox"
                    id="defectCheck"
                    checked={defectVerified}
                    onChange={(e) => setDefectVerified(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
<label htmlFor="defectCheck" className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                    I confirm all defect liability period snags have been cleared &amp; signed off by Architect/QS.
</label>
</div>
)}

<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  QS Recommendation Notes
</label>
<textarea
                  rows={2}
                  value={qsNotes}
                  onChange={(e) => setQsNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-xs"
                />
</div>

<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow"
                >
                  Approve Release
</button>
</div>
</form>
</div>
</div>
  );
}

interface RegisterBondModalProps {
  bondType: ContractorBondItem['bondType'];
  setBondType: Dispatch<SetStateAction<ContractorBondItem['bondType']>>;
  issuingBank: string;
  setIssuingBank: Dispatch<SetStateAction<string>>;
  bondRef: string;
  setBondRef: Dispatch<SetStateAction<string>>;
  bondAmount: string;
  setBondAmount: Dispatch<SetStateAction<string>>;
  effectiveDate: string;
  setEffectiveDate: Dispatch<SetStateAction<string>>;
  expiryDate: string;
  setExpiryDate: Dispatch<SetStateAction<string>>;
  onSubmit: (e: FormEvent) => Promise<void>;
  onClose: () => void;
}

export function RegisterBondModal({
  bondType,
  setBondType,
  issuingBank,
  setIssuingBank,
  bondRef,
  setBondRef,
  bondAmount,
  setBondAmount,
  effectiveDate,
  setEffectiveDate,
  expiryDate,
  setExpiryDate,
  onSubmit,
  onClose,
}: RegisterBondModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Register Contractor Bank Bond / Guarantee
</h3>
<p className="text-xs text-slate-500 mb-4">
              Registers bank guarantees (Performance Bond, Advance Payment Guarantee) under JBC 1999.
</p>
<form onSubmit={onSubmit} className="space-y-4 text-sm">
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bond Type
</label>
<select
                    value={bondType}
                    onChange={(e: any) => setBondType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-xs"
                  >
<option value="PERFORMANCE_BOND">Performance Bond (10%)</option>
<option value="ADVANCE_PAYMENT_GUARANTEE">Advance Payment Guarantee</option>
<option value="RETENTION_BOND">Retention Bond</option>
<option value="BID_TENDER_BOND">Bid / Tender Bond</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Issuing Bank / Insurer
</label>
<input
                    type="text"
                    value={issuingBank}
                    onChange={(e) => setIssuingBank(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
</div>
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bond Reference #
</label>
<input
                    type="text"
                    value={bondRef}
                    onChange={(e) => setBondRef(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 tabular-nums"
                    required
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bond Amount (KES)
</label>
<input
                    type="number"
                    step="0.01"
                    value={bondAmount}
                    onChange={(e) => setBondAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 tabular-nums"
                    required
                  />
</div>
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Date
</label>
<input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
</label>
<input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
</div>
</div>
<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg shadow"
                >
                  Save Bond Record
</button>
</div>
</form>
</div>
</div>
  );
}
