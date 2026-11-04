import React, { useState } from 'react';

export interface SafetyAuditItem {
  id: string;
  auditNo: string;
  auditDate: string;
  auditorName: string;
  auditorType: 'INTERNAL_SAFETY_OFFICER' | 'NCA_INSPECTOR' | 'DOSHS_OFFICER' | 'LEAD_CONSULTANT';
  ppeComplianceScore: string;
  scaffoldingAndEdgeProtectionStatus: 'PASS' | 'MINOR_DEFECTS' | 'FAIL_STOP_WORK';
  excavationAndShoringStatus: 'PASS' | 'MINOR_DEFECTS' | 'FAIL_STOP_WORK' | 'NOT_APPLICABLE';
  firstAidAndFireStationStatus: 'PASS' | 'DEFICIENT' | 'ABSENT';
  electricalSafetyAndCablesStatus: 'PASS' | 'HAZARDOUS';
  overallComplianceScore: string;
  auditOutcome: 'SATISFACTORY' | 'CORRECTIVE_ACTION_REQUIRED' | 'STOP_ORDER_ISSUED';
  correctiveActionPlan?: string | null;
  reinspectionDueDate?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  createdAt: string;
}

export interface SafetySummary {
  totalAudits: number;
  passCount: number;
  stopOrdersCount: number;
  averageComplianceScorePct: string;
}

interface SafetyAuditScorecardViewProps {
  projectId: string;
  projectName?: string;
  audits?: SafetyAuditItem[];
  summary?: SafetySummary;
  userRole?: string;
  onCreateAudit?: (data: any) => Promise<void>;
}

export const SafetyAuditScorecardView: React.FC<SafetyAuditScorecardViewProps> = ({
  projectId: _projectId,
  projectName = 'Current Project',
  audits: initialAudits,
  summary: initialSummary,
  userRole: _userRole = 'SITE_SUPERVISOR',
  onCreateAudit,
}) => {
  const [auditsList, setAuditsList] = useState<SafetyAuditItem[]>(
    initialAudits || [
      {
        id: 'saf-1',
        auditNo: 'SAF-2026-001',
        auditDate: '2026-11-02',
        auditorName: 'HSE Officer Wanjiku Kariuki',
        auditorType: 'INTERNAL_SAFETY_OFFICER',
        ppeComplianceScore: '95.00',
        scaffoldingAndEdgeProtectionStatus: 'PASS',
        excavationAndShoringStatus: 'PASS',
        firstAidAndFireStationStatus: 'PASS',
        electricalSafetyAndCablesStatus: 'PASS',
        overallComplianceScore: '98.00',
        auditOutcome: 'SATISFACTORY',
        correctiveActionPlan: 'Maintain daily morning safety briefings and inspect safety harness lanyards',
        reinspectionDueDate: null,
        status: 'CLOSED',
        createdAt: '2026-11-02T16:00:00Z',
      },
      {
        id: 'saf-2',
        auditNo: 'SAF-NCA-088',
        auditDate: '2026-10-25',
        auditorName: 'Eng. K. Njoroge (NCA Inspectorate)',
        auditorType: 'NCA_INSPECTOR',
        ppeComplianceScore: '70.00',
        scaffoldingAndEdgeProtectionStatus: 'MINOR_DEFECTS',
        excavationAndShoringStatus: 'PASS',
        firstAidAndFireStationStatus: 'PASS',
        electricalSafetyAndCablesStatus: 'PASS',
        overallComplianceScore: '80.00',
        auditOutcome: 'CORRECTIVE_ACTION_REQUIRED',
        correctiveActionPlan: 'Erect double guardrails and kickboards on Level 2 peripheral cantilever scaffold',
        reinspectionDueDate: '2026-11-05',
        status: 'OPEN',
        createdAt: '2026-10-25T14:30:00Z',
      },
    ]
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAuditForDetails, setSelectedAuditForDetails] = useState<SafetyAuditItem | null>(null);

  // Form states
  const [auditNo, setAuditNo] = useState(`SAF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditorName, setAuditorName] = useState('HSE Officer Wanjiku Kariuki');
  const [auditorType, setAuditorType] = useState<'INTERNAL_SAFETY_OFFICER' | 'NCA_INSPECTOR' | 'DOSHS_OFFICER' | 'LEAD_CONSULTANT'>('INTERNAL_SAFETY_OFFICER');
  const [ppeScore, setPpeScore] = useState('90.00');
  const [scaffoldingStatus, setScaffoldingStatus] = useState<'PASS' | 'MINOR_DEFECTS' | 'FAIL_STOP_WORK'>('PASS');
  const [excavationStatus, setExcavationStatus] = useState<'PASS' | 'MINOR_DEFECTS' | 'FAIL_STOP_WORK' | 'NOT_APPLICABLE'>('PASS');
  const [firstAidStatus, setFirstAidStatus] = useState<'PASS' | 'DEFICIENT' | 'ABSENT'>('PASS');
  const [electricalStatus, setElectricalStatus] = useState<'PASS' | 'HAZARDOUS'>('PASS');
  const [correctiveActionPlan, setCorrectiveActionPlan] = useState('');
  const [reinspectionDueDate, setReinspectionDueDate] = useState('');

  const calculateScoreAndOutcome = (
    ppe: string,
    scaffold: string,
    excavation: string,
    firstAid: string,
    electrical: string
  ) => {
    const ppeNum = parseFloat(ppe) || 0;
    const scaffoldScore = scaffold === 'PASS' ? 20 : scaffold === 'MINOR_DEFECTS' ? 12 : 0;
    const excavationScore = excavation === 'PASS' || excavation === 'NOT_APPLICABLE' ? 20 : excavation === 'MINOR_DEFECTS' ? 10 : 0;
    const firstAidScore = firstAid === 'PASS' ? 10 : firstAid === 'DEFICIENT' ? 5 : 0;
    const electricalScore = electrical === 'PASS' ? 10 : 0;

    const overall = ppeNum * 0.40 + scaffoldScore + excavationScore + firstAidScore + electricalScore;

    let outcome: 'SATISFACTORY' | 'CORRECTIVE_ACTION_REQUIRED' | 'STOP_ORDER_ISSUED' = 'SATISFACTORY';
    if (scaffold === 'FAIL_STOP_WORK' || excavation === 'FAIL_STOP_WORK' || electrical === 'HAZARDOUS') {
      outcome = 'STOP_ORDER_ISSUED';
    } else if (overall < 80 || scaffold === 'MINOR_DEFECTS' || excavation === 'MINOR_DEFECTS' || firstAid === 'DEFICIENT') {
      outcome = 'CORRECTIVE_ACTION_REQUIRED';
    }

    return { overall: overall.toFixed(2), outcome };
  };

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { overall, outcome } = calculateScoreAndOutcome(
      ppeScore,
      scaffoldingStatus,
      excavationStatus,
      firstAidStatus,
      electricalStatus
    );

    const payload = {
      auditNo,
      auditDate,
      auditorName,
      auditorType,
      ppeComplianceScore: ppeScore,
      scaffoldingAndEdgeProtectionStatus: scaffoldingStatus,
      excavationAndShoringStatus: excavationStatus,
      firstAidAndFireStationStatus: firstAidStatus,
      electricalSafetyAndCablesStatus: electricalStatus,
      correctiveActionPlan: correctiveActionPlan || null,
      reinspectionDueDate: reinspectionDueDate || null,
    };

    if (onCreateAudit) {
      await onCreateAudit(payload);
    }

    const newAudit: SafetyAuditItem = {
      id: `saf-${Date.now()}`,
      auditNo,
      auditDate: auditDate || new Date().toISOString().slice(0, 10),
      auditorName,
      auditorType,
      ppeComplianceScore: ppeScore,
      scaffoldingAndEdgeProtectionStatus: scaffoldingStatus,
      excavationAndShoringStatus: excavationStatus,
      firstAidAndFireStationStatus: firstAidStatus,
      electricalSafetyAndCablesStatus: electricalStatus,
      overallComplianceScore: overall,
      auditOutcome: outcome,
      correctiveActionPlan: correctiveActionPlan || null,
      reinspectionDueDate: reinspectionDueDate || null,
      status: outcome === 'SATISFACTORY' ? 'CLOSED' : 'OPEN',
      createdAt: new Date().toISOString(),
    };

    setAuditsList([newAudit, ...auditsList]);
    setShowAddModal(false);
  };

  const summary = initialSummary || {
    totalAudits: auditsList.length,
    passCount: auditsList.filter((a) => a.auditOutcome === 'SATISFACTORY').length,
    stopOrdersCount: auditsList.filter((a) => a.auditOutcome === 'STOP_ORDER_ISSUED').length,
    averageComplianceScorePct:
      auditsList.length > 0
        ? (
            auditsList.reduce((sum, a) => sum + parseFloat(a.overallComplianceScore), 0) /
            auditsList.length
          ).toFixed(1)
        : '100.0',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Field Safety &amp; DOSHS/NCA Compliance Scorecards
          </h2>
          <p className="text-sm text-gray-500">
            {projectName} • Site safety inspections, PPE compliance gauges, scaffolding &amp; excavation pass/fail audits
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition self-start md:self-auto"
        >
          + Record Field Safety Audit
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Average Compliance Score
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">
            {summary.averageComplianceScorePct}%
          </p>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                parseFloat(summary.averageComplianceScorePct) >= 80
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, parseFloat(summary.averageComplianceScorePct))}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Satisfactory Inspections
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {summary.passCount} / {summary.totalAudits} Passes
          </p>
          <span className="text-xs text-gray-500">Meeting OSHA 2007 guidelines</span>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-sm ${
            summary.stopOrdersCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
          }`}
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Critical Stop-Work Orders
          </span>
          <p
            className={`text-2xl font-bold mt-1 ${
              summary.stopOrdersCount > 0 ? 'text-red-700' : 'text-gray-900'
            }`}
          >
            {summary.stopOrdersCount} Active
          </p>
          <span className="text-xs text-red-600 font-medium">Scaffolding, excavation or wiring breaches</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Auditing Authority Coverage
          </span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            NCA &amp; DOSHS
          </p>
          <span className="text-xs text-gray-500">Internal Safety &amp; Statutory Agency</span>
        </div>
      </div>

      {/* Safety Audits Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3">Audit No / Date</th>
                <th className="px-4 py-3">Auditor &amp; Agency</th>
                <th className="px-4 py-3">PPE Score</th>
                <th className="px-4 py-3">Scaffolding &amp; Edge</th>
                <th className="px-4 py-3">Excavation &amp; Shoring</th>
                <th className="px-4 py-3">Overall Score</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {auditsList.map((audit) => {
                const isStop = audit.auditOutcome === 'STOP_ORDER_ISSUED';
                const isCorrective = audit.auditOutcome === 'CORRECTIVE_ACTION_REQUIRED';

                return (
                  <tr
                    key={audit.id}
                    className={
                      isStop
                        ? 'bg-red-50 hover:bg-red-100 transition'
                        : isCorrective
                        ? 'bg-amber-50 hover:bg-amber-100 transition'
                        : 'hover:bg-gray-50 transition'
                    }
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{audit.auditNo}</div>
                      <div className="text-xs text-gray-500">{audit.auditDate}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="font-semibold text-xs">{audit.auditorName}</div>
                      <div className="text-xs text-gray-500">{audit.auditorType.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      <span
                        className={
                          parseFloat(audit.ppeComplianceScore) >= 85
                            ? 'text-emerald-700 font-bold'
                            : 'text-amber-700 font-bold'
                        }
                      >
                        {audit.ppeComplianceScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {audit.scaffoldingAndEdgeProtectionStatus === 'PASS' ? (
                        <span className="text-emerald-700 font-semibold">✓ Pass</span>
                      ) : audit.scaffoldingAndEdgeProtectionStatus === 'MINOR_DEFECTS' ? (
                        <span className="text-amber-700 font-semibold">⚠️ Minor Defects</span>
                      ) : (
                        <span className="text-red-700 font-bold">⛔ FAIL STOP WORK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {audit.excavationAndShoringStatus === 'PASS' ? (
                        <span className="text-emerald-700 font-semibold">✓ Pass</span>
                      ) : audit.excavationAndShoringStatus === 'NOT_APPLICABLE' ? (
                        <span className="text-gray-400">N/A</span>
                      ) : audit.excavationAndShoringStatus === 'MINOR_DEFECTS' ? (
                        <span className="text-amber-700 font-semibold">⚠️ Minor Defects</span>
                      ) : (
                        <span className="text-red-700 font-bold">⛔ FAIL STOP WORK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">
                      {audit.overallComplianceScore}%
                    </td>
                    <td className="px-4 py-3">
                      {isStop ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-200 text-red-900 border border-red-300">
                          ⛔ STOP ORDER ISSUED
                        </span>
                      ) : isCorrective ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                          ⚠️ CORRECTIVE ACTION
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          ✓ SATISFACTORY
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedAuditForDetails(audit)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Audit */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Record Field Safety Audit &amp; Scorecard
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateAudit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Audit Certificate No
                  </label>
                  <input
                    type="text"
                    required
                    value={auditNo}
                    onChange={(e) => setAuditNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Audit Date
                  </label>
                  <input
                    type="date"
                    required
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Auditor Name
                  </label>
                  <input
                    type="text"
                    required
                    value={auditorName}
                    onChange={(e) => setAuditorName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Auditor Agency
                  </label>
                  <select
                    value={auditorType}
                    onChange={(e) => setAuditorType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="INTERNAL_SAFETY_OFFICER">Internal HSE Officer</option>
                    <option value="NCA_INSPECTOR">National Construction Authority (NCA)</option>
                    <option value="DOSHS_OFFICER">DOSHS Safety Officer</option>
                    <option value="LEAD_CONSULTANT">Resident Architect / Engineer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  PPE Compliance Score (0 - 100%) [Helmets, Boots, Vests, Harnesses]
                </label>
                <input
                  type="text"
                  required
                  value={ppeScore}
                  onChange={(e) => setPpeScore(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Scaffolding &amp; Edge Protection
                  </label>
                  <select
                    value={scaffoldingStatus}
                    onChange={(e) => setScaffoldingStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="PASS">Pass (Fully Guarded)</option>
                    <option value="MINOR_DEFECTS">Minor Defects (Toe boards missing)</option>
                    <option value="FAIL_STOP_WORK">Fail (Stop Work Immediately)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Excavation &amp; Trench Shoring
                  </label>
                  <select
                    value={excavationStatus}
                    onChange={(e) => setExcavationStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="PASS">Pass (Adequately Shored)</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                    <option value="MINOR_DEFECTS">Minor Defects</option>
                    <option value="FAIL_STOP_WORK">Fail (Cave-in Risk - Stop Work)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    First Aid &amp; Fire Protection
                  </label>
                  <select
                    value={firstAidStatus}
                    onChange={(e) => setFirstAidStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="PASS">Pass (Kit &amp; Extinguishers Present)</option>
                    <option value="DEFICIENT">Deficient</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Electrical Safety &amp; Wiring
                  </label>
                  <select
                    value={electricalStatus}
                    onChange={(e) => setElectricalStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="PASS">Pass (Insulated &amp; RCD Grounded)</option>
                    <option value="HAZARDOUS">Hazardous (Exposed Live Conductors)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Corrective Action Plan / Directives
                </label>
                <textarea
                  rows={3}
                  value={correctiveActionPlan}
                  onChange={(e) => setCorrectiveActionPlan(e.target.value)}
                  placeholder="Detail mandatory corrective directives before re-inspection..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Re-inspection Due Date (if corrective actions required)
                </label>
                <input
                  type="date"
                  value={reinspectionDueDate}
                  onChange={(e) => setReinspectionDueDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
                >
                  Save Safety Audit &amp; Scorecard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Audit Details View */}
      {selectedAuditForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Safety Audit Certificate: {selectedAuditForDetails.auditNo}
              </h3>
              <button
                onClick={() => setSelectedAuditForDetails(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-semibold text-gray-600 block text-xs">Date:</span>
                  {selectedAuditForDetails.auditDate}
                </div>
                <div>
                  <span className="font-semibold text-gray-600 block text-xs">Auditor:</span>
                  {selectedAuditForDetails.auditorName} ({selectedAuditForDetails.auditorType.replace(/_/g, ' ')})
                </div>
                <div>
                  <span className="font-semibold text-gray-600 block text-xs">PPE Compliance:</span>
                  <span className="font-mono font-bold">{selectedAuditForDetails.ppeComplianceScore}%</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600 block text-xs">Overall Compliance:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedAuditForDetails.overallComplianceScore}%</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-gray-700 block mb-1">Corrective Action Plan:</span>
                <p className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                  {selectedAuditForDetails.correctiveActionPlan || 'No corrective actions required. Standard maintenance.'}
                </p>
              </div>

              {selectedAuditForDetails.reinspectionDueDate && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">Re-inspection Due:</span> {selectedAuditForDetails.reinspectionDueDate}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedAuditForDetails(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
