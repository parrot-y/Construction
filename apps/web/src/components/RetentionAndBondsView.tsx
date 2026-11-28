import React, { useEffect, useState} from 'react';
import { useAppDialog } from './AppDialog';
import { formatKes } from '../ui';
import { api, apiErrorMessage } from '../lib/apiClient';
import { canReviewRetentionRelease, canDirectRetentionRelease } from '@construction/permissions';
import {
  ContractorBondsTable,
  demoContractorBonds,
  demoRetentionReleases,
  RegisterBondModal,
  ReleaseRetentionModal,
  RetentionReleasesTable,
} from './RetentionAndBondsView.parts';
import type {
  ContractorBondItem,
  RetentionReleaseItem,
  RetentionSummary,
} from './RetentionAndBondsView.parts';

export type { ContractorBondItem, RetentionReleaseItem, RetentionSummary } from './RetentionAndBondsView.parts';

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
  const dialog = useAppDialog();
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
    initialReleases || (import.meta.env.DEV ? demoRetentionReleases() : [])
);

  // Default state for Bonds
  const [bonds, setBonds] = useState<ContractorBondItem[]>(
    initialBonds || (import.meta.env.DEV ? demoContractorBonds() : [])
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
        const msg = String(err?.message ?? err ?? ''); // hygiene-allow
        // Maker-checker override: the API demands a >=15-char reason when the
        // approver is also the requester/recommender.
        if (action === 'APPROVE' && /overrideReason/i.test(msg)) {
          const reason = await dialog.prompt({
            title: 'Override approval reason required',
            message: 'You recommended or requested this release — approval needs an override reason (min 15 characters).',
            inputLabel: 'Override reason',
            confirmLabel: 'Approve anyway',
            minLength: 15,
            danger: true,
          });
          if (reason && reason.trim().length >= 15) {
            try {
              await post({ ...extra, overrideReason: reason.trim() });
              await reload();
              return;
            } catch (err2: any) {
              setReviewError(apiErrorMessage(err2));
              return;
            }
          }
          setReviewError('Approval cancelled — an override reason is required for self-approval.');
          return;
        }
        setReviewError(apiErrorMessage(err, `Could not ${action.toLowerCase()} the release.`));
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
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/30 text-blue-700 border border-blue-500/30 mb-2">
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
              className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
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
<div className="text-[10px] text-blue-700 mt-1">{pct.cap}% Retention Cap</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Retention Disbursed</div>
<div className="text-xl font-bold text-emerald-700 mt-1">{formatKes(summary.totalReleasedAmount)}</div>
<div className="text-[10px] text-emerald-700 mt-1">M-Pesa B2C / EFT Released</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Active Performance Bonds</div>
<div className="text-xl font-bold text-amber-700 mt-1">{bonds.filter((b) => b.claimStatus === 'ACTIVE').length} Active</div>
<div className="text-[10px] text-amber-300/80 mt-1">Commercial Bank Underwritten</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-blue-800/30">
<div className="text-xs text-blue-200/70">Total Bond Guarantees</div>
<div className="text-xl font-bold text-white mt-1">{formatKes(bonds.reduce((s, b) => s + parseFloat(b.bondAmount), 0))}</div>
<div className="text-[10px] text-slate-600 mt-1">Risk Protection Ceiling</div>
</div>
</div>
</div>

      {/* Tabs */}
<div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
<button
          onClick={() => setActiveTab('RETENTION')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'RETENTION'
              ? 'border-blue-600 text-blue-700 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
}`}
        >
<span> Subcontractor Retention Releases ({releases.length})</span>
</button>
<button
          onClick={() => setActiveTab('BONDS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'BONDS'
              ? 'border-blue-600 text-blue-700 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
}`}
        >
<span> Contractor Bonds &amp; Guarantees ({bonds.length})</span>
</button>
</div>

      {/* Tab 1: Retention Releases Table */}
      {activeTab === 'RETENTION' && (
<RetentionReleasesTable
            releases={releases}
            pct={pct}
            canReviewRelease={canReviewRelease}
            canDirectRelease={canDirectRelease}
            reviewError={reviewError}
            onReview={handleReview}
            onDisburse={handleDisburseClick}
          />
)}

      {/* Tab 2: Bonds Table */}
      {activeTab === 'BONDS' && (
<ContractorBondsTable bonds={bonds} />
)}

      {/* Issue Retention Release Modal */}
      {showReleaseModal && (
<ReleaseRetentionModal
            isLive={isLive}
            subPkgs={subPkgs}
            pct={pct}
            moietyMaxPct={moietyMaxPct}
            releasePackageId={releasePackageId}
            setReleasePackageId={setReleasePackageId}
            releaseNo={releaseNo}
            setReleaseNo={setReleaseNo}
            firmName={firmName}
            setFirmName={setFirmName}
            moietyStage={moietyStage}
            setMoietyStage={setMoietyStage}
            totalHeld={totalHeld}
            setTotalHeld={setTotalHeld}
            releasePct={releasePct}
            setReleasePct={setReleasePct}
            defectVerified={defectVerified}
            setDefectVerified={setDefectVerified}
            qsNotes={qsNotes}
            setQsNotes={setQsNotes}
            onSubmit={handleCreateReleaseSubmit}
            onClose={() => setShowReleaseModal(false)}
          />
)}

      {/* Register Contractor Bond Modal */}
      {showBondModal && (
<RegisterBondModal
            bondType={bondType}
            setBondType={setBondType}
            issuingBank={issuingBank}
            setIssuingBank={setIssuingBank}
            bondRef={bondRef}
            setBondRef={setBondRef}
            bondAmount={bondAmount}
            setBondAmount={setBondAmount}
            effectiveDate={effectiveDate}
            setEffectiveDate={setEffectiveDate}
            expiryDate={expiryDate}
            setExpiryDate={setExpiryDate}
            onSubmit={handleCreateBondSubmit}
            onClose={() => setShowBondModal(false)}
          />
)}
{dialog.element}
</div>
);
};
