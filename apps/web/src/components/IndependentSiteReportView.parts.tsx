import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { PRODUCT_NAME } from '../lib/product';
import { formatDateTime } from '../lib/format';

export type InspectionStage = 'substructure' | 'framing' | 'slab' | 'roofing' | 'finishes' | 'borehole';
export type InspectionStatus = 'REQUESTED' | 'DISPATCHED' | 'COMPLETED' | 'CLIENT_REVIEWED';
export type PhotoCategory = 'All' | 'Structural' | 'Materials' | 'Finishes' | 'Safety';

export interface InspectorCredentials {
  name: string;
  ncaRegistration: string;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
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

export const mapApiStatus = (s?: string | null): InspectionStatus => {
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

export const applyInspectionDetail = (insp: SiteInspectionReport, d: any): SiteInspectionReport => {
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
      ? formatDateTime(new Date(p.capturedAt)) + ' EAT'
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

export const getStatusBadge = (status: InspectionStatus) => {
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

export interface VarianceBadgeInfo {
  bg: string;
  badge: string;
  label: string;
  sub: string;
}

export const getVarianceBadge = (variance: number): VarianceBadgeInfo => {
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

interface SiteReportBannerProps {
  projectId: string;
  projectName: string;
  activeInspection: SiteInspectionReport;
  setShowPrintModal: Dispatch<SetStateAction<boolean>>;
  setShowBookingModal: Dispatch<SetStateAction<boolean>>;
  handleDispatchWhatsApp: () => Promise<void>;
}

export function SiteReportBanner({
  projectId,
  projectName,
  activeInspection,
  setShowPrintModal,
  setShowBookingModal,
  handleDispatchWhatsApp,
}: SiteReportBannerProps) {
  return (
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
            {PRODUCT_NAME} Independent Site Inspection Reports
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
  );
}

interface InspectionRegisterListProps {
  inspections: SiteInspectionReport[];
  selectedInspectionId: string;
  setSelectedInspectionId: Dispatch<SetStateAction<string>>;
}

export function InspectionRegisterList({
  inspections,
  selectedInspectionId,
  setSelectedInspectionId,
}: InspectionRegisterListProps) {
  return (
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
<span className="tabular-nums text-xs font-bold text-slate-800">{insp.reportRef}</span>
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
  );
}

interface ReportOverviewHeaderProps {
  activeInspection: SiteInspectionReport;
}

export function ReportOverviewHeader({ activeInspection }: ReportOverviewHeaderProps) {
  return (
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
<div>
<div className="flex items-center gap-2">
<span className="tabular-nums text-sm font-bold text-emerald-800">{activeInspection.reportRef}</span>
<span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(activeInspection.status)}`}>
                {activeInspection.status}
</span>
<span className="text-xs text-slate-500 tabular-nums">Date: {activeInspection.inspectionDate}</span>
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
  );
}

interface InspectorCredentialsCardProps {
  activeInspection: SiteInspectionReport;
}

export function InspectorCredentialsCard({ activeInspection }: InspectorCredentialsCardProps) {
  return (
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
<span className="text-slate-600 text-[11px] tabular-nums mt-0.5 block">NCA Reg: {activeInspection.inspector.ncaRegistration}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-400 block text-[10px] font-semibold ">Contact Telephony</span>
<span className="font-bold text-slate-900 mt-0.5 block">{activeInspection.inspector.phone}</span>
<span className="text-slate-600 text-[11px] mt-0.5 block">{activeInspection.inspector.email}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-400 block text-[10px] font-semibold ">GPS Coordinate Lock &amp; Accuracy</span>
<span className="tabular-nums font-bold text-slate-900 mt-0.5 block">
                {activeInspection.inspector.latitude != null && activeInspection.inspector.longitude != null
                  ? `${activeInspection.inspector.latitude.toFixed(6)}, ${activeInspection.inspector.longitude.toFixed(6)}`
                  : 'No GPS fix recorded'}
</span>
<span className="text-emerald-700 font-medium text-[11px] mt-0.5 block">
                {activeInspection.inspector.accuracyMeters != null ? `± ${activeInspection.inspector.accuracyMeters.toFixed(1)}m GPS Accuracy • ` : ''}{activeInspection.inspector.arrivalTimestamp}
</span>
</div>
</div>
</div>
  );
}

interface VarianceAnalysisCardProps {
  activeInspection: SiteInspectionReport;
  varianceInfo: VarianceBadgeInfo;
}

export function VarianceAnalysisCard({ activeInspection, varianceInfo }: VarianceAnalysisCardProps) {
  return (
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
<span className="text-lg font-bold tabular-nums text-slate-900 mt-0.5 block">
                {activeInspection.contractorReportedPct.toFixed(1)}%
</span>
<span className="text-[10px] text-slate-400 block">Claimed on Interim Valuation</span>
</div>

<div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
<span className="text-[11px] font-semibold text-slate-500 block">Inspector Verified</span>
<span className="text-lg font-bold tabular-nums text-emerald-700 mt-0.5 block">
                {activeInspection.inspectorVerifiedPct.toFixed(1)}%
</span>
<span className="text-[10px] text-slate-400 block">Genuine physically measured progress</span>
</div>

<div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
<span className="text-[11px] font-semibold text-slate-500 block">Variance Delta</span>
<span className={`text-lg font-bold tabular-nums mt-0.5 block ${activeInspection.variancePct<= -10 ? 'text-rose-700' : 'text-slate-800'}`}>
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
  );
}

interface InspectionFindingsCardProps {
  activeInspection: SiteInspectionReport;
}

export function InspectionFindingsCard({ activeInspection }: InspectionFindingsCardProps) {
  return (
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
  );
}

interface PhotoEvidenceGalleryProps {
  filteredPhotos: InspectionPhoto[];
  selectedPhotoCategory: PhotoCategory;
  setSelectedPhotoCategory: Dispatch<SetStateAction<PhotoCategory>>;
}

export function PhotoEvidenceGallery({
  filteredPhotos,
  selectedPhotoCategory,
  setSelectedPhotoCategory,
}: PhotoEvidenceGalleryProps) {
  return (
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
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
<span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                      {photo.category}
</span>
<span className="absolute bottom-2 right-2 bg-slate-900/80 text-white tabular-nums text-[9px] px-2 py-0.5 rounded backdrop-blur-xs">
                       {photo.gpsCoords}
</span>
</div>
<div className="p-3 space-y-1">
<h5 className="font-bold text-xs text-slate-900">{photo.title}</h5>
<p className="text-[11px] text-slate-600">{photo.caption}</p>
<span className="text-[10px] text-slate-400 tabular-nums block">Captured: {photo.timestamp}</span>
</div>
</div>
))}
</div>
)}
</div>
  );
}

interface ClientReviewCardProps {
  activeInspection: SiteInspectionReport;
  handleSignOffReview: (e: FormEvent) => Promise<void>;
  reviewRating: number;
  setReviewRating: Dispatch<SetStateAction<number>>;
  reviewClientName: string;
  setReviewClientName: Dispatch<SetStateAction<string>>;
  reviewNotes: string;
  setReviewNotes: Dispatch<SetStateAction<string>>;
}

export function ClientReviewCard({
  activeInspection,
  handleSignOffReview,
  reviewRating,
  setReviewRating,
  reviewClientName,
  setReviewClientName,
  reviewNotes,
  setReviewNotes,
}: ClientReviewCardProps) {
  return (
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
<span className="text-[11px] text-slate-500 tabular-nums">
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
  );
}
