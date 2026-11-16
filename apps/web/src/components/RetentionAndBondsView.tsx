import React, { useEffect, useState} from 'react';
import { formatKes, ResponsiveTable } from '../ui';
import { api } from '../lib/apiClient';
import { statusLabel } from '../lib/status-labels';
import { canReviewRetentionRelease, canDirectRetentionRelease } from '@construction/permissions';

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
  userRole = '',
  onCreateRelease,
  onReviewRelease,
  onCreateBond,
}) => {
  const canReviewRelease = canReviewRetentionRelease(userRole);
  const canDirectRelease = canDirectRetentionRelease(userRole);
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

  // Round H3: retention schedule labels come from the project's own
  // settings — never hard-coded 5%/50%.
  const [projTerms, setProjTerms] = useState<{ rate: string; cap: string; first: string; second: string } | null>(null);
  const termsApplied = React.useRef(false);
  const fmtPct = (v: unknown, fallback: number) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    const p = Number.isFinite(n) ? n : fallback;
    return `${p.toFixed(2).replace(/\.00$/, '')}`;
  };

  const isLive = !!projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive || !projectId) return;
    try {
      const [rj, bj, pj, prj] = await Promise.all([
        api.get<{ releases?: RetentionReleaseItem[] }>(`/api/v1/projects/${projectId}/subcontractor-retention-releases`).catch(() => null),
        api.get<{ bonds?: ContractorBondItem[] }>(`/api/v1/projects/${projectId}/contractor-bonds`).catch(() => null),
        api.get<{ packages?: Array<{ id: string; firm_name: string }> }>(`/api/v1/projects/${projectId}/subcontractors`).catch(() => null),
        api.get<Record<string, unknown>>(`/api/v1/projects/${projectId}`).catch(() => null),
      ]);
      if (rj) setReleases(rj.releases || []);
      if (bj) setBonds(bj.bonds || []);
      if (pj) setSubPkgs((pj.packages || []).map((p) => ({ id: p.id, firm_name: p.firm_name})));
      const p = (prj as any)?.project ?? prj;
      if (p && !termsApplied.current) {
        termsApplied.current = true;
        const first = parseFloat(String(p.retention_first_moiety_pct ?? '50')) || 50;
        const second = 100 - first;
        setProjTerms({
          rate: fmtPct(p.retention_rate_pct, 5),
          cap: fmtPct(p.retention_cap_pct, 5),
          first: fmtPct(first, 50),
          second: fmtPct(second, 50),
        });
        setReleasePct(first.toFixed(2));
        setQsNotes(`First moiety ${fmtPct(first, 50)}% retention recommended for release upon practical completion.`);
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

  const pct = projTerms ?? { rate: '5', cap: '5', first: '50', second: '50' };
  const moietyMaxPct = moietyStage === 'FIRST_MOIETY_PRACTICAL_COMPLETION' ? pct.first : pct.second;

  const handleCreateReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const held = parseFloat(totalHeld) || 0;
    const pctNum = parseFloat(releasePct) || parseFloat(pct.first) || 50;
    const amt = held * (pctNum / 100);

    const newRel: RetentionReleaseItem = {
      id: `rel-${Date.now()}`,
      releaseNo,
      subcontractorPackageId: `sub-pkg-${Date.now()}`,
      firmName,
      tradeCategory: 'SPECIALIST_TRADE',
      moietyStage,
      totalRetentionHeld: held.toFixed(2),
      releasePercentage: pctNum.toFixed(2),
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
          await api.post(`/api/v1/projects/${projectId}/subcontractor-retention-releases`, {
            subcontractorPackageId: releasePackageId,
            releaseNo,
            moietyStage,
            totalRetentionHeld: held.toFixed(2),
            releasePercentage: pctNum.toFixed(2),
            releaseAmount: amt.toFixed(2),
            qsRecommendationNotes: qsNotes || null,
            defectClearanceVerified: defectVerified,
});
          await reload();
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

  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleReview = async (releaseId: string, action: 'RECOMMEND' | 'APPROVE' | 'REJECT' | 'MARK_PAID', extra: Record<string, unknown> = {}) => {
    setReviewError(null);
    const statusFor = { RECOMMEND: 'QS_RECOMMENDED', APPROVE: 'APPROVED_BY_DIRECTOR', REJECT: 'REJECTED', MARK_PAID: 'PAID' } as const;

    if (isLive && projectId) {
      const post = (payload: Record<string, unknown>) =>
        api.post<{ status?: string }>(`/api/v1/projects/${projectId}/subcontractor-retention-releases/${releaseId}/review`, { action, ...payload });
      try {
        await post(extra);
        await reload();
        return;
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? '');
        // Maker-checker override: the API demands a >=15-char reason when the
        // approver is also the requester/recommender.
        if (action === 'APPROVE' && /overrideReason/i.test(msg)) {
          const reason = window.prompt('You recommended or requested this release — approval needs an override reason (min 15 characters):');
          if (reason && reason.trim().length >= 15) {
            try {
              await post({ ...extra, overrideReason: reason.trim() });
              await reload();
              return;
            } catch (err2: any) {
              setReviewError(String(err2?.message ?? err2));
              return;
            }
          }
          setReviewError('Approval cancelled — an override reason is required for self-approval.');
          return;
        }
        setReviewError(msg || `Could not ${action.toLowerCase()} the release.`);
        return;
      }
    }

    if (onReviewRelease) {
      await onReviewRelease(releaseId, statusFor[action], extra.disbursementRef as string | undefined);
    }
    setReleases(
      releases.map((r) =>
        r.id === releaseId
          ? {
              ...r,
              status: statusFor[action],
              ...(action === 'MARK_PAID'
                ? { disbursementRef: extra.disbursementRef as string, disbursedAt: new Date().toISOString() }
                : {}),
            }
          : r,
      ),
    );
  };

  const handleDisburseClick = async (releaseId: string) => {
    const ref = `MPESA-B2C-${Date.now().toString().slice(-6)}`;
    await handleReview(releaseId, 'MARK_PAID', { disbursementRef: ref });
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
          await api.post(`/api/v1/projects/${projectId}/contractor-bonds`, {
            bondType,
            issuingInstitution: issuingBank,
            bondReferenceNo: bondRef,
            bondAmount,
            effectiveDate,
            expiryDate,
            claimStatus: 'ACTIVE',
            dischargeCertificateRef: null,
});
          await reload();
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
              Project:<span className="font-semibold text-white">{projectName}</span> | {pct.first}% Practical Completion Release, {pct.second}% Post-DLP Expiry Release &amp; Bank Guarantee Expiry Monitor
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
<div className="text-[10px] text-blue-300 mt-1">{pct.cap}% Retention Cap</div>
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
                                  ? handleDisburseClick(rel.id)
                                  : handleReview(rel.id, rel.status === 'PENDING_QS_REVIEW' ? 'RECOMMEND' : 'APPROVE')
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
                            onClick={() => handleReview(rel.id, 'REJECT')}
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
)}

      {/* Issue Retention Release Modal */}
      {showReleaseModal && (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Issue Subcontractor Retention Release
</h3>
<p className="text-xs text-slate-500 mb-4">
              Dual-moiety retention release under JBC 1999 Clause 30 ({pct.first}% on PC, {pct.second}% post-DLP).
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
