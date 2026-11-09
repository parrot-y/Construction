import React, { useEffect, useState} from 'react';
import { formatKes } from '../../ui';
import { PortalLinkNotice, PortalExpiryBanner } from './PortalErrorState';

export interface SubcontractorSnag {
  id: string;
  snag_number: string;
  location: string;
  description: string;
  severity: 'COSMETIC' | 'MINOR' | 'CRITICAL';
  status: 'OPEN' | 'RECTIFIED_BY_CONTRACTOR' | 'VERIFIED_CLOSED' | 'REJECTED';
  trade_category: string;
  assigned_trade_firm?: string;
  created_at: string;
  photos?: Array<{
    id: string;
    photo_type: 'DEFECT' | 'RECTIFIED';
    storage_key: string;
    caption?: string;
}>;
}

export interface SubcontractMilestone {
  id: string;
  milestoneName: string;
  pct: number;
  grossKes: string;
  retentionKes: string;
  netKes: string;
  status: 'PAID' | 'CERTIFIED' | 'UNDER_REVIEW' | 'PENDING_CLAIM';
  certifiedDate?: string;
}

export interface SubcontractCommercialSummary {
  contractSumKes: string;
  cumulativeCertifiedKes: string;
  retentionWithheldKes: string;
  retentionRatePct: number; // 5% Kenyan norm
  netDisbursedKes: string;
  milestones: SubcontractMilestone[];
}

interface SubcontractorPortalViewProps {
  token?: string;
  subcontractorName?: string;
  subcontractorTrade?: string;
  projectName?: string;
  projectCode?: string;
  onBackToDashboard?: () => void;
}

export default function SubcontractorPortalView({
  token,
  subcontractorName,
  subcontractorTrade,
  projectName,
  projectCode,
  onBackToDashboard,
}: SubcontractorPortalViewProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [stakeholder, setStakeholder] = useState({ name: subcontractorName || '', trade: subcontractorTrade || '' });
  const [proj, setProj] = useState({ name: projectName || '', code: projectCode || '' });
  const [snagList, setSnagList] = useState<SubcontractorSnag[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedSnagId, setSelectedSnagId] = useState<string | null>(null);
  const [rectifyPhotoKey, setRectifyPhotoKey] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [rectifyNotes, setRectifyNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'DEFECTS' | 'VALUATIONS'>('DEFECTS');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimPackageId, setClaimPackageId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); setLoadError('Missing portal token.'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/portals/subcontractor/${token}`, { credentials: 'include' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || 'This portal link is invalid or has expired');
        if (cancelled) return;
        const d = body.data || body;
        if (d.stakeholder) setStakeholder({ name: d.stakeholder.name || '', trade: d.stakeholder.trade || '' });
        if (d.linkExpiresAt) setLinkExpiresAt(d.linkExpiresAt);
        if (d.project) setProj({ name: d.project.name || '', code: d.project.code || '' });
        setSnagList((d.snags || []).map((s: any) => ({
          id: s.id,
          snag_number: `SNG-${String(s.snag_number).padStart(3, '0')}`,
          location: [s.locationBlock, s.locationFloor, s.locationRoom].filter(Boolean).join(', ') || '—',
          description: s.description,
          severity: s.severity === 'CRITICAL_SAFETY' ? 'CRITICAL' : s.severity === 'FUNCTIONAL' ? 'MINOR' : 'COSMETIC',
          status: s.status,
          trade_category: s.tradeCategory || '',
          assigned_trade_firm: '',
          created_at: s.identifiedAt,
          photos: (s.photos || []).map((ph: any) => ({
            id: ph.id, photo_type: ph.photoType, storage_key: ph.storageKey, caption: ph.caption,
          })),
        })));
        setPackages(d.packages || []);
        if ((d.packages || []).length > 0) setClaimPackageId(d.packages[0].id);
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || 'Failed to load portal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-sm text-slate-400">Loading portal…</div>;
  }
  if (loadError) {
    const isExpired = /expired/i.test(loadError);
    const isRevoked = /revoked|invalid/i.test(loadError);
    return (
      <div className="max-w-5xl mx-auto">
        <PortalLinkNotice kind={isExpired ? 'expired' : isRevoked ? 'revoked' : 'error'} message={loadError} />
        {onBackToDashboard && <div className="text-center pb-8"><button onClick={onBackToDashboard} className="text-xs text-blue-600 hover:underline">Back</button></div>}
      </div>
    );
  }

  // Commercial summary derived from real work packages + valuations
  const commercialSummary: SubcontractCommercialSummary = (() => {
    const contractSum = packages.reduce((a: number, p: any) => a + Number(p.subcontractSum || 0), 0);
    const allVals = packages.flatMap((p: any) => p.valuations || []);
    const certified = allVals.filter((v: any) => ['QS_VERIFIED', 'APPROVED_FOR_PAYMENT', 'PAID'].includes(v.paymentStatus))
      .reduce((a: number, v: any) => a + Number(v.grossWorkCertifiedKes || 0), 0);
    const retention = allVals.reduce((a: number, v: any) => a + Number(v.retentionDeductedKes || 0), 0);
    const milestones: SubcontractMilestone[] = packages.flatMap((p: any) =>
      (p.valuations || []).map((v: any) => {
        const pkgSum = Number(p.subcontractSum || 0);
        const gross = Number(v.grossWorkCertifiedKes || 0);
        return {
          id: v.id,
          milestoneName: `${p.tradeCategory} — ${v.certificateNo}`,
          pct: pkgSum > 0 ? Math.round((gross / pkgSum) * 1000) / 10 : 0,
          grossKes: v.grossWorkCertifiedKes,
          retentionKes: v.retentionDeductedKes,
          netKes: v.netPayableKes,
          status: v.paymentStatus === 'PAID' ? 'PAID' : v.paymentStatus === 'REJECTED' ? 'PENDING_CLAIM' : 'CERTIFIED',
          certifiedDate: v.valuationDate ? String(v.valuationDate).split('T')[0] : undefined,
        };
      }),
    );
    return {
      contractSumKes: String(contractSum),
      cumulativeCertifiedKes: String(certified),
      retentionWithheldKes: String(retention),
      retentionRatePct: packages[0] ? Number(packages[0].retentionRatePct || 5) : 5,
      netDisbursedKes: allVals.filter((v: any) => v.paymentStatus === 'PAID')
        .reduce((a: number, v: any) => a + Number(v.netPayableKes || 0), 0)
        .toString(),
      milestones,
    };
  })();

  const openCount = snagList.filter((s) => s.status === 'OPEN').length;
  const rectifiedCount = snagList.filter((s) => s.status === 'RECTIFIED_BY_CONTRACTOR').length;
  const closedCount = snagList.filter((s) => s.status === 'VERIFIED_CLOSED').length;

  const handleRectifySubmit = async (snagId: string) => {
    if (!rectifyPhotoKey.trim()) {
      setFeedback('Photo proof storage key or photo file is required to verify defect rectification.');
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/portals/subcontractor/${token}/snags/${snagId}/rectify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoStorageKey: rectifyPhotoKey.trim(),
          notes: rectifyNotes.trim() || `Rectified by ${stakeholder.name}`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Error updating snag rectification.');
      setFeedback('Defect marked as rectified! Awaiting Site Supervisor sign-off.');
      setSnagList((prev) => prev.map((s) => s.id === snagId ? { ...s, status: 'RECTIFIED_BY_CONTRACTOR' } : s));
      setSelectedSnagId(null);
      setRectifyPhotoKey('');
      setRectifyNotes('');
    } catch (e: any) {
      setFeedback(e.message || 'Network error — rectification not submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const gross = Number(String(claimAmount).replace(/[^0-9.]/g, ''));
    if (!claimPackageId || !Number.isFinite(gross) || gross <= 0) {
      setFeedback('Select a work package and enter a valid amount.');
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/portals/subcontractor/${token}/valuations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: claimPackageId, grossWorkCertifiedKes: gross, notes: claimNotes.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Valuation submission failed.');
      setFeedback(`Valuation ${body.data?.certificate_no || ''} submitted to QS for verification.`);
      setShowClaimModal(false);
      setClaimAmount('');
      setClaimNotes('');
    } catch (e: any) {
      setFeedback(e.message || 'Network error — valuation not submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
<div className="max-w-5xl mx-auto space-y-6" data-testid="subcontractor-portal-view">
      <PortalExpiryBanner expiresAt={linkExpiresAt} />
      {/* Header */}
<header className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-2">
<span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Subcontractor Portal
</span>
<span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Secured project link
</span>
</div>
<h1 className="text-xl font-bold mt-2 text-slate-900">{proj.name} ({proj.code})</h1>
<p className="text-xs text-slate-500">
            Assigned Trade:<span className="text-slate-700 font-semibold">{stakeholder.name}</span> ({stakeholder.trade})
</p>
</div>

<div className="flex items-center gap-3">
          {onBackToDashboard && (
<button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              ← Back to Project
</button>
)}
</div>
</header>
      {/* What you can do here */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-bold text-slate-500 mb-2">What you can do here</p>
<ul className="text-xs text-slate-600 space-y-1">
            <li>• See defects assigned to your trade and upload photo proof to rectify them</li>
            <li>• Track your valuation claims, certified amounts and retention held</li>
            <li>• Submit a new valuation claim against your work package</li>
</ul>
</div>


      {/* KPI Stats — tiles hidden while their values are all zero */}
{(openCount > 0 || rectifiedCount > 0 || closedCount > 0 || Number(commercialSummary.contractSumKes) > 0) && (
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
{openCount > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
<p className="text-xs font-semibold text-slate-500">Open Defects</p>
<p className="text-2xl font-bold text-amber-600 mt-1">{openCount}</p>
</div>
)}
{rectifiedCount > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
<p className="text-xs font-semibold text-slate-500">Rectified (Pending Sign-off)</p>
<p className="text-2xl font-bold text-blue-600 mt-1">{rectifiedCount}</p>
<span className="text-[10px] text-slate-400">({closedCount} verified &amp; closed)</span>
</div>
)}
{closedCount > 0 && rectifiedCount === 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
<p className="text-xs font-semibold text-slate-500">Verified &amp; Closed</p>
<p className="text-2xl font-bold text-emerald-600 mt-1">{closedCount}</p>
</div>
)}
{Number(commercialSummary.contractSumKes) > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
<p className="text-xs font-semibold text-slate-500">Subcontract Sum</p>
<p className="text-base font-bold text-slate-900 mt-1 font-mono">{formatKes(commercialSummary.contractSumKes)}</p>
</div>
)}
{Number(commercialSummary.retentionWithheldKes) > 0 && (
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
<p className="text-xs font-semibold text-slate-500">{commercialSummary.retentionRatePct}% Retention Held</p>
<p className="text-base font-bold text-purple-700 mt-1 font-mono">{formatKes(commercialSummary.retentionWithheldKes)}</p>
</div>
)}
</div>
)}

      {feedback && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center shadow-sm">
<span> {feedback}</span>
<button onClick={() => setFeedback(null)} className="text-emerald-600 font-bold ml-2">×</button>
</div>
)}

      {/* Navigation Tabs */}
<div className="flex border-b border-slate-200 gap-2">
<button
          onClick={() => setActiveTab('DEFECTS')}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'DEFECTS'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
}`}
        >
           Defect Rectification Register ({openCount} open)
</button>
<button
          onClick={() => setActiveTab('VALUATIONS')}
          data-testid="subcontractor-valuations-tab"
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'VALUATIONS'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
}`}
        >
           Trade Valuations &amp; 5% Retention Ledger
</button>
</div>

      {/* Tab 1: Defect Rectification Register */}
      {activeTab === 'DEFECTS' && (
<div className="space-y-4">
          {snagList.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8">No snagging items assigned to your trade yet — snags raised against your scope appear here; rectify with photo proof to close them.</p>
)}
          {snagList.map((snag) => {
            const isOpen = snag.status === 'OPEN';
            const isRectified = snag.status === 'RECTIFIED_BY_CONTRACTOR';
            const isSelected = selectedSnagId === snag.id;

            return (
<div
                key={snag.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
                data-testid={`subcontractor-snag-${snag.snag_number}`}
              >
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div className="flex items-center gap-2">
<span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {snag.snag_number}
</span>
<span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {snag.location}
</span>
<span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        snag.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : snag.severity === 'MINOR'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
}`}
                    >
                      {snag.severity}
</span>
</div>

<span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isOpen
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : isRectified
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
}`}
                  >
                    {isOpen ? 'Open • Needs Rectification' : isRectified ? 'Rectified (Pending Sign-off)' : 'Verified & Closed'}
</span>
</div>

<p className="text-xs text-slate-800 leading-relaxed">{snag.description}</p>

                {/* Photos */}
                {snag.photos && snag.photos.length > 0 && (
<div className="flex gap-2 flex-wrap">
                    {snag.photos.map((p) => (
<div
                        key={p.id}
                        className="text-[11px] p-2 bg-slate-50 border border-slate-200 rounded flex items-center gap-2"
                      >
<span className="font-bold text-slate-600 text-[10px]">
                          [{p.photo_type} Photo]:
</span>
<span className="text-slate-500 font-mono text-[10px] truncate max-w-xs">{p.storage_key}</span>
</div>
))}
</div>
)}

                {/* Action Form */}
                {isOpen && (
<div className="pt-2">
                    {!isSelected ? (
<button
                        onClick={() => setSelectedSnagId(snag.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition"
                      >
                        Submit Defect Rectification Proof
</button>
) : (
<div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
<p className="text-xs font-bold text-amber-900">
                          Upload After-Repair Evidence &amp; Rectification Report:
</p>

<div>
<label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            After-Repair Photo (required):
</label>
<input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,video/mp4,video/quicktime"
                            disabled={uploadingPhoto}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingPhoto(true);
                              setFeedback(null);
                              try {
                                const fd = new FormData();
                                fd.append('file', file);
                                const up = await fetch(`/api/v1/portals/subcontractor/${token}/snags/${snag.id}/upload`, { method: 'POST', body: fd });
                                const ub = await up.json().catch(() => ({}));
                                if (!up.ok) throw new Error(ub.message || 'Photo upload failed');
                                setRectifyPhotoKey(ub.data?.storageKey || '');
                                setFeedback('Photo uploaded — submit to mark the defect rectified.');
                              } catch (err: any) {
                                setFeedback(err.message || 'Photo upload failed');
                              } finally {
                                setUploadingPhoto(false);
                                e.target.value = '';
                              }
                            }}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
{uploadingPhoto && <p className="text-[11px] text-slate-500 mt-1">Uploading photo…</p>}
{rectifyPhotoKey && !uploadingPhoto && <p className="text-[11px] text-emerald-700 mt-1">Photo attached.</p>}
</div>

<div>
<label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Rectification Action &amp; Trade Verification Notes:
</label>
<input
                            type="text"
                            value={rectifyNotes}
                            onChange={(e) => setRectifyNotes(e.target.value)}
                            placeholder="e.g. Tightened compression coupling, tested under full mains pressure with zero leakage."
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
</div>

<div className="flex gap-2 justify-end pt-1">
<button
                            type="button"
                            onClick={() => {
                              setSelectedSnagId(null);
                              setRectifyPhotoKey('');
                              setRectifyNotes('');
}}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                          >
                            Cancel
</button>
<button
                            type="button"
                            disabled={submitting || uploadingPhoto || !rectifyPhotoKey.trim()}
                            onClick={() => handleRectifySubmit(snag.id)}
                            className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition"
                          >
                            {submitting ? 'Submitting...' : 'Mark Rectified (GPS Verified)'}
</button>
</div>
</div>
)}
</div>
)}
</div>
);
})}
</div>
)}

      {/* Tab 2: Trade Valuations & 5% Retention Ledger */}
      {activeTab === 'VALUATIONS' && (
<div className="space-y-4">
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
<div>
<h3 className="text-sm font-bold text-slate-900">
                  Subcontract Milestone Valuations &amp; Retention Schedule
</h3>
<p className="text-xs text-slate-500">
                  Certified progress claims under Kenyan Standard Form of Subcontract Agreement
</p>
</div>
<button
                type="button"
                onClick={() => setShowClaimModal(true)}
                data-testid="submit-milestone-claim-btn"
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-xs transition"
              >
                + Submit Milestone Claim
</button>
</div>

<div className="overflow-x-auto">
<table className="w-full text-xs text-left">
<thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
<tr>
<th className="p-3">Milestone Scope of Work</th>
<th className="p-3">Weight (%)</th>
<th className="p-3">Contract Value</th>
<th className="p-3">{commercialSummary.retentionRatePct}% Retention</th>
<th className="p-3">Net Payable</th>
<th className="p-3">Claim Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
                  {commercialSummary.milestones.length === 0 && (
<tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">No valuation claims certified yet — submit a milestone claim below and the QS will certify it here.</td></tr>
)}
                  {commercialSummary.milestones.map((m) => (
<tr key={m.id} className="hover:bg-slate-50">
<td className="p-3 font-medium text-slate-900">
                          {m.milestoneName}
                          {m.certifiedDate && (
<span className="block text-[10px] text-slate-400">Certified: {m.certifiedDate}</span>
)}
</td>
<td className="p-3 font-bold text-slate-700">{m.pct}%</td>
<td className="p-3 font-mono font-bold text-slate-900">{formatKes(m.grossKes)}</td>
<td className="p-3 font-mono text-purple-700">{formatKes(m.retentionKes)}</td>
<td className="p-3 font-mono font-bold text-emerald-700">{formatKes(m.netKes)}</td>
<td className="p-3">
<span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              m.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : m.status === 'CERTIFIED'
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
}`}
                          >
                            {m.status.replace('_', ' ')}
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
</div>
)}

      {/* Submit Milestone Claim Modal */}
      {showClaimModal && (
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
<div className="flex justify-between items-start border-b border-slate-100 pb-3">
<div>
<span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Subcontractor Interim Claim
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
                  Submit Milestone Progress Claim
</h3>
</div>
<button onClick={() => setShowClaimModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                
</button>
</div>

<form onSubmit={handleSubmitClaim} className="space-y-3 text-xs">
<div>
<label className="block font-semibold text-slate-700 mb-1">
                  Work Package:
</label>
<select
                  required
                  value={claimPackageId}
                  onChange={(e) => setClaimPackageId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  {packages.map((pkg: any) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.tradeCategory} — {pkg.firmName}</option>
                  ))}
                </select>
</div>

{(() => {
                  const pkg = packages.find((p: any) => p.id === claimPackageId);
                  if (!pkg) return null;
                  const vals = pkg.valuations || [];
                  const certifiedToDate = vals.length ? Math.max(...vals.map((v: any) => Number(v.grossWorkCertifiedKes || 0))) : 0;
                  const packageSum = Number(pkg.subcontractSum || 0);
                  const remaining = Math.max(0, packageSum - certifiedToDate);
                  return (
<div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
<div>
<p className="text-[10px] text-slate-500 font-semibold">Package value</p>
<p className="text-xs font-bold text-slate-900 font-mono">{formatKes(String(packageSum))}</p>
</div>
<div>
<p className="text-[10px] text-slate-500 font-semibold">Certified to date</p>
<p className="text-xs font-bold text-slate-900 font-mono">{formatKes(String(certifiedToDate))}</p>
</div>
<div>
<p className="text-[10px] text-slate-500 font-semibold">Remaining</p>
<p className="text-xs font-bold text-emerald-700 font-mono">{formatKes(String(remaining))}</p>
</div>
</div>
);
                })()}

<div>
<label className="block font-semibold text-slate-700 mb-1">
                  Claim Valuation Amount (KES Gross, cumulative):
</label>
<input
                  type="text"
                  required
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
<p className="text-[10px] text-slate-500 mt-0.5">
                  Contract retention and 3% WHT are calculated automatically on submission.
</p>
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">Notes (optional):</label>
<textarea
                  rows={2}
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
</div>
<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-3.5 py-2 text-slate-600 border border-slate-300 rounded-lg font-semibold"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit to QS'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}
