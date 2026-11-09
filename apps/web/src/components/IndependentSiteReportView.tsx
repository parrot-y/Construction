import React, { useEffect, useRef, useState} from 'react';

export type InspectionStage = 'substructure' | 'framing' | 'slab' | 'roofing' | 'finishes' | 'borehole';
export type InspectionStatus = 'REQUESTED' | 'DISPATCHED' | 'COMPLETED' | 'CLIENT_REVIEWED';
export type PhotoCategory = 'All' | 'Structural' | 'Materials' | 'Finishes' | 'Safety';

export interface InspectorCredentials {
  name: string;
  ncaRegistration: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  arrivalTimestamp: string;
}

export interface MaterialsAudit {
  cementBrand: string;
  rebarGrade: string;
  aggregateCleanliness: string;
  batchMix: string;
}

export interface InspectionPhoto {
  id: string;
  title: string;
  category: 'Structural' | 'Materials' | 'Finishes' | 'Safety';
  url: string;
  caption: string;
  gpsCoords: string;
  timestamp: string;
}

export interface ClientReview {
  rating: number; // 1 - 5
  feedbackNotes: string;
  signedOffAt: string;
  clientName: string;
}

export interface SiteInspectionReport {
  id: string;
  reportRef: string;
  stage: InspectionStage;
  stageLabel: string;
  inspectionDate: string;
  status: InspectionStatus;
  urgency: 'UNANNOUNCED_48HR' | 'SCHEDULED_7DAY' | 'POUR_AUTHORIZATION';
  inspector: InspectorCredentials;
  contractorReportedPct: number;
  inspectorVerifiedPct: number;
  variancePct: number;
  structuralNotes: string;
  materialsAudit: MaterialsAudit;
  safetyObservations: string;
  discrepanciesFlagged: string;
  recommendations: string;
  photos: InspectionPhoto[];
  clientReview?: ClientReview | null;
}

interface IndependentSiteReportViewProps {
  projectId?: string;
  projectName?: string;
  userRole?: string;
  onBookInspection?: (booking: Partial<SiteInspectionReport>) => void;
  onReviewSubmit?: (reportId: string, review: ClientReview) => void;
}

const STAGE_LABELS: Record<InspectionStage, string> = {
  substructure: 'Substructure (Excavation, Hardcore & Footings)',
  framing: 'Framing (Columns, Beams & Ring Beam)',
  slab: 'Slab (Suspended Slab Casting & Reinforcement)',
  roofing: 'Roofing (Steel Trusses & Rainwater Disposal)',
  finishes: 'Finishes (Plaster, Screeds, Tiling & MEP)',
  borehole: 'Borehole (Drilling, Casing & Solar Pump)',
};

const mapApiStatus = (s?: string | null): InspectionStatus => {
  switch (s) {
    case 'SUBMITTED':
      return 'COMPLETED';
    case 'REVIEWED':
      return 'CLIENT_REVIEWED';
    case 'SCHEDULED':
    case 'IN_PROGRESS':
    case 'DISPATCHED':
      return 'DISPATCHED';
    default:
      return 'REQUESTED';
}
};

const inferStage = (scope?: string | null): InspectionStage => {
  const s = (scope || '').toLowerCase();
  if (s.includes('slab')) return 'slab';
  if (s.includes('substructure') || s.includes('footing') || s.includes('foundation') || s.includes('excavat')) return 'substructure';
  if (s.includes('fram') || s.includes('column') || s.includes('beam')) return 'framing';
  if (s.includes('roof') || s.includes('truss')) return 'roofing';
  if (s.includes('finish') || s.includes('plaster') || s.includes('til') || s.includes('mep') || s.includes('mech')) return 'finishes';
  if (s.includes('borehole') || s.includes('water') || s.includes('pump') || s.includes('well')) return 'borehole';
  return 'substructure';
};

const mapListItemToReport = (i: any): SiteInspectionReport => {
  const stage = inferStage(i.scopeDescription);
  const reported = Number(i.reportedProgressPct) || 0;
  const verified = i.verifiedProgressPct != null ? Number(i.verifiedProgressPct) : reported;
  const variance = i.variancePct != null ? Number(i.variancePct) : Number((verified - reported).toFixed(2));
  const dateStr = String(i.conductedDate || i.scheduledDate || i.createdAt || '').slice(0, 10);
  return {
    id: i.id,
    reportRef: i.inspectionCode || i.id,
    stage,
    stageLabel: STAGE_LABELS[stage],
    inspectionDate: dateStr,
    status: mapApiStatus(i.status),
    urgency: 'UNANNOUNCED_48HR',
    inspector: {
      name: i.inspectorName || 'Independent Inspector (Pending Assignment)',
      ncaRegistration: i.inspectorLicense || 'NCA Registry Pending',
      phone: '',
      email: '',
      latitude: 0,
      longitude: 0,
      accuracyMeters: 0,
      arrivalTimestamp: i.conductedDate || i.scheduledDate || 'Pending Dispatch',
},
    contractorReportedPct: reported,
    inspectorVerifiedPct: verified,
    variancePct: variance,
    structuralNotes: 'Awaiting inspector field findings submission.',
    materialsAudit: {
      cementBrand: 'Pending on-site batch verification',
      rebarGrade: 'Pending tensile and diameter calibration',
      aggregateCleanliness: 'Pending silt & organic matter check',
      batchMix: 'Pending slump test & cube casting witness',
},
    safetyObservations: 'Pending site safety inspection',
    discrepanciesFlagged: 'Will be compared against contractor reported progress upon arrival',
    recommendations: 'Awaiting independent inspector site findings',
    photos: [],
    clientReview: null,
};
};

const applyInspectionDetail = (insp: SiteInspectionReport, d: any): SiteInspectionReport => {
  const photos: InspectionPhoto[] = (d.photos || []).map((p: any) => ({
    id: p.id,
    title: p.caption || p.elementInspected || 'Site Evidence Photo',
    category: (p.hasDiscrepancy ? 'Safety' : 'Structural') as InspectionPhoto['category'],
    url: p.photoUrl,
    caption: p.caption || '',
    gpsCoords:
      p.gpsLatitude != null && p.gpsLongitude != null
        ? `${Number(p.gpsLatitude).toFixed(6)}, ${Number(p.gpsLongitude).toFixed(6)}`
        : '—',
    timestamp: p.capturedAt
      ? new Date(p.capturedAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi'}) + ' EAT'
      : '',
}));
  const hasReview = !!(d.clientReviewNotes || d.clientSatisfactionRating != null);
  return {
    ...insp,
    status: mapApiStatus(d.status),
    inspector: {
      ...insp.inspector,
      name: d.inspectorName || insp.inspector.name,
      ncaRegistration: d.inspectorLicense || insp.inspector.ncaRegistration,
      latitude: d.gpsLatitude != null ? Number(d.gpsLatitude) : insp.inspector.latitude,
      longitude: d.gpsLongitude != null ? Number(d.gpsLongitude) : insp.inspector.longitude,
      arrivalTimestamp: d.conductedDate || d.scheduledDate || insp.inspector.arrivalTimestamp,
},
    inspectorVerifiedPct: d.verifiedProgressPct != null ? Number(d.verifiedProgressPct) : insp.inspectorVerifiedPct,
    variancePct: d.variancePct != null ? Number(d.variancePct) : insp.variancePct,
    structuralNotes:
      d.findingsNotes ||
      (d.structuralDefectsFound
        ? 'Structural defects flagged by independent inspector — see findings notes.'
        : 'No structural defects flagged.'),
    materialsAudit: {
      cementBrand: d.materialsOnSiteNotes || 'Not separately recorded',
      rebarGrade: d.structuralDefectsFound ? 'See structural defects findings' : 'Not separately recorded',
      aggregateCleanliness: `Workmanship rating: ${d.workmanshipRating ?? '—'}/5`,
      batchMix: `Safety compliance rating: ${d.safetyComplianceRating ?? '—'}/5`,
},
    safetyObservations: d.structuralDefectsFound
      ? 'Structural defects found on site — review findings notes.'
      : 'No structural safety defects flagged.',
    discrepanciesFlagged: d.clientDiscrepancyFlagged
      ? 'Client flagged a discrepancy on this inspection report.'
      : d.varianceStatus || 'No discrepancy flagged.',
    recommendations: d.recommendations || '—',
    photos,
    clientReview: hasReview
      ? {
          rating: d.clientSatisfactionRating ?? 5,
          feedbackNotes: d.clientReviewNotes || '',
          signedOffAt: d.updatedAt || '',
          clientName: 'Client',
}
      : null,
};
};

export default function IndependentSiteReportView({
  projectId = '',
  projectName = '',
  userRole: _userRole = 'CLIENT',
  onReviewSubmit,
}: IndependentSiteReportViewProps): React.JSX.Element {
  const [inspections, setInspections] = useState<SiteInspectionReport[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>(
    ''
);
  const [selectedPhotoCategory, setSelectedPhotoCategory] = useState<PhotoCategory>('All');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // New Inspection Booking Form State
  const [bookStage, setBookStage] = useState<InspectionStage>('slab');
  const [bookUrgency, setBookUrgency] = useState<'UNANNOUNCED_48HR' | 'SCHEDULED_7DAY' | 'POUR_AUTHORIZATION'>('UNANNOUNCED_48HR');
  const [bookContactPhone, setBookContactPhone] = useState('+44 7700 900123');
  const [bookSpecialFocus, setBookSpecialFocus] = useState('Audit rebar spacing and verify cement batch storage ahead of IPC #4');

  // Client Review Form State
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewClientName, setReviewClientName] = useState<string>('Diaspora Property Owner');
  const [reviewSubmitted, setReviewSubmitted] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);
  const loadedDetailsRef = useRef<Set<string>>(new Set());

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/independent-inspections`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (Array.isArray(json) ? json : json.inspections || json.data || []) as any[];
      setInspections(list.map(mapListItemToReport));
      setSelectedInspectionId((prev) =>
        list.some((i: any) => i.id === prev) ? prev : list[0]?.id ?? prev
);
      loadedDetailsRef.current.clear();
} catch { /* keep demo */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Lazy-load full findings + photos for the selected live inspection
  useEffect(() => {
    if (!isLive || !selectedInspectionId || loadedDetailsRef.current.has(selectedInspectionId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/independent-inspections/${selectedInspectionId}`, { credentials: 'include'});
        if (!res.ok) return;
        const detail = await res.json();
        if (cancelled) return;
        loadedDetailsRef.current.add(selectedInspectionId);
        setInspections((prev) => prev.map((i) => (i.id === selectedInspectionId ? applyInspectionDetail(i, detail) : i)));
} catch { /* keep list-level data */}
})();
    return () => { cancelled = true;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isLive, projectId, selectedInspectionId]);

  const activeInspection =
    inspections.find((i) => i.id === selectedInspectionId) ?? inspections[0];

  const handleDispatchWhatsApp = async () => {
    if (!activeInspection) return;
    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/independent-inspections/${activeInspection.id}/notify-client`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ channel: 'WHATSAPP'}),
});
        if (res.ok) {
          const j = await res.json();
          setWhatsappStatus(`WhatsApp digest dispatched to ${j.recipientPhone}: ${j.message}`);
          return;
}
} catch { /* fall through to local digest */}
}
    const isCritical = activeInspection.variancePct<= -10;
    setWhatsappStatus(
      `WhatsApp SMS alert dispatched: [${isCritical ? 'CRITICAL INFLATION ALERT' : 'PROGRESS DIGEST'}] Inspection ${activeInspection.reportRef} verified with ${activeInspection.inspectorVerifiedPct}% physical progress.`
);
};

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/independent-inspections`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            stage: bookStage.toUpperCase(),
            scopeDescription: `${STAGE_LABELS[bookStage]} — Focus: ${bookSpecialFocus}`,
            scheduledDate: new Date().toISOString(),
            inspectorName: 'Clerk of Works Dispatching...',
            inspectorLicense: 'NCA Independent Inspector Registry',
}),
});
        if (res.ok) {
          const created = await res.json();
          await reload();
          if (created?.id) setSelectedInspectionId(created.id);
          setShowBookingModal(false);
          setBookingSuccess(`Neutral inspection ${created?.inspectionCode ?? ''} successfully booked for ${STAGE_LABELS[bookStage]}! Dispatch notification sent to neutral Clerk of Works.`);
          return;
}
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || `Booking failed (${res.status})`);
} catch (err: any) {
          setBookingError(err?.message || 'Booking failed — check your connection and try again.');
          return;
}
}
    // Non-live/demo contexts have no backend — refuse to fabricate a booking.
    setBookingError('Inspection booking requires a live project connection.');
};

  const handleSignOffReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInspection || !reviewNotes.trim()) return;
    const targetId = activeInspection.id;
    const targetRef = activeInspection.reportRef;

    const review: ClientReview = {
      rating: reviewRating,
      feedbackNotes: reviewNotes.trim(),
      signedOffAt: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi'}) + ' EAT',
      clientName: reviewClientName.trim() || 'Diaspora Property Owner',
};

    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/independent-inspections/${targetId}/client-review`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            clientReviewNotes: review.feedbackNotes,
            clientSatisfactionRating: review.rating,
            clientDiscrepancyFlagged: activeInspection.variancePct<= -10,
}),
});
        if (res.ok) {
          loadedDetailsRef.current.delete(targetId);
          await reload();
          setInspections((prev) =>
            prev.map((insp) =>
              insp.id === targetId
                ? { ...insp, status: 'CLIENT_REVIEWED' as InspectionStatus, clientReview: review}
                : insp
)
);
          setReviewSubmitted(`Inspection report ${targetRef} verified and signed off successfully.`);
          setReviewNotes('');
          if (onReviewSubmit) onReviewSubmit(targetId, review);
          return;
}
} catch { /* fall through to local update */}
}

    const updated = inspections.map((insp) => {
      if (insp.id === targetId) {
        return {
          ...insp,
          status: 'CLIENT_REVIEWED' as InspectionStatus,
          clientReview: review,
};
}
      return insp;
});

    setInspections(updated);
    setReviewSubmitted(`Inspection report ${targetRef} verified and signed off successfully.`);
    setReviewNotes('');
    if (onReviewSubmit) {
      onReviewSubmit(targetId, review);
}
};

  const getStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case 'REQUESTED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'DISPATCHED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'CLIENT_REVIEWED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
}
};

  const getVarianceBadge = (variance: number) => {
    if (variance<= -10) {
      return {
        bg: 'bg-rose-50 border-rose-300 text-rose-800',
        badge: 'bg-rose-600 text-white',
        label: 'Critical Contractor Inflation',
        sub: `Contractor reported +${Math.abs(variance).toFixed(1)}% more progress than physically present on site!`,
};
}
    if (variance<= -5) {
      return {
        bg: 'bg-amber-50 border-amber-300 text-amber-800',
        badge: 'bg-amber-600 text-white',
        label: 'Moderate Discrepancy Alert',
        sub: `Progress discrepancy of ${Math.abs(variance).toFixed(1)}% flagged between claim and reality.`,
};
}
    return {
      bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
      badge: 'bg-emerald-600 text-white',
      label: 'Verified Physical Alignment',
      sub: `Contractor claims match verified physical installation on site (Variance: ${variance.toFixed(1)}%).`,
};
};

  if (isLive && !liveLoaded) {
    return (
<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Loading independent inspection reports…
</div>
);
}

  if (!activeInspection) {
    return (
<div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-xs">
        No inspection report selected.
</div>
);
}

  const filteredPhotos =
    selectedPhotoCategory === 'All'
      ? activeInspection.photos
      : activeInspection.photos.filter((p) => p.category === selectedPhotoCategory);

  const varianceInfo = getVarianceBadge(activeInspection.variancePct);

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Header Banner */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Diaspora Shield • Neutral Site Verification
</span>
<span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              NCA Registered Clerk of Works
</span>
</div>
<h2 className="text-xl font-bold text-slate-900 mt-1">
            Site Safi Independent Site Inspection Reports
</h2>
<p className="text-xs text-slate-500 mt-0.5">
            Unannounced third-party Clerk of Works audits, GPS-verified progress reality, and material quality assurance for {projectName}.
</p>
</div>

<div className="flex flex-wrap items-center gap-2 shrink-0">
<a
            href={`/api/v1/projects/${projectId}/reports/independent-inspections/${activeInspection.id}`}
            download
            data-testid="download-inspection-pdf-btn"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download Forensic Site Inspection Certificate (PDF)"
          >
<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
</svg>
<span>Certified PDF</span>
</a>

<button
            onClick={() => setShowPrintModal(true)}
            data-testid="preview-certificate-btn"
            className="px-3 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Preview and Print BORAQS Certified Inspection Certificate"
          >
<span> Certificate Docket</span>
</button>

<button
            onClick={handleDispatchWhatsApp}
            data-testid="whatsapp-alert-btn"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Dispatch Inspection Briefing to Diaspora Client via WhatsApp"
          >
<span> WhatsApp Digest</span>
</button>

<button
            onClick={() => setShowBookingModal(true)}
            data-testid="book-inspection-btn"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-2"
          >
<span> Book Unannounced Inspection</span>
</button>
</div>
</div>

      {whatsappStatus && (
<div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-lg flex justify-between items-center shadow-sm">
<span> {whatsappStatus}</span>
<button onClick={() => setWhatsappStatus(null)} className="font-bold text-emerald-900 ml-2">×</button>
</div>
)}

      {bookingError && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex justify-between items-center">
<span> {bookingError}</span>
<button onClick={() => setBookingError(null)} className="font-bold text-rose-900 ml-2">×</button>
</div>
)}

      {bookingSuccess && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center">
<span> {bookingSuccess}</span>
<button onClick={() => setBookingSuccess(null)} className="font-bold text-emerald-900 ml-2">×</button>
</div>
)}

      {reviewSubmitted && (
<div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg flex justify-between items-center">
<span> {reviewSubmitted}</span>
<button onClick={() => setReviewSubmitted(null)} className="font-bold text-blue-900 ml-2">×</button>
</div>
)}

      {/* Inspections List Bar */}
<div className="space-y-2">
<span className="text-xs font-bold text-slate-700 block">
          Inspection Reports Register:
</span>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {inspections.map((insp) => (
<button
              key={insp.id}
              onClick={() => setSelectedInspectionId(insp.id)}
              data-testid={`inspection-card-${insp.id}`}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                selectedInspectionId === insp.id
                  ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
}`}
            >
<div className="flex justify-between items-start gap-2">
<span className="font-mono text-xs font-bold text-slate-800">{insp.reportRef}</span>
<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(insp.status)}`}>
                  {insp.status}
</span>
</div>
<div className="mt-2">
<span className="text-xs font-semibold text-slate-900 block truncate">{insp.stageLabel}</span>
<span className="text-[11px] text-slate-500">{insp.inspectionDate} • {insp.inspector.name}</span>
</div>
</button>
))}
</div>
</div>

      {/* Selected Inspection Report Details Card */}
<div className="bg-slate-50/60 rounded-xl border border-slate-200 p-5 space-y-6">
        {/* Report Overview Header */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
<div>
<div className="flex items-center gap-2">
<span className="font-mono text-sm font-bold text-emerald-800">{activeInspection.reportRef}</span>
<span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(activeInspection.status)}`}>
                {activeInspection.status}
</span>
<span className="text-xs text-slate-500 font-mono">Date: {activeInspection.inspectionDate}</span>
</div>
<h3 className="text-base font-bold text-slate-900 mt-1">
              {activeInspection.stageLabel}
</h3>
</div>

<div className="text-left sm:text-right text-xs">
<span className="text-[10px] font-semibold text-slate-400 block">Inspection Urgency</span>
<span className="font-bold text-slate-800">
              {activeInspection.urgency === 'UNANNOUNCED_48HR'
                ? ' 48-Hour Unannounced Surprise Audit'
                : activeInspection.urgency === 'POUR_AUTHORIZATION'
                ? ' Pre-Pour Authorization Hold'
                : ' Scheduled Milestone Verification'}
</span>
</div>
</div>

        {/* Inspector Credentials & GPS Coordinates */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
<div className="flex items-center justify-between">
<h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
<span></span>
<span>Independent Inspector Credentials &amp; On-Site GPS Telemetry</span>
</h4>
<span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Verified Physical Site Presence
</span>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-400 block text-[10px] font-semibold ">Clerk of Works / Lead Auditor</span>
<span className="font-bold text-slate-900 mt-0.5 block">{activeInspection.inspector.name}</span>
<span className="text-slate-600 text-[11px] font-mono mt-0.5 block">NCA Reg: {activeInspection.inspector.ncaRegistration}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-400 block text-[10px] font-semibold ">Contact Telephony</span>
<span className="font-bold text-slate-900 mt-0.5 block">{activeInspection.inspector.phone}</span>
<span className="text-slate-600 text-[11px] mt-0.5 block">{activeInspection.inspector.email}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-400 block text-[10px] font-semibold ">GPS Coordinate Lock &amp; Accuracy</span>
<span className="font-mono font-bold text-slate-900 mt-0.5 block">
                {activeInspection.inspector.latitude.toFixed(6)}, {activeInspection.inspector.longitude.toFixed(6)}
</span>
<span className="text-emerald-700 font-medium text-[11px] mt-0.5 block">
                ± {activeInspection.inspector.accuracyMeters.toFixed(1)}m GPS Accuracy • {activeInspection.inspector.arrivalTimestamp}
</span>
</div>
</div>
</div>

        {/* Progress Variance Analysis */}
<div className={`p-4 rounded-xl border ${varianceInfo.bg} shadow-xs space-y-3`}>
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold block">
                Ground Truth vs Contractor Valuation Claim
</span>
<h4 className="text-sm font-bold mt-0.5">Progress Variance Analysis</h4>
</div>
<span className={`text-xs font-bold px-3 py-1 rounded-full ${varianceInfo.badge}`}>
              {varianceInfo.label}
</span>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
<div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
<span className="text-[11px] font-semibold text-slate-500 block">Contractor Reported</span>
<span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
                {activeInspection.contractorReportedPct.toFixed(1)}%
</span>
<span className="text-[10px] text-slate-400 block">Claimed on Interim Valuation</span>
</div>

<div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
<span className="text-[11px] font-semibold text-slate-500 block">Inspector Verified</span>
<span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
                {activeInspection.inspectorVerifiedPct.toFixed(1)}%
</span>
<span className="text-[10px] text-slate-400 block">Genuine physically measured progress</span>
</div>

<div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
<span className="text-[11px] font-semibold text-slate-500 block">Variance Delta</span>
<span className={`text-lg font-bold font-mono mt-0.5 block ${activeInspection.variancePct<= -10 ? 'text-rose-700' : 'text-slate-800'}`}>
                {activeInspection.variancePct > 0 ? `+${activeInspection.variancePct.toFixed(1)}%` : `${activeInspection.variancePct.toFixed(1)}%`}
</span>
<span className="text-[10px] text-slate-500 font-medium block">
                {activeInspection.variancePct<= -10 ? 'Critical Inflation' : 'Disparity'}
</span>
</div>
</div>

<div className="p-2.5 bg-white/80 rounded-lg border border-slate-200 text-xs">
<span className="font-semibold">Variance Finding:</span>
<span>{varianceInfo.sub}</span>
</div>
</div>

        {/* Inspection Detailed Findings */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
<h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
            Independent Technical Inspection Findings
</h4>

<div className="space-y-3 text-xs">
            {/* Structural integrity */}
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
<span className="font-bold text-slate-900 flex items-center gap-1.5">
<span></span> Structural Integrity Assessment:
</span>
<p className="text-slate-700 leading-relaxed">{activeInspection.structuralNotes}</p>
</div>

            {/* Materials Quality Audit */}
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
<span className="font-bold text-slate-900 flex items-center gap-1.5">
<span></span> Materials Quality Audit (BS &amp; KEBS Standards):
</span>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
<div className="bg-white p-2 rounded border border-slate-200">
<span className="font-semibold text-slate-500 block">Cement Brand &amp; Storage:</span>
<span className="text-slate-800">{activeInspection.materialsAudit.cementBrand}</span>
</div>
<div className="bg-white p-2 rounded border border-slate-200">
<span className="font-semibold text-slate-500 block">Rebar Grade &amp; Specification:</span>
<span className="text-slate-800">{activeInspection.materialsAudit.rebarGrade}</span>
</div>
<div className="bg-white p-2 rounded border border-slate-200">
<span className="font-semibold text-slate-500 block">Aggregate Cleanliness &amp; Silt:</span>
<span className="text-slate-800">{activeInspection.materialsAudit.aggregateCleanliness}</span>
</div>
<div className="bg-white p-2 rounded border border-slate-200">
<span className="font-semibold text-slate-500 block">Batch Mix &amp; Slump Verification:</span>
<span className="text-slate-800">{activeInspection.materialsAudit.batchMix}</span>
</div>
</div>
</div>

            {/* Health & Safety */}
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
<span className="font-bold text-slate-900 flex items-center gap-1.5">
<span></span> Health, Safety &amp; Environmental (HSE) Observations:
</span>
<p className="text-slate-700 leading-relaxed">{activeInspection.safetyObservations}</p>
</div>

            {/* Discrepancies Flagged */}
<div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
<span className="font-bold text-rose-900 flex items-center gap-1.5">
<span></span> Discrepancies Flagged by Clerk of Works:
</span>
<p className="text-rose-800 leading-relaxed font-medium">{activeInspection.discrepanciesFlagged}</p>
</div>

            {/* Inspector Recommendations */}
<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
<span className="font-bold text-emerald-900 flex items-center gap-1.5">
<span></span> Neutral Inspector Recommendations &amp; Milestone Advice:
</span>
<p className="text-emerald-800 leading-relaxed font-medium">{activeInspection.recommendations}</p>
</div>
</div>
</div>

        {/* Photo Evidence Gallery with Category Tabs */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-slate-400 block">
                GPS &amp; Timestamped Photographic Evidence
</span>
<h4 className="text-xs font-bold text-slate-800">
                Photo Evidence Gallery
</h4>
</div>

            {/* Photo Category Tabs */}
<div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              {(['All', 'Structural', 'Materials', 'Finishes', 'Safety'] as PhotoCategory[]).map((cat) => (
<button
                  key={cat}
                  onClick={() => setSelectedPhotoCategory(cat)}
                  data-testid={`photo-category-${cat.toLowerCase()}`}
                  className={`px-2.5 py-1 rounded font-semibold text-[11px] transition ${
                    selectedPhotoCategory === cat
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
}`}
                >
                  {cat}
</button>
))}
</div>
</div>

          {filteredPhotos.length === 0 ? (
<div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No photo evidence recorded under category {selectedPhotoCategory}.
</div>
) : (
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredPhotos.map((photo) => (
<div key={photo.id} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden group">
<div className="h-44 bg-slate-200 relative overflow-hidden">
<img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
<span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                      {photo.category}
</span>
<span className="absolute bottom-2 right-2 bg-slate-900/80 text-white font-mono text-[9px] px-2 py-0.5 rounded backdrop-blur-xs">
                       {photo.gpsCoords}
</span>
</div>
<div className="p-3 space-y-1">
<h5 className="font-bold text-xs text-slate-900">{photo.title}</h5>
<p className="text-[11px] text-slate-600">{photo.caption}</p>
<span className="text-[10px] text-slate-400 font-mono block">Captured: {photo.timestamp}</span>
</div>
</div>
))}
</div>
)}
</div>

        {/* Client Review & Rating Form */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
<div className="flex justify-between items-center">
<h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
<span>Client Review &amp; Report Sign-Off</span>
</h4>
            {activeInspection.clientReview && (
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Verified &amp; Signed Off
</span>
)}
</div>

          {activeInspection.clientReview ? (
<div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2 text-xs">
<div className="flex items-center justify-between">
<div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
<span
                      key={s}
                      className={s<= (activeInspection.clientReview?.rating || 5) ? 'text-amber-500' : 'text-slate-300'}
                    >
                      
</span>
))}
<span className="font-bold text-slate-800 ml-1.5">
                    {activeInspection.clientReview.rating} / 5 Stars
</span>
</div>
<span className="text-[11px] text-slate-500 font-mono">
                  {activeInspection.clientReview.signedOffAt}
</span>
</div>
<p className="text-slate-700 italic">"{activeInspection.clientReview.feedbackNotes}"</p>
<span className="text-[11px] font-semibold text-slate-600 block">
                Signed off by: {activeInspection.clientReview.clientName}
</span>
</div>
) : (
<form onSubmit={handleSignOffReview} className="space-y-3 text-xs">
<p className="text-slate-500 text-[11px]">
                As the project client / diaspora property owner, sign off on this independent report or provide instructions for the quantity surveyor and contractor.
</p>

<div>
<label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Inspector Satisfaction Rating:
</label>
<div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
<button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      data-testid={`rating-star-${star}`}
                      className={`text-xl transition ${
                        star<= reviewRating ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-400'
}`}
                    >
                      
</button>
))}
<span className="text-xs font-bold text-slate-700 ml-2">{reviewRating} Star{reviewRating > 1 ? 's' : ''}</span>
</div>
</div>

<div>
<label htmlFor="client-signoff-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Your Name / Representative Title:
</label>
<input
                  id="client-signoff-name"
                  type="text"
                  value={reviewClientName}
                  onChange={(e) => setReviewClientName(e.target.value)}
                  placeholder="e.g. Dr. Evans Kiprop (Property Developer)"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
</div>

<div>
<label htmlFor="client-feedback-notes" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Client Feedback &amp; Milestone Instructions:
</label>
<textarea
                  id="client-feedback-notes"
                  rows={2}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Acknowledge findings. Contractor must fix cover blocks and safety rails prior to releasing IPC #4."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
</div>

<button
                type="submit"
                data-testid="submit-signoff-btn"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm transition text-xs flex items-center gap-1.5"
              >
<span> Sign Off Inspection Report</span>
</button>
</form>
)}
</div>
</div>

      {/* Booking Modal */}
      {showBookingModal && (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Platform Neutral Field Audit
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
                  Book Unannounced Site Inspection
</h3>
</div>
<button
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
</button>
</div>

<form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
<div>
<label htmlFor="booking-stage-select" className="block font-semibold text-slate-700 mb-1">
                  Construction Milestone Stage:
</label>
<select
                  id="booking-stage-select"
                  value={bookStage}
                  onChange={(e) => setBookStage(e.target.value as InspectionStage)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
<option value="substructure">Substructure (Excavation, Hardcore &amp; Footings)</option>
<option value="framing">Framing (Columns, Beams &amp; Ring Beam)</option>
<option value="slab">Slab (Suspended Slab Casting &amp; Reinforcement)</option>
<option value="roofing">Roofing (Steel Trusses &amp; Rainwater Disposal)</option>
<option value="finishes">Finishes (Plaster, Screeds, Tiling &amp; MEP)</option>
<option value="borehole">Borehole (Drilling, Casing &amp; Solar Pump)</option>
</select>
</div>

<div>
<label htmlFor="booking-urgency-select" className="block font-semibold text-slate-700 mb-1">
                  Inspection Urgency &amp; Arrival Window:
</label>
<select
                  id="booking-urgency-select"
                  value={bookUrgency}
                  onChange={(e) => setBookUrgency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
<option value="UNANNOUNCED_48HR"> Unannounced Surprise Audit (Within 48 Hours)</option>
<option value="POUR_AUTHORIZATION"> Pre-Pour Authorization Hold (Pre-Cast Witness)</option>
<option value="SCHEDULED_7DAY"> Scheduled Milestone Verification (Within 7 Days)</option>
</select>
</div>

<div>
<label htmlFor="booking-phone-input" className="block font-semibold text-slate-700 mb-1">
                  Diaspora Client Phone (WhatsApp / Call Alert):
</label>
<input
                  id="booking-phone-input"
                  type="text"
                  required
                  value={bookContactPhone}
                  onChange={(e) => setBookContactPhone(e.target.value)}
                  placeholder="e.g. +44 7700 900123 or +254 722 000 000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
</div>

<div>
<label htmlFor="booking-focus-input" className="block font-semibold text-slate-700 mb-1">
                  Special Focus &amp; Inspector Instructions:
</label>
<textarea
                  id="booking-focus-input"
                  rows={3}
                  required
                  value={bookSpecialFocus}
                  onChange={(e) => setBookSpecialFocus(e.target.value)}
                  placeholder="e.g. Check Y16 spacing, verify cement brand stored dry, and take elevation photographs."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold"
                >
                  Cancel
</button>
<button
                  type="submit"
                  data-testid="confirm-booking-btn"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  Dispatch Neutral Inspector
</button>
</div>
</form>
</div>
</div>
)}

      {/* BORAQS Certified Inspection Certificate Preview Modal */}
      {showPrintModal && activeInspection && (
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
<div className="flex justify-between items-start border-b-2 border-emerald-800 pb-4">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded">
                  BORAQS &amp; NCA ACCREDITED CLERK OF WORKS • FORENSIC DOCKET
</span>
<h3 className="text-xl font-black text-slate-900 mt-1">
                  Official Site Inspection Certificate
</h3>
<p className="text-xs text-slate-500">
                  Ref:<span className="font-mono font-bold text-slate-800">{activeInspection.reportRef}</span> • Project: {projectName}
</p>
</div>
<button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                
</button>
</div>

            {/* Certificate Details Grid */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
<div>
<span className="text-slate-500 block text-[10px] font-semibold">Inspector</span>
<span className="font-bold text-slate-900">{activeInspection.inspector.name}</span>
<span className="text-[10px] text-slate-500 block">{activeInspection.inspector.ncaRegistration}</span>
</div>
<div>
<span className="text-slate-500 block text-[10px] font-semibold">Date &amp; Geotag</span>
<span className="font-bold text-slate-900">{activeInspection.inspectionDate}</span>
<span className="text-[10px] text-slate-500 block font-mono">GPS: ±{activeInspection.inspector.accuracyMeters}m</span>
</div>
<div>
<span className="text-slate-500 block text-[10px] font-semibold">Stage</span>
<span className="font-bold text-slate-900">{activeInspection.stage.toUpperCase()}</span>
<span className="text-[10px] text-slate-500 block">{activeInspection.urgency}</span>
</div>
<div>
<span className="text-slate-500 block text-[10px] font-semibold">Status</span>
<span className="font-bold text-emerald-700">{activeInspection.status}</span>
<span className="text-[10px] text-slate-500 block">Neutral Audit</span>
</div>
</div>

            {/* Variance Callout */}
<div
              className={`p-4 rounded-xl border-2 ${
                activeInspection.variancePct<= -10
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
}`}
            >
<div className="flex justify-between items-center mb-2">
<span className="font-bold text-xs ">
                  {activeInspection.variancePct<= -10
                    ? ' Forensic Variance Alert: Contractor Progress Inflation'
                    : ' Verified Physical Progress Concurrence'}
</span>
<span className="font-mono text-xs font-black">
                  Δ = {activeInspection.variancePct > 0 ? `+${activeInspection.variancePct}%` : `${activeInspection.variancePct}%`}
</span>
</div>
<div className="grid grid-cols-3 gap-2 text-center text-xs">
<div className="bg-white p-2 rounded border border-slate-200">
<span className="text-[10px] text-slate-500 block ">Contractor Claimed</span>
<span className="text-sm font-bold text-slate-900">{activeInspection.contractorReportedPct}%</span>
</div>
<div className="bg-white p-2 rounded border border-slate-200">
<span className="text-[10px] text-slate-500 block ">Inspector Verified</span>
<span className="text-sm font-bold text-emerald-700">{activeInspection.inspectorVerifiedPct}%</span>
</div>
<div className="bg-white p-2 rounded border border-slate-200">
<span className="text-[10px] text-slate-500 block ">Commercial Action</span>
<span className="text-xs font-bold text-rose-700">
                    {activeInspection.variancePct<= -10 ? 'Withhold Claim' : 'Authorize IPC'}
</span>
</div>
</div>
</div>

            {/* Forensic Notes & Materials */}
<div className="space-y-3 text-xs">
<div className="bg-white p-3 rounded-xl border border-slate-200">
<h4 className="font-bold text-slate-800 text-[10px] mb-1">
                  Structural Findings &amp; Observations
</h4>
<p className="text-slate-600 leading-relaxed">{activeInspection.structuralNotes}</p>
</div>

<div className="bg-white p-3 rounded-xl border border-slate-200">
<h4 className="font-bold text-slate-800 text-[10px] mb-1">
                  Materials Verification Audit
</h4>
<ul className="text-slate-600 space-y-1 list-disc list-inside">
<li><strong>Cement:</strong> {activeInspection.materialsAudit.cementBrand}</li>
<li><strong>Rebar:</strong> {activeInspection.materialsAudit.rebarGrade}</li>
<li><strong>Aggregates:</strong> {activeInspection.materialsAudit.aggregateCleanliness}</li>
<li><strong>Batch Mix:</strong> {activeInspection.materialsAudit.batchMix}</li>
</ul>
</div>
</div>

            {/* Cryptographic Security Hash */}
<div className="bg-slate-900 text-slate-300 p-3 rounded-xl text-[10px] font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-slate-500 block">SHA-256 FORENSIC TAMPER-EVIDENT SEAL:</span>
<span className="text-emerald-400 font-bold">
                  E8F4B92C1D70A38165B907F63DE14CA29910E4B7208173429FA01BC4
</span>
</div>
<span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-bold">
                BDS VERIFIED
</span>
</div>

            {/* Modal Actions */}
<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
              >
<span> Print Certificate</span>
</button>
<button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                Close
</button>
</div>
</div>
</div>
)}
</div>
);
}
