import React, { useState } from 'react';
import ConcreteCubeTestModal from './ConcreteCubeTestModal';

export type ChecklistType =
  | 'PRE_POUR_CONCRETE'
  | 'REBAR_VERIFICATION'
  | 'FORMWORK_RIGIDITY'
  | 'WATERPROOFING_MEMBRANE';

export type InspectionStatus =
  | 'PENDING_INSPECTION'
  | 'APPROVED_FOR_POUR'
  | 'REJECTED_REWORK_REQUIRED';

export interface ChecklistItem {
  id: string;
  description: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  notes?: string;
}

export interface InspectionChecklist {
  id: string;
  checklistNumber: string;
  checklistType: ChecklistType;
  location: string;
  inspectorName: string;
  status: InspectionStatus;
  date: string;
  items: ChecklistItem[];
}

export interface ConcreteCubeTest {
  id: string;
  testNo: string;
  pourLocation: string;
  concreteClass: string;
  targetStrengthMpa: number;
  pourDate: string;
  batchTicket: string;
  slumpMm: number;
  sevenDayBreakDate: string;
  sevenDayStrengthMpa: number | null;
  twentyEightDayBreakDate: string;
  twentyEightDayStrengthMpa: number | null;
  status: 'PENDING_7DAY' | 'PENDING_28DAY' | 'PASS' | 'FAIL';
  testingLab: string;
}

interface QualityControlViewProps {
  projectId?: string;
  projectName?: string;
  defaultTab?: 'checklists' | 'cube-tests';
  canApprove?: boolean;
  initialChecklists?: InspectionChecklist[];
  initialCubeTests?: ConcreteCubeTest[];
}

const DEFAULT_CHECKLISTS: InspectionChecklist[] = [
  {
    id: 'chk-001',
    checklistNumber: 'CHK-PRE-001',
    checklistType: 'PRE_POUR_CONCRETE',
    location: 'Grid 3-B Ground Floor Raft Foundation (Section 3)',
    inspectorName: 'Eng. Kevin Ochieng (Site Agent) & Resident RE',
    status: 'APPROVED_FOR_POUR',
    date: '2026-02-18',
    items: [
      {
        id: 'ci-1',
        description: 'Rebar sizing, spacing, lap length & 50mm precast concrete cover blocks',
        category: 'Steel Reinforcement',
        status: 'PASS',
        notes: 'Y20 and Y16 bars tied with 16 SWG wire, cover blocks @ 1m centers verified.',
      },
      {
        id: 'ci-2',
        description: 'Formwork rigidity, prop verticality, tie bolts & release agent applied',
        category: 'Formwork / Falsework',
        status: 'PASS',
        notes: 'Steel soldiers braced with diagonal pipe jacks, neat mineral oil coating.',
      },
      {
        id: 'ci-3',
        description: 'Cleanliness of pour area (sawdust, rust flakes, standing water removed)',
        category: 'Housekeeping',
        status: 'PASS',
        notes: 'Compressed air blowing completed, sump pit dry.',
      },
      {
        id: 'ci-4',
        description: 'MEP pipe sleeves, earth rod studs, and conduits securely tied without cutting rebar',
        category: 'MEP Services',
        status: 'PASS',
        notes: '4x 110mm PVC drainage sleeves fixed per drawing MEP-03.',
      },
      {
        id: 'ci-5',
        description: 'Concrete batch plant ticket, target slump (100mm ± 25mm), and cube moulds on standby',
        category: 'Concrete Delivery & QA',
        status: 'PASS',
        notes: '6 cube moulds oiled and tamping rod inspected.',
      },
    ],
  },
  {
    id: 'chk-002',
    checklistNumber: 'CHK-PRE-002',
    checklistType: 'REBAR_VERIFICATION',
    location: 'First Floor Suspended Slab & Perimeter Spandrel Beams (C1-C6)',
    inspectorName: 'Sammy Waweru (Site Supervisor)',
    status: 'PENDING_INSPECTION',
    date: '2026-02-22',
    items: [
      {
        id: 'ci-6',
        description: 'Top mesh reinforcement chair supports and cantilever hogging steel placement',
        category: 'Steel Reinforcement',
        status: 'PENDING',
        notes: 'High-chairs being placed by steel fixers.',
      },
      {
        id: 'ci-7',
        description: 'Soffit formwork camber (3mm per meter span) and prop stability on firm ground',
        category: 'Formwork / Falsework',
        status: 'PASS',
        notes: 'Acro jacks adjusted with base plates on timber sole plates.',
      },
      {
        id: 'ci-8',
        description: 'Electrical conduit junction boxes and conduit crossovers tied to bottom steel',
        category: 'MEP Services',
        status: 'PASS',
        notes: 'Conduit inspection completed by sub-contractor electrician.',
      },
      {
        id: 'ci-9',
        description: 'Concrete cover spacers on beam soffits and sides (min 30mm)',
        category: 'Quality Assurance',
        status: 'FAIL',
        notes: 'Beam B-12 missing side spacers near column junction; fixers instructed to install.',
      },
    ],
  },
  {
    id: 'chk-003',
    checklistNumber: 'CHK-PRE-003',
    checklistType: 'WATERPROOFING_MEMBRANE',
    location: 'Basement 1 Retaining Wall External Face (Grid A - E)',
    inspectorName: 'Faith Achieng (PM/QS)',
    status: 'PENDING_INSPECTION',
    date: '2026-02-20',
    items: [
      {
        id: 'ci-10',
        description: 'Concrete surface primer coat fully cured and free of pinholes',
        category: 'Substrate Preparation',
        status: 'PASS',
      },
      {
        id: 'ci-11',
        description: '4mm SBS torch-on bitumen membrane 100mm side laps and 150mm end laps',
        category: 'Membrane Application',
        status: 'PENDING',
      },
      {
        id: 'ci-12',
        description: 'Protection board (dimpled HDPE drainage sheet) installed before backfilling',
        category: 'Protection Layer',
        status: 'PENDING',
      },
    ],
  },
];

const DEFAULT_CUBE_TESTS: ConcreteCubeTest[] = [
  {
    id: 'cube-001',
    testNo: 'CUBE-2026-001',
    pourLocation: 'Basement Raft Foundation (Slab Pour 1)',
    concreteClass: 'Class 25/20',
    targetStrengthMpa: 25.0,
    pourDate: '2026-01-20',
    batchTicket: 'Bamburi ReadyMix #BRM-8491',
    slumpMm: 105,
    sevenDayBreakDate: '2026-01-27',
    sevenDayStrengthMpa: 18.6,
    twentyEightDayBreakDate: '2026-02-17',
    twentyEightDayStrengthMpa: 27.8,
    status: 'PASS',
    testingLab: 'Materials Testing Research Dept (MTRD) Nairobi',
  },
  {
    id: 'cube-002',
    testNo: 'CUBE-2026-002',
    pourLocation: 'Ground Floor Columns (Grid 2 - 4)',
    concreteClass: 'Class 30/20',
    targetStrengthMpa: 30.0,
    pourDate: '2026-02-02',
    batchTicket: 'Bamburi ReadyMix #BRM-8730',
    slumpMm: 95,
    sevenDayBreakDate: '2026-02-09',
    sevenDayStrengthMpa: 22.4,
    twentyEightDayBreakDate: '2026-03-02',
    twentyEightDayStrengthMpa: null,
    status: 'PENDING_28DAY',
    testingLab: 'On-site Hydraulic Press (Calibrated EBK #CAL-90)',
  },
  {
    id: 'cube-003',
    testNo: 'CUBE-2026-003',
    pourLocation: 'First Floor Suspended Beam B12 & Slab Panel 3',
    concreteClass: 'Class 25/20',
    targetStrengthMpa: 25.0,
    pourDate: '2026-02-14',
    batchTicket: 'Savannah ReadyMix #SRM-1022',
    slumpMm: 110,
    sevenDayBreakDate: '2026-02-21',
    sevenDayStrengthMpa: 17.8,
    twentyEightDayBreakDate: '2026-03-14',
    twentyEightDayStrengthMpa: null,
    status: 'PENDING_28DAY',
    testingLab: 'Materials Testing Research Dept (MTRD) Nairobi',
  },
  {
    id: 'cube-004',
    testNo: 'CUBE-2026-004',
    pourLocation: 'Basement Sump Pit & Pump Chamber Walls',
    concreteClass: 'Class 25/20',
    targetStrengthMpa: 25.0,
    pourDate: '2026-01-10',
    batchTicket: 'On-site Reversible Drum Mixer Batch 4',
    slumpMm: 90,
    sevenDayBreakDate: '2026-01-17',
    sevenDayStrengthMpa: 19.1,
    twentyEightDayBreakDate: '2026-02-07',
    twentyEightDayStrengthMpa: 26.4,
    status: 'PASS',
    testingLab: 'University of Nairobi Civil Eng Lab',
  },
];

export default function QualityControlView({
  projectId = 'project-rcp-2026',
  projectName = 'Riverside Commercial Plaza',
  defaultTab = 'checklists',
  canApprove = true,
  initialChecklists = DEFAULT_CHECKLISTS,
  initialCubeTests = DEFAULT_CUBE_TESTS,
}: QualityControlViewProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'checklists' | 'cube-tests'>(defaultTab);
  const [checklists, setChecklists] = useState<InspectionChecklist[]>(initialChecklists);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>(
    initialChecklists[0]?.id || 'chk-001'
  );
  const [cubeTests, setCubeTests] = useState<ConcreteCubeTest[]>(initialCubeTests);
  const [isCubeModalOpen, setIsCubeModalOpen] = useState(false);

  const selectedChecklist =
    checklists.find((c) => c.id === selectedChecklistId) || checklists[0];

  // Toggle item PASS / FAIL / PENDING
  const handleToggleItemStatus = (itemId: string, newStatus: 'PASS' | 'FAIL') => {
    setChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== selectedChecklistId) return chk;
        const updatedItems = chk.items.map((item) =>
          item.id === itemId
            ? { ...item, status: item.status === newStatus ? ('PENDING' as const) : newStatus }
            : item
        );
        return { ...chk, items: updatedItems };
      })
    );
  };

  // Approve checklist for pour
  const handleSetChecklistStatus = (newStatus: InspectionStatus) => {
    setChecklists((prev) =>
      prev.map((chk) => (chk.id === selectedChecklistId ? { ...chk, status: newStatus } : chk))
    );
  };

  const handleTestCreated = (newTest: any) => {
    setCubeTests((prev) => [newTest, ...prev]);
  };

  const getStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case 'APPROVED_FOR_POUR':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'PENDING_INSPECTION':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'REJECTED_REWORK_REQUIRED':
        return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
    }
  };

  const getCubeStatusBadge = (test: ConcreteCubeTest) => {
    if (test.twentyEightDayStrengthMpa !== null) {
      if (test.twentyEightDayStrengthMpa >= test.targetStrengthMpa) {
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: `PASS (${test.twentyEightDayStrengthMpa.toFixed(1)} MPa)`,
        };
      }
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
        label: `FAIL (${test.twentyEightDayStrengthMpa.toFixed(1)} MPa)`,
      };
    }
    if (test.sevenDayStrengthMpa !== null) {
      return {
        bg: 'bg-blue-50 text-blue-800 border-blue-200',
        label: `PENDING 28-DAY (7-Day: ${test.sevenDayStrengthMpa.toFixed(1)} MPa)`,
      };
    }
    return {
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      label: 'CUBES CURING IN TANK',
    };
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Quality Assurance & Structural Inspection
            </span>
            <span className="text-xs text-slate-400 font-mono">KS 02-598 / BORAQS</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            Pre-Pour Hold Points & Concrete Cube Crushing
          </h3>
          <p className="text-xs text-slate-500">
            Mandatory site hold-point clearances, rebar verification, and compressive cube break certificates
          </p>
        </div>

        {activeTab === 'cube-tests' && (
          <button
            onClick={() => setIsCubeModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <span>+ Log Cube Test</span>
          </button>
        )}
      </div>

      {/* Sub-Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('checklists')}
          className={`flex-1 py-2 px-4 rounded-lg transition text-center flex items-center justify-center gap-2 ${
            activeTab === 'checklists'
              ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span>📋</span>
          <span>Pre-Pour Inspection Checklists ({checklists.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('cube-tests')}
          className={`flex-1 py-2 px-4 rounded-lg transition text-center flex items-center justify-center gap-2 ${
            activeTab === 'cube-tests'
              ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span>🧪</span>
          <span>Concrete Cube Crushing Tests ({cubeTests.length})</span>
        </button>
      </div>

      {/* TAB 1: PRE-POUR INSPECTION CHECKLISTS */}
      {activeTab === 'checklists' && selectedChecklist && (
        <div className="p-5 space-y-5">
          {/* Checklist Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {checklists.map((chk) => {
              const isSelected = chk.id === selectedChecklist.id;
              const passCount = chk.items.filter((i) => i.status === 'PASS').length;
              return (
                <div
                  key={chk.id}
                  onClick={() => setSelectedChecklistId(chk.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs space-y-1.5 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-400'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-slate-800">
                      {chk.checklistNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getStatusBadge(
                        chk.status
                      )}`}
                    >
                      {chk.status === 'APPROVED_FOR_POUR'
                        ? 'APPROVED'
                        : chk.status === 'REJECTED_REWORK_REQUIRED'
                        ? 'REWORK'
                        : 'PENDING'}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 line-clamp-1">{chk.location}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="font-mono">{chk.checklistType}</span>
                    <span className="font-semibold text-blue-700">
                      {passCount}/{chk.items.length} Passed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Checklist Detail Box */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                    {selectedChecklist.checklistNumber}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    Type: <span className="font-mono text-slate-900">{selectedChecklist.checklistType}</span>
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-1">
                  {selectedChecklist.location}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspector: <span className="font-medium text-slate-700">{selectedChecklist.inspectorName}</span> • Date: {selectedChecklist.date}
                </p>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                    selectedChecklist.status
                  )}`}
                >
                  {selectedChecklist.status}
                </span>

                {canApprove && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => handleSetChecklistStatus('APPROVED_FOR_POUR')}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition"
                      title="Authorize ready-mix pour"
                    >
                      ✓ Approve for Pour
                    </button>
                    <button
                      onClick={() => handleSetChecklistStatus('REJECTED_REWORK_REQUIRED')}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition"
                      title="Reject pour and require structural rework"
                    >
                      ✕ Reject / Rework
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Checklist Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200 overflow-hidden">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                    <th className="p-3 font-semibold">Hold-Point Inspection Parameter</th>
                    <th className="p-3 font-semibold">Trade Category</th>
                    <th className="p-3 font-semibold">Inspector Notes / Criteria</th>
                    <th className="p-3 font-semibold text-center">Status</th>
                    <th className="p-3 font-semibold text-right">Interactive Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {selectedChecklist.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-medium text-slate-900 max-w-sm">
                        {item.description}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono border border-slate-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px] max-w-xs">
                        {item.notes || 'Meets structural drawing spec.'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            item.status === 'PASS'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.status === 'FAIL'
                              ? 'bg-rose-50 text-rose-800 border-rose-200 font-black'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleToggleItemStatus(item.id, 'PASS')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded transition border ${
                              item.status === 'PASS'
                                ? 'bg-emerald-700 text-white border-emerald-800'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            PASS ✓
                          </button>
                          <button
                            onClick={() => handleToggleItemStatus(item.id, 'FAIL')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded transition border ${
                              item.status === 'FAIL'
                                ? 'bg-rose-700 text-white border-rose-800'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                            }`}
                          >
                            FAIL ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONCRETE CUBE CRUSHING TESTS */}
      {activeTab === 'cube-tests' && (
        <div className="p-5 space-y-4">
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
            <span className="text-base">ℹ️</span>
            <div>
              <span className="font-semibold block">Kenyan Standard KS 02-598 Testing Protocol:</span>
              <p className="mt-0.5 text-blue-800">
                Sets of 3 cubes tested at 7 days (expected ~67-70% characteristic target) and 28 days
                (mandatory ≥ 100% characteristic strength, target 25.0 MPa for Class 25/20).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="p-3 font-semibold">Test # & Supplier Ticket</th>
                  <th className="p-3 font-semibold">Pour Structural Location</th>
                  <th className="p-3 font-semibold">Class</th>
                  <th className="p-3 font-semibold">7-Day Break</th>
                  <th className="p-3 font-semibold">28-Day Break</th>
                  <th className="p-3 font-semibold">Compressive Strength (MPa) Gauge</th>
                  <th className="p-3 font-semibold text-right">Pass/Fail Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cubeTests.map((test) => {
                  const badge = getCubeStatusBadge(test);
                  const effectiveStrength =
                    test.twentyEightDayStrengthMpa || test.sevenDayStrengthMpa || 0;
                  const ratio = Math.min(
                    150,
                    Math.round((effectiveStrength / test.targetStrengthMpa) * 100)
                  );
                  const isPass =
                    test.twentyEightDayStrengthMpa !== null &&
                    test.twentyEightDayStrengthMpa >= test.targetStrengthMpa;

                  return (
                    <tr key={test.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-blue-900">{test.testNo}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {test.batchTicket}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{test.pourLocation}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {`Poured: ${test.pourDate} • Slump: ${test.slumpMm}mm`}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono font-medium text-[11px] border border-slate-200">
                          {test.concreteClass}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {test.sevenDayStrengthMpa !== null ? (
                          <div>
                            <span className="font-mono font-bold text-slate-800">
                              {`${test.sevenDayStrengthMpa.toFixed(1)} MPa`}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {test.sevenDayBreakDate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">Pending break</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {test.twentyEightDayStrengthMpa !== null ? (
                          <div>
                            <span
                              className={`font-mono font-bold ${
                                isPass ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {`${test.twentyEightDayStrengthMpa.toFixed(1)} MPa`}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {test.twentyEightDayBreakDate}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-amber-700 font-medium font-mono text-[11px]">
                              Scheduled
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {test.twentyEightDayBreakDate}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Compressive strength gauge */}
                      <td className="p-3 min-w-[180px]">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="font-semibold text-slate-700">
                              {effectiveStrength > 0 ? `${effectiveStrength.toFixed(1)} MPa` : '0 MPa'}
                            </span>
                            <span className="text-slate-400">
                              {`target ${test.targetStrengthMpa.toFixed(0)} MPa`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full transition-all rounded-full ${
                                test.twentyEightDayStrengthMpa !== null
                                  ? isPass
                                    ? 'bg-emerald-600'
                                    : 'bg-rose-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, ratio)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-right font-mono text-slate-500">
                            {`${ratio}% of target`}
                          </div>
                        </div>
                      </td>

                      {/* Pass / Fail badge */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <ConcreteCubeTestModal
        isOpen={isCubeModalOpen}
        onClose={() => setIsCubeModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        onTestCreated={handleTestCreated}
      />
    </div>
  );
}
