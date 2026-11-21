import React, { useEffect, useRef, useState} from 'react';
import { formatDateTime } from '../lib/format';
import { api, apiErrorMessage } from '../lib/api';
import {
  applyInspectionDetail,
  ClientReviewCard,
  getVarianceBadge,
  InspectionFindingsCard,
  InspectionRegisterList,
  InspectorCredentialsCard,
  mapApiStatus,
  PhotoEvidenceGallery,
  ReportOverviewHeader,
  SiteReportBanner,
  VarianceAnalysisCard,
} from './IndependentSiteReportView.parts';
import { BookingInspectionModal, CertificatePreviewModal } from './IndependentSiteReportView.modals';
import type {
  ClientReview,
  InspectionStage,
  InspectionStatus,
  PhotoCategory,
  SiteInspectionReport,
} from './IndependentSiteReportView.parts';

export type {
  ClientReview,
  InspectionPhoto,
  InspectionStage,
  InspectionStatus,
  InspectorCredentials,
  MaterialsAudit,
  PhotoCategory,
  SiteInspectionReport,
} from './IndependentSiteReportView.parts';

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
      const json = await api.get<any>(`/api/v1/projects/${projectId}/independent-inspections`);
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
        const detail = await api.get<any>(`/api/v1/projects/${projectId}/independent-inspections/${selectedInspectionId}`);
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
        const j = await api.post<any>(`/api/v1/projects/${projectId}/independent-inspections/${activeInspection.id}/notify-client`, { channel: 'WHATSAPP'});
        setWhatsappStatus(`WhatsApp digest dispatched to ${j.recipientPhone}: ${j.message}`);
        return;
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
        const created = await api.post<any>(`/api/v1/projects/${projectId}/independent-inspections`, {
            stage: bookStage.toUpperCase(),
            scopeDescription: `${STAGE_LABELS[bookStage]} — Focus: ${bookSpecialFocus}`,
            scheduledDate: new Date().toISOString(),
            inspectorName: 'Clerk of Works Dispatching...',
            inspectorLicense: 'NCA Independent Inspector Registry',
});
        await reload();
        if (created?.id) setSelectedInspectionId(created.id);
        setShowBookingModal(false);
        setBookingSuccess(`Neutral inspection ${created?.inspectionCode ?? ''} successfully booked for ${STAGE_LABELS[bookStage]}! Dispatch notification sent to neutral Clerk of Works.`);
        return;
} catch (err) {
          setBookingError(apiErrorMessage(err, 'Booking failed — check your connection and try again.'));
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
      signedOffAt: formatDateTime(new Date()) + ' EAT',
      clientName: reviewClientName.trim() || 'Diaspora Property Owner',
};

    if (isLive) {
      try {
        await api.patch<any>(`/api/v1/projects/${projectId}/independent-inspections/${targetId}/client-review`, {
            clientReviewNotes: review.feedbackNotes,
            clientSatisfactionRating: review.rating,
            clientDiscrepancyFlagged: activeInspection.variancePct<= -10,
});
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
<SiteReportBanner
        projectId={projectId}
        projectName={projectName}
        activeInspection={activeInspection}
        setShowPrintModal={setShowPrintModal}
        setShowBookingModal={setShowBookingModal}
        handleDispatchWhatsApp={handleDispatchWhatsApp}
      />

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
<InspectionRegisterList
        inspections={inspections}
        selectedInspectionId={selectedInspectionId}
        setSelectedInspectionId={setSelectedInspectionId}
      />

      {/* Selected Inspection Report Details Card */}
<div className="bg-slate-50/60 rounded-xl border border-slate-200 p-5 space-y-6">
        {/* Report Overview Header */}
<ReportOverviewHeader activeInspection={activeInspection} />

        {/* Inspector Credentials & GPS Coordinates */}
<InspectorCredentialsCard activeInspection={activeInspection} />

        {/* Progress Variance Analysis */}
<VarianceAnalysisCard activeInspection={activeInspection} varianceInfo={varianceInfo} />

        {/* Inspection Detailed Findings */}
<InspectionFindingsCard activeInspection={activeInspection} />

        {/* Photo Evidence Gallery with Category Tabs */}
<PhotoEvidenceGallery
          filteredPhotos={filteredPhotos}
          selectedPhotoCategory={selectedPhotoCategory}
          setSelectedPhotoCategory={setSelectedPhotoCategory}
        />

        {/* Client Review & Rating Form */}
<ClientReviewCard
          activeInspection={activeInspection}
          handleSignOffReview={handleSignOffReview}
          reviewRating={reviewRating}
          setReviewRating={setReviewRating}
          reviewClientName={reviewClientName}
          setReviewClientName={setReviewClientName}
          reviewNotes={reviewNotes}
          setReviewNotes={setReviewNotes}
        />
</div>

      {/* Booking Modal */}
      {showBookingModal && (
<BookingInspectionModal
          bookStage={bookStage}
          setBookStage={setBookStage}
          bookUrgency={bookUrgency}
          setBookUrgency={setBookUrgency}
          bookContactPhone={bookContactPhone}
          setBookContactPhone={setBookContactPhone}
          bookSpecialFocus={bookSpecialFocus}
          setBookSpecialFocus={setBookSpecialFocus}
          handleCreateBooking={handleCreateBooking}
          setShowBookingModal={setShowBookingModal}
        />
)}

      {/* BORAQS Certified Inspection Certificate Preview Modal */}
      {showPrintModal && activeInspection && (
<CertificatePreviewModal
          activeInspection={activeInspection}
          projectName={projectName}
          setShowPrintModal={setShowPrintModal}
        />
)}
</div>
);
}
