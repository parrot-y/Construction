import React, { useEffect, useState} from 'react';
import { PortalLinkNotice, PortalExpiryBanner, portalErrorKind, portalHttpError, type PortalLinkKind } from './PortalErrorState';
import { ResponsiveTable } from '../../ui';

export interface ComplianceSummary {
  ncaSiteRegistration: string;
  statutoryLevyPaid: boolean | null;
  certifiedSiteSupervisorPresent: boolean | null;
  concreteCubePassRate: string;
  totalBatchesSampled: number;
  prePourInspectionsConducted: number;
}

export interface StatutoryPermit {
  id: string;
  permitType: string;
  permitNumber: string;
  issuer: string;
  issuedDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  statusLabel: string;
}

export interface ComplianceVisit {
  id: string;
  visitDate: string;
  outcome: 'COMPLIANT' | 'CONDITIONAL' | 'NON_COMPLIANT' | 'FOLLOW_UP_REQUIRED';
  notes?: string | null;
  recordedByName?: string | null;
  actions?: { id: string; description: string; dueDate?: string | null; status?: string }[];
}

const PERMIT_TYPE_LABELS: Record<string, string> = {
  NCA_REGISTRATION: 'NCA site registration',
  NEMA_LICENSE: 'NEMA environmental licence',
  COUNTY_APPROVAL: 'County building approval',
  OTHER: 'Other statutory permit',
};

interface CompliancePortalViewProps {
  token?: string;
  auditorName?: string;
  auditorAgency?: string;
  projectName?: string;
  projectCode?: string;
  onBackToDashboard?: () => void;
}

export default function CompliancePortalView({
  token,
  auditorName,
  auditorAgency,
  projectName,
  projectCode,
}: CompliancePortalViewProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PortalLinkKind>('error');
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [auditor, setAuditor] = useState({ name: auditorName || '', agency: auditorAgency || '' });
  const [proj, setProj] = useState({ name: projectName || '', code: projectCode || '' });
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary>({
    ncaSiteRegistration: '',
    statutoryLevyPaid: null,
    certifiedSiteSupervisorPresent: null,
    concreteCubePassRate: '—',
    totalBatchesSampled: 0,
    prePourInspectionsConducted: 0,
  });
  const [statutoryPermits, setStatutoryPermits] = useState<StatutoryPermit[]>([]);
  const [cubeTests, setCubeTests] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [, setCertificates] = useState<any[]>([]);
  const [visits, setVisits] = useState<ComplianceVisit[]>([]);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [visitForm, setVisitForm] = useState({ visitDate: new Date().toISOString().slice(0, 10), outcome: 'COMPLIANT' as ComplianceVisit['outcome'], notes: '', actionDescription: '', actionDueDate: '' });
  const [visitBusy, setVisitBusy] = useState(false);
  const [visitFeedback, setVisitFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); setLoadError('Missing portal token.'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/portals/compliance/${token}`, { credentials: 'include' });
        const body = await res.json();
        if (!res.ok) throw portalHttpError(body.message || 'This portal link is invalid or has expired', res.status);
        if (cancelled) return;
        const d = body.data || body;
        if (d.regulatoryAuditor) setAuditor({ name: d.regulatoryAuditor.name || '', agency: d.regulatoryAuditor.agency || '' });
        if (d.linkExpiresAt) setLinkExpiresAt(d.linkExpiresAt);
        if (d.project) setProj({ name: d.project.name || '', code: d.project.code || '' });
        if (d.complianceSummary) setComplianceSummary({
          ncaSiteRegistration: d.complianceSummary.ncaSiteRegistration || '',
          statutoryLevyPaid: d.complianceSummary.statutoryLevyPaid ?? null,
          certifiedSiteSupervisorPresent: d.complianceSummary.certifiedSiteSupervisorPresent ?? null,
          concreteCubePassRate: d.complianceSummary.concreteCubePassRate ?? 'No tests yet',
          totalBatchesSampled: d.complianceSummary.totalBatchesSampled ?? 0,
          prePourInspectionsConducted: d.complianceSummary.prePourInspectionsConducted ?? 0,
        });
        setCubeTests((d.cubeTests || []).map((c: any) => ({
          id: c.id,
          batch_reference: c.deliveryDocketNo || c.id,
          pour_date: c.pourDate,
          element_location: c.pourLocation,
          concrete_class: c.concreteClass,
          design_grade_mpa: Number(c.targetStrengthMpa ?? 0),
          supplier_name: c.supplierName,
          break_results: (c.breakResults || []).map((b: any) => ({
            age_days: b.breakAgeDays,
            compressive_strength_mpa: Number(b.compressiveMpa ?? 0),
            is_pass: !!b.isPass,
          })),
        })));
        setInspections((d.inspections || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          category: i.inspectionType || String(i.checklistType || ''),
          scheduled_date: i.scheduledDate,
          status: i.status,
          location: i.location,
        })));
        setCertificates(d.certificates || []);
        setStatutoryPermits((d.permits || []).map((p: any) => ({
          id: p.id,
          permitType: p.permitType || 'OTHER',
          permitNumber: p.permitNumber || '',
          issuer: p.issuer || '',
          issuedDate: p.issuedDate || null,
          expiryDate: p.expiryDate || null,
          notes: p.notes || null,
          status: p.status || 'VALID',
          statusLabel: p.statusLabel || p.status || 'Valid',
        })));
        setVisits((d.visits || []).map((v: any) => ({
          id: v.id,
          visitDate: v.visitDate,
          outcome: v.outcome,
          notes: v.notes,
          recordedByName: v.recordedByName,
          actions: v.actions || [],
        })));
      } catch (e: any) {
        if (!cancelled) { setLoadError(e.message || 'Failed to load portal'); setErrorKind(portalErrorKind(e)); setErrorKind(portalErrorKind(e)); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const recordVisit = async () => {
    if (!token || !visitForm.visitDate || !visitForm.outcome) return;
    setVisitBusy(true);
    setVisitFeedback(null);
    try {
      const actions = visitForm.actionDescription.trim()
        ? [{ description: visitForm.actionDescription.trim(), dueDate: visitForm.actionDueDate || null }]
        : [];
      const res = await fetch(`/api/v1/portals/compliance/${token}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate: visitForm.visitDate,
          outcome: visitForm.outcome,
          notes: visitForm.notes || null,
          actions,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not record the visit');
      const created = body.data || body;
      setVisits((prev) => [{
        id: created.id,
        visitDate: created.visitDate || created.visit_date || visitForm.visitDate,
        outcome: created.outcome || visitForm.outcome,
        notes: created.notes || visitForm.notes || null,
        recordedByName: created.recordedByName || auditor.name || null,
        actions: (created.actions || []).map((a: any) => ({ id: a.id, description: a.description, dueDate: a.dueDate ?? a.due_date, status: a.status })),
      }, ...prev]);
      setVisitForm((f) => ({ ...f, notes: '', actionDescription: '', actionDueDate: '' }));
      setVisitFeedback('Visit recorded — the site team has been notified.');
    } catch (e: any) {
      setVisitFeedback(e.message || 'Network error — visit not recorded.');
    } finally {
      setVisitBusy(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-sm text-slate-400">Loading portal…</div>;
  }
  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto">
        <PortalLinkNotice kind={errorKind} message={loadError || undefined} />
      </div>
    );
  }

  const getPermitStatusBadge = (status: StatutoryPermit['status']) => {
    switch (status) {
      case 'VALID':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'EXPIRING_SOON':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'EXPIRED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
}
};

  return (
<div className="w-full max-w-5xl mx-auto space-y-6" data-testid="compliance-portal-view">
      <PortalExpiryBanner expiresAt={linkExpiresAt} />
      {/* Header */}
<header className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-2">
<span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              NCA &amp; Regulatory Compliance Portal
</span>
<span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Secured auditor link
</span>
</div>
<h1 className="text-xl font-bold mt-2 text-slate-900">{proj.name} ({proj.code})</h1>
<p className="text-xs text-slate-500">
            Inspector:<span className="text-slate-700 font-semibold">{auditor.name}</span> • {auditor.agency}
</p>
</div>

<div className="flex items-center gap-3">
<button
            onClick={() => setShowCertificateModal(true)}
            data-testid="view-statutory-certificate-btn"
            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded-lg transition flex items-center gap-1.5"
          >
<span> Statutory Docket Certificate</span>
</button>
</div>
</header>
      {/* What you can do here */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-bold text-slate-500 mb-2">What you can do here</p>
<ul className="text-xs text-slate-600 space-y-1">
            <li>• Review NCA registration, statutory levy and supervisor certification status</li>
            <li>• Inspect concrete cube test results and site inspection records</li>
            <li>• Record site inspection visits with outcomes and required actions</li>
            <li>• Issue statutory docket certificates for completed works</li>
</ul>
</div>


      {/* Statutory Compliance Cards */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
<p className="text-[11px] font-semibold text-slate-500">NCA Registration</p>
<p className="text-xs font-bold text-slate-900 truncate">
            {complianceSummary.ncaSiteRegistration || 'Not recorded'}
</p>
{complianceSummary.ncaSiteRegistration && (
<span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-1">
            Registered Site
</span>
)}
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
<p className="text-[11px] font-semibold text-slate-500">Statutory Levy</p>
<p className="text-sm font-bold text-emerald-600">
            {complianceSummary.statutoryLevyPaid === null ? 'Not tracked' : complianceSummary.statutoryLevyPaid ? 'Paid & Reconciled' : 'Pending'}
</p>
<p className="text-[10px] text-slate-500">National Construction Levy</p>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
<p className="text-[11px] font-semibold text-slate-500">Accredited Supervisor</p>
<p className="text-sm font-bold text-emerald-600">
            {complianceSummary.certifiedSiteSupervisorPresent === null ? 'Not tracked' : complianceSummary.certifiedSiteSupervisorPresent ? 'Active on Site' : 'Not Certified'}
</p>
<p className="text-[10px] text-slate-500">NCA Registered Professional</p>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
<p className="text-[11px] font-semibold text-slate-500">Cube Crushing Pass Rate</p>
<p className="text-xl font-bold text-emerald-700">
            {complianceSummary.concreteCubePassRate}
</p>
<p className="text-[10px] text-slate-500">KS 02-598 Standard ({complianceSummary.totalBatchesSampled} Batches)</p>
</div>
</div>

      {/* Kenyan Statutory Clearances & Approvals Register */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="flex justify-between items-center">
<div>
<h3 className="text-sm font-bold text-slate-900">Kenyan Statutory Clearances &amp; Approvals</h3>
<p className="text-xs text-slate-500">
              NEMA, County Government Stamped Drawings, DOSHS OSHA 2007 &amp; Water Services
</p>
</div>
<span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            Statutory Legal Guard Active
</span>
</div>

<ResponsiveTable
            head={['Statutory Authority', 'Permit / Reference No', 'Scope / Approval Scope', 'Issue Date', 'Expiry', 'Status']}
            className="text-xs"
            empty="No statutory permits on file yet — the contractor registers NEMA, county and NCA permits here."
            rows={statutoryPermits.map((p) => ({
              key: p.id,
              className: 'hover:bg-slate-50',
              cells: [
                { content: p.issuer, className: 'font-semibold text-slate-900' },
                { content: p.permitNumber, className: 'font-mono tabular-nums font-bold text-blue-700' },
                { content: p.notes || PERMIT_TYPE_LABELS[p.permitType] || p.permitType, className: 'text-slate-600 max-w-xs' },
                { content: p.issuedDate ? String(p.issuedDate).slice(0, 10) : '—', className: 'text-slate-600' },
                { content: p.expiryDate ? `Expires ${String(p.expiryDate).slice(0, 10)}` : '—', className: 'text-slate-600' },
                <span
                  key="st"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPermitStatusBadge(p.status)}`}
                >
                  {p.statusLabel || p.status.replace(/_/g, ' ')}
</span>,
              ],
            }))}
          />
</div>

      {/* Concrete Cube Crushing Register */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="flex justify-between items-center">
<div>
<h3 className="text-sm font-bold text-slate-900">Structural Concrete Quality Register</h3>
<p className="text-xs text-slate-500">Independent concrete test cube crush records (BS EN 12390 / KS 02-598)</p>
</div>
<span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
            {"σ = kN / 22.5 MPa"}
</span>
</div>

<ResponsiveTable
            head={['Batch Ref', 'Pour Date', 'Element / Structural Location', 'Design Grade', '7-Day Test', '28-Day Test', 'Compliance Status']}
            className="text-xs"
            empty="No concrete cube tests recorded yet — cube results appear here once the contractor logs batch tests."
            rows={cubeTests.map((c) => {
              const day7 = c.break_results?.find((b: any) => b.age_days === 7);
              const day28 = c.break_results?.find((b: any) => b.age_days === 28);
              const allPassed = c.break_results?.every((b: any) => b.is_pass) ?? true;
              return {
                key: c.id,
                className: 'hover:bg-slate-50',
                cells: [
                  { content: c.batch_reference, className: 'font-mono tabular-nums font-bold text-blue-700' },
                  { content: c.pour_date, className: 'text-slate-600' },
                  { content: c.element_location, className: 'font-medium text-slate-900' },
                  { content: `C${c.design_grade_mpa}`, className: 'font-bold text-slate-800' },
                  { content: day7 ? `${day7.compressive_strength_mpa} MPa` : '—', className: 'tabular-nums' },
                  { content: day28 ? `${day28.compressive_strength_mpa} MPa` : 'In Curing Tank', className: 'tabular-nums' },
                  <span
                    key="st"
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      allPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {allPassed ? 'Compliant' : 'Investigation Required'}
</span>,
                ],
              };
            })}
          />
</div>

      {/* Pre-pour QA Register */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div>
<h3 className="text-sm font-bold text-slate-900">Pre-Pour Structural Inspection Register</h3>
<p className="text-xs text-slate-500">Verification before concrete pouring per National Building Code</p>
</div>

<div className="divide-y divide-slate-100 text-xs">
          {inspections.length === 0 && (
<p className="text-sm text-slate-500 text-center py-6">No inspections on file yet — inspection requests and results will appear here once the site team schedules them.</p>
)}
          {inspections.map((insp) => (
<div key={insp.id} className="py-3 flex justify-between items-center">
<div>
<p className="font-bold text-slate-900">{insp.title}</p>
<p className="text-slate-500 text-[11px]">Inspection Date: {insp.scheduled_date} • {insp.category}</p>
</div>
<span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {insp.status}
</span>
</div>
))}
</div>
</div>

      {/* Site visits — inspector records each visit; contractor sees outcomes */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4" data-testid="compliance-visits-card">
<div>
<h3 className="text-sm font-bold text-slate-900">Site inspection visits</h3>
<p className="text-xs text-slate-500">Record each site visit — the outcome and any required actions are shared with the site team.</p>
</div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
<label className="text-[11px] font-semibold text-slate-600">
            Visit date
            <input
              type="date"
              className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
              value={visitForm.visitDate}
              onChange={(e) => setVisitForm((f) => ({ ...f, visitDate: e.target.value }))}
              data-testid="visit-date-input"
            />
</label>
<label className="text-[11px] font-semibold text-slate-600">
            Outcome
            <select
              className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
              value={visitForm.outcome}
              onChange={(e) => setVisitForm((f) => ({ ...f, outcome: e.target.value as ComplianceVisit['outcome'] }))}
              data-testid="visit-outcome-select"
            >
              <option value="COMPLIANT">Compliant</option>
              <option value="CONDITIONAL">Conditional</option>
              <option value="NON_COMPLIANT">Non-compliant</option>
              <option value="FOLLOW_UP_REQUIRED">Follow-up required</option>
</select>
</label>
<label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
            Notes (optional)
            <input
              type="text"
              className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
              placeholder="What was inspected and observed"
              value={visitForm.notes}
              onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))}
              data-testid="visit-notes-input"
            />
</label>
</div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
<label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
            Required action (optional)
            <input
              type="text"
              className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
              placeholder="e.g. Submit revised edge-protection detail by Friday"
              value={visitForm.actionDescription}
              onChange={(e) => setVisitForm((f) => ({ ...f, actionDescription: e.target.value }))}
              data-testid="visit-action-input"
            />
</label>
<label className="text-[11px] font-semibold text-slate-600">
            Action due date
            <input
              type="date"
              className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
              value={visitForm.actionDueDate}
              onChange={(e) => setVisitForm((f) => ({ ...f, actionDueDate: e.target.value }))}
            />
</label>
<button
          type="button"
          disabled={visitBusy}
          onClick={() => void recordVisit()}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-700 hover:bg-rose-800 text-white disabled:opacity-50"
          data-testid="record-visit-btn"
        >
          {visitBusy ? 'Recording…' : 'Record visit'}
</button>
</div>

        {visitFeedback && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">{visitFeedback}</div>
)}

        <div className="divide-y divide-slate-100 text-xs">
          {visits.length === 0 && (
<p className="text-sm text-slate-500 text-center py-4">No inspection visits recorded yet.</p>
)}
          {visits.map((v) => (
<div key={v.id} className="py-3 space-y-1" data-testid={`visit-${v.id}`}>
<div className="flex justify-between items-center gap-3">
<div>
<p className="font-bold text-slate-900">{new Date(v.visitDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
<p className="text-slate-500 text-[11px]">{v.recordedByName || 'Inspector'}{v.notes ? ` • ${v.notes}` : ''}</p>
</div>
<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                v.outcome === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : v.outcome === 'NON_COMPLIANT' ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                {v.outcome.replace(/_/g, ' ')}
</span>
</div>
              {(v.actions || []).map((a) => (
<p key={a.id} className="text-[11px] text-slate-600 pl-3 border-l-2 border-rose-200">
                  Required: {a.description}{a.dueDate ? ` — due ${String(a.dueDate).slice(0, 10)}` : ''}
                  {a.status ? ` (${String(a.status).replace(/_/g, ' ').toLowerCase()})` : ''}
</p>
))}
</div>
))}
</div>
</div>

      {/* Statutory Certificate Print / Verification Modal */}
      {showCertificateModal && (
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
<div className="flex justify-between items-start border-b border-slate-100 pb-3">
<div>
<span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  REPUBLIC OF KENYA • STATUTORY CLEARANCE DOCKET
</span>
<h3 className="text-lg font-bold text-slate-900 mt-1">
                  Official Site Compliance Certificate
</h3>
<p className="text-xs text-slate-500">Project: {proj.name} ({proj.code})</p>
</div>
<button
                onClick={() => setShowCertificateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                
</button>
</div>

<div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
<div className="flex justify-between items-center border-b border-slate-200 pb-2">
<span className="text-slate-500">NCA Registration:</span>
<span className="font-bold text-slate-900">{complianceSummary.ncaSiteRegistration || 'Not recorded'}</span>
</div>
{statutoryPermits.length === 0 ? (
<div className="text-slate-500">No statutory permits on file — the contractor has not registered NEMA, county or NCA permits for this project.</div>
) : (
statutoryPermits.map((pm) => (
<div key={pm.id} className="flex justify-between items-center border-b border-slate-200 pb-2">
<span className="text-slate-500">{pm.issuer}:</span>
<span className="font-bold text-slate-900"><span className="font-mono tabular-nums">{pm.permitNumber}</span> ({pm.statusLabel || pm.status})</span>
</div>
))
)}
</div>

<div className="flex justify-end gap-2 pt-2">
<button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                 Print Statutory Docket
</button>
<button
                onClick={() => setShowCertificateModal(false)}
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
