import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { InspectionStage, SiteInspectionReport } from './IndependentSiteReportView.parts';

interface BookingInspectionModalProps {
  bookStage: InspectionStage;
  setBookStage: Dispatch<SetStateAction<InspectionStage>>;
  bookUrgency: 'UNANNOUNCED_48HR' | 'SCHEDULED_7DAY' | 'POUR_AUTHORIZATION';
  setBookUrgency: Dispatch<SetStateAction<'UNANNOUNCED_48HR' | 'SCHEDULED_7DAY' | 'POUR_AUTHORIZATION'>>;
  bookContactPhone: string;
  setBookContactPhone: Dispatch<SetStateAction<string>>;
  bookSpecialFocus: string;
  setBookSpecialFocus: Dispatch<SetStateAction<string>>;
  handleCreateBooking: (e: FormEvent) => Promise<void>;
  setShowBookingModal: Dispatch<SetStateAction<boolean>>;
}

export function BookingInspectionModal({
  bookStage,
  setBookStage,
  bookUrgency,
  setBookUrgency,
  bookContactPhone,
  setBookContactPhone,
  bookSpecialFocus,
  setBookSpecialFocus,
  handleCreateBooking,
  setShowBookingModal,
}: BookingInspectionModalProps) {
  return (
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
  );
}

interface CertificatePreviewModalProps {
  activeInspection: SiteInspectionReport;
  projectName: string;
  setShowPrintModal: Dispatch<SetStateAction<boolean>>;
}

export function CertificatePreviewModal({
  activeInspection,
  projectName,
  setShowPrintModal,
}: CertificatePreviewModalProps) {
  return (
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
                  Ref:<span className="tabular-nums font-bold text-slate-800">{activeInspection.reportRef}</span> • Project: {projectName}
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
<span className="text-[10px] text-slate-500 block tabular-nums">GPS: ±{activeInspection.inspector.accuracyMeters}m</span>
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
<span className="tabular-nums text-xs font-black">
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
  );
}
