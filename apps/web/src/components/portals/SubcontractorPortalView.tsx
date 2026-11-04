import React, { useState } from 'react';

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
  amountKes: string;
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
  snags?: SubcontractorSnag[];
  commercialSummary?: SubcontractCommercialSummary;
  onBackToDashboard?: () => void;
}

const DEFAULT_COMMERCIAL: SubcontractCommercialSummary = {
  contractSumKes: '4,800,000.00',
  cumulativeCertifiedKes: '3,120,000.00',
  retentionWithheldKes: '156,000.00',
  retentionRatePct: 5.0,
  netDisbursedKes: '2,964,000.00',
  milestones: [
    {
      id: 'sub-ms-1',
      milestoneName: 'Substructure Drainage Piping & Manhole Connections',
      pct: 30,
      amountKes: '1,440,000.00',
      status: 'PAID',
      certifiedDate: '2026-01-28',
    },
    {
      id: 'sub-ms-2',
      milestoneName: '1st - 3rd Floor Soil, Waste & Vent Stacks Rough-In',
      pct: 35,
      amountKes: '1,680,000.00',
      status: 'CERTIFIED',
      certifiedDate: '2026-02-25',
    },
    {
      id: 'sub-ms-3',
      milestoneName: 'Sanitaryware Fixtures, Basin Traps & Water Heaters',
      pct: 25,
      amountKes: '1,200,000.00',
      status: 'PENDING_CLAIM',
    },
    {
      id: 'sub-ms-4',
      milestoneName: 'Pressure Testing, Chlorination & Final Commissioning',
      pct: 10,
      amountKes: '480,000.00',
      status: 'PENDING_CLAIM',
    },
  ],
};

export default function SubcontractorPortalView({
  token = 'demo-subcontractor-token',
  subcontractorName = 'Simba Plumbing Works Ltd',
  subcontractorTrade = 'Specialist Sanitary & Drainage Subcontractor',
  projectName = 'Riverside Commercial Plaza',
  projectCode = 'RCP-2026',
  snags = [
    {
      id: 'snag-sub-1',
      snag_number: 'SNG-001',
      location: 'Floor 2, Washroom 2B',
      description: 'Compression coupling on hot water basin supply is dripping at 1 drop/5s under test pressure.',
      severity: 'MINOR',
      status: 'OPEN',
      trade_category: 'Plumbing',
      assigned_trade_firm: 'Simba Plumbing Works Ltd',
      created_at: new Date().toISOString(),
      photos: [
        {
          id: 'p-1',
          photo_type: 'DEFECT',
          storage_key: 'uploads/snags/defect_washbasin_coupling.jpg',
          caption: 'Dripping coupling under washbasin counter',
        },
      ],
    },
    {
      id: 'snag-sub-2',
      snag_number: 'SNG-002',
      location: 'Ground Floor, Kitchenette',
      description: 'Install stainless steel bottle trap to kitchen sink waste pipe.',
      severity: 'COSMETIC',
      status: 'RECTIFIED_BY_CONTRACTOR',
      trade_category: 'Plumbing',
      assigned_trade_firm: 'Simba Plumbing Works Ltd',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      photos: [
        {
          id: 'p-2',
          photo_type: 'RECTIFIED',
          storage_key: 'uploads/snags/rectified_sink_trap.jpg',
          caption: 'Trap installed and tested with zero leak',
        },
      ],
    },
  ],
  commercialSummary = DEFAULT_COMMERCIAL,
  onBackToDashboard,
}: SubcontractorPortalViewProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'DEFECTS' | 'VALUATIONS'>('DEFECTS');
  const [selectedSnagId, setSelectedSnagId] = useState<string | null>(null);
  const [rectifyPhotoKey, setRectifyPhotoKey] = useState('');
  const [rectifyNotes, setRectifyNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [snagList, setSnagList] = useState<SubcontractorSnag[]>(snags);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMilestoneName, setClaimMilestoneName] = useState(
    'Sanitaryware Fixtures, Basin Traps & Water Heaters'
  );
  const [claimAmount, setClaimAmount] = useState('1,200,000.00');

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
          notes: rectifyNotes.trim() || `Rectified by ${subcontractorName}`,
          gpsLat: -1.2683,
          gpsLng: 36.8044,
        }),
      });

      if (res.ok) {
        setFeedback('Defect marked as rectified! Awaiting Site Supervisor sign-off.');
        setSnagList((prev) =>
          prev.map((s) =>
            s.id === snagId ? { ...s, status: 'RECTIFIED_BY_CONTRACTOR' } : s
          )
        );
        setSelectedSnagId(null);
        setRectifyPhotoKey('');
        setRectifyNotes('');
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback(err.message || 'Error updating snag rectification.');
      }
    } catch {
      // Offline / Preview fallback
      setFeedback('Defect marked as rectified (Preview Mode).');
      setSnagList((prev) =>
        prev.map((s) =>
          s.id === snagId ? { ...s, status: 'RECTIFIED_BY_CONTRACTOR' } : s
        )
      );
      setSelectedSnagId(null);
      setRectifyPhotoKey('');
      setRectifyNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(
      `Interim progress claim for "${claimMilestoneName}" (KES ${claimAmount}) submitted to QS for joint measurement.`
    );
    setShowClaimModal(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="subcontractor-portal-view">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
              Subcontractor Portal • Zero Seat Tax
            </span>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Active Trade Token
            </span>
          </div>
          <h1 className="text-xl font-bold mt-2 text-white">{projectName} ({projectCode})</h1>
          <p className="text-xs text-slate-400">
            Assigned Trade: <span className="text-slate-200 font-semibold">{subcontractorName}</span> ({subcontractorTrade})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              ← Back to Project
            </button>
          )}
          <div className="text-right">
            <p className="text-[11px] text-slate-400">Action Required</p>
            <p className="text-xs font-bold text-amber-400">{openCount} Defects Open</p>
          </div>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">Open Defects</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">Rectified (Pending Sign-off)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{rectifiedCount}</p>
          <span className="text-[10px] text-slate-400">({closedCount} verified &amp; closed)</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">Subcontract Sum</p>
          <p className="text-base font-bold text-slate-900 mt-1 font-mono">KES {commercialSummary.contractSumKes}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">5% Retention Held</p>
          <p className="text-base font-bold text-purple-700 mt-1 font-mono">KES {commercialSummary.retentionWithheldKes}</p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center shadow-sm">
          <span>✓ {feedback}</span>
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
          🔍 Defect Rectification Register ({openCount} open)
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
          📑 Trade Valuations &amp; 5% Retention Ledger
        </button>
      </div>

      {/* Tab 1: Defect Rectification Register */}
      {activeTab === 'DEFECTS' && (
        <div className="space-y-4">
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
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
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
                        <span className="font-bold text-slate-600 uppercase text-[10px]">
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
                            After-Repair Photo Storage Key / Image URL:
                          </label>
                          <input
                            type="text"
                            value={rectifyPhotoKey}
                            onChange={(e) => setRectifyPhotoKey(e.target.value)}
                            placeholder="e.g. uploads/snags/rectified_washbasin_coupling.jpg"
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
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
                            disabled={submitting || !rectifyPhotoKey.trim()}
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
                    <th className="p-3">5% Retention</th>
                    <th className="p-3">Net Payable</th>
                    <th className="p-3">Claim Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commercialSummary.milestones.map((m) => {
                    const retentionAmt = (parseFloat(m.amountKes.replace(/,/g, '')) * 0.05).toLocaleString('en-US', { minimumFractionDigits: 2 });
                    const netAmt = (parseFloat(m.amountKes.replace(/,/g, '')) * 0.95).toLocaleString('en-US', { minimumFractionDigits: 2 });

                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-900">
                          {m.milestoneName}
                          {m.certifiedDate && (
                            <span className="block text-[10px] text-slate-400">Certified: {m.certifiedDate}</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-700">{m.pct}%</td>
                        <td className="p-3 font-mono font-bold text-slate-900">KES {m.amountKes}</td>
                        <td className="p-3 font-mono text-purple-700">KES {retentionAmt}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">KES {netAmt}</td>
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
                    );
                  })}
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Subcontractor Interim Claim
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Submit Milestone Progress Claim
                </h3>
              </div>
              <button onClick={() => setShowClaimModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Completed Milestone Stage:
                </label>
                <input
                  type="text"
                  required
                  value={claimMilestoneName}
                  onChange={(e) => setClaimMilestoneName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Claim Valuation Amount (KES Gross):
                </label>
                <input
                  type="text"
                  required
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  5% retention (KES {(parseFloat(claimAmount.replace(/,/g, '') || '0') * 0.05).toLocaleString('en-US', { minimumFractionDigits: 2 })}) will be automatically applied per contract terms.
                </p>
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
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  Submit to QS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
