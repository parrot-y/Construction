import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';

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
  status: 'PENDING_QS_REVIEW' | 'APPROVED_BY_DIRECTOR' | 'PAID' | 'REJECTED';
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

interface RetentionAndBondsViewProps {
  projectId?: string;
  projectName?: string;
  releases?: RetentionReleaseItem[];
  bonds?: ContractorBondItem[];
  summary?: RetentionSummary;
  userRole?: string;
  onCreateRelease?: (data: any) => Promise<void>;
  onReviewRelease?: (releaseId: string, status: string, ref?: string) => Promise<void>;
  onCreateBond?: (data: any) => Promise<void>;
}

export const RetentionAndBondsView: React.FC<RetentionAndBondsViewProps> = ({
  projectId,
  projectName = '',
  releases: initialReleases,
  bonds: initialBonds,
  summary: initialSummary,
  userRole: _userRole,
  onCreateRelease,
  onReviewRelease,
  onCreateBond,
}) => {
  const [activeTab, setActiveTab] = useState<'RETENTION' | 'BONDS'>('RETENTION');
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showBondModal, setShowBondModal] = useState(false);

  // Form states for Retention Release
  const [firmName, setFirmName] = useState('Nairobi Volt Electricals Ltd');
  const [releaseNo, setReleaseNo] = useState(`RET-${Date.now().toString().slice(-5)}`);
  const [moietyStage, setMoietyStage] = useState<'FIRST_MOIETY_PRACTICAL_COMPLETION' | 'SECOND_MOIETY_FINAL_COMPLETION'>('FIRST_MOIETY_PRACTICAL_COMPLETION');
  const [totalHeld, setTotalHeld] = useState('150000.00');
  const [releasePct, setReleasePct] = useState('50.00');
  const [defectVerified, setDefectVerified] = useState(false);
  const [qsNotes, setQsNotes] = useState('First moiety 50% retention recommended for release upon practical completion.');

  // Form states for Bond
  const [bondType, setBondType] = useState<'PERFORMANCE_BOND' | 'ADVANCE_PAYMENT_GUARANTEE' | 'RETENTION_BOND' | 'BID_TENDER_BOND'>('PERFORMANCE_BOND');
  const [issuingBank, setIssuingBank] = useState('Kenya Commercial Bank (KCB Bank)');
  const [bondRef, setBondRef] = useState(`KCB-PB-2026-${Date.now().toString().slice(-4)}`);
  const [bondAmount, setBondAmount] = useState('2500000.00');
  const [effectiveDate, setEffectiveDate] = useState('2026-01-15');
  const [expiryDate, setExpiryDate] = useState('2027-01-15');
  const [releasePackageId, setReleasePackageId] = useState('');
  const [subPkgs, setSubPkgs] = useState<{ id: string; firm_name: string}[]>([]);

  const isLive = !!projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive || !projectId) return;
    try {
      const [relRes, bondRes, pkgRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/subcontractor-retention-releases`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/contractor-bonds`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/subcontractors`, { credentials: 'include'}),
      ]);
      if (relRes.ok) {
        const rj = await relRes.json();
        setReleases((rj.releases || []) as RetentionReleaseItem[]);
}
      if (bondRes.ok) {
        const bj = await bondRes.json();
        setBonds((bj.bonds || []) as ContractorBondItem[]);
}
      if (pkgRes.ok) {
        const pj = await pkgRes.json();
        setSubPkgs((pj.packages || []).map((p: any) => ({ id: p.id, firm_name: p.firm_name})));
}
} catch { /* keep demo */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Default state for Retention
  const [releases, setReleases] = useState<RetentionReleaseItem[]>(
    initialReleases || (import.meta.env.DEV ? [
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
    ] : [])
);

  // Default state for Bonds
  const [bonds, setBonds] = useState<ContractorBondItem[]>(
    initialBonds || (import.meta.env.DEV ? [
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
    ] : [])
);

  const summary = (!isLive && initialSummary) ? initialSummary : {
    totalReleasesCount: releases.length,
    totalRetentionHeld: releases.reduce((s, r) => s + parseFloat(r.totalRetentionHeld), 0).toFixed(2),
    totalReleasedAmount: releases.reduce((s, r) => s + parseFloat(r.releaseAmount), 0).toFixed(2),
};

  const handleCreateReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const held = parseFloat(totalHeld) || 0;
    const pct = parseFloat(releasePct) || 50;
    const amt = held * (pct / 100);

    const newRel: RetentionReleaseItem = {
      id: `rel-${Date.now()}`,
      releaseNo,
      subcontractorPackageId: `sub-pkg-${Date.now()}`,
      firmName,
      tradeCategory: 'SPECIALIST_TRADE',
      moietyStage,
      totalRetentionHeld: held.toFixed(2),
      releasePercentage: pct.toFixed(2),
      releaseAmount: amt.toFixed(2),
      qsRecommendationNotes: qsNotes,
      defectClearanceVerified: defectVerified,
      status: 'PENDING_QS_REVIEW',
      createdAt: new Date().toISOString(),
};

    if (isLive && projectId) {
      if (!releasePackageId) return;
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/subcontractor-retention-releases`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              subcontractorPackageId: releasePackageId,
              releaseNo,
              moietyStage,
              totalRetentionHeld: held.toFixed(2),
              releasePercentage: pct.toFixed(2),
              releaseAmount: amt.toFixed(2),
              qsRecommendationNotes: qsNotes || null,
              defectClearanceVerified: defectVerified,
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      setShowReleaseModal(false);
      return;
}

    if (onCreateRelease) {
      await onCreateRelease(newRel);
}
    setReleases([newRel, ...releases]);
    setShowReleaseModal(false);
};

  const handleDisburseClick = async (releaseId: string) => {
    const ref = `MPESA-B2C-${Date.now().toString().slice(-6)}`;

    if (isLive && projectId) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/subcontractor-retention-releases/${releaseId}/review`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ status: 'PAID', disbursementRef: ref}),
});
        if (res.ok) { await reload(); return;}
} catch { /* fall through to local */}
}

    if (onReviewRelease) {
      await onReviewRelease(releaseId, 'PAID', ref);
}
    setReleases(
      releases.map((r) =>
        r.id === releaseId
          ? { ...r, status: 'PAID', disbursementRef: ref, disbursedAt: new Date().toISOString()}
          : r
)
);
};

  const handleCreateBondSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBond: ContractorBondItem = {
      id: `bnd-${Date.now()}`,
      bondType,
      issuingInstitution: issuingBank,
      bondReferenceNo: bondRef,
      bondAmount: parseFloat(bondAmount).toFixed(2),
      effectiveDate,
      expiryDate,
      claimStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
};

    if (isLive && projectId) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/contractor-bonds`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              bondType,
              issuingInstitution: issuingBank,
              bondReferenceNo: bondRef,
              bondAmount,
              effectiveDate,
              expiryDate,
              claimStatus: 'ACTIVE',
              dischargeCertificateRef: null,
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      setShowBondModal(false);
      return;
}

    if (onCreateBond) {
      await onCreateBond(newBond);
}
    setBonds([newBond, ...bonds]);
    setShowBondModal(false);
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">Loading retention &amp; bonds data...</div>;
}

  return (
<div className="space-y-6">
      {/* Header Banner */}
<div className="bg-gradient-to-r from-blue-950 to-slate-900 rounded-xl p-6 text-white shadow-lg border border-blue-900/40">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
<div>
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/30 text-blue-300 border border-blue-500/30 mb-2">
<span> Subcontractor Retention &amp; Bank Bonds Engine</span>
<span>•</span>
<span>JBC 1999 Clause 30 &amp; 34 Dual-Moiety</span>
</div>
<h1 className="text-2xl font-bold ">Retention Releases &amp; Performance Bonds</h1>
<p className="text-sm text-blue-200/80 mt-1">
              Project:<span className="font-semibold text-white">{projectName}</span> | 50% Practical Completion Release, 50% Post-DLP Expiry Release &amp; Bank Guarantee Expiry Monitor
</p>
</div>
<div className="flex items-center gap-3">
<button
              onClick={() => setShowReleaseModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
            >
<span>+</span>
<span>Issue Retention Release</span>
</button>
<button
              onClick={() => setShowBondModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
            >
<span>+</span>
<span>Register Bank Bond</span>
</button>
</div>
</div>

        {/* 4 Financial Metric Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-blue-900/50">
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Subcontract Retention Held</div>
<div className="text-xl font-bold text-white mt-1">{formatKes(summary.totalRetentionHeld)}</div>
<div className="text-[10px] text-blue-300 mt-1">5% Subcontract Sum Cap</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Retention Disbursed</div>
<div className="text-xl font-bold text-emerald-400 mt-1">{formatKes(summary.totalReleasedAmount)}</div>
<div className="text-[10px] text-emerald-300 mt-1">M-Pesa B2C / EFT Released</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Active Performance Bonds</div>
<div className="text-xl font-bold text-amber-300 mt-1">{bonds.filter((b) => b.claimStatus === 'ACTIVE').length} Active</div>
<div className="text-[10px] text-amber-300/80 mt-1">Commercial Bank Underwritten</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Total Bond Guarantees</div>
<div className="text-xl font-bold text-white mt-1">{formatKes(bonds.reduce((s, b) => s + parseFloat(b.bondAmount), 0))}</div>
<div className="text-[10px] text-slate-400 mt-1">Risk Protection Ceiling</div>
</div>
</div>
</div>

      {/* Tabs */}
<div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
<button
          onClick={() => setActiveTab('RETENTION')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'RETENTION'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
}`}
        >
<span> Subcontractor Retention Releases ({releases.length})</span>
</button>
<button
          onClick={() => setActiveTab('BONDS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'BONDS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
}`}
        >
<span> Contractor Bonds &amp; Guarantees ({bonds.length})</span>
</button>
</div>

      {/* Tab 1: Retention Releases Table */}
      {activeTab === 'RETENTION' && (
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
<div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Subcontractor Dual-Moiety Retention Schedule (JBC 1999)
</h3>
<span className="text-xs text-slate-500">
              Moiety 1: 50% at PC | Moiety 2: 50% post-DLP Snags Cleared
</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-sm">
<thead>
<tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold ">
<th className="py-3 px-4">Certificate #</th>
<th className="py-3 px-4">Subcontractor Firm</th>
<th className="py-3 px-4">Trade</th>
<th className="py-3 px-4">Moiety Stage</th>
<th className="py-3 px-4 text-right">Retention Held (KES)</th>
<th className="py-3 px-4 text-center">Release %</th>
<th className="py-3 px-4 text-right">Release Sum (KES)</th>
<th className="py-3 px-4 text-center">Status</th>
<th className="py-3 px-4 text-center">Action</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {releases.map((rel) => (
<tr key={rel.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
<td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {rel.releaseNo}
</td>
<td className="py-3 px-4 font-bold">{rel.firmName}</td>
<td className="py-3 px-4 text-xs">{rel.tradeCategory}</td>
<td className="py-3 px-4 text-xs">
<span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium">
                        {rel.moietyStage === 'FIRST_MOIETY_PRACTICAL_COMPLETION' ? '1st Moiety (PC)' : '2nd Moiety (Final DLP)'}
</span>
</td>
<td className="py-3 px-4 text-right font-medium">
                      {formatKes(rel.totalRetentionHeld)}
</td>
<td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400">
                      {rel.releasePercentage}%
</td>
<td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatKes(rel.releaseAmount)}
</td>
<td className="py-3 px-4 text-center">
<span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          rel.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : rel.status === 'APPROVED_BY_DIRECTOR'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
}`}
                      >
                        {rel.status}
</span>
</td>
<td className="py-3 px-4 text-center">
                      {rel.status !== 'PAID' ? (
<button
                          onClick={() => handleDisburseClick(rel.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded text-xs transition-colors shadow"
                        >
                          Disburse M-Pesa B2C
</button>
) : (
<span className="text-[10px] tabular-nums text-slate-500">
                          {rel.disbursementRef}
</span>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}

      {/* Tab 2: Bonds Table */}
      {activeTab === 'BONDS' && (
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
<div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Commercial Bank Performance Bonds &amp; Advance Guarantees
</h3>
<span className="text-xs text-slate-500">
              Standard 10% Contractor Security under JBC 1999
</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-sm">
<thead>
<tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold ">
<th className="py-3 px-4">Bond Reference #</th>
<th className="py-3 px-4">Bond Type</th>
<th className="py-3 px-4">Guarantor (Bank / Insurer)</th>
<th className="py-3 px-4 text-right">Guaranteed Sum (KES)</th>
<th className="py-3 px-4">Effective Date</th>
<th className="py-3 px-4">Expiry Date</th>
<th className="py-3 px-4 text-center">Claim Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {bonds.map((bnd) => (
<tr key={bnd.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
<td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {bnd.bondReferenceNo}
</td>
<td className="py-3 px-4 text-xs">
<span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {bnd.bondType.replace(/_/g, ' ')}
</span>
</td>
<td className="py-3 px-4 font-semibold">{bnd.issuingInstitution}</td>
<td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatKes(bnd.bondAmount)}
</td>
<td className="py-3 px-4 tabular-nums text-xs">{bnd.effectiveDate}</td>
<td className="py-3 px-4 tabular-nums text-xs">{bnd.expiryDate}</td>
<td className="py-3 px-4 text-center">
<span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          bnd.claimStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
}`}
                      >
                         {bnd.claimStatus}
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}

      {/* Issue Retention Release Modal */}
      {showReleaseModal && (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Issue Subcontractor Retention Release
</h3>
<p className="text-xs text-slate-500 mb-4">
              Dual-moiety retention release under JBC 1999 Clause 30 (50% on PC, 50% post-DLP).
</p>
<form onSubmit={handleCreateReleaseSubmit} className="space-y-4 text-sm">
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
<option value="FIRST_MOIETY_PRACTICAL_COMPLETION">First Moiety (Practical Completion - 50%)</option>
<option value="SECOND_MOIETY_FINAL_COMPLETION">Second Moiety (Final Completion Post-DLP - 50%)</option>
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
                    Release % (Max 50%)
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
                  onClick={() => setShowReleaseModal(false)}
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
)}

      {/* Register Contractor Bond Modal */}
      {showBondModal && (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Register Contractor Bank Bond / Guarantee
</h3>
<p className="text-xs text-slate-500 mb-4">
              Registers bank guarantees (Performance Bond, Advance Payment Guarantee) under JBC 1999.
</p>
<form onSubmit={handleCreateBondSubmit} className="space-y-4 text-sm">
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
                  onClick={() => setShowBondModal(false)}
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
)}
</div>
);
};
