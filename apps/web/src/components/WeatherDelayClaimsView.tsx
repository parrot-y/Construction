import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';

export interface ProjectDelayEvent {
  id: string;
  delay_type: string;
  title: string;
  start_date: string;
  end_date: string;
  days_claimed: number;
  critical_path_impact: string;
  daily_lad_rate_kes: string | number;
  site_diary_reference?: string | null;
  meteorological_proof?: string | null;
  status: 'PENDING_REVIEW' | 'RECOMMENDED_BY_QS' | 'APPROVED_BY_ARCHITECT' | 'REJECTED';
  approved_days?: number | null;
  lad_financial_relief_kes?: string | number | null;
  certifying_authority?: string | null;
  notes?: string | null;
  created_at: string;
}

interface WeatherDelayClaimsViewProps {
  projectId: string;
  canClaim?: boolean;
  canReview?: boolean;
  initialEvents?: ProjectDelayEvent[];
  onClaimSubmitted?: (claim: Partial<ProjectDelayEvent>) => void;
  onClaimReviewed?: (id: string, updates: Partial<ProjectDelayEvent>) => void;
}

export default function WeatherDelayClaimsView({
  projectId,
  canClaim = true,
  canReview = true,
  initialEvents = [
    {
      id: 'delay-1',
      delay_type: 'WEATHER_INCLEMENT',
      title: 'El Niño Flash Flooding & Foundation Trench Inundation',
      start_date: '2026-03-01',
      end_date: '2026-03-12',
      days_claimed: 12,
      critical_path_impact: 'CRITICAL',
      daily_lad_rate_kes: '75000.00',
      site_diary_reference: 'DIARY-2026-03-01',
      meteorological_proof: 'Dagoretti Corner Meteorological Station: 154mm rainfall over 48 hours exceeding 15-year statistical normal.',
      status: 'APPROVED_BY_ARCHITECT',
      approved_days: 10,
      lad_financial_relief_kes: '750000.00',
      certifying_authority: 'Arch. Peter Kamau (BORAQS #1192)',
      notes: 'Certified 10 days extension under JBC 1999 Clause 25.1(b). 2 days concurrently absorbed in formwork curing.',
      created_at: '2026-03-13T10:00:00Z',
    },
    {
      id: 'delay-2',
      delay_type: 'ARCHITECT_INSTRUCTION',
      title: 'Structural Redesign of Ground Floor Transfer Beam Grid C',
      start_date: '2026-03-15',
      end_date: '2026-03-21',
      days_claimed: 6,
      critical_path_impact: 'CRITICAL',
      daily_lad_rate_kes: '75000.00',
      site_diary_reference: 'DIARY-2026-03-16',
      meteorological_proof: null,
      status: 'PENDING_REVIEW',
      approved_days: null,
      lad_financial_relief_kes: null,
      certifying_authority: null,
      notes: 'Work held pending revised structural rebar schedule from consulting engineer.',
      created_at: '2026-03-22T08:30:00Z',
    },
  ],
  onClaimSubmitted,
  onClaimReviewed,
}: WeatherDelayClaimsViewProps) {
  const [events, setEvents] = useState<ProjectDelayEvent[]>(initialEvents);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<string>('WEATHER_INCLEMENT');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [newDaysClaimed, setNewDaysClaimed] = useState<number>(7);
  const [newLadRate, setNewLadRate] = useState<string>('75000.00');
  const [newMetProof, setNewMetProof] = useState<string>('');
  const [newDiaryRef, setNewDiaryRef] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  const filtered = events.filter((e) => {
    const matchesType = typeFilter === 'ALL' || e.delay_type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
    return matchesType && matchesStatus;
  });

  const totalClaims = events.length;
  const totalDaysClaimed = events.reduce((sum, e) => sum + e.days_claimed, 0);
  const totalApprovedDays = events.reduce((sum, e) => sum + (e.approved_days || 0), 0);
  const totalFinancialRelief = events.reduce(
    (sum, e) => sum + (Number(e.lad_financial_relief_kes) || 0),
    0
  );

  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStartDate || !newEndDate) return;

    const created: ProjectDelayEvent = {
      id: `delay-${Date.now()}`,
      delay_type: newType,
      title: newTitle.trim(),
      start_date: newStartDate,
      end_date: newEndDate,
      days_claimed: newDaysClaimed,
      critical_path_impact: 'CRITICAL',
      daily_lad_rate_kes: newLadRate,
      site_diary_reference: newDiaryRef.trim() || null,
      meteorological_proof: newMetProof.trim() || null,
      status: 'PENDING_REVIEW',
      notes: newNotes.trim() || null,
      created_at: new Date().toISOString(),
    };

    setEvents([created, ...events]);
    if (onClaimSubmitted) onClaimSubmitted(created);
    setShowModal(false);
    setNewTitle('');
    setNewMetProof('');
    setNewDiaryRef('');
    setNewNotes('');
  };

  const handleReview = (id: string, approvedDays: number) => {
    const target = events.find((e) => e.id === id);
    if (!target) return;

    const dailyRate = Number(target.daily_lad_rate_kes) || 75000;
    const relief = (dailyRate * approvedDays).toFixed(2);

    const updates: Partial<ProjectDelayEvent> = {
      status: 'APPROVED_BY_ARCHITECT',
      approved_days: approvedDays,
      lad_financial_relief_kes: relief,
      certifying_authority: 'Lead Project Architect (BORAQS)',
    };

    setEvents(events.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    if (onClaimReviewed) onClaimReviewed(id, updates);
  };

  const getStatusBadge = (status: ProjectDelayEvent['status']) => {
    switch (status) {
      case 'APPROVED_BY_ARCHITECT':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Approved EOT</span>;
      case 'RECOMMENDED_BY_QS':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">Recommended by QS</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Claim Rejected</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Pending Review</span>;
    }
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      data-testid="weather-delay-claims-view"
      data-project-id={projectId}
    >
      {/* Header & KPI Summary */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-cyan-100 text-cyan-800">
                JBC 1999 CLAUSE 25 &amp; 32
              </span>
              <h2 className="text-xl font-bold text-slate-900">Weather Delays &amp; Extension of Time (EOT) Register</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Meteorological inclement weather proofs, statutory delay event claims, and Liquidated Damages (LAD) protection.
            </p>
          </div>
          {canClaim && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-cyan-700 hover:bg-cyan-800 shadow-sm"
            >
              🌧️ Submit EOT Delay Claim
            </button>
          )}
        </div>

        {/* 4 Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Total Delay Claims</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalClaims}</span>
              <span className="text-xs text-slate-400">events</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">Formal notifications logged</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Days Claimed</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">{totalDaysClaimed}</span>
              <span className="text-xs text-slate-400">calendar days</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">Adverse weather / force majeure</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Certified EOT Granted</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">{totalApprovedDays}</span>
              <span className="text-xs text-slate-400">days approved</span>
            </div>
            <div className="text-xs text-emerald-700 mt-2 font-medium">Contract completion extended</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">LAD Financial Relief</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 font-mono">
                {toCurrencyString(totalFinancialRelief)}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">Liquidated damages shielded</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Reason:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="ALL">All Delay Types</option>
            <option value="WEATHER_INCLEMENT">Inclement Weather (Floods / Rains)</option>
            <option value="ARCHITECT_INSTRUCTION">Architect Instruction (Redesign / Hold)</option>
            <option value="FORCE_MAJEURE">Force Majeure &amp; Civil Disturbance</option>
            <option value="CLIENT_DELAY">Client Default (Delayed Possession / Approval)</option>
            <option value="STATUTORY_INSPECTION">Statutory Inspection Delay (NCA / County)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="RECOMMENDED_BY_QS">Recommended by QS</option>
            <option value="APPROVED_BY_ARCHITECT">Approved by Architect</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Claim Cards List */}
      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No delay claims logged matching the filter criteria. Project program is running smoothly.
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-50 text-cyan-800">
                      {item.delay_type.replace('_', ' ')}
                    </span>
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-slate-400">
                      • {item.days_claimed} days claimed ({item.start_date} → {item.end_date})
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 mb-1">
                    {item.title}
                  </h4>

                  {item.meteorological_proof && (
                    <div className="bg-sky-50 p-2.5 rounded-lg border border-sky-100 text-xs text-sky-900 mb-2">
                      🌦️ <strong>Meteorological Station Proof:</strong> {item.meteorological_proof}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-xs text-slate-600 mb-2">
                      {item.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {item.site_diary_reference && (
                      <span>
                        📓 <strong className="text-slate-700">Site Diary Ref:</strong> {item.site_diary_reference}
                      </span>
                    )}
                    <span>
                      ⚖️ <strong className="text-slate-700">Daily LAD Rate:</strong> KES {Number(item.daily_lad_rate_kes).toLocaleString()}/day
                    </span>
                    {item.certifying_authority && (
                      <span>
                        ✍️ <strong className="text-slate-700">Certified By:</strong> {item.certifying_authority}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status & Review Controls */}
                <div className="lg:w-64 flex flex-col items-start lg:items-end justify-between self-stretch">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block mb-0.5">Approved EOT Days</span>
                    <span className="text-xl font-bold font-mono text-emerald-700">
                      {item.approved_days ? `${item.approved_days} Days` : '0 Days'}
                    </span>
                    {item.lad_financial_relief_kes && (
                      <span className="text-xs font-semibold text-slate-600 block mt-0.5">
                        Relief: {toCurrencyString(item.lad_financial_relief_kes)}
                      </span>
                    )}
                  </div>

                  {canReview && item.status === 'PENDING_REVIEW' && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleReview(item.id, Math.max(1, item.days_claimed - 2))}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-xs"
                      >
                        ✓ Certify EOT
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Claim Submission Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Submit Extension of Time (EOT) Claim</h3>
            <p className="text-xs text-slate-500 mb-4">
              Contractual notification under JBC 1999 Clause 25 with meteorological evidence.
            </p>
            <form onSubmit={handleCreateClaim} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unprecedented seasonal rainfall flooding basement floor"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contractual Delay Cause</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
                    <option value="WEATHER_INCLEMENT">Inclement Weather (Floods / Storms)</option>
                    <option value="ARCHITECT_INSTRUCTION">Architect Instruction / Redesign</option>
                    <option value="FORCE_MAJEURE">Force Majeure</option>
                    <option value="CLIENT_DELAY">Client Possession / Payment Default</option>
                    <option value="STATUTORY_INSPECTION">Statutory County Inspection Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Days Claimed</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newDaysClaimed}
                    onChange={(e) => setNewDaysClaimed(Number(e.target.value))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delay Start Date</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delay End Date</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Daily LAD Rate (KES)</label>
                  <input
                    type="text"
                    value={newLadRate}
                    onChange={(e) => setNewLadRate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Site Diary Log Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. DIARY-2026-03-05"
                    value={newDiaryRef}
                    onChange={(e) => setNewDiaryRef(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meteorological Department Station Proof</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dagoretti Corner / Wilson Airport rain gauge reading: 135mm rainfall..."
                  value={newMetProof}
                  onChange={(e) => setNewMetProof(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Impact Description &amp; Mitigation</label>
                <textarea
                  rows={2}
                  placeholder="Detailed technical disruption narrative..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg shadow-sm"
                >
                  Submit EOT Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
