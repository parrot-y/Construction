import React, { useEffect, useState} from 'react';
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
  // Live API checklist_type values (e.g. SCAFFOLDING_SAFETY) exceed the demo union.
  checklistType: ChecklistType | string;
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

export default function QualityControlView({
  projectId = '',
  projectName = '',
  defaultTab = 'checklists',
  canApprove = true,
  initialChecklists = [],
  initialCubeTests = [],
}: QualityControlViewProps): React.JSX.Element {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [activeTab, setActiveTab] = useState<'checklists' | 'cube-tests'>(defaultTab);
  const [checklists, setChecklists] = useState<InspectionChecklist[]>(initialChecklists);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>(
    ''
);
  const [cubeTests, setCubeTests] = useState<ConcreteCubeTest[]>(initialCubeTests);
  const [isCubeModalOpen, setIsCubeModalOpen] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const mapApiStatus = (s: string): InspectionStatus => {
    if (s === 'APPROVED_WITHOUT_COMMENTS' || s === 'APPROVED_WITH_CONDITIONS') return 'APPROVED_FOR_POUR';
    if (s === 'REJECTED') return 'REJECTED_REWORK_REQUIRED';
    return 'PENDING_INSPECTION';
};

  const mapApiChecklist = (c: any): InspectionChecklist => ({
    id: c.id,
    checklistNumber: c.title || `CHK-${String(c.id).slice(0, 8).toUpperCase()}`,
    checklistType: c.checklist_type,
    location: c.location,
    inspectorName: c.inspector_name || c.inspector_role || 'Site Inspector',
    status: mapApiStatus(c.status),
    date: c.inspected_at ? String(c.inspected_at).slice(0, 10) : String(c.scheduled_date || '').slice(0, 10),
    items: (c.items || []).map((i: any) => ({
      id: i.id,
      description: i.check_point,
      category: i.is_mandatory ? 'Mandatory Hold-Point' : 'Advisory',
      status: i.result === 'PASS' ? 'PASS' : i.result === 'FAIL' ? 'FAIL' : 'PENDING',
      notes: i.deficiency_notes || undefined,
})),
});

  const mapApiCubeTest = (t: any): ConcreteCubeTest => {
    const breaks = (t.break_results || []) as any[];
    const b7 = breaks.find((b) => Number(b.break_age_days)<= 7) || null;
    const b28 = breaks.find((b) => Number(b.break_age_days) >= 28) || null;
    const latestBreak = breaks[breaks.length - 1] || null;
    const classLabel = String(t.concrete_class || '')
      .replace(/^CLASS_/, 'Class ')
      .replace(/_/g, '/');
    const sevenMpa = b7?.compressive_mpa != null ? parseFloat(b7.compressive_mpa) : null;
    const twentyEightMpa = b28?.compressive_mpa != null ? parseFloat(b28.compressive_mpa) : null;
    let status: ConcreteCubeTest['status'] = 'PENDING_7DAY';
    if (b28) {
      status = b28.is_pass === false || (twentyEightMpa !== null && twentyEightMpa< parseFloat(t.target_strength_mpa)) ? 'FAIL' : 'PASS';
} else if (b7) {
      status = 'PENDING_28DAY';
}
    return {
      id: t.id,
      testNo: t.batch_reference,
      pourLocation: t.pour_location,
      concreteClass: classLabel || 'Class 25/20',
      targetStrengthMpa: parseFloat(t.target_strength_mpa) || 0,
      pourDate: String(t.pour_date || '').slice(0, 10),
      batchTicket: t.delivery_docket_no || t.supplier_name || t.batch_reference,
      slumpMm: t.slump_tested_mm ?? 0,
      sevenDayBreakDate: b7 ? String(b7.scheduled_break_date || '').slice(0, 10) : '',
      sevenDayStrengthMpa: sevenMpa,
      twentyEightDayBreakDate: b28 ? String(b28.scheduled_break_date || '').slice(0, 10) : '',
      twentyEightDayStrengthMpa: twentyEightMpa,
      status,
      testingLab: latestBreak?.lab_name || t.supplier_name || 'On-site Hydraulic Press',
};
};

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const [chkRes, cubeRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/inspections`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/cube-tests`, { credentials: 'include'}),
      ]);
      if (chkRes.ok) {
        const list = (await chkRes.json()) as any[];
        const mapped = (Array.isArray(list) ? list : []).map(mapApiChecklist);
        setChecklists(mapped);
        setSelectedChecklistId((prev) => (mapped.some((c) => c.id === prev) ? prev : mapped[0]?.id || prev));
}
      if (cubeRes.ok) {
        const list = (await cubeRes.json()) as any[];
        setCubeTests((Array.isArray(list) ? list : []).map(mapApiCubeTest));
}
} catch { /* keep demo fixtures */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const selectedChecklist =
    checklists.find((c) => c.id === selectedChecklistId) || checklists[0];

  // Toggle item PASS / FAIL / PENDING
  const handleToggleItemStatus = (itemId: string, newStatus: 'PASS' | 'FAIL') => {
    const target = selectedChecklist?.items.find((i) => i.id === itemId);
    const nextStatus: 'PASS' | 'FAIL' | 'PENDING' =
      target?.status === newStatus ? 'PENDING' : newStatus;

    if (isLive && selectedChecklist) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/v1/projects/${projectId}/inspections/${selectedChecklist.id}/items/${itemId}`,
            {
              method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json'},
              body: JSON.stringify({ result: nextStatus, deficiencyNotes: target?.notes || null}),
}
);
          if (res.ok) await reload();
} catch { /* keep local */}
})();
}

    setChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== selectedChecklistId) return chk;
        const updatedItems = chk.items.map((item) =>
          item.id === itemId ? { ...item, status: nextStatus} : item
);
        return { ...chk, items: updatedItems};
})
);
};

  // Approve checklist for pour.
  // NOTE: the API derives checklist status automatically from item results
  // (PUT .../items/:itemId) and exposes no direct status-transition endpoint,
  // so in live mode this only updates local UI state.
  const handleSetChecklistStatus = (newStatus: InspectionStatus) => {
    setChecklists((prev) =>
      prev.map((chk) => (chk.id === selectedChecklistId ? { ...chk, status: newStatus} : chk))
);
};

  const handleTestCreated = (newTest: any) => {
    if (isLive) {
      void (async () => {
        try {
          const classMap: Record<string, string> = {
            'Class 15/20': 'CLASS_15_20', 'Class 20/20': 'CLASS_20_20', 'Class 25/20': 'CLASS_25_20',
            'Class 30/20': 'CLASS_30_20', 'Class 35/20': 'CLASS_35_20', 'Class 40/20': 'CLASS_40_20',
};
          const res = await fetch(`/api/v1/projects/${projectId}/cube-tests`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              batchReference: newTest.testNo || `CUBE-${Date.now()}`,
              pourLocation: newTest.pourLocation,
              pourDate: newTest.pourDate,
              concreteClass: classMap[newTest.concreteClass] || 'CLASS_25_20',
              targetStrengthMpa: String(newTest.targetStrengthMpa ?? 25),
              slumpTestedMm: newTest.slumpMm ?? null,
              deliveryDocketNo: newTest.batchTicket || null,
              notes: `Testing lab: ${newTest.testingLab || 'On-site'}`,
}),
});
          if (!res.ok) return;
          const created = await res.json();
          const breaks: any[] = [];
          if (newTest.sevenDayStrengthMpa != null) {
            breaks.push({ cubeNumber: 1, breakAgeDays: 7, scheduledBreakDate: newTest.sevenDayBreakDate, compressiveMpa: String(newTest.sevenDayStrengthMpa), labName: newTest.testingLab});
}
          if (newTest.twentyEightDayStrengthMpa != null) {
            breaks.push({ cubeNumber: 2, breakAgeDays: 28, scheduledBreakDate: newTest.twentyEightDayBreakDate, compressiveMpa: String(newTest.twentyEightDayStrengthMpa), labName: newTest.testingLab});
}
          for (const b of breaks) {
            await fetch(`/api/v1/projects/${projectId}/cube-tests/${created.id}/breaks`, {
              method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
              body: JSON.stringify(b),
});
}
          await reload();
} catch { /* keep local */}
})();
      return;
}
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

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading quality inspections…</div>;
}

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Header */}
<div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Quality Assurance & Structural Inspection
</span>
<span className="text-xs text-slate-400 tabular-nums">KS 02-598 / BORAQS</span>
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
<span></span>
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
<span></span>
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
<span className="tabular-nums font-bold text-slate-800">
                      {chk.checklistNumber}
</span>
<span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadge(
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
<span className="tabular-nums">{chk.checklistType}</span>
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
<span className="text-xs tabular-nums font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                    {selectedChecklist.checklistNumber}
</span>
<span className="text-xs font-semibold text-slate-600">
                    Type:<span className="tabular-nums text-slate-900">{selectedChecklist.checklistType}</span>
</span>
</div>
<h4 className="text-base font-bold text-slate-900 mt-1">
                  {selectedChecklist.location}
</h4>
<p className="text-xs text-slate-500 mt-0.5">
                  Inspector:<span className="font-medium text-slate-700">{selectedChecklist.inspectorName}</span> • Date: {selectedChecklist.date}
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
                       Approve for Pour
</button>
<button
                      onClick={() => handleSetChecklistStatus('REJECTED_REWORK_REQUIRED')}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition"
                      title="Reject pour and require structural rework"
                    >
                       Reject / Rework
</button>
</div>
)}
</div>
</div>

            {/* Checklist Items Table */}
<div className="overflow-x-auto">
<table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200 overflow-hidden">
<thead>
<tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-[10px]">
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
<span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] tabular-nums border border-slate-200">
                          {item.category}
</span>
</td>
<td className="p-3 text-slate-500 text-[11px] max-w-xs">
                        {item.notes || 'Meets structural drawing spec.'}
</td>
<td className="p-3 text-center whitespace-nowrap">
<span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
                            PASS 
</button>
<button
                            onClick={() => handleToggleItemStatus(item.id, 'FAIL')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded transition border ${
                              item.status === 'FAIL'
                                ? 'bg-rose-700 text-white border-rose-800'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
}`}
                          >
                            FAIL 
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
<span className="text-base">ℹ</span>
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
<tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px]">
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
<div className="font-mono tabular-nums font-bold text-blue-900">{test.testNo}</div>
<div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
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
<span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded tabular-nums font-medium text-[11px] border border-slate-200">
                          {test.concreteClass}
</span>
</td>
<td className="p-3 whitespace-nowrap">
                        {test.sevenDayStrengthMpa !== null ? (
<div>
<span className="tabular-nums font-bold text-slate-800">
                              {`${test.sevenDayStrengthMpa.toFixed(1)} MPa`}
</span>
<span className="text-[10px] text-slate-400 block tabular-nums">
                              {test.sevenDayBreakDate}
</span>
</div>
) : (
<span className="text-slate-400 text-[11px]">Pending break</span>
)}
</td>
<td className="p-3 whitespace-nowrap">
                        {test.twentyEightDayStrengthMpa !== null ? (
<div>
<span
                              className={`tabular-nums font-bold ${
                                isPass ? 'text-emerald-700' : 'text-rose-700'
}`}
                            >
                              {`${test.twentyEightDayStrengthMpa.toFixed(1)} MPa`}
</span>
<span className="text-[10px] text-slate-400 block tabular-nums">
                              {test.twentyEightDayBreakDate}
</span>
</div>
) : (
<div>
<span className="text-amber-700 font-medium text-[11px]">
                              Scheduled
</span>
<span className="text-[10px] text-slate-400 block tabular-nums">
                              {test.twentyEightDayBreakDate}
</span>
</div>
)}
</td>

                      {/* Compressive strength gauge */}
<td className="p-3 min-w-[180px]">
<div className="space-y-1">
<div className="flex justify-between items-center text-[10px] tabular-nums">
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
                              style={{ width: `${Math.min(100, ratio)}%`}}
                            />
</div>
<div className="text-[10px] text-right tabular-nums text-slate-500">
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
