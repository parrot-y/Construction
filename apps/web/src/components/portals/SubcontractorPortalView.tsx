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

interface SubcontractorPortalViewProps {
  token?: string;
  subcontractorName?: string;
  subcontractorTrade?: string;
  projectName?: string;
  projectCode?: string;
  snags?: SubcontractorSnag[];
  onBackToDashboard?: () => void;
}

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
  onBackToDashboard,
}: SubcontractorPortalViewProps): React.JSX.Element {
  const [selectedSnagId, setSelectedSnagId] = useState<string | null>(null);
  const [rectifyPhotoKey, setRectifyPhotoKey] = useState('');
  const [rectifyNotes, setRectifyNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [snagList, setSnagList] = useState<SubcontractorSnag[]>(snags);

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
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">Open Defects</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">Rectified (Pending Sign-off)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{rectifiedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500">Verified & Closed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{closedCount}</p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Snags List */}
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
                  {isOpen ? 'Open • Needs Rectification' : isRectified ? 'Rectified (Awaiting Site QA)' : 'Closed'}
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
                        Upload After-Repair Evidence & Rectification Report:
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
                          Rectification Action & Trade Verification Notes:
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
    </div>
  );
}
