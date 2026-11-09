import React, { useEffect, useState} from 'react';

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
  authority: string;
  permitNumber: string;
  description: string;
  issueDate: string;
  expiryDate?: string;
  status: 'VALID' | 'APPROVED_STAMPED' | 'CONDITIONAL' | 'PENDING';
  leadOfficer: string;
}

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
  onBackToDashboard,
}: CompliancePortalViewProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [statutoryPermits] = useState<StatutoryPermit[]>([]);
  const [cubeTests, setCubeTests] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [, setCertificates] = useState<any[]>([]);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); setLoadError('Missing portal token.'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/portals/compliance/${token}`, { credentials: 'include' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || 'This portal link is invalid or has expired');
        if (cancelled) return;
        const d = body.data || body;
        if (d.regulatoryAuditor) setAuditor({ name: d.regulatoryAuditor.name || '', agency: d.regulatoryAuditor.agency || '' });
        if (d.project) setProj({ name: d.project.name || '', code: d.project.code || '' });
        if (d.complianceSummary) setComplianceSummary({
          ncaSiteRegistration: d.complianceSummary.ncaSiteRegistration || '',
          statutoryLevyPaid: d.complianceSummary.statutoryLevyPaid ?? null,
          certifiedSiteSupervisorPresent: d.complianceSummary.certifiedSiteSupervisorPresent ?? null,
          concreteCubePassRate: d.complianceSummary.concreteCubePassRate || '—',
          totalBatchesSampled: d.complianceSummary.totalBatchesSampled ?? 0,
          prePourInspectionsConducted: d.complianceSummary.prePourInspectionsConducted ?? 0,
        });
        setCubeTests((d.cubeTests || []).map((c: any) => ({
          id: c.id,
          batch_reference: c.batch_reference,
          pour_date: c.pour_date,
          element_location: c.pour_location,
          design_grade_mpa: Number(c.target_strength_mpa),
          break_results: (c.break_results || []).map((b: any) => ({
            age_days: b.break_age_days,
            compressive_strength_mpa: Number(b.compressive_mpa ?? 0),
            is_pass: !!b.is_pass,
          })),
        })));
        setInspections((d.inspections || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          category: i.inspection_type || String(i.checklist_type || ''),
          scheduled_date: i.scheduled_date,
          status: i.status,
        })));
        setCertificates(d.certificates || []);
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
    return (
      <div className="max-w-5xl mx-auto p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-700">{loadError}</p>
        <p className="text-xs text-slate-400">Check the link or ask your project manager for a new one.</p>
        {onBackToDashboard && <button onClick={onBackToDashboard} className="text-xs text-blue-600 hover:underline">Back</button>}
      </div>
    );
  }

  const getPermitStatusBadge = (status: StatutoryPermit['status']) => {
    switch (status) {
      case 'VALID':
      case 'APPROVED_STAMPED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'CONDITIONAL':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PENDING':
        return 'bg-slate-100 text-slate-800 border-slate-300';
}
};

  return (
<div className="max-w-5xl mx-auto space-y-6" data-testid="compliance-portal-view">
      {/* Header */}
<header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-2">
<span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              NCA &amp; Regulatory Compliance Portal • Zero Seat Tax
</span>
<span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Auditor Direct Link
</span>
</div>
<h1 className="text-xl font-bold mt-2 text-white">{proj.name} ({proj.code})</h1>
<p className="text-xs text-slate-400">
            Inspector:<span className="text-slate-200 font-semibold">{auditor.name}</span> • {auditor.agency}
</p>
</div>

<div className="flex items-center gap-3">
<button
            onClick={() => setShowCertificateModal(true)}
            data-testid="view-statutory-certificate-btn"
            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700 rounded-lg transition flex items-center gap-1.5"
          >
<span> Statutory Docket Certificate</span>
</button>
          {onBackToDashboard && (
<button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              ← Back to Project
</button>
)}
<div className="text-right">
<p className="text-[11px] text-slate-400">Statutory Mandate</p>
<p className="text-xs font-bold text-emerald-400">NCA Cap 499A Verified</p>
</div>
</div>
</header>

      {/* Statutory Compliance Cards */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
<p className="text-[11px] font-semibold text-slate-500">NCA Registration</p>
<p className="text-xs font-mono font-bold text-slate-900 truncate">
            {complianceSummary.ncaSiteRegistration}
</p>
<span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-1">
            Registered Site
</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
<p className="text-[11px] font-semibold text-slate-500">0.5% Statutory Levy</p>
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

<div className="overflow-x-auto">
<table className="w-full text-xs text-left">
<thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
<tr>
<th className="p-3">Statutory Authority</th>
<th className="p-3">Permit / Reference No</th>
<th className="p-3">Scope / Approval Scope</th>
<th className="p-3">Issue Date</th>
<th className="p-3">Supervising Official</th>
<th className="p-3">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {statutoryPermits.length === 0 && (
<tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">No statutory permits on file yet — the contractor uploads NEMA, county, DOSHS and NCWSC documents here.</td></tr>
)}
              {statutoryPermits.map((p) => (
<tr key={p.id} className="hover:bg-slate-50">
<td className="p-3 font-semibold text-slate-900">{p.authority}</td>
<td className="p-3 font-mono font-bold text-blue-700">{p.permitNumber}</td>
<td className="p-3 text-slate-600 max-w-xs">{p.description}</td>
<td className="p-3 text-slate-600">{p.issueDate}</td>
<td className="p-3 text-slate-700 font-medium">{p.leadOfficer}</td>
<td className="p-3">
<span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPermitStatusBadge(
                        p.status
)}`}
                    >
                      {p.status.replace('_', ' ')}
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
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

<div className="overflow-x-auto">
<table className="w-full text-xs text-left">
<thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
<tr>
<th className="p-3">Batch Ref</th>
<th className="p-3">Pour Date</th>
<th className="p-3">Element / Structural Location</th>
<th className="p-3">Design Grade</th>
<th className="p-3">7-Day Test</th>
<th className="p-3">28-Day Test</th>
<th className="p-3">Compliance Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {cubeTests.map((c) => {
                const day7 = c.break_results?.find((b: any) => b.age_days === 7);
                const day28 = c.break_results?.find((b: any) => b.age_days === 28);
                const allPassed = c.break_results?.every((b: any) => b.is_pass) ?? true;

                return (
<tr key={c.id} className="hover:bg-slate-50">
<td className="p-3 font-mono font-bold text-blue-700">{c.batch_reference}</td>
<td className="p-3 text-slate-600">{c.pour_date}</td>
<td className="p-3 font-medium text-slate-900">{c.element_location}</td>
<td className="p-3 font-bold text-slate-800">C{c.design_grade_mpa}</td>
<td className="p-3 font-mono">
                      {day7 ? `${day7.compressive_strength_mpa} MPa` : '—'}
</td>
<td className="p-3 font-mono">
                      {day28 ? `${day28.compressive_strength_mpa} MPa` : 'In Curing Tank'}
</td>
<td className="p-3">
<span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          allPassed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
}`}
                      >
                        {allPassed ? 'Compliant' : 'Investigation Required'}
</span>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>

      {/* Pre-pour QA Register */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div>
<h3 className="text-sm font-bold text-slate-900">Pre-Pour Structural Inspection Register</h3>
<p className="text-xs text-slate-500">Verification before concrete pouring per National Building Code</p>
</div>

<div className="divide-y divide-slate-100 text-xs">
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

<div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3 font-mono">
<div className="flex justify-between items-center border-b border-slate-200 pb-2">
<span className="text-slate-500">NCA Registration:</span>
<span className="font-bold text-slate-900">{complianceSummary.ncaSiteRegistration}</span>
</div>
{statutoryPermits.length === 0 ? (
<div className="text-slate-500">No statutory permits on file — the contractor has not uploaded NEMA, county, DOSHS or NCWSC documents for this project.</div>
) : (
statutoryPermits.map((pm) => (
<div key={pm.id} className="flex justify-between items-center border-b border-slate-200 pb-2">
<span className="text-slate-500">{pm.authority}:</span>
<span className="font-bold text-slate-900">{pm.permitNumber} ({pm.status})</span>
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
