import React from 'react';

export interface ComplianceSummary {
  ncaSiteRegistration: string;
  statutoryLevyPaid: boolean;
  certifiedSiteSupervisorPresent: boolean;
  concreteCubePassRate: string;
  totalBatchesSampled: number;
  prePourInspectionsConducted: number;
}

interface CompliancePortalViewProps {
  token?: string;
  auditorName?: string;
  auditorAgency?: string;
  projectName?: string;
  projectCode?: string;
  complianceSummary?: ComplianceSummary;
  cubeTests?: Array<{
    id: string;
    batch_reference: string;
    pour_date: string;
    element_location: string;
    design_grade_mpa: number;
    break_results?: Array<{
      age_days: number;
      compressive_strength_mpa: number;
      is_pass: boolean;
    }>;
  }>;
  inspections?: Array<{
    id: string;
    title: string;
    category: string;
    scheduled_date: string;
    status: string;
  }>;
  onBackToDashboard?: () => void;
}

export default function CompliancePortalView({
  token: _token = 'demo-compliance-token',
  auditorName = 'Eng. Faith Mutua',
  auditorAgency = 'National Construction Authority (NCA) / Nairobi County Planning',
  projectName = 'Riverside Commercial Plaza',
  projectCode = 'RCP-2026',
  complianceSummary = {
    ncaSiteRegistration: 'NCA/PRJ/RCP-2026/REG-0891',
    statutoryLevyPaid: true,
    certifiedSiteSupervisorPresent: true,
    concreteCubePassRate: '100.0%',
    totalBatchesSampled: 8,
    prePourInspectionsConducted: 14,
  },
  cubeTests = [
    {
      id: 'c-1',
      batch_reference: 'BT-2026-001',
      pour_date: '2026-02-10',
      element_location: 'Columns C1-C8 Ground Floor',
      design_grade_mpa: 25,
      break_results: [
        { age_days: 7, compressive_strength_mpa: 19.56, is_pass: true },
        { age_days: 28, compressive_strength_mpa: 27.11, is_pass: true },
      ],
    },
    {
      id: 'c-2',
      batch_reference: 'BT-2026-002',
      pour_date: '2026-02-18',
      element_location: 'First Floor Suspended Slab Beam Girder G1',
      design_grade_mpa: 30,
      break_results: [
        { age_days: 7, compressive_strength_mpa: 22.67, is_pass: true },
      ],
    },
  ],
  inspections = [
    {
      id: 'i-1',
      title: 'Foundation Strip Footing Pre-Pour QA',
      category: 'PRE_POUR_CONCRETE',
      scheduled_date: '2026-01-20',
      status: 'PASSED',
    },
    {
      id: 'i-2',
      title: 'Ground Floor Columns Pre-Pour QA',
      category: 'PRE_POUR_CONCRETE',
      scheduled_date: '2026-02-09',
      status: 'PASSED',
    },
    {
      id: 'i-3',
      title: 'First Floor Suspended Slab Pre-Pour QA',
      category: 'PRE_POUR_CONCRETE',
      scheduled_date: '2026-02-17',
      status: 'PASSED',
    },
  ],
  onBackToDashboard,
}: CompliancePortalViewProps): React.JSX.Element {
  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="compliance-portal-view">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              NCA & Regulatory Compliance Portal • Zero Seat Tax
            </span>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Auditor Direct Link
            </span>
          </div>
          <h1 className="text-xl font-bold mt-2 text-white">{projectName} ({projectCode})</h1>
          <p className="text-xs text-slate-400">
            Inspector: <span className="text-slate-200 font-semibold">{auditorName}</span> • {auditorAgency}
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
            {complianceSummary.statutoryLevyPaid ? 'Paid & Reconciled' : 'Pending'}
          </p>
          <p className="text-[10px] text-slate-500">National Construction Levy</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">Accredited Supervisor</p>
          <p className="text-sm font-bold text-emerald-600">
            {complianceSummary.certifiedSiteSupervisorPresent ? 'Active on Site' : 'Not Certified'}
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
                const day7 = c.break_results?.find((b) => b.age_days === 7);
                const day28 = c.break_results?.find((b) => b.age_days === 28);
                const allPassed = c.break_results?.every((b) => b.is_pass) ?? true;

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
    </div>
  );
}
