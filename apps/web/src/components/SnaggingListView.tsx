import React, { useEffect, useState } from 'react';
import CreateSnagModal, { SnagSeverity, TradeCategory } from './CreateSnagModal';

export type SnagStatus = 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'RECTIFIED_BY_CONTRACTOR' | 'VERIFIED_CLOSED' | 'CONTESTED' | 'REJECTED';

export interface SnagItemData {
  id: string;
  snagNo: string;
  block: string;
  floor: string;
  room: string;
  tradeCategory: TradeCategory;
  description: string;
  severity: SnagSeverity;
  status: SnagStatus;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  geotag: {
    lat: number;
    lng: number;
    label?: string;
  };
  raisedBy: string;
  raisedAt: string;
  rectifiedBy?: string;
  rectifiedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  // Gate-4 S6 punch depth
  priority?: string;
  isPrivate?: boolean;
  dueDate?: string | null;
  costImpactKes?: string | null;
  scheduleImpactDays?: number | null;
  managerName?: string | null;
  finalApproverName?: string | null;
  costCode?: string | null;
  referenceDoc?: string | null;
}

interface SnaggingListViewProps {
  projectId?: string;
  projectName?: string;
  initialSnags?: SnagItemData[];
  canAdd?: boolean;
  canRectify?: boolean;
  canVerify?: boolean;
}

const DEFAULT_SNAGS: SnagItemData[] = [
  {
    id: 'snag-001',
    snagNo: 'SNG-001',
    block: 'Block A',
    floor: '2nd Floor',
    room: 'Room 204 (Master Ensuite)',
    tradeCategory: 'Tiling',
    description:
      'Hollow sounding porcelain floor tiles near walk-in shower trap with cracked grout line. Re-bedding and epoxy regrouting required.',
    severity: 'FUNCTIONAL',
    status: 'OPEN',
    beforePhotoUrl:
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
    geotag: {
      lat: -1.268321,
      lng: 36.804412,
      label: 'Block A, 2nd Floor, Room 204',
    },
    raisedBy: 'Faith Achieng (Lead QS)',
    raisedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'snag-002',
    snagNo: 'SNG-002',
    block: 'Block B',
    floor: 'Ground Floor',
    room: 'Main Reception Lobby',
    tradeCategory: 'Painting',
    description:
      'Visible paint roller flashings and brush marks on south feature wall under downlight graze. Repaint two coats silk vinyl.',
    severity: 'COSMETIC',
    status: 'RECTIFIED_BY_CONTRACTOR',
    beforePhotoUrl:
      'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=400&q=80',
    afterPhotoUrl:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
    geotag: {
      lat: -1.268504,
      lng: 36.804192,
      label: 'Block B, Ground Floor, Lobby',
    },
    raisedBy: 'Arch. Peter Mwangi',
    raisedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    rectifiedBy: 'Crown Paints Sub-Contractor Foreman',
    rectifiedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'snag-003',
    snagNo: 'SNG-003',
    block: 'Block A',
    floor: 'Basement 1',
    room: 'Main Electrical Switchgear Room',
    tradeCategory: 'Electrical',
    description:
      'Main distribution board earth continuity conductor loose at copper busbar connection. Non-compliant with IEE 18th edition.',
    severity: 'CRITICAL_SAFETY',
    status: 'OPEN',
    beforePhotoUrl:
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80',
    geotag: {
      lat: -1.268112,
      lng: 36.804615,
      label: 'Block A, Basement 1, Plant',
    },
    raisedBy: 'Eng. Peter Gitau (Consultant)',
    raisedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'snag-004',
    snagNo: 'SNG-004',
    block: 'Block A',
    floor: '3rd Floor',
    room: 'Executive Suite 302',
    tradeCategory: 'Glazing',
    description:
      'Deep scratch on double glazed powder-coated sliding window panel; weatherstrip seal pinched along bottom sill.',
    severity: 'COSMETIC',
    status: 'VERIFIED_CLOSED',
    beforePhotoUrl:
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=400&q=80',
    afterPhotoUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
    geotag: {
      lat: -1.268421,
      lng: 36.804355,
      label: 'Block A, 3rd Floor, Suite 302',
    },
    raisedBy: 'Faith Achieng (Lead QS)',
    raisedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    rectifiedBy: 'Apex Site Joinery Team',
    rectifiedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    verifiedBy: 'Arch. Peter Mwangi & Client Rep',
    verifiedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

export default function SnaggingListView({
  projectId = 'project-rcp-2026',
  projectName = 'Riverside Commercial Plaza',
  initialSnags = DEFAULT_SNAGS,
  canAdd = true,
  canRectify = true,
  canVerify = true,
}: SnaggingListViewProps): React.JSX.Element {
  const [snags, setSnags] = useState<SnagItemData[]>(initialSnags);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | SnagStatus>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | SnagSeverity>('ALL');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | TradeCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Gate-4 S6: load real snag items when the API is reachable; fall back to
  // the seeded demo register otherwise (keeps dashboards demo-safe).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/snags`, { credentials: 'include' });
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0 || cancelled) return;
        setSnags(rows.map((s: any): SnagItemData => {
          const defectPhoto = (s.photos || []).find((p: any) => p.photo_type === 'DEFECT') || s.photos?.[0];
          const rectPhoto = (s.photos || []).find((p: any) => p.photo_type === 'RECTIFIED');
          return {
            id: s.id,
            snagNo: `SNG-${String(s.snag_number).padStart(3, '0')}`,
            block: s.location_block || 'Site',
            floor: s.location_floor || '',
            room: s.location_room || '',
            tradeCategory: s.trade_category || 'Other',
            description: s.description || '',
            severity: s.severity || 'COSMETIC',
            status: s.status || 'OPEN',
            beforePhotoUrl: defectPhoto?.storage_key || undefined,
            afterPhotoUrl: rectPhoto?.storage_key || undefined,
            geotag: {
              lat: defectPhoto?.gps_latitude ? parseFloat(defectPhoto.gps_latitude) : 0,
              lng: defectPhoto?.gps_longitude ? parseFloat(defectPhoto.gps_longitude) : 0,
              label: `${s.location_block || ''} ${s.location_floor || ''} ${s.location_room || ''}`.trim(),
            },
            raisedBy: s.identified_by_name || 'Site Team',
            raisedAt: s.identified_at || new Date().toISOString(),
            rectifiedBy: s.rectified_by_name || undefined,
            rectifiedAt: s.rectified_at || undefined,
            verifiedBy: s.verified_by_name || undefined,
            verifiedAt: s.verified_at || undefined,
            priority: s.priority,
            isPrivate: s.is_private,
            dueDate: s.due_date,
            costImpactKes: s.cost_impact_kes,
            scheduleImpactDays: s.schedule_impact_days,
            managerName: s.manager_name,
            finalApproverName: s.final_approver_name,
            costCode: s.cost_code,
            referenceDoc: s.reference_doc,
          };
        }));
      } catch {
        // API unreachable — keep demo register
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const putStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/v1/projects/${projectId}/snags/${id}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {
      // best-effort; local state still updates for demo mode
    }
  };

  const handleSnagCreated = (newSnag: any) => {
    if (newSnag?.id) {
      // Real API record — map into view shape and prepend
      const defectPhoto = (newSnag.photos || []).find((p: any) => p.photo_type === 'DEFECT') || newSnag.photos?.[0];
      setSnags((prev) => [{
        id: newSnag.id,
        snagNo: `SNG-${String(newSnag.snag_number).padStart(3, '0')}`,
        block: newSnag.location_block || 'Site',
        floor: newSnag.location_floor || '',
        room: newSnag.location_room || '',
        tradeCategory: newSnag.trade_category || 'Other',
        description: newSnag.description || '',
        severity: newSnag.severity || 'COSMETIC',
        status: newSnag.status || 'OPEN',
        beforePhotoUrl: defectPhoto?.storage_key || undefined,
        geotag: { lat: 0, lng: 0, label: '' },
        raisedBy: newSnag.identified_by_name || 'Site Team',
        raisedAt: newSnag.identified_at || new Date().toISOString(),
        priority: newSnag.priority,
        isPrivate: newSnag.is_private,
        dueDate: newSnag.due_date,
      }, ...prev]);
      return;
    }
    setSnags((prev) => [newSnag, ...prev]);
  };

  const handleMarkRectified = (id: string) => {
    void putStatus(id, 'RECTIFIED_BY_CONTRACTOR');
    setSnags((prev) =>
      prev.map((snag) => {
        if (snag.id !== id) return snag;
        return {
          ...snag,
          status: 'RECTIFIED_BY_CONTRACTOR' as const,
          rectifiedBy: 'Apex Site Supervisor',
          rectifiedAt: new Date().toISOString(),
          afterPhotoUrl:
            snag.afterPhotoUrl ||
            'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
        };
      })
    );
  };

  const handleVerifyClose = (id: string) => {
    void putStatus(id, 'VERIFIED_CLOSED');
    setSnags((prev) =>
      prev.map((snag) => {
        if (snag.id !== id) return snag;
        return {
          ...snag,
          status: 'VERIFIED_CLOSED' as const,
          verifiedBy: 'Client Representative & Architect',
          verifiedAt: new Date().toISOString(),
        };
      })
    );
  };

  const filteredSnags = snags.filter((snag) => {
    if (statusFilter !== 'ALL' && snag.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && snag.severity !== severityFilter) return false;
    if (tradeFilter !== 'ALL' && snag.tradeCategory !== tradeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const text = `${snag.snagNo} ${snag.block} ${snag.floor} ${snag.room} ${snag.description} ${snag.tradeCategory}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: SnagSeverity) => {
    switch (severity) {
      case 'CRITICAL_SAFETY':
        return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
      case 'FUNCTIONAL':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
      case 'COSMETIC':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: SnagStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'READY_FOR_REVIEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RECTIFIED_BY_CONTRACTOR':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
      case 'VERIFIED_CLOSED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
      case 'CONTESTED':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'REJECTED':
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getStatusLabel = (status: SnagStatus) => {
    switch (status) {
      case 'OPEN':
        return 'OPEN';
      case 'IN_PROGRESS':
        return 'IN PROGRESS';
      case 'READY_FOR_REVIEW':
        return 'READY FOR REVIEW';
      case 'RECTIFIED_BY_CONTRACTOR':
        return 'RECTIFIED BY CONTRACTOR';
      case 'VERIFIED_CLOSED':
        return 'VERIFIED & CLOSED';
      case 'CONTESTED':
        return 'CONTESTED';
      case 'REJECTED':
        return 'REJECTED';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              Practical Completion Handover
            </span>
            <span className="text-xs text-slate-400 font-mono">BORAQS Closeout</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            Defects Snagging Punch List Register
          </h3>
          <p className="text-xs text-slate-500">
            Spatial defect capture (Block → Floor → Room), before/after photographic proof, and joint sign-offs
          </p>
        </div>

        <button
          onClick={() => { window.open(`/api/v1/projects/${projectId}/snags/export?format=csv`, '_blank'); }}
          className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg transition"
          title="Export snag register as CSV"
        >
          CSV
        </button>
        <button
          onClick={() => { window.open(`/api/v1/projects/${projectId}/snags/export?format=pdf`, '_blank'); }}
          className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg transition"
          title="Export snag register as PDF"
        >
          PDF
        </button>

        {canAdd && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <span>+ Add Snag Item</span>
          </button>
        )}
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-slate-50/30 border-b border-slate-200 text-xs">
        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Snags
          </span>
          <span className="text-lg font-bold font-mono text-slate-800 mt-0.5 block">
            {snags.length}
          </span>
        </div>
        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block">
            Open Deficiencies
          </span>
          <span className="text-lg font-bold font-mono text-rose-700 mt-0.5 block">
            {snags.filter((s) => s.status === 'OPEN').length}
          </span>
        </div>
        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block">
            Rectified by Contractor
          </span>
          <span className="text-lg font-bold font-mono text-blue-700 mt-0.5 block">
            {snags.filter((s) => s.status === 'RECTIFIED_BY_CONTRACTOR').length}
          </span>
        </div>
        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block">
            Verified & Closed
          </span>
          <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
            {snags.filter((s) => s.status === 'VERIFIED_CLOSED').length}
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'OPEN', 'RECTIFIED_BY_CONTRACTOR', 'VERIFIED_CLOSED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                  statusFilter === st
                    ? 'bg-white text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL'
                  ? 'All Status'
                  : st === 'RECTIFIED_BY_CONTRACTOR'
                  ? 'Rectified'
                  : st === 'VERIFIED_CLOSED'
                  ? 'Closed'
                  : 'Open'}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL_SAFETY">Critical Safety</option>
            <option value="FUNCTIONAL">Functional</option>
            <option value="COSMETIC">Cosmetic</option>
          </select>

          {/* Trade Filter */}
          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <option value="ALL">All Trades</option>
            <option value="Tiling">Tiling</option>
            <option value="Plumbing">Plumbing</option>
            <option value="Painting">Painting</option>
            <option value="Electrical">Electrical</option>
            <option value="Joinery">Joinery</option>
            <option value="Glazing">Glazing</option>
            <option value="Masonry">Masonry</option>
            <option value="External Works">External Works</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search spatial room, block, trade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder-slate-400"
          />
          <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
        </div>
      </div>

      {/* Snag List Items */}
      <div className="divide-y divide-slate-100">
        {filteredSnags.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No snag items matching active filters.
          </div>
        ) : (
          filteredSnags.map((snag) => (
            <div
              key={snag.id}
              className="p-4 sm:p-5 hover:bg-slate-50/70 transition space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded text-xs border border-rose-200">
                    {snag.snagNo}
                  </span>

                  {/* Spatial Location Breadcrumbs: Block -> Floor -> Room */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100/80 px-2.5 py-0.5 rounded-md border border-slate-200">
                    <span className="text-slate-500">📍</span>
                    <span>{snag.block}</span>
                    <span className="text-slate-400">→</span>
                    <span>{snag.floor}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-purple-900 font-bold">{snag.room}</span>
                  </div>

                  {/* Trade Category */}
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                    🔨 {snag.tradeCategory}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${getSeverityBadge(
                      snag.severity
                    )}`}
                  >
                    {snag.severity}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${getStatusBadge(
                      snag.status
                    )}`}
                  >
                    {getStatusLabel(snag.status)}
                  </span>
                </div>
              </div>

              {/* Description & Inspector Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <p className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                    {snag.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>
                      Raised by: <span className="font-medium text-slate-700">{snag.raisedBy}</span>
                    </span>
                    <span>•</span>
                    <span>{new Date(snag.raisedAt).toLocaleDateString()}</span>
                    {snag.rectifiedBy && (
                      <>
                        <span>•</span>
                        <span className="text-blue-700">
                          Rectified by: {snag.rectifiedBy}
                        </span>
                      </>
                    )}
                    {snag.verifiedBy && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">
                          Verified by: {snag.verifiedBy}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Geotag GPS Pin */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 rounded-md text-[11px] font-mono border border-slate-200">
                    <span className="text-rose-600">📌</span>
                    <span>Geotag Pin:</span>
                    <span className="text-slate-800 font-semibold">
                      {snag.geotag.lat.toFixed(6)}, {snag.geotag.lng.toFixed(6)}
                    </span>
                  </div>
                </div>

                {/* Before & After Photo Comparison Thumbnails */}
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {/* Before Photo */}
                  <div className="flex-1 space-y-1 text-center">
                    <div className="relative aspect-4/3 bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                      {snag.beforePhotoUrl ? (
                        <img
                          src={snag.beforePhotoUrl}
                          alt="Before rectification defect"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                          Photo
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        BEFORE
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">Defect</span>
                  </div>

                  {/* Arrow */}
                  <span className="text-slate-400 text-sm">→</span>

                  {/* After Photo */}
                  <div className="flex-1 space-y-1 text-center">
                    <div className="relative aspect-4/3 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                      {snag.afterPhotoUrl ? (
                        <>
                          <img
                            src={snag.afterPhotoUrl}
                            alt="After rectification"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 bg-emerald-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            AFTER
                          </span>
                        </>
                      ) : (
                        <div className="p-2 text-center text-[10px] text-slate-400">
                          Pending Fix
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">Rectified</span>
                  </div>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                {snag.status === 'OPEN' && canRectify && (
                  <button
                    onClick={() => handleMarkRectified(snag.id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition flex items-center gap-1.5"
                  >
                    <span>🔧</span>
                    <span>Mark Rectified</span>
                  </button>
                )}

                {snag.status === 'RECTIFIED_BY_CONTRACTOR' && canVerify && (
                  <button
                    onClick={() => handleVerifyClose(snag.id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-2xs transition flex items-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>Verify & Close</span>
                  </button>
                )}

                {snag.status === 'VERIFIED_CLOSED' && (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <span>✓</span>
                    <span>Verified Closed by Consultant & Client</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Snag Modal */}
      <CreateSnagModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        onSnagCreated={handleSnagCreated}
      />
    </div>
  );
}
